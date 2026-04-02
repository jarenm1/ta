import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useCanvasData } from '../canvas/CanvasDataContext';
import StudyGuideAgentPanel from '../components/StudyGuideAgentPanel';
import StudyGuideMarkdownView, {
  extractStudyGuideHeadings,
  type StudyGuideHeading,
} from '../components/StudyGuideMarkdownView';
import { buildCourseStudyGuidePath } from '../lib/canvasApi';
import type { CourseStudyGuideList, StudyGuideMarkdownDocument } from '../lib/studyGuides';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';
type ViewStatus = 'idle' | 'loading' | 'ready' | 'error';

function CourseStudyGuidePage() {
  const navigate = useNavigate();
  const { courseSlug, guideId } = useParams();
  const { coursesStatus, getCourseBySlug } = useCanvasData();
  const course = courseSlug ? getCourseBySlug(courseSlug) : undefined;
  const [studyGuideDocument, setStudyGuideDocument] = useState<StudyGuideMarkdownDocument | null>(null);
  const [studyGuideList, setStudyGuideList] = useState<CourseStudyGuideList | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('idle');
  const [viewStatus, setViewStatus] = useState<ViewStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [viewErrorMessage, setViewErrorMessage] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const [activeHeadingId, setActiveHeadingId] = useState('');

  useEffect(() => {
    let isCancelled = false;

    async function loadStudyGuides() {
      if (!course) {
        return;
      }

      if (!window.canvasApi) {
        if (!isCancelled) {
          setLoadStatus('error');
          setErrorMessage('The desktop bridge is unavailable, so study guides cannot be loaded.');
        }
        return;
      }

      setLoadStatus('loading');
      setErrorMessage('');

      try {
        const nextStudyGuideList = await window.canvasApi.listStudyGuides(course.id);

        if (!isCancelled) {
          setStudyGuideList(nextStudyGuideList);
          setLoadStatus('ready');
        }
      } catch (error) {
        if (!isCancelled) {
          setLoadStatus('error');
          setErrorMessage(error instanceof Error ? error.message : 'Unable to load study guides.');
        }
      }
    }

    void loadStudyGuides();

    return () => {
      isCancelled = true;
    };
  }, [course]);

  const guides = useMemo(() => {
    return [...(studyGuideList?.studyGuides || [])].sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
  }, [studyGuideList]);

  const tableOfContents = useMemo<StudyGuideHeading[]>(() => {
    if (!studyGuideDocument) {
      return [];
    }

    return extractStudyGuideHeadings(studyGuideDocument.markdown).filter((heading) => heading.level <= 3);
  }, [studyGuideDocument]);

  useEffect(() => {
    if (!course || loadStatus !== 'ready' || guides.length === 0) {
      return;
    }

    if (!guideId || !guides.some((guide) => guide.id === guideId)) {
      navigate(buildCourseStudyGuidePath(course, guides[0].id), { replace: true });
    }
  }, [course, guideId, guides, loadStatus, navigate]);

  useEffect(() => {
    let isCancelled = false;

    async function loadStudyGuideDocument(selectedGuideId: string) {
      if (!course || !window.canvasApi) {
        return;
      }

      setViewStatus('loading');
      setViewErrorMessage('');

      try {
        const nextDocument = await window.canvasApi.getStudyGuideMarkdown(course.id, selectedGuideId);

        if (!isCancelled) {
          setStudyGuideDocument(nextDocument);
          setViewStatus('ready');
        }
      } catch (error) {
        if (!isCancelled) {
          setStudyGuideDocument(null);
          setViewStatus('error');
          setViewErrorMessage(
            error instanceof Error ? error.message : 'Unable to open the selected study guide.',
          );
        }
      }
    }

    if (!course || !guideId) {
      return () => {
        isCancelled = true;
      };
    }

    if (loadStatus === 'ready' && guides.length > 0 && !guides.some((guide) => guide.id === guideId)) {
      return () => {
        isCancelled = true;
      };
    }

    if (course && guideId) {
      void loadStudyGuideDocument(guideId);
    }

    return () => {
      isCancelled = true;
    };
  }, [course, guideId, guides, loadStatus]);

  useEffect(() => {
    setSelectedText('');
  }, [guideId]);

  useEffect(() => {
    if (tableOfContents.length === 0) {
      setActiveHeadingId('');
      return;
    }

    const syncActiveHeading = () => {
      const nextHeadingId = tableOfContents.reduce((currentHeadingId, heading) => {
        const element = document.getElementById(heading.id);

        if (!element) {
          return currentHeadingId;
        }

        return element.getBoundingClientRect().top <= 180 ? heading.id : currentHeadingId;
      }, tableOfContents[0].id);

      setActiveHeadingId(nextHeadingId);
    };

    syncActiveHeading();
    window.addEventListener('scroll', syncActiveHeading, { passive: true });

    return () => {
      window.removeEventListener('scroll', syncActiveHeading);
    };
  }, [tableOfContents]);

  if (coursesStatus === 'ready' && courseSlug && !course) {
    return <Navigate replace to="/" />;
  }

  if (!course) {
    return (
      <main className="bg-neutral-100 px-6 py-10 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
        <section className="border border-neutral-300 bg-white px-6 py-6 dark:border-neutral-800 dark:bg-neutral-900/60">
          <p className="text-base leading-7 text-neutral-700 dark:text-neutral-300">
            {coursesStatus === 'error'
              ? 'Unable to load this course because the Canvas course list failed to load.'
              : 'Loading study guides…'}
          </p>
        </section>
      </main>
    );
  }

  const handleHeadingJump = (headingId: string) => {
    setActiveHeadingId(headingId);
    const targetElement = document.getElementById(headingId);
    targetElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <main className="h-full overflow-hidden bg-neutral-100 px-6 py-4 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
      <div className="mx-auto flex h-full max-w-[110rem] flex-col">
        <div className="mt-4 grid min-h-0 flex-1 xl:grid-cols-[minmax(12rem,1fr)_minmax(0,48rem)_minmax(16rem,1fr)] rounded-lg overflow-hidden border border-neutral-300 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/80 shadow-sm">
          <aside className="min-h-0 overflow-y-auto px-4 py-5 bg-transparent">
            {errorMessage ? (
              <p className="text-sm leading-6 text-rose-700 dark:text-rose-300 mb-4">
                {errorMessage}
              </p>
            ) : null}

            <nav aria-label="Study guide table of contents">
              {tableOfContents.length === 0 ? (
                <p className="text-sm leading-6 text-neutral-500 dark:text-neutral-400">
                  Open a guide to populate the section outline.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {tableOfContents.map((heading) => {
                    const isActive = heading.id === activeHeadingId;

                    return (
                      <li key={heading.id}>
                        <button
                          className={[
                            'group w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400',
                            heading.level === 3 ? 'pl-6' : heading.level === 2 ? 'pl-4' : 'pl-3',
                            isActive
                              ? 'bg-neutral-200/70 text-neutral-900 dark:bg-neutral-800/70 dark:text-neutral-100'
                              : 'text-neutral-600 hover:bg-neutral-200/40 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800/40 dark:hover:text-neutral-100',
                          ].join(' ')}
                          onClick={() => {
                            handleHeadingJump(heading.id);
                          }}
                          type="button"
                        >
                          {heading.text}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </nav>
          </aside>

          <section className="min-h-0 min-w-0 overflow-y-auto bg-neutral-50/50 dark:bg-neutral-900/30 border-l border-neutral-300 dark:border-neutral-800">
            <div className="px-5 py-5">
              <header className="mb-6 border-b border-neutral-300 pb-5 dark:border-neutral-800">
                <h2 className="text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
                  {studyGuideDocument?.guide.title || 'Study guide'}
                </h2>
              </header>

              {viewStatus === 'loading' ? (
                <div className="border border-neutral-300 bg-neutral-50 px-5 py-6 dark:border-neutral-800 dark:bg-neutral-900/40">
                  <p className="text-base leading-7 text-neutral-700 dark:text-neutral-300">
                    Opening study guide…
                  </p>
                </div>
              ) : null}

              {viewErrorMessage ? (
                <div className="border border-neutral-300 bg-neutral-50 px-5 py-6 dark:border-neutral-800 dark:bg-neutral-900/40">
                  <p className="text-base leading-7 text-rose-700 dark:text-rose-300">{viewErrorMessage}</p>
                </div>
              ) : null}

              {viewStatus === 'ready' && studyGuideDocument ? (
                <StudyGuideMarkdownView
                  document={studyGuideDocument}
                  onSelectionChange={setSelectedText}
                />
              ) : null}
            </div>
          </section>

          <aside className="min-h-0 overflow-hidden bg-neutral-50/50 dark:bg-neutral-900/30 border-l border-neutral-300 dark:border-neutral-800">
            <StudyGuideAgentPanel
              className="h-full border-0 bg-transparent"
              courseName={course.name}
              guideTitle={studyGuideDocument?.guide.title}
              selectedText={selectedText}
            />
          </aside>
        </div>
      </div>
    </main>
  );
}

export default CourseStudyGuidePage;
