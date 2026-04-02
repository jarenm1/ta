import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useCanvasData } from '../canvas/CanvasDataContext';
import CourseAssignmentsSection from '../components/CourseAssignmentsSection';
import CourseCodingWorkspaceSection from '../components/CourseCodingWorkspaceSection';
import CourseDetailsBlock from '../components/CourseDetailsBlock';
import CourseKnowledgeBaseSection from '../components/CourseKnowledgeBaseSection';
import CourseStudyGuideSection from '../components/CourseStudyGuideSection';
import CourseStudentSummarySection from '../components/CourseStudentSummarySection';
import ContentPageLayout, { type ContentSection } from '../components/ContentPageLayout';
import { isCodingWorkspaceEnabled } from '../lib/courseFeatures';

function buildCourseSections(showCodingWorkspace: boolean): ContentSection[] {
  return [
    {
      id: 'course-details',
      title: 'Course Details',
    },
    {
      id: 'student-summary',
      title: 'Student Summary',
    },
    {
      id: 'course-knowledge-base',
      title: 'Knowledge Base',
    },
    {
      id: 'study-guide',
      title: 'Study Guides',
    },
    ...(showCodingWorkspace
      ? [
          {
            id: 'coding-workspace',
            title: 'Coding Workspace',
          },
        ]
      : []),
    {
      id: 'assignments',
      title: 'Assignments',
    },
  ];
}

function CoursePage() {
  const { courseSlug } = useParams();
  const {
    assignmentErrors,
    assignmentStatusByCourseId,
    coursesStatus,
    getAssignmentsForCourse,
    getCourseBySlug,
    loadAssignmentsForCourse,
  } = useCanvasData();
  const course = courseSlug ? getCourseBySlug(courseSlug) : undefined;
  const showCodingWorkspace = course ? isCodingWorkspaceEnabled(course) : false;
  const courseSections = buildCourseSections(showCodingWorkspace);
  const assignments = course ? getAssignmentsForCourse(course.id) : [];
  const assignmentStatus = course ? assignmentStatusByCourseId[course.id] ?? 'idle' : 'idle';
  const assignmentError = course ? assignmentErrors[course.id] : '';

  useEffect(() => {
    if (!course || assignmentStatus === 'loading' || assignmentStatus === 'ready') {
      return;
    }

    void loadAssignmentsForCourse(course.id);
  }, [assignmentStatus, course, loadAssignmentsForCourse]);

  if (coursesStatus === 'ready' && courseSlug && !course) {
    return <Navigate replace to="/" />;
  }

  if (!course) {
    return (
      <ContentPageLayout
        description="We are still resolving the Canvas course list for this route."
        hideHeader
        sections={courseSections}
        title="Course"
      >
        <section className="py-10">
          <p className="text-base leading-7 text-neutral-700 dark:text-neutral-300">
            {coursesStatus === 'error'
              ? 'Unable to load this course because the Canvas course list failed to load.'
              : 'Loading course details…'}
          </p>
        </section>
      </ContentPageLayout>
    );
  }

  return (
    <ContentPageLayout hideHeader sections={courseSections} title={course.name}>
      <CourseDetailsBlock course={course} />
      <CourseKnowledgeBaseSection courseId={course.id} />
      <CourseStudyGuideSection courseId={course.id} />
      <CourseCodingWorkspaceSection course={course} />

      {assignmentStatus === 'error' ? (
        <section className="pt-8">
          <p className="text-base leading-7 text-rose-700 dark:text-rose-300">{assignmentError}</p>
        </section>
      ) : null}

      {assignmentStatus === 'loading' ? (
        <section className="pt-8">
          <p className="text-base leading-7 text-neutral-700 dark:text-neutral-300">
            Loading student summary and assignments…
          </p>
        </section>
      ) : null}

      {assignmentStatus === 'ready' ? (
        <>
          <CourseStudentSummarySection assignments={assignments} course={course} />
          <CourseAssignmentsSection assignments={assignments} />
        </>
      ) : null}
    </ContentPageLayout>
  );
}

export default CoursePage;
