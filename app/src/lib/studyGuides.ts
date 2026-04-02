type StudyGuideRecord = {
  id: string;
  courseId: number;
  title: string;
  createdAt: string;
  markdownRelativePath: string;
};

type CourseStudyGuideList = {
  courseId: number;
  updatedAt: string | null;
  studyGuides: StudyGuideRecord[];
};

type StudyGuideMarkdownDocument = {
  guide: StudyGuideRecord;
  markdown: string;
};

export type { CourseStudyGuideList, StudyGuideMarkdownDocument, StudyGuideRecord };
