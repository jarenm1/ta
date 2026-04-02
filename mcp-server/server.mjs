import process from 'node:process';
import { appendFile } from 'node:fs/promises';
import {
  CanvasClientError,
  getCourseSnapshot,
  getFileText,
  listCourses,
  normalizeCanvasEndpoint,
} from './canvas-client.mjs';
import {
  COURSE_MATERIALS_ENV_VAR,
  RAW_COURSE_ALIASES_ENV_VAR,
  RAW_COURSE_DATA_ENV_VAR,
  getCourseKnowledgeBase,
} from './course-materials.mjs';
import { createCodingProblem, renderCodingProblemMarkdown } from './coding-problem.mjs';
import { createQuiz, renderQuizMarkdown } from './quiz-generator.mjs';
import { CANVAS_SESSION_ENV_VAR, loadSharedCanvasSession } from './session-store.mjs';
import { createStudyGuide, renderStudyGuideMarkdown } from './study-guide.mjs';
import { bulkDownloadFiles, saveMaterialsToManifest } from './file-downloader.mjs';
import { saveStudyGuide } from './study-guide-store.mjs';

const SERVER_NAME = 'canvas-study-guide';
const SERVER_VERSION = '0.1.0';
const FALLBACK_PROTOCOL_VERSION = '2024-11-05';

const HELP_RESOURCE = {
  uri: 'canvas://server/schema',
  name: 'Canvas Study Guide Schema',
  description: 'Describes the MCP tools and the structured study guide output contract.',
  mimeType: 'application/json',
};

const RESOURCE_TEMPLATES = [
  {
    uriTemplate: 'canvas://course/{courseId}/snapshot',
    name: 'Course Snapshot',
    description: 'Aggregated course context for agent planning. Uses the shared desktop-app session when available, or falls back to explicit/env credentials.',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'canvas://course/{courseId}/knowledge-base',
    name: 'Course Knowledge Base',
    description: 'Uploaded course materials stored locally for MCP agents, including extracted text when available.',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'canvas://course/{courseId}/study-guide',
    name: 'Course Study Guide',
    description: 'Structured study-guide JSON built from the full course snapshot. Uses the shared desktop-app session when available, or falls back to explicit/env credentials.',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'canvas://course/{courseId}/quiz',
    name: 'Course Quiz',
    description: 'Structured quiz JSON with questions, answer options, and correct answers built from course content.',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'canvas://course/{courseId}/coding-problem',
    name: 'Course Coding Problem',
    description: 'Structured coding problem JSON with description, starter code, and test cases.',
    mimeType: 'application/json',
  },
];

