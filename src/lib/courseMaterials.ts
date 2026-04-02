type CourseMaterialExtractionStatus = 'ready' | 'unsupported' | 'empty' | 'error';

type CourseMaterialRecord = {
  id: string;
  courseId: number;
  displayName: string;
  extension: string;
  mimeType: string | null;
  sizeBytes: number;
  addedAt: string;
  storageRelativePath: string;
  textRelativePath?: string | null;
  textExtracted: boolean;
  textLength: number;
  textExcerpt: string;
  textTruncated: boolean;
  extractionStatus: CourseMaterialExtractionStatus;
  extractionNote?: string | null;
};

type CourseKnowledgeBaseSummary = {
  totalCount: number;
  extractedTextCount: number;
  metadataOnlyCount: number;
  totalSizeBytes: number;
};

type CourseKnowledgeBase = {
  courseId: number;
  updatedAt: string | null;
  materials: CourseMaterialRecord[];
  summary: CourseKnowledgeBaseSummary;
};

type CourseMaterialUploadSkip = {
  name: string;
  reason: string;
};

type UploadCourseMaterialsResult = CourseKnowledgeBase & {
  canceled: boolean;
  imported: CourseMaterialRecord[];
  skipped: CourseMaterialUploadSkip[];
};

export type {
  CourseKnowledgeBase,
  CourseKnowledgeBaseSummary,
  CourseMaterialExtractionStatus,
  CourseMaterialRecord,
  CourseMaterialUploadSkip,
  UploadCourseMaterialsResult,
};
