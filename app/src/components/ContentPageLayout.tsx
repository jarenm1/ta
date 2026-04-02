import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AppAgentSidebar from './AppAgentSidebar';

type ContentSection = {
  id: string;
  title: string;
};

type ContentPageLayoutProps = {
  children: ReactNode;
  compactHeader?: boolean;
  description?: string;
  hideHeader?: boolean;
  sections: ContentSection[];
  showHeaderDivider?: boolean;
  title: string;
};

function scrollToSection(sectionId: string, behavior: ScrollBehavior) {
  const targetElement = document.getElementById(sectionId);

  if (!targetElement) {
    return;
  }

  window.requestAnimationFrame(() => {
    targetElement.scrollIntoView({ behavior, block: 'start' });
  });
}

export default function ContentPageLayout({
  children,
  compactHeader = false,
  description,
  hideHeader = false,
  sections,
  showHeaderDivider = true,
  title,
}: ContentPageLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeSectionId, setActiveSectionId] = useState(sections[0]?.id ?? '');

  const sectionIds = useMemo(() => sections.map((section) => section.id), [sections]);

  useEffect(() => {
    setActiveSectionId(sections[0]?.id ?? '');
  }, [sections]);

  useEffect(() => {
    if (!sections.length) {
      return;
    }

    const syncActiveSection = () => {
      const nextSectionId = sections.reduce((currentSectionId, section) => {
        const element = document.getElementById(section.id);

        if (!element) {
          return currentSectionId;
        }

        return element.getBoundingClientRect().top <= 160 ? section.id : currentSectionId;
      }, sections[0].id);

      setActiveSectionId(nextSectionId);
    };

    syncActiveSection();
    window.addEventListener('scroll', syncActiveSection, { passive: true });

    return () => {
      window.removeEventListener('scroll', syncActiveSection);
    };
  }, [sections]);

  useEffect(() => {
    const sectionId = location.hash.replace(/^#/, '');

    if (!sectionIds.includes(sectionId)) {
      return;
    }

    setActiveSectionId(sectionId);
    scrollToSection(sectionId, 'smooth');
  }, [location.hash, sectionIds]);

  const handleSectionJump = (sectionId: string) => {
    setActiveSectionId(sectionId);
    scrollToSection(sectionId, 'smooth');
    navigate({ hash: `#${sectionId}` }, { replace: true });
  };

  return (
    <main className="h-full overflow-hidden bg-neutral-100 px-4 py-3 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 sm:px-6 sm:py-4">
      <div className="mx-auto flex h-full max-w-[110rem] flex-col">
        <div className="mt-2 grid min-h-0 flex-1 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-lg shadow-neutral-200/50 dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-neutral-900/50 sm:mt-4 xl:grid-cols-[minmax(12rem,1fr)_minmax(0,48rem)_minmax(16rem,1fr)]">
          {sections.length ? (
            <aside className="min-h-0 overflow-y-auto border-b border-neutral-200 bg-neutral-50/50 px-4 py-5 dark:border-neutral-800 dark:bg-neutral-900/20 xl:border-b-0 xl:border-r xl:px-4 xl:py-6">
              <nav aria-label="Table of contents">
                <ul className="flex flex-row flex-wrap gap-1 xl:flex-col xl:gap-1.5">
                  {sections.map((section) => {
                    const isActive = section.id === activeSectionId;

                    return (
                      <li key={section.id} className="flex-1 xl:flex-none">
                        <button
                          aria-current={isActive ? 'location' : undefined}
                          className={`group w-full rounded-lg px-3 py-2 text-left text-xs font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 sm:text-sm xl:px-3 xl:py-2.5 ${
                            isActive
                              ? 'bg-neutral-800 text-white shadow-sm dark:bg-neutral-200 dark:text-neutral-900'
                              : 'text-neutral-600 hover:bg-neutral-200/60 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800/60 dark:hover:text-neutral-100'
                          }`}
                          onClick={() => {
                            handleSectionJump(section.id);
                          }}
                          type="button"
                        >
                          <span className="block truncate">{section.title}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </aside>
          ) : (
            <div className="hidden xl:block" />
          )}

          <article className="relative min-h-0 min-w-0 overflow-y-auto bg-white dark:bg-neutral-900">
            <div className="px-5 py-6 sm:px-8 sm:py-10">
              {hideHeader ? null : (
                <header
                  className={[
                    showHeaderDivider ? 'border-b border-neutral-200 dark:border-neutral-800' : '',
                    compactHeader ? 'pb-6' : 'pb-8 sm:pb-12',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 sm:text-3xl">
                    {title}
                  </h1>
                  {description ? (
                    <p
                      className={`max-w-2xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-400 sm:text-base ${
                        compactHeader ? 'mt-3' : 'mt-4'
                      }`}
                    >
                      {description}
                    </p>
                  ) : null}
                </header>
              )}

              <div className="space-y-10 pt-8 sm:space-y-12 sm:pt-10">
                {children}
              </div>
            </div>
          </article>

          <aside className="min-h-0 overflow-hidden border-t border-neutral-200 bg-neutral-50/30 dark:border-neutral-800 dark:bg-neutral-900/20 xl:border-t-0 xl:border-l">
            <AppAgentSidebar
              className="h-full border-0 bg-transparent"
              contextLabel={title}
            />
          </aside>
        </div>
      </div>
    </main>
  );
}

export type { ContentSection };