const TOOL_DEFINITIONS = [
  {
    name: 'list_courses',
    description: 'List the user’s Canvas courses that are available to study.',
    inputSchema: {
      type: 'object',
      properties: {
        session: sessionSchema({ required: false }),
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_course_snapshot',
    description:
      'Fetch a full course context snapshot including course details, syllabus, front page, modules, assignments, pages, announcements, discussions, files, and folders.',
    inputSchema: {
      type: 'object',
      properties: {
        session: sessionSchema({ required: false }),
        courseId: { type: 'number', description: 'Canvas course id.' },
        includePageBodies: {
          type: 'boolean',
          description: 'When true, fetch the full body of each Canvas page for agent study planning.',
          default: true,
        },
      },
      required: ['courseId'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_course_knowledge_base',
    description:
      'Load locally uploaded course materials that extend the agent knowledge base for a specific course.',
    inputSchema: {
      type: 'object',
      properties: {
        courseId: { type: 'number', description: 'Canvas course id.' },
        courseCode: {
          type: 'string',
          description:
            'Optional course code hint used to match raw local course-data folders when Canvas metadata is unavailable.',
        },
        courseName: {
          type: 'string',
          description:
            'Optional course name hint used to match raw local course-data folders when Canvas metadata is unavailable.',
        },
        includeTextContent: {
          type: 'boolean',
          description: 'When true, include extracted text snippets for uploaded text-like files.',
          default: true,
        },
        maxTextChars: {
          type: 'number',
          description: 'Maximum extracted characters to include for each uploaded material.',
          default: 12000,
        },
      },
      required: ['courseId'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_file_text',
    description: 'Download and return the text for a Canvas file when it is a text-like file.',
    inputSchema: {
      type: 'object',
      properties: {
        session: sessionSchema({ required: false }),
        fileId: { type: 'number', description: 'Canvas file id.' },
        maxBytes: {
          type: 'number',
          description: 'Maximum text bytes to return.',
          default: 200000,
        },
      },
      required: ['fileId'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_study_guide',
    description:
      'Create a structured study-guide payload from the full course snapshot. Supports focused walkthrough and vocabulary modes, source scoping, worked examples, and an authoring prompt for polished Markdown generation.',
    inputSchema: {
      type: 'object',
      properties: {
        session: sessionSchema({ required: false }),
        courseId: { type: 'number', description: 'Canvas course id.' },
        title: { type: 'string', description: 'Optional title for the study guide.' },
        objective: { type: 'string', description: 'What the learner is preparing for.' },
        guideMode: {
          type: 'string',
          enum: ['walkthrough', 'vocabulary'],
          description: 'Guide style. Use vocabulary for dense glossary-style exam prep.',
          default: 'walkthrough',
        },
        sourceScope: {
          type: 'string',
          enum: ['all', 'focused', 'uploaded_only'],
          description: 'How broadly to search the course context before generating the guide.',
          default: 'focused',
        },
        examDate: {
          type: 'string',
          description: 'Optional target date in ISO 8601 or any Date-parsable format.',
        },
        availableHours: {
          type: 'number',
          description: 'Estimated hours available for studying.',
          default: 6,
        },
        outputFormat: {
          type: 'string',
          enum: ['outline', 'checklist', 'flashcards', 'qa'],
          description: 'How the agent expects to shape the final study material.',
          default: 'outline',
        },
        includeCompletedAssignments: {
          type: 'boolean',
          description: 'Include already-submitted assignments when prioritizing material.',
          default: false,
        },
        includePlanningSections: {
          type: 'boolean',
          description: 'Include study blocks, deadlines, and other planning sections in the output.',
          default: false,
        },
      },
      required: ['courseId', 'objective'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_coding_problem',
    description:
      'Create a structured coding problem payload with description, compileable scaffold starter code, test cases, and a walkthrough grounded in the course context.',
    inputSchema: {
      type: 'object',
      properties: {
        session: sessionSchema({ required: false }),
        courseId: { type: 'number', description: 'Canvas course id.' },
        title: { type: 'string', description: 'Optional title override for the coding problem.' },
        objective: {
          type: 'string',
          description: 'What concept or exam skill the coding problem should reinforce.',
        },
        topicHint: {
          type: 'string',
          description: 'Optional topic hint such as linked lists, recursion, stacks, or Big-O.',
        },
        language: {
          type: 'string',
          enum: ['cpp'],
          description: 'Programming language for the starter code.',
          default: 'cpp',
        },
        difficulty: {
          type: 'string',
          enum: ['Easy', 'Medium', 'Hard'],
          description: 'Difficulty label for the generated problem.',
          default: 'Medium',
        },
        includeWalkthrough: {
          type: 'boolean',
          description: 'Include a step-by-step strategy section in the output.',
          default: true,
        },
        sourceScope: {
          type: 'string',
          enum: ['all', 'focused', 'uploaded_only'],
          description: 'How broadly to search the course context before selecting source cues.',
          default: 'focused',
        },
      },
      required: ['courseId', 'objective'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_quiz',
    description:
      'Create a structured quiz payload with questions, answer options, and correct answers derived from the course snapshot.',
    inputSchema: {
      type: 'object',
      properties: {
        session: sessionSchema({ required: false }),
        courseId: { type: 'number', description: 'Canvas course id.' },
        title: { type: 'string', description: 'Optional title for the quiz.' },
        objective: {
          type: 'string',
          description: 'What the quiz should reinforce or assess.',
        },
        questionCount: {
          type: 'number',
          description: 'How many questions to generate.',
          default: 8,
        },
        answerCount: {
          type: 'number',
          description: 'How many answer options to include for multiple-choice questions.',
          default: 4,
        },
        questionTypes: {
          type: 'array',
          description: 'Question types to cycle through during quiz generation.',
          items: {
            type: 'string',
            enum: ['multiple_choice', 'short_answer'],
          },
        },
        includeExplanations: {
          type: 'boolean',
          description: 'Include explanations alongside answers.',
          default: true,
        },
      },
      required: ['courseId'],
      additionalProperties: false,
    },
  },
  {
    name: 'bulk_download_files',
    description:
      'Download multiple files from Canvas course and extract text from PDFs, Office documents, and images for the knowledge base.',
    inputSchema: {
      type: 'object',
      properties: {
        session: sessionSchema({ required: false }),
        courseId: { type: 'number', description: 'Canvas course id.' },
        fileIds: {
          type: 'array',
          description: 'Array of Canvas file IDs to download.',
          items: { type: 'number' },
        },
        maxTextChars: {
          type: 'number',
          description: 'Maximum extracted characters per file.',
          default: 12000,
        },
        maxFileSize: {
          type: 'number',
          description: 'Maximum file size in bytes (default 50MB).',
          default: 52428800,
        },
        concurrency: {
          type: 'number',
          description: 'Number of concurrent downloads (1-5).',
          default: 3,
        },
        includeTextContent: {
          type: 'boolean',
          description: 'Include extracted text content in the response.',
          default: true,
        },
      },
      required: ['courseId', 'fileIds'],
      additionalProperties: false,
    },
  },
];

function sessionSchema() {
  return {
    type: 'object',
    description:
      'Optional explicit Canvas session. When omitted, the server first tries the desktop app’s shared session file, then falls back to CANVAS_API_ENDPOINT and CANVAS_API_TOKEN.',
    properties: {
      endpoint: { type: 'string' },
      token: { type: 'string' },
    },
    required: ['endpoint', 'token'],
    additionalProperties: false,
  };
}

function buildSchemaDocument() {
  return {
    server: {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    studyGuideContract: {
      required_request_fields: ['courseId', 'objective'],
      output_shape: {
        generated_at: 'string',
        request: {
          title: 'string',
          objective: 'string',
          exam_date: 'string | null',
          available_hours: 'number',
          output_format: 'outline | checklist | flashcards | qa',
          guide_mode: 'walkthrough | vocabulary',
          source_scope: 'all | focused | uploaded_only',
          include_completed_assignments: 'boolean',
          include_planning_sections: 'boolean',
        },
        course: {
          id: 'number',
          name: 'string',
          course_code: 'string | null',
          current_grade: 'string | null',
          current_score: 'number | null',
        },
        overview: {
          purpose: 'string',
          recommended_use: 'string',
        },
        summary: 'counts and warnings',
        key_deadlines: 'array',
        priority_items: 'array',
        topic_clusters: 'array',
        study_blocks: 'array',
        walkthrough_topics: [
          {
            id: 'string',
            title: 'string',
            introduction: 'string',
            lecture_details: 'string[]',
            worked_example: {
              problem: 'string',
              answer: 'string',
              explanation: 'string',
            },
            common_pitfalls: 'string[]',
            check_yourself: 'string[]',
            source_refs: 'array',
          },
        ],
        vocabulary_terms: [
          {
            id: 'string',
            topic_id: 'string',
            topic_title: 'string',
            term: 'string',
            definition: 'string',
            why_it_matters: 'string',
            example_question: 'string',
            answer_outline: 'string',
            source_refs: 'array',
          },
        ],
        authoring_prompt: 'string',
        source_material: 'focused source summary and document excerpts',
      },
    },
    knowledgeBaseContract: {
      required_request_fields: ['courseId'],
      notes: [
        'Reads both uploaded files saved by the desktop app and raw local course-data folders for this course when they can be matched.',
        `Set ${COURSE_MATERIALS_ENV_VAR} if the desktop app and MCP server should use a non-default shared directory.`,
        `Set ${RAW_COURSE_DATA_ENV_VAR} to override the base directory used for raw per-course data such as lecture folders and extracted archives.`,
        `Set ${RAW_COURSE_ALIASES_ENV_VAR} to provide explicit raw-folder aliases when a course id/code/name does not match the folder name directly.`,
        `Canvas-backed tools and resources also try the desktop app's shared session file before falling back to env vars; set ${CANVAS_SESSION_ENV_VAR} to override that file path.`,
      ],
      output_shape: {
        course_id: 'number',
        updated_at: 'string | null',
        storage_directory: 'string',
        raw_storage_directory: 'string',
        summary: {
          total_count: 'number',
          extracted_text_count: 'number',
          metadata_only_count: 'number',
          total_size_bytes: 'number',
        },
        materials: [
          {
            id: 'string',
            displayName: 'string',
            mimeType: 'string | null',
            textExtracted: 'boolean',
            textExcerpt: 'string',
            text_content: 'string | null',
          },
        ],
      },
    },
    quizContract: {
      required_request_fields: ['courseId'],
      output_shape: {
        generated_at: 'string',
        request: {
          title: 'string',
          objective: 'string',
          question_count: 'number',
          question_types: 'array',
          answer_count: 'number',
          include_explanations: 'boolean',
        },
        course: {
          id: 'number',
          name: 'string',
          course_code: 'string | null',
        },
        questions: [
          {
            id: 'string',
            type: 'multiple_choice | short_answer',
            prompt: 'string',
            answer_options: [
              {
                id: 'string',
                text: 'string',
              },
            ],
            correct_answer: {
              answer_option_ids: 'string[]',
              text: 'string',
              acceptable_answers: 'string[] | optional',
            },
            explanation: 'string | optional',
            source_refs: 'array',
          },
        ],
        answer_key: 'array',
      },
    },
    codingProblemContract: {
      required_request_fields: ['courseId', 'objective'],
      output_shape: {
        generated_at: 'string',
        request: {
          title: 'string',
          objective: 'string',
          topic_hint: 'string | null',
          language: 'cpp',
          difficulty: 'Easy | Medium | Hard',
          include_walkthrough: 'boolean',
          source_scope: 'all | focused | uploaded_only',
        },
        course: {
          id: 'number',
          name: 'string',
          course_code: 'string | null',
          current_grade: 'string | null',
          current_score: 'number | null',
        },
        problem: {
          id: 'string',
          title: 'string',
          topic: 'string',
          difficulty: 'Easy | Medium | Hard',
          language: 'cpp',
          description: 'string[]',
          constraints: 'string[]',
          examples: 'array',
          starter_code: 'string (compileable scaffold, not a completed solution)',
          test_cases: 'array',
          runner_kind: 'string',
          walkthrough: 'string[]',
          source_refs: 'array',
        },
        source_summary: {
          documents_considered_count: 'number',
          source_material: 'array',
        },
      },
    },
    bulkDownloadContract: {
      required_request_fields: ['courseId', 'fileIds'],
      output_shape: {
        courseId: 'number',
        requested: 'number',
        downloaded: 'number',
        saved: 'number',
        failed: 'number',
        materials: [
          {
            id: 'string',
            displayName: 'string',
            sizeBytes: 'number',
            textExtracted: 'boolean',
            textLength: 'number',
            textTruncated: 'boolean',
            extractionStatus: 'string',
            extractionNote: 'string',
            text_content: 'string | optional',
          },
        ],
        errors: [
          {
            fileId: 'number',
            fileName: 'string',
            error: 'string',
            skipped: 'boolean',
          },
        ],
      },
    },
    tools: TOOL_DEFINITIONS,
    resources: {
      static: [HELP_RESOURCE],
      templates: RESOURCE_TEMPLATES,
    },
  };
}

async function getEnvSession() {
  const sharedSession = await loadSharedCanvasSession();

  if (sharedSession) {
    return sharedSession;
  }

  const endpoint = normalizeCanvasEndpoint(process.env.CANVAS_API_ENDPOINT || '');
  const token = String(process.env.CANVAS_API_TOKEN || '').trim();

  if (!endpoint || !token) {
    throw new CanvasClientError(
      `Canvas session is missing. Provide a session argument, sign in through the desktop app so it saves a shared session, or set CANVAS_API_ENDPOINT and CANVAS_API_TOKEN. Optionally set ${CANVAS_SESSION_ENV_VAR} to override the shared session file path.`,
    );
  }

  return { endpoint, token };
}

async function resolveSession(argumentsObject) {
  const session = argumentsObject?.session;

  if (session?.endpoint && session?.token) {
    return {
      endpoint: normalizeCanvasEndpoint(session.endpoint),
      token: String(session.token).trim(),
    };
  }

  return getEnvSession();
}

function assertNumber(value, fieldName) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new CanvasClientError(`${fieldName} must be a number.`);
  }

  return value;
}

function assertString(value, fieldName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new CanvasClientError(`${fieldName} must be a non-empty string.`);
  }

  return value.trim();
}

function createTextContent(text) {
  return [{ type: 'text', text }];
}

function createJsonResponse(payload, extraText) {
  return {
    content: createTextContent(extraText || JSON.stringify(payload, null, 2)),
    structuredContent: payload,
  };
}

async function getEnrichedCourseSnapshot(session, courseId, options = {}) {
  const snapshot = await getCourseSnapshot(session, courseId, options);
  const knowledgeBase = await getCourseKnowledgeBase(courseId, {
    course: snapshot.course,
    includeTextContent: true,
    maxTextChars: 12000,
  });

  return {
    ...snapshot,
    uploaded_materials: knowledgeBase.materials,
    knowledge_base_summary: knowledgeBase.summary,
  };
}

async function callTool(name, argumentsObject = {}) {
  const getSession = () => resolveSession(argumentsObject);

  switch (name) {
    case 'list_courses': {
      const courses = await listCourses(await getSession());
      return createJsonResponse(
        { courses },
        `Loaded ${courses.length} Canvas course${courses.length === 1 ? '' : 's'}.`,
      );
    }

    case 'get_course_snapshot': {
      const courseId = assertNumber(argumentsObject.courseId, 'courseId');
      const snapshot = await getEnrichedCourseSnapshot(await getSession(), courseId, {
        includePageBodies: argumentsObject.includePageBodies !== false,
      });
      return createJsonResponse(
        snapshot,
        `Loaded snapshot for ${snapshot.course?.name || `course ${courseId}`}.`,
      );
    }

    case 'get_course_knowledge_base': {
      const courseId = assertNumber(argumentsObject.courseId, 'courseId');
      const knowledgeBase = await getCourseKnowledgeBase(courseId, {
        course:
          argumentsObject.courseCode || argumentsObject.courseName
            ? {
                id: courseId,
                course_code: argumentsObject.courseCode ?? null,
                name: argumentsObject.courseName ?? null,
              }
            : undefined,
        includeTextContent: argumentsObject.includeTextContent !== false,
        maxTextChars: argumentsObject.maxTextChars,
      });
      return createJsonResponse(
        knowledgeBase,
        `Loaded ${knowledgeBase.summary.total_count} knowledge-base material${knowledgeBase.summary.total_count === 1 ? '' : 's'} for course ${courseId}.`,
      );
    }

    case 'get_file_text': {
      const fileId = assertNumber(argumentsObject.fileId, 'fileId');
      const fileText = await getFileText(await getSession(), fileId, {
        maxBytes: argumentsObject.maxBytes,
      });
      return createJsonResponse(
        fileText,
        `Loaded ${fileText.metadata.display_name || `file ${fileId}`}${fileText.truncated ? ' (truncated)' : ''}.`,
      );
    }

    case 'create_study_guide': {
      const courseId = assertNumber(argumentsObject.courseId, 'courseId');
      const objective = assertString(argumentsObject.objective, 'objective');
      const snapshot = await getEnrichedCourseSnapshot(await getSession(), courseId, {
        includePageBodies: true,
      });
      const guide = createStudyGuide(snapshot, {
        title: argumentsObject.title,
        objective,
        guideMode: argumentsObject.guideMode,
        sourceScope: argumentsObject.sourceScope,
        examDate: argumentsObject.examDate,
        availableHours: argumentsObject.availableHours,
        outputFormat: argumentsObject.outputFormat,
        includeCompletedAssignments: argumentsObject.includeCompletedAssignments,
        includePlanningSections: argumentsObject.includePlanningSections,
      });
      const markdown = renderStudyGuideMarkdown(guide);
      await saveStudyGuide(courseId, guide, markdown);
      return {
        content: createTextContent(markdown),
        structuredContent: guide,
      };
    }

    case 'create_coding_problem': {
      const courseId = assertNumber(argumentsObject.courseId, 'courseId');
      const objective = assertString(argumentsObject.objective, 'objective');
      const snapshot = await getEnrichedCourseSnapshot(await getSession(), courseId, {
        includePageBodies: true,
      });
      const problem = createCodingProblem(snapshot, {
        title: argumentsObject.title,
        objective,
        topicHint: argumentsObject.topicHint,
        language: argumentsObject.language,
        difficulty: argumentsObject.difficulty,
        includeWalkthrough: argumentsObject.includeWalkthrough,
        sourceScope: argumentsObject.sourceScope,
      });
      const markdown = renderCodingProblemMarkdown(problem);
      await saveCodingProblem(courseId, problem, markdown);
      return {
        content: createTextContent(markdown),
        structuredContent: problem,
      };
    }

    case 'create_quiz': {
      const courseId = assertNumber(argumentsObject.courseId, 'courseId');
      const snapshot = await getEnrichedCourseSnapshot(await getSession(), courseId, {
        includePageBodies: true,
      });
      const quiz = createQuiz(snapshot, {
        title: argumentsObject.title,
        objective: argumentsObject.objective,
        questionCount: argumentsObject.questionCount,
        answerCount: argumentsObject.answerCount,
        questionTypes: argumentsObject.questionTypes,
        includeExplanations: argumentsObject.includeExplanations,
      });
      return {
        content: createTextContent(renderQuizMarkdown(quiz)),
        structuredContent: quiz,
      };
    }

    case 'bulk_download_files': {
      const courseId = assertNumber(argumentsObject.courseId, 'courseId');
      const fileIds = argumentsObject.fileIds;
      
      if (!Array.isArray(fileIds) || fileIds.length === 0) {
        throw new CanvasClientError('fileIds must be a non-empty array of file IDs.');
      }
      
      const session = await getSession();
      
      // Get file metadata for all files
      const { getFileMetadata } = await import('./canvas-client.mjs');
      const files = await Promise.all(
        fileIds.map(async (fileId) => {
          try {
            return await getFileMetadata(session, fileId);
          } catch (error) {
            return { id: fileId, error: error.message, display_name: `File ${fileId}` };
          }
        })
      );
      
      const validFiles = files.filter(f => !f.error);
      const failedMetadata = files.filter(f => f.error).map(f => ({
        fileId: f.id,
        fileName: f.display_name,
        error: f.error,
        skipped: true,
      }));
      
      // Download and extract files
      const result = await bulkDownloadFiles(session, validFiles, {
        courseId,
        maxTextChars: argumentsObject.maxTextChars,
        maxFileSize: argumentsObject.maxFileSize,
        concurrency: argumentsObject.concurrency,
        includeTextContent: argumentsObject.includeTextContent,
      });
      
      // Save to manifest
      if (result.materials.length > 0) {
        await saveMaterialsToManifest(courseId, result.materials);
      }
      
      const allErrors = [...failedMetadata, ...result.errors];
      
      return createJsonResponse(
        {
          courseId,
          requested: fileIds.length,
          downloaded: result.downloaded,
          saved: result.materials.length,
          failed: allErrors.length,
          materials: result.materials.map(m => ({
            id: m.id,
            displayName: m.displayName,
            sizeBytes: m.sizeBytes,
            textExtracted: m.textExtracted,
            textLength: m.textLength,
            textTruncated: m.textTruncated,
            extractionStatus: m.extractionStatus,
            extractionNote: m.extractionNote,
            text_content: argumentsObject.includeTextContent !== false ? m.text_content : undefined,
          })),
          errors: allErrors,
        },
        `Downloaded ${result.downloaded}/${fileIds.length} files. ${result.downloaded > 0 ? `Saved to course ${courseId} knowledge base.` : ''} ${allErrors.length > 0 ? `${allErrors.length} files failed.` : ''}`
      );
    }

    default:
      throw new CanvasClientError(`Unknown tool: ${name}`);
  }
}

async function readResource(uri) {
  if (uri === HELP_RESOURCE.uri) {
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(buildSchemaDocument(), null, 2),
        },
      ],
    };
  }

  const parsed = parseCanvasResourceUri(uri);

  if (!parsed) {
    throw new CanvasClientError(`Unsupported resource URI: ${uri}`);
  }

  const getSession = () => getEnvSession();

  if (parsed.type === 'snapshot') {
    const snapshot = await getEnrichedCourseSnapshot(await getSession(), parsed.courseId, {
      includePageBodies: true,
    });

    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(snapshot, null, 2),
        },
      ],
    };
  }

  if (parsed.type === 'knowledge-base') {
    const knowledgeBase = await getCourseKnowledgeBase(parsed.courseId, {
      includeTextContent: true,
      maxTextChars: 12000,
    });

    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(knowledgeBase, null, 2),
        },
      ],
    };
  }

  if (parsed.type === 'quiz') {
    const snapshot = await getEnrichedCourseSnapshot(await getSession(), parsed.courseId, {
      includePageBodies: true,
    });
    const quiz = createQuiz(snapshot, {
      objective: parsed.objective,
      title: parsed.title,
      questionCount: parsed.questionCount,
      answerCount: parsed.answerCount,
      questionTypes: parsed.questionTypes,
      includeExplanations: parsed.includeExplanations,
    });

    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(quiz, null, 2),
        },
      ],
    };
  }

  if (parsed.type === 'coding-problem') {
    const snapshot = await getEnrichedCourseSnapshot(await getSession(), parsed.courseId, {
      includePageBodies: true,
    });
    const problem = createCodingProblem(snapshot, {
      objective: parsed.objective || 'Create a course-aligned coding problem from the available materials.',
      title: parsed.title,
      topicHint: parsed.topicHint,
      language: parsed.language,
      difficulty: parsed.difficulty,
      includeWalkthrough: parsed.includeWalkthrough,
      sourceScope: parsed.sourceScope,
    });

    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(problem, null, 2),
        },
      ],
    };
  }

  const snapshot = await getEnrichedCourseSnapshot(await getSession(), parsed.courseId, {
    includePageBodies: true,
  });
  const guide = createStudyGuide(snapshot, {
    objective: parsed.objective || 'Prepare a course study guide from all available course context.',
    guideMode: parsed.guideMode,
    sourceScope: parsed.sourceScope,
    outputFormat: parsed.outputFormat || 'outline',
    includePlanningSections: parsed.includePlanningSections,
  });

  return {
    contents: [
      {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(guide, null, 2),
      },
    ],
  };
}

