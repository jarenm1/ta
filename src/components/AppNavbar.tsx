import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Button } from './ui';
import { useAuth } from '../auth/AuthContext';
import { useCanvasData } from '../canvas/CanvasDataContext';

export default function AppNavbar() {
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();
  const { courseItems, coursesError, coursesStatus } = useCanvasData();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const navLinkClasses = ({ isActive }: { isActive: boolean }) => [
    'rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400',
    isActive
      ? 'bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
      : 'text-neutral-600 hover:bg-neutral-200/50 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800/50 dark:hover:text-neutral-100',
  ].join(' ');

  return (
    <header className="z-50 shrink-0 border-b border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex min-h-16 items-center justify-between gap-4 py-3">
          <Link
            className="shrink-0 rounded-md text-sm font-semibold tracking-[0.2em] text-neutral-900 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:text-neutral-100"
            to={isAuthenticated ? '/' : '/login'}
          >
            TEACHING ASSISTANT
          </Link>

          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <Link
                  className="rounded-md p-2 text-neutral-600 transition-colors hover:bg-neutral-200/50 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:text-neutral-400 dark:hover:bg-neutral-800/50 dark:hover:text-neutral-100"
                  to="/settings"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </Link>
                <Button onClick={handleLogout} size="sm" variant="secondary">
                  Log out
                </Button>
              </>
            ) : null}
          </div>
        </div>

        {isAuthenticated ? (
          <div className="flex items-center gap-1 overflow-x-auto pb-3 text-sm whitespace-nowrap">
            <NavLink className={navLinkClasses} end to="/">
              Dashboard
            </NavLink>

            <NavLink className={navLinkClasses} to="/settings">
              Settings
            </NavLink>

            {coursesStatus === 'loading' ? (
              <span className="px-3 py-1.5 text-sm text-neutral-500 dark:text-neutral-400">
                Loading courses…
              </span>
            ) : null}

            {coursesStatus === 'error' ? (
              <span className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400">
                {coursesError}
              </span>
            ) : null}

            {courseItems.map((course) => (
              <NavLink className={navLinkClasses} key={course.id} to={course.path}>
                {course.course_code || course.name}
              </NavLink>
            ))}
          </div>
        ) : null}
      </div>
    </header>
  );
}
