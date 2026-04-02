import type { CanvasSession } from './canvasSession';
import type {
  CodingProblemDocument,
  CourseCodingProblemList,
} from './codingProblems';
import type {
  CourseKnowledgeBase,
  CourseMaterialRecord,
  UploadCourseMaterialsResult,
} from './courseMaterials';
import type { CourseStudyGuideList, StudyGuideMarkdownDocument } from './studyGuides';

type CanvasTerm = {
  id: number;
  name: string;
  start_at?: string | null;
  end_at?: string | null;
};

type CanvasCourse = {
  id: number;
  name: string;
  course_code?: string | null;
  original_name?: string | null;
  workflow_state?: string | null;
  default_view?: string | null;
  enrollment_term_id?: number | null;
  start_at?: string | null;
  end_at?: string | null;
  course_progress?: CanvasCourseProgress | null;
  enrollments?: CanvasEnrollment[];
  term?: CanvasTerm | null;
};

type CanvasCourseProgress = {
  completed_at?: string | null;
  next_requirement_url?: string | null;
  requirement_count?: number | null;
  requirement_completed_count?: number | null;
};

type CanvasEnrollment = {
  computed_current_grade?: string | null;
  computed_current_score?: number | null;
  computed_final_grade?: string | null;
  computed_final_score?: number | null;
  current_grade?: string | null;
  current_score?: number | null;
  final_grade?: string | null;
  final_score?: number | null;
  enrollment_state?: string | null;
  type?: string | null;
};

type CanvasAssignmentSubmission = {
  attempt?: number | null;
  excused?: boolean | null;
  grade?: string | null;
  late?: boolean | null;
  missing?: boolean | null;
  score?: number | null;
  submitted_at?: string | null;
  workflow_state?: string | null;
};

type CanvasAssignment = {
  id: number;
  name: string;
  description?: string | null;
  due_at?: string | null;
  html_url?: string | null;
  points_possible?: number | null;
  published?: boolean | null;
  unlock_at?: string | null;
  submission?: CanvasAssignmentSubmission | null;
};

type CanvasApiErrorPayload = {
  message: string;
  status?: number;
};

type CodingWorkspaceRunRequest = {
  compileTimeoutMs?: number;
  language: 'cpp' | 'mips';
  runTimeoutMs?: number;
  sourceCode: string;
  stdin?: string;
};

type CodingWorkspaceRunResult = {
  durationMs: number;
  exitCode: number | null;
  ok: boolean;
  phase: 'compile' | 'run';
  stderr: string;
  stdout: string;
  timedOut: boolean;
};

type AgentChatContext = {
  courseId?: number;
  courseName?: string;
  guideTitle?: string;
  pageKind?: 'course' | 'dashboard' | 'study-guide' | 'workspace' | 'other';
  pagePath?: string;
  pageTitle?: string;
  selectedText?: string;
};

type AgentAuthStatus = {
  available: boolean;
  model: string;
  source: 'codex_session' | 'env' | null;
};

type ToolParameterType = 'string' | 'number' | 'boolean' | 'array' | 'object';

type ToolParameter = {
  name: string;
  type: ToolParameterType;
  description: string;
  required?: boolean;
  items?: ToolParameter;
  properties?: Record<string, ToolParameter>;
};

type ToolDefinition = {
  name: string;
  description: string;
  parameters: ToolParameter[];
};

type ToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

type ToolResult = {
  toolCallId: string;
  name: string;
  result: unknown;
  error?: string;
};

type AgentChatRequest = {
  apiKey?: string | null;
  context?: AgentChatContext;
  history?: Array<{
    role: 'assistant' | 'user';
    text: string;
  }>;
  message: string;
  model?: string | null;
  previousResponseId?: string | null;
  provider?: string | null;
  stream?: boolean;
  tools?: ToolDefinition[];
};

type AgentChatResponse = {
  message: string;
  model: string;
  responseId: string | null;
  retryCount?: number;
  source: 'codex_session' | 'env';
  thinking?: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  done?: boolean;
};

type AgentChatStreamEvent = {
  type: 'thinking' | 'content' | 'tool_call' | 'tool_result' | 'error' | 'done';
  data: string | ToolCall | ToolResult | { error: string };
  messageId?: string;
};