function parseCanvasResourceUri(uri) {
  const snapshotMatch = uri.match(/^canvas:\/\/course\/(\d+)\/snapshot$/);

  if (snapshotMatch) {
    return {
      type: 'snapshot',
      courseId: Number(snapshotMatch[1]),
    };
  }

  const knowledgeBaseMatch = uri.match(/^canvas:\/\/course\/(\d+)\/knowledge-base$/);

  if (knowledgeBaseMatch) {
    return {
      type: 'knowledge-base',
      courseId: Number(knowledgeBaseMatch[1]),
    };
  }

  const studyGuideMatch = uri.match(/^canvas:\/\/course\/(\d+)\/study-guide(?:\?(.*))?$/);

  if (studyGuideMatch) {
    const params = new URLSearchParams(studyGuideMatch[2] || '');
    return {
      type: 'study-guide',
      courseId: Number(studyGuideMatch[1]),
      objective: params.get('objective') || undefined,
      guideMode: params.get('guideMode') || undefined,
      sourceScope: params.get('sourceScope') || undefined,
      outputFormat: params.get('outputFormat') || undefined,
      includePlanningSections: params.get('includePlanningSections') === 'true',
    };
  }

  const quizMatch = uri.match(/^canvas:\/\/course\/(\d+)\/quiz(?:\?(.*))?$/);

  if (quizMatch) {
    const params = new URLSearchParams(quizMatch[2] || '');
    const questionTypes = params.getAll('questionType');

    return {
      type: 'quiz',
      courseId: Number(quizMatch[1]),
      objective: params.get('objective') || undefined,
      title: params.get('title') || undefined,
      questionCount: params.get('questionCount') ? Number(params.get('questionCount')) : undefined,
      answerCount: params.get('answerCount') ? Number(params.get('answerCount')) : undefined,
      questionTypes: questionTypes.length > 0 ? questionTypes : undefined,
      includeExplanations: params.get('includeExplanations') === 'false' ? false : undefined,
    };
  }

  const codingProblemMatch = uri.match(/^canvas:\/\/course\/(\d+)\/coding-problem(?:\?(.*))?$/);

  if (codingProblemMatch) {
    const params = new URLSearchParams(codingProblemMatch[2] || '');
    return {
      type: 'coding-problem',
      courseId: Number(codingProblemMatch[1]),
      objective: params.get('objective') || undefined,
      title: params.get('title') || undefined,
      topicHint: params.get('topicHint') || undefined,
      language: params.get('language') || undefined,
      difficulty: params.get('difficulty') || undefined,
      sourceScope: params.get('sourceScope') || undefined,
      includeWalkthrough: params.get('includeWalkthrough') !== 'false',
    };
  }

  return null;
}

