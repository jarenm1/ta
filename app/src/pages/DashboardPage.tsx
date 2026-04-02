import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { useCanvasData } from '../canvas/CanvasDataContext';
import ContentPageLayout, { type ContentSection } from '../components/ContentPageLayout';

function maskToken(token: string) {
  if (token.length <= 8) {
    return '•'.repeat(token.length);
  }

  return `${token.slice(0, 4)}${'•'.repeat(Math.max(token.length - 8, 4))}${token.slice(-4)}`;
}

const dashboardSections: ContentSection[] = [
  {
    id: 'dashboard-overview',
    title: 'Overview',
  },
  {
    id: 'canvas-session',
    title: 'Session',
  },
  {
    id: 'student-courses',
    title: 'Courses',
  },
  {
    id: 'next-steps',
    title: 'Next Steps',
  },
];

function DashboardPage() {
  const { session } = useAuth();
  const { courseItems, coursesError, coursesStatus } = useCanvasData();

  const savedAtLabel = session?.savedAt
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: 'long',
        timeStyle: 'short',
      }).format(new Date(session.savedAt))
    : 'Unknown';

  if (!session) {
    return null;
  }

  return (
    <ContentPageLayout
      description="This dashboard is now backed by the shared Canvas data layer. The next pages can reuse the same layout and route structure."
      sections={dashboardSections}
      title="Dashboard"
    >
      <section className="scroll-mt-16" id="dashboard-overview">
        <div className="border-b border-neutral-200/60 pb-8 dark:border-neutral-800/60">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">
            Overview
          </p>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Dashboard Overview
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-400 sm:text-base">
            The app now loads your Canvas course list through the Electron bridge so the course data
            can drive shared navigation and future course-specific pages.
          </p>
        </div>
      </section>

      <section className="scroll-mt-16" id="canvas-session">
        <div className="border-b border-neutral-200/60 pb-8 dark:border-neutral-800/60">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">
            Session
          </p>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Canvas Session
          </h2>
          
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Endpoint
              </dt>
              <dd className="mt-1.5 break-all text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {session.endpoint}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Token
              </dt>
              <dd className="mt-1.5 break-all font-mono text-sm text-neutral-900 dark:text-neutral-100">
                {maskToken(session.token)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Saved locally
              </dt>
              <dd className="mt-1.5 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {savedAtLabel}
              </dd>
            </div>
          </div>
        </div>
      </section>

      <section className="scroll-mt-16" id="student-courses">
        <div className="border-b border-neutral-200/60 pb-8 dark:border-neutral-800/60">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">
            Courses
          </p>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Student Courses
          </h2>

          {coursesStatus === 'loading' ? (
            <div className="mt-6 flex items-center gap-3 text-neutral-600 dark:text-neutral-400">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600 dark:border-neutral-700 dark:border-t-neutral-400" />
              <p className="text-sm">Loading your courses from Canvas…</p>
            </div>
          ) : null}

          {coursesStatus === 'error' ? (
            <div className="mt-6 rounded-lg border border-red-200 bg-red-50/50 p-4 dark:border-red-900/50 dark:bg-red-950/20">
              <p className="text-sm text-red-700 dark:text-red-400">{coursesError}</p>
            </div>
          ) : null}

          {coursesStatus === 'ready' ? (
            <>
              <p className="mt-4 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                Found <span className="font-semibold text-neutral-900 dark:text-neutral-100">{courseItems.length}</span> courses.
              </p>
              {courseItems.length === 0 ? (
                <div className="mt-6">
                  <EmptyState
                    description="No courses found in your Canvas account."
                    title="No courses available"
                  />
                </div>
              ) : (
                <ul className="mt-6 grid gap-2 sm:grid-cols-2">
                  {courseItems.map((course) => (
                    <li key={course.id}>
                      <Link
                        className="group flex items-center gap-3 rounded-lg border border-neutral-200/60 bg-neutral-50/40 px-4 py-3 text-sm font-medium text-neutral-900 transition-all duration-200 hover:border-neutral-300 hover:bg-white hover:shadow-sm dark:border-neutral-800/60 dark:bg-neutral-800/20 dark:text-neutral-100 dark:hover:border-neutral-700 dark:hover:bg-neutral-800/40"
                        to={course.path}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-200/60 text-xs font-bold text-neutral-600 dark:bg-neutral-800/60 dark:text-neutral-400">
                          {course.course_code?.slice(0, 2) || course.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="truncate">{course.name}</span>
                        <svg 
                          className="ml-auto h-4 w-4 shrink-0 text-neutral-400 transition-transform group-hover:translate-x-0.5 dark:text-neutral-500" 
                          fill="none" 
                          viewBox="0 0 24 24" 
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : null}
        </div>
      </section>

      <section className="scroll-mt-16" id="next-steps">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">
            Planning
          </p>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Next Steps
          </h2>
          
          <ul className="mt-6 space-y-4">
            <li className="flex items-start gap-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-200/80 text-xs font-bold text-neutral-700 dark:bg-neutral-800/80 dark:text-neutral-300">
                1
              </span>
              <span className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300 sm:text-base">
                Add course-specific endpoints for assignments, modules, and announcements.
              </span>
            </li>
            <li className="flex items-start gap-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-200/80 text-xs font-bold text-neutral-700 dark:bg-neutral-800/80 dark:text-neutral-300">
                2
              </span>
              <span className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300 sm:text-base">
                Reuse this layout shell for each course page so navigation stays consistent.
              </span>
            </li>
            <li className="flex items-start gap-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-200/80 text-xs font-bold text-neutral-700 dark:bg-neutral-800/80 dark:text-neutral-300">
                3
              </span>
              <span className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300 sm:text-base">
                Introduce background refresh and richer loading states once the first data views land.
              </span>
            </li>
          </ul>
        </div>
      </section>
    </ContentPageLayout>
  );
}

export default DashboardPage;
