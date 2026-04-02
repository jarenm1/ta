import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from '../auth/AuthContext';
import { buildCoursePath, buildCourseSlug, type CanvasAssignment, type CanvasCourse } from '../lib/canvasApi';

type CanvasCourseNavItem = CanvasCourse & {
  path: string;
  slug: string;
};

type CanvasDataStatus = 'idle' | 'loading' | 'ready' | 'error';

type CanvasDataContextValue = {
  assignmentErrors: Record<number, string>;
  assignmentStatusByCourseId: Record<number, CanvasDataStatus>;
  courseItems: CanvasCourseNavItem[];
  coursesError: string;
  coursesStatus: CanvasDataStatus;
  getAssignmentsForCourse: (courseId: number) => CanvasAssignment[];
  getCourseBySlug: (slug: string) => CanvasCourseNavItem | undefined;
  loadAssignmentsForCourse: (courseId: number) => Promise<void>;
  refreshCourses: () => Promise<void>;
};

const CanvasDataContext = createContext<CanvasDataContextValue | undefined>(undefined);

function CanvasDataProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const [assignmentErrors, setAssignmentErrors] = useState<Record<number, string>>({});
  const [assignmentStatusByCourseId, setAssignmentStatusByCourseId] = useState<Record<number, CanvasDataStatus>>({});
  const [assignmentsByCourseId, setAssignmentsByCourseId] = useState<Record<number, CanvasAssignment[]>>({});
  const [courses, setCourses] = useState<CanvasCourse[]>([]);
  const [coursesStatus, setCoursesStatus] = useState<CanvasDataStatus>('idle');
  const [coursesError, setCoursesError] = useState('');

  const refreshCourses = useCallback(async () => {
    if (!session) {
      setAssignmentsByCourseId({});
      setAssignmentErrors({});
      setAssignmentStatusByCourseId({});
      setCourses([]);
      setCoursesStatus('idle');
      setCoursesError('');
      return;
    }

    if (!window.canvasApi) {
      setAssignmentsByCourseId({});
      setAssignmentErrors({});
      setAssignmentStatusByCourseId({});
      setCourses([]);
      setCoursesStatus('error');
      setCoursesError('Canvas API bridge is unavailable in the renderer process.');
      return;
    }

    setCoursesStatus('loading');
    setCoursesError('');
    setAssignmentsByCourseId({});
    setAssignmentErrors({});
    setAssignmentStatusByCourseId({});

    try {
      const nextCourses = await window.canvasApi.listCourses(session);

      setCourses(nextCourses);
      setCoursesStatus('ready');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load Canvas courses.';

      setCourses([]);
      setCoursesStatus('error');
      setCoursesError(message);
    }
  }, [session]);

  const loadAssignmentsForCourse = useCallback(
    async (courseId: number) => {
      if (!session) {
        return;
      }

      if (!window.canvasApi) {
        setAssignmentStatusByCourseId((currentStatus) => ({
          ...currentStatus,
          [courseId]: 'error',
        }));
        setAssignmentErrors((currentErrors) => ({
          ...currentErrors,
          [courseId]: 'Canvas API bridge is unavailable in the renderer process.',
        }));
        return;
      }

      setAssignmentStatusByCourseId((currentStatus) => ({
        ...currentStatus,
        [courseId]: 'loading',
      }));
      setAssignmentErrors((currentErrors) => ({
        ...currentErrors,
        [courseId]: '',
      }));

      try {
        const nextAssignments = await window.canvasApi.listCourseAssignments(session, courseId);

        setAssignmentsByCourseId((currentAssignments) => ({
          ...currentAssignments,
          [courseId]: nextAssignments,
        }));
        setAssignmentStatusByCourseId((currentStatus) => ({
          ...currentStatus,
          [courseId]: 'ready',
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load assignments.';

        setAssignmentsByCourseId((currentAssignments) => ({
          ...currentAssignments,
          [courseId]: [],
        }));
        setAssignmentStatusByCourseId((currentStatus) => ({
          ...currentStatus,
          [courseId]: 'error',
        }));
        setAssignmentErrors((currentErrors) => ({
          ...currentErrors,
          [courseId]: message,
        }));
      }
    },
    [session],
  );

  useEffect(() => {
    void refreshCourses();
  }, [refreshCourses]);

  const courseItems = useMemo<CanvasCourseNavItem[]>(() => {
    return courses
      .map((course) => ({
        ...course,
        path: buildCoursePath(course),
        slug: buildCourseSlug(course),
      }))
      .sort((leftCourse, rightCourse) => leftCourse.name.localeCompare(rightCourse.name));
  }, [courses]);

  const value = useMemo<CanvasDataContextValue>(
    () => ({
      assignmentErrors,
      assignmentStatusByCourseId,
      courseItems,
      coursesError,
      coursesStatus,
      getAssignmentsForCourse: (courseId) => assignmentsByCourseId[courseId] ?? [],
      getCourseBySlug: (slug) => courseItems.find((course) => course.slug === slug),
      loadAssignmentsForCourse,
      refreshCourses,
    }),
    [
      assignmentErrors,
      assignmentStatusByCourseId,
      assignmentsByCourseId,
      courseItems,
      coursesError,
      coursesStatus,
      loadAssignmentsForCourse,
      refreshCourses,
    ],
  );

  return <CanvasDataContext.Provider value={value}>{children}</CanvasDataContext.Provider>;
}

function useCanvasData() {
  const context = useContext(CanvasDataContext);

  if (!context) {
    throw new Error('useCanvasData must be used within a CanvasDataProvider');
  }

  return context;
}

export { CanvasDataProvider, useCanvasData };
export type { CanvasCourseNavItem, CanvasDataStatus };
