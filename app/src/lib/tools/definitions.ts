import { registerTool, type ToolDefinition } from './index';
import {
  listCourses,
  getCourseMaterials,
  searchCourseMaterials,
  getStudyGuides,
  getStudyGuide,
  getCodingProblems,
  getCodingProblem,
  runCode,
} from './courseTools';

// Define and register all available tools

const listCoursesTool: ToolDefinition = {
  name: 'list_courses',
  description: 'List all available courses in the system',
  parameters: [],
};

const getCourseMaterialsTool: ToolDefinition = {
  name: 'get_course_materials',
  description: 'Get all materials (files, documents) for a specific course',
  parameters: [
    {
      name: 'courseId',
      type: 'number',
      description: 'The ID of the course to get materials for',
      required: true,
    },
  ],
};

const searchCourseMaterialsTool: ToolDefinition = {
  name: 'search_course_materials',
  description: 'Search course materials by keyword or phrase',
  parameters: [
    {
      name: 'courseId',
      type: 'number',
      description: 'The ID of the course to search within',
      required: true,
    },
    {
      name: 'query',
      type: 'string',
      description: 'The search query to find relevant materials',
      required: true,
    },
  ],
};

const getStudyGuidesTool: ToolDefinition = {
  name: 'get_study_guides',
  description: 'Get all study guides for a specific course',
  parameters: [
    {
      name: 'courseId',
      type: 'number',
      description: 'The ID of the course to get study guides for',
      required: true,
    },
  ],
};

const getStudyGuideTool: ToolDefinition = {
  name: 'get_study_guide',
  description: 'Get the full content of a specific study guide',
  parameters: [
    {
      name: 'courseId',
      type: 'number',
      description: 'The ID of the course',
      required: true,
    },
    {
      name: 'guideId',
      type: 'string',
      description: 'The ID of the study guide to retrieve',
      required: true,
    },
  ],
};

const getCodingProblemsTool: ToolDefinition = {
  name: 'get_coding_problems',
  description: 'Get all coding problems for a specific course',
  parameters: [
    {
      name: 'courseId',
      type: 'number',
      description: 'The ID of the course to get coding problems for',
      required: true,
    },
  ],
};

const getCodingProblemTool: ToolDefinition = {
  name: 'get_coding_problem',
  description: 'Get the full details of a specific coding problem including description and starter code',
  parameters: [
    {
      name: 'courseId',
      type: 'number',
      description: 'The ID of the course',
      required: true,
    },
    {
      name: 'problemId',
      type: 'string',
      description: 'The ID of the coding problem to retrieve',
      required: true,
    },
  ],
};

const runCodeTool: ToolDefinition = {
  name: 'run_code',
  description: 'Execute code in a sandboxed environment (Python, JavaScript, or TypeScript)',
  parameters: [
    {
      name: 'code',
      type: 'string',
      description: 'The code to execute',
      required: true,
    },
    {
      name: 'language',
      type: 'string',
      description: 'The programming language (python, javascript, or typescript)',
      required: true,
    },
  ],
};

// Register all tools
export function registerAllTools(): void {
  registerTool(listCoursesTool, async () => listCourses());
  registerTool(getCourseMaterialsTool, async (args) => getCourseMaterials(args.courseId as number));
  registerTool(searchCourseMaterialsTool, async (args) => 
    searchCourseMaterials(args.courseId as number, args.query as string)
  );
  registerTool(getStudyGuidesTool, async (args) => getStudyGuides(args.courseId as number));
  registerTool(getStudyGuideTool, async (args) => 
    getStudyGuide(args.courseId as number, args.guideId as string)
  );
  registerTool(getCodingProblemsTool, async (args) => getCodingProblems(args.courseId as number));
  registerTool(getCodingProblemTool, async (args) => 
    getCodingProblem(args.courseId as number, args.problemId as string)
  );
  registerTool(runCodeTool, async (args) => 
    runCode(args.code as string, args.language as 'python' | 'javascript' | 'typescript')
  );
}

export * from './index';
export * from './courseTools';