function createResponse(id, result) {
  return {
    jsonrpc: '2.0',
    id,
    result,
  };
}

function createError(id, code, message, data) {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      ...(data === undefined ? {} : { data }),
    },
  };
}

function writeMessage(message) {
  const payload = JSON.stringify(message);

  if (stdioTransportMode === 'line') {
    process.stdout.write(`${payload}\n`);
    return;
  }

  const buffer = Buffer.from(payload, 'utf8');
  process.stdout.write(`Content-Length: ${buffer.length}\r\n\r\n`);
  process.stdout.write(buffer);
}

function sendError(id, error) {
  if (error instanceof CanvasClientError) {
    writeMessage(createError(id, -32000, error.message, error.details));
    return;
  }

  writeMessage(
    createError(id, -32603, error instanceof Error ? error.message : 'Unexpected server error.'),
  );
}

async function handleRequest(message) {
  const { id, method, params } = message;

  try {
    switch (method) {
      case 'initialize': {
        writeMessage(
          createResponse(id, {
            protocolVersion: params?.protocolVersion || FALLBACK_PROTOCOL_VERSION,
            capabilities: {
              resources: {
                subscribe: false,
                listChanged: false,
              },
              tools: {
                listChanged: false,
              },
            },
            serverInfo: {
              name: SERVER_NAME,
              version: SERVER_VERSION,
            },
          }),
        );
        return;
      }

      case 'ping': {
        writeMessage(createResponse(id, {}));
        return;
      }

      case 'resources/list': {
        writeMessage(createResponse(id, { resources: [HELP_RESOURCE] }));
        return;
      }

      case 'resources/templates/list': {
        writeMessage(createResponse(id, { resourceTemplates: RESOURCE_TEMPLATES }));
        return;
      }

      case 'resources/read': {
        const result = await readResource(params?.uri);
        writeMessage(createResponse(id, result));
        return;
      }

      case 'tools/list': {
        writeMessage(createResponse(id, { tools: TOOL_DEFINITIONS }));
        return;
      }

      case 'tools/call': {
        const result = await callTool(params?.name, params?.arguments || {});
        writeMessage(createResponse(id, result));
        return;
      }

      default:
        writeMessage(createError(id, -32601, `Method not found: ${method}`));
    }
  } catch (error) {
    sendError(id, error);
  }
}

