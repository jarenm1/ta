import type { CanvasAssignment } from '../lib/canvasApi';
import type { CanvasCourseNavItem } from '../canvas/CanvasDataContext';

type CourseStudentSummarySectionProps = {
  assignments: CanvasAssignment[];
  course: CanvasCourseNavItem;
};

function formatDateTime(value?: string | null) {
  if (!value) {
    return 'Unavailable';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatPercent(value?: number | null) {
  if (value === null || value === undefined) {
    return 'Unavailable';
  }

  return `${Math.round(value * 10) / 10}%`;
}

function getStudentEnrollment(course: CanvasCourseNavItem) {
  return course.enrollments?.find((enrollment) => enrollment.type?.includes('Student')) ?? course.enrollments?.[0];
}

function getNextAssignment(assignments: CanvasAssignment[]) {
  const now = Date.now();

  const upcomingAssignment = assignments
    .filter((assignment) => assignment.due_at && new Date(assignment.due_at).getTime() >= now)
    .sort((leftAssignment, rightAssignment) => {
      return new Date(leftAssignment.due_at ?? 0).getTime() - new Date(rightAssignment.due_at ?? 0).getTime();
    })[0];

  if (upcomingAssignment) {
    return upcomingAssignment;
  }

  return [...assignments]
    .filter((assignment) => assignment.due_at)
    .sort((leftAssignment, rightAssignment) => {
      return new Date(rightAssignment.due_at ?? 0).getTime() - new Date(leftAssignment.due_at ?? 0).getTime();
    })[0];
}

function getOverdueCount(assignments: CanvasAssignment[]) {
  const now = Date.now();

  return assignments.filter((assignment) => {
    const dueAt = assignment.due_at ? new Date(assignment.due_at).getTime() : null;

    if (!dueAt || dueAt >= now) {
      return false;
    }

    if (assignment.submission?.excused) {
      return false;
    }

    if (assignment.submission?.missing) {
      return true;
    }

    return !assignment.submission?.submitted_at;
  }).length;
}

function getSubmittedCount(assignments: CanvasAssignment[]) {
  return assignments.filter((assignment) => Boolean(assignment.submission?.submitted_at)).length;
}

function StatItem({ 
  label, 
  value, 
  subvalue 
}: { 
  label: string; 
  value: React.ReactNode; 
  subvalue?: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-1.5 text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
        {value}
      </p>
      {subvalue && (
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{subvalue}</p>
      )}
    </div>
  );
}

export default function CourseStudentSummarySection({ assignments, course }: CourseStudentSummarySectionProps) {
  const enrollment = getStudentEnrollment(course);
  const nextAssignment = getNextAssignment(assignments);
  const progressTotal = course.course_progress?.requirement_count ?? 0;
  const progressComplete = course.course_progress?.requirement_completed_count ?? 0;

  return (
    <section className="scroll-mt-16" id="student-summary">
      <div className="border-b border-neutral-200/60 pb-8 dark:border-neutral-800/60">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">
          Progress
        </p>
        <h2 className="mt-2 text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
          Student Summary
        </h2>

        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatItem
            label="Current grade"
            subvalue={formatPercent(enrollment?.computed_current_score ?? enrollment?.current_score)}
            value={enrollment?.computed_current_grade || enrollment?.current_grade || 'Unavailable'}
          />

          <StatItem
            label="Next assignment"
            subvalue={`Due ${formatDateTime(nextAssignment?.due_at)}`}
            value={nextAssignment?.name || 'Unavailable'}
          />

          <StatItem
            label="Assignments submitted"
            subvalue={`Out of ${assignments.length} loaded assignments`}
            value={getSubmittedCount(assignments)}
          />

          <StatItem
            label="Needs attention"
            subvalue={progressTotal > 0
              ? `${progressComplete} of ${progressTotal} requirements`
              : 'Progress unavailable'}
            value={getOverdueCount(assignments)}
          />
        </div>
      </div>
    </section>
  );
}
