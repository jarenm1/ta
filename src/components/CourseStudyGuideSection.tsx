import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { buildCourseStudyGuidePath } from '../lib/canvasApi';
import { useCanvasData } from '../canvas/CanvasDataContext';
import { EmptyState } from './ui';
import type { CourseStudyGuideList, StudyGuideRecord } from '../lib/studyGuides';

type CourseStudyGuideSectionProps = {
  courseId: number;
};

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function CourseStudyGuideSection({ courseId }: CourseStudyGuideSectionProps) {
  const { courseSlug } = useParams();
  const { getCourseBySlug } = useCanvasData();
  const course = courseSlug ? getCourseBySlug(courseSlug) : undefined;
  const [studyGuideList, setStudyGuideList] = useState<CourseStudyGuideList | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isCancelled = false;

    async function loadStudyGuides() {
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
        const nextStudyGuideList = await window.canvasApi.listStudyGuides(courseId);

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
  }, [courseId]);

  const guides = useMemo(() => {
    return [...(studyGuideList?.studyGuides || [])].sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
  }, [studyGuideList]);

  const summaryLabel = useMemo(() => {
    return `${guides.length} saved guide${guides.length === 1 ? '' : 's'}`;
  }, [guides]);

  return (
    <section className="scroll-mt-16" id="study-guide">
      <div className="border-b border-neutral-200 dark:border-neutral-800 pb-8">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
            Study Guides
          </p>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Saved Guides</h2>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            Open any saved study guide in its own page. Guides are listed with the newest first.
          </p>
        </div>

        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">{summaryLabel}</p>

        {loadStatus === 'loading' ? (
          <p className="text-base leading-7 text-neutral-600 dark:text-neutral-400">
            Loading saved study guides…
          </p>
        ) : null}

        {errorMessage ? (
          <p className="text-base leading-7 text-red-600 dark:text-red-400">{errorMessage}</p>
        ) : null}

        {loadStatus === 'ready' && guides.length === 0 ? (
          <EmptyState
            description="Create one from the MCP agent and it will appear here."
            title="No study guides saved yet"
          />
        ) : null}

        {guides.length > 0 ? (
          <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {guides.map((guide: StudyGuideRecord) => (
              <div
                className="group flex flex-col gap-3 py-5 transition-colors duration-200 last:border-b-0 hover:bg-neutral-50/50 dark:hover:bg-neutral-900/20 md:flex-row md:items-start md:justify-between"
                key={guide.id}
              >
                <div>
                  <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                    {guide.title}
                  </h3>
                  <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                    Saved {formatDate(guide.createdAt)}
                  </p>
                </div>

                {course ? (
                  <Link
                    className="inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition-all duration-200 hover:border-neutral-400 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
                    to={buildCourseStudyGuidePath(course, guide.id)}
                  >
                    Open guide
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
