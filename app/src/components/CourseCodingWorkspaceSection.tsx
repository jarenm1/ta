import { Link } from 'react-router-dom';
import { Badge } from './ui';
import type { CanvasCourse } from '../lib/canvasApi';
import { buildCourseWorkspacePath } from '../lib/canvasApi';
import { getCodingWorkspaceConfig } from '../lib/courseFeatures';

type CourseCodingWorkspaceSectionProps = {
  course: CanvasCourse;
};

export default function CourseCodingWorkspaceSection({ course }: CourseCodingWorkspaceSectionProps) {
  const codingWorkspace = getCodingWorkspaceConfig(course);

  if (!codingWorkspace) {
    return null;
  }

  return (
    <section className="scroll-mt-16" id="coding-workspace">
      <div className="border-b border-neutral-200 dark:border-neutral-800 pb-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex-1 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
              Coding Workspace
            </p>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              {codingWorkspace.title}
            </h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              Open the CS workspace for a LeetCode-style layout with the problem on the left, Monaco in
              the center, and test cases plus output on the right.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge>{codingWorkspace.topic}</Badge>
              <Badge>{codingWorkspace.language.toUpperCase()}</Badge>
              <Badge>{codingWorkspace.difficulty}</Badge>
            </div>
          </div>

          <Link
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-all duration-200 hover:border-neutral-400 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
            to={buildCourseWorkspacePath(course)}
          >
            Open workspace
          </Link>
        </div>
      </div>
    </section>
  );
}
