import { useMemo, useState } from 'react';
import { Button, EmptyState } from './ui';
import type { CanvasAssignment } from '../lib/canvasApi';

type CourseAssignmentsSectionProps = {
  assignments: CanvasAssignment[];
};

function formatDueDate(value?: string | null) {
  if (!value) {
    return 'No due date';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getAssignmentStatus(assignment: CanvasAssignment) {
  if (assignment.submission?.excused) {
    return 'Excused';
  }

  if (assignment.submission?.missing) {
    return 'Missing';
  }

  if (assignment.submission?.submitted_at) {
    return assignment.submission?.grade ? `Graded: ${assignment.submission.grade}` : 'Submitted';
  }

  if (assignment.submission?.late) {
    return 'Late';
  }

  return 'Not submitted';
}

export default function CourseAssignmentsSection({ assignments }: CourseAssignmentsSectionProps) {
  const [showAllAssignments, setShowAllAssignments] = useState(false);

  const sortedAssignments = useMemo(() => {
    return [...assignments].sort((leftAssignment, rightAssignment) => {
      if (!leftAssignment.due_at) {
        return 1;
      }

      if (!rightAssignment.due_at) {
        return -1;
      }

      return new Date(leftAssignment.due_at).getTime() - new Date(rightAssignment.due_at).getTime();
    });
  }, [assignments]);

  const visibleAssignments = showAllAssignments ? sortedAssignments : sortedAssignments.slice(0, 5);

  return (
    <section className="scroll-mt-16" id="assignments">
      <div className="border-b border-neutral-200 dark:border-neutral-800 pb-8">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
              Assignments
            </p>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Course Work</h2>
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
              Keep this list focused on what matters for studying: due dates, submission state, and points.
            </p>
          </div>

          {sortedAssignments.length > 5 ? (
            <Button
              onClick={() => {
                setShowAllAssignments((currentValue) => !currentValue);
              }}
              size="sm"
              variant="secondary"
            >
              {showAllAssignments ? 'Show fewer' : 'See all'}
            </Button>
          ) : null}
        </div>

        <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {visibleAssignments.map((assignment) => (
            <div
              className="group flex flex-col gap-3 py-5 transition-colors duration-200 last:border-b-0 hover:bg-neutral-50/50 dark:hover:bg-neutral-900/20 md:flex-row md:items-start md:justify-between"
              key={assignment.id}
            >
              <div className="flex-1">
                <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                  {assignment.name}
                </h3>
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  Due {formatDueDate(assignment.due_at)}
                </p>
              </div>

              <div className="text-left md:text-right">
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {getAssignmentStatus(assignment)}
                </p>
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  {assignment.points_possible !== null && assignment.points_possible !== undefined
                    ? `${assignment.points_possible} points`
                    : 'Points unavailable'}
                </p>
              </div>
            </div>
          ))}

          {!visibleAssignments.length ? (
            <div className="py-8">
              <EmptyState
                description="No assignments were returned for this course."
                title="No assignments"
              />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