function handleNotification(message) {
  if (message.method === 'notifications/initialized') {
    return;
  }
}

let inputBuffer = Buffer.alloc(0);
let stdioTransportMode = null;

async function debugLog(message) {
  const debugPath = String(process.env.TA_MCP_DEBUG_PATH || '').trim();
  if (!debugPath) {
    return;
  }

  try {
    await appendFile(debugPath, `${new Date().toISOString()} ${message}\n`, 'utf8');
  } catch {
    return;
  }
}

function findHeaderBoundary(buffer) {
  const crlfBoundary = buffer.indexOf('\r\n\r\n');
  if (crlfBoundary !== -1) {
    return {
      headerEnd: crlfBoundary,
      separatorLength: 4,
      headerSeparator: '\r\n',
    };
  }

  const lfBoundary = buffer.indexOf('\n\n');
  if (lfBoundary !== -1) {
    return {
      headerEnd: lfBoundary,
      separatorLength: 2,
      headerSeparator: '\n',
    };
  }

  return null;
}

function drainInputBuffer() {
  while (true) {
    const headerBoundary = stdioTransportMode === 'line' ? null : findHeaderBoundary(inputBuffer);

    let message;

    if (headerBoundary) {
      stdioTransportMode = 'framed';
      const headerText = inputBuffer.slice(0, headerBoundary.headerEnd).toString('utf8');
      void debugLog(
        `header_found separator=${JSON.stringify(headerBoundary.headerSeparator)} header=${JSON.stringify(headerText)}`,
      );
      const headers = headerText.split(headerBoundary.headerSeparator);
      const contentLengthHeader = headers.find((header) => /^Content-Length:/i.test(header));

      if (!contentLengthHeader) {
        throw new Error('Missing Content-Length header.');
      }

      const contentLength = Number(contentLengthHeader.split(':')[1].trim());
      const messageStart = headerBoundary.headerEnd + headerBoundary.separatorLength;
      const messageEnd = messageStart + contentLength;

      if (inputBuffer.length < messageEnd) {
        void debugLog(
          `waiting_for_body bytes=${inputBuffer.length} message_end=${messageEnd} content_length=${contentLength}`,
        );
        return;
      }

      const body = inputBuffer.slice(messageStart, messageEnd).toString('utf8');
      void debugLog(`body=${JSON.stringify(body)}`);
      inputBuffer = inputBuffer.slice(messageEnd);
      message = JSON.parse(body);
    } else {
      const lineEnd = inputBuffer.indexOf('\n');

      if (lineEnd === -1) {
        void debugLog(`waiting_for_line bytes=${inputBuffer.length}`);
        return;
      }

      stdioTransportMode = 'line';
      const rawLine = inputBuffer.slice(0, lineEnd).toString('utf8');
      inputBuffer = inputBuffer.slice(lineEnd + 1);
      const line = rawLine.trim();

      if (!line) {
        continue;
      }

      void debugLog(`line=${JSON.stringify(line)}`);
      message = JSON.parse(line);
    }

    if (Object.prototype.hasOwnProperty.call(message, 'id')) {
      void handleRequest(message);
    } else {
      handleNotification(message);
    }
  }
}

process.stdin.on('data', (chunk) => {
  void debugLog(`stdin_chunk bytes=${chunk.length} preview=${JSON.stringify(chunk.toString('utf8'))}`);
  inputBuffer = Buffer.concat([inputBuffer, chunk]);

  try {
    drainInputBuffer();
  } catch (error) {
    sendError(null, error);
  }
});

process.stdin.on('end', () => {
  process.exit(0);
});
