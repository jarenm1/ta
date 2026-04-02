import type { CanvasCourseNavItem } from '../canvas/CanvasDataContext';

type CourseDetailsBlockProps = {
  course: CanvasCourseNavItem;
};

export default function CourseDetailsBlock({ course }: CourseDetailsBlockProps) {
  return (
    <section className="scroll-mt-16" id="course-details">
      <div className="border-b border-neutral-200/60 pb-8 dark:border-neutral-800/60">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">
          Overview
        </p>
        <h2 className="mt-2 text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
          Course Details
        </h2>
        <div className="mt-6 grid gap-6 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Course name
            </dt>
            <dd className="mt-1.5 text-base font-semibold text-neutral-900 dark:text-neutral-100">
              {course.name}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Course code
            </dt>
            <dd className="mt-1.5 text-base font-semibold text-neutral-900 dark:text-neutral-100">
              {course.course_code || 'Unavailable'}
            </dd>
          </div>
        </div>
      </div>
    </section>
  );
}