type CanvasApiBridge = {
  bulkDownloadFiles: (courseId: number, fileIds: string[], options?: {
    maxTextChars?: number;
    maxFileSize?: number;
    concurrency?: number;
  }) => Promise<{
    downloaded: number;
    failed: number;
    materials: Array<{
      id: string;
      displayName: string;
      sizeBytes: number;
      textExtracted: boolean;
      textLength: number;
      extractionStatus: string;
    }>;
    errors: Array<{ fileId: string; fileName: string; error: string }>;
  }>;
  getAgentAuthStatus: () => Promise<AgentAuthStatus>;
  sendAgentChatMessage: (request: AgentChatRequest) => Promise<AgentChatResponse>;
  onAgentChatStream: (callback: (event: AgentChatStreamEvent) => void) => () => void;
  listCourses: (session: CanvasSession) => Promise<CanvasCourse[]>;
  listCourseAssignments: (session: CanvasSession, courseId: number) => Promise<CanvasAssignment[]>;
  listCourseMaterials: (courseId: number) => Promise<CourseKnowledgeBase>;
  listCodingProblems: (courseId: number) => Promise<CourseCodingProblemList>;
  getCodingProblem: (courseId: number, problemId: string) => Promise<CodingProblemDocument>;
  listStudyGuides: (courseId: number) => Promise<CourseStudyGuideList>;
  getStudyGuideMarkdown: (courseId: number, guideId: string) => Promise<StudyGuideMarkdownDocument>;
  runCodingWorkspace: (request: CodingWorkspaceRunRequest) => Promise<CodingWorkspaceRunResult>;
  uploadCourseMaterials: (courseId: number, filePaths?: string[]) => Promise<UploadCourseMaterialsResult>;
  removeCourseMaterial: (courseId: number, materialId: string) => Promise<CourseKnowledgeBase>;
  loadSharedSession: () => Promise<CanvasSession | null>;
  saveSharedSession: (session: CanvasSession) => Promise<CanvasSession>;
  clearSharedSession: () => Promise<void>;
};

const canvasCoursesPath =
  '/api/v1/courses?per_page=100&enrollment_state=active&state[]=available&state[]=completed&include[]=term&include[]=course_progress&include[]=total_scores&include[]=current_grading_period_scores';

function buildCourseAssignmentsPath(courseId: number) {
  return `/api/v1/courses/${courseId}/assignments?per_page=100&order_by=due_at&include[]=submission`;
}

function normalizeCanvasEndpoint(endpoint: string) {
  return endpoint.trim().replace(/\/+$/, '');
}

function slugifySegment(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function buildCourseSlug(course: Pick<CanvasCourse, 'id' | 'name' | 'course_code'>) {
  const baseLabel = course.course_code || course.name || `course-${course.id}`;
  const baseSlug = slugifySegment(baseLabel) || `course-${course.id}`;

  return `${baseSlug}-${course.id}`;
}

function buildCoursePath(course: Pick<CanvasCourse, 'id' | 'name' | 'course_code'>) {
  return `/courses/${buildCourseSlug(course)}`;
}

function buildCourseStudyGuidesPath(course: Pick<CanvasCourse, 'id' | 'name' | 'course_code'>) {
  return `${buildCoursePath(course)}/study-guides`;
}

function buildCourseWorkspacePath(course: Pick<CanvasCourse, 'id' | 'name' | 'course_code'>) {
  return `${buildCoursePath(course)}/workspace`;
}

function buildCourseStudyGuidePath(
  course: Pick<CanvasCourse, 'id' | 'name' | 'course_code'>,
  guideId: string,
) {
  return `${buildCourseStudyGuidesPath(course)}/${guideId}`;
}

export {
  buildCoursePath,
  buildCourseSlug,
  buildCourseStudyGuidePath,
  buildCourseStudyGuidesPath,
  buildCourseWorkspacePath,
  canvasCoursesPath,
  normalizeCanvasEndpoint,
};
export { buildCourseAssignmentsPath };
export type {
  AgentAuthStatus,
  AgentChatContext,
  AgentChatRequest,
  AgentChatResponse,
  AgentChatStreamEvent,
  CanvasApiBridge,
  CanvasApiErrorPayload,
  CanvasAssignment,
  CanvasAssignmentSubmission,
  CanvasCourse,
  CanvasCourseProgress,
  CodingWorkspaceRunRequest,
  CodingWorkspaceRunResult,
  CanvasEnrollment,
  CourseKnowledgeBase,
  CourseMaterialRecord,
  CourseCodingProblemList,
  CodingProblemDocument,
  CourseStudyGuideList,
  StudyGuideMarkdownDocument,
  CanvasSession,
  CanvasTerm,
  ToolCall,
  ToolDefinition,
  ToolParameter,
  ToolResult,
  UploadCourseMaterialsResult,
};
