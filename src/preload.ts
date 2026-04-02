import { contextBridge, ipcRenderer } from 'electron';
import type {
  AgentAuthStatus,
  AgentChatResponse,
  AgentChatStreamEvent,
  CanvasApiBridge,
  CanvasAssignment,
  CanvasCourse,
  CanvasSession,
} from './lib/canvasApi';
import type { CodingProblemDocument, CourseCodingProblemList } from './lib/codingProblems';
import type { CourseKnowledgeBase, UploadCourseMaterialsResult } from './lib/courseMaterials';
import type { CourseStudyGuideList, StudyGuideMarkdownDocument } from './lib/studyGuides';

const canvasApi: CanvasApiBridge = {
  bulkDownloadFiles: (courseId, fileIds, options) =>
    ipcRenderer.invoke('canvas:bulk-download-files', courseId, fileIds, options),
  getAgentAuthStatus: () =>
    ipcRenderer.invoke('canvas:get-agent-auth-status') as Promise<AgentAuthStatus>,
  sendAgentChatMessage: (request) =>
    ipcRenderer.invoke('canvas:send-agent-chat-message', request) as Promise<AgentChatResponse>,
  onAgentChatStream: (callback) => {
    const wrappedCallback = (_event: Electron.IpcRendererEvent, data: AgentChatStreamEvent) => callback(data);
    ipcRenderer.on('agent-chat-stream', wrappedCallback);
    return () => {
      ipcRenderer.removeListener('agent-chat-stream', wrappedCallback);
    };
  },
  loadSharedSession: () =>
    ipcRenderer.invoke('canvas:load-shared-session') as Promise<CanvasSession | null>,
  saveSharedSession: (session: CanvasSession) =>
    ipcRenderer.invoke('canvas:save-shared-session', session) as Promise<CanvasSession>,
  clearSharedSession: () => ipcRenderer.invoke('canvas:clear-shared-session') as Promise<void>,
  listCourses: (session: CanvasSession) =>
    ipcRenderer.invoke('canvas:list-courses', session) as Promise<CanvasCourse[]>,
  listCourseAssignments: (session: CanvasSession, courseId: number) =>
    ipcRenderer.invoke('canvas:list-course-assignments', session, courseId) as Promise<CanvasAssignment[]>,
  listCourseMaterials: (courseId: number) =>
    ipcRenderer.invoke('canvas:list-course-materials', courseId) as Promise<CourseKnowledgeBase>,
  listCodingProblems: (courseId: number) =>
    ipcRenderer.invoke('canvas:list-coding-problems', courseId) as Promise<CourseCodingProblemList>,
  getCodingProblem: (courseId: number, problemId: string) =>
    ipcRenderer.invoke('canvas:get-coding-problem', courseId, problemId) as Promise<CodingProblemDocument>,
  listStudyGuides: (courseId: number) =>
    ipcRenderer.invoke('canvas:list-study-guides', courseId) as Promise<CourseStudyGuideList>,
  getStudyGuideMarkdown: (courseId: number, guideId: string) =>
    ipcRenderer.invoke('canvas:get-study-guide-markdown', courseId, guideId) as Promise<StudyGuideMarkdownDocument>,
  runCodingWorkspace: (request) =>
    ipcRenderer.invoke('canvas:run-coding-workspace', request),
  uploadCourseMaterials: (courseId: number, filePaths?: string[]) =>
    ipcRenderer.invoke('canvas:upload-course-materials', courseId, filePaths) as Promise<UploadCourseMaterialsResult>,
  removeCourseMaterial: (courseId: number, materialId: string) =>
    ipcRenderer.invoke('canvas:remove-course-material', courseId, materialId) as Promise<CourseKnowledgeBase>,
};

contextBridge.exposeInMainWorld('canvasApi', canvasApi);
