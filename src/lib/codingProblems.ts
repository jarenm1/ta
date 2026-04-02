type CodingProblemExample = {
  explanation: string;
  input: string;
  output: string;
  title: string;
};

type CodingProblemTestCase = {
  expected_output: string;
  id: string;
  input: string;
  label: string;
  notes?: string;
};

type CodingProblemPayload = {
  course: {
    course_code?: string | null;
    current_grade?: string | null;
    current_score?: number | null;
    id?: number;
    name: string;
  };
  generated_at: string;
  problem: {
    constraints: string[];
    description: string[];
    difficulty: string;
    examples: CodingProblemExample[];
    id: string;
    language: string;
    runner_kind: 'cpp-linked-list-reverse' | 'cpp-stdin-console' | 'mips-wasm';
    source_refs: Array<{
      source_id: number | string;
      source_type: string;
      title: string;
    }>;
    starter_code: string;
    test_cases: CodingProblemTestCase[];
    title: string;
    topic: string;
    walkthrough: string[];
  };
  request: {
    difficulty: string;
    include_walkthrough: boolean;
    language: string;
    objective: string;
    source_scope: string;
    title: string;
    topic_hint?: string | null;
  };
  source_summary: {
    documents_considered_count: number;
    source_material: Array<{
      excerpt?: string;
      relevance_score: number;
      source_id: number | string;
      source_type: string;
      title: string;
    }>;
  };
};

type CodingProblemRecord = {
  courseId: number;
  createdAt: string;
  difficulty: string;
  id: string;
  jsonRelativePath: string;
  language: string;
  markdownRelativePath: string;
  runnerKind: 'cpp-linked-list-reverse' | 'cpp-stdin-console' | 'mips-wasm';
  title: string;
  topic: string;
};

type CourseCodingProblemList = {
  codingProblems: CodingProblemRecord[];
  courseId: number;
  updatedAt: string | null;
};

type CodingProblemDocument = {
  markdown: string;
  payload: CodingProblemPayload;
  problem: CodingProblemRecord;
};

export type {
  CodingProblemDocument,
  CodingProblemExample,
  CodingProblemPayload,
  CodingProblemRecord,
  CodingProblemTestCase,
  CourseCodingProblemList,
};
