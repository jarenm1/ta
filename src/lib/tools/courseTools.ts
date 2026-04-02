import { type CourseKnowledgeBase } from '../courseMaterials';
import { type CourseCodingProblemList } from '../codingProblems';
import { type CourseStudyGuideList } from '../studyGuides';

// Tool to list all courses
export async function listCourses(): Promise<Array<{ id: number; name: string; code: string }>> {
  try {
    if (!window.canvasApi) {
      throw new Error('Canvas API not available');
    }
    const session = await window.canvasApi.loadSharedSession();
    if (!session) {
      throw new Error('No Canvas session available');
    }
    const courses = await window.canvasApi.listCourses(session);
    return courses.map((c) => ({
      id: c.id,
      name: c.name || c.course_code || `Course ${c.id}`,
      code: c.course_code || '',
    }));
  } catch {
    return [];
  }
}

// Tool to get course materials
export async function getCourseMaterials(courseId: number): Promise<CourseKnowledgeBase | null> {
  try {
    if (!window.canvasApi) {
      throw new Error('Canvas API not available');
    }
    return await window.canvasApi.listCourseMaterials(courseId);
  } catch {
    return null;
  }
}

// Tool to search course materials by query
export async function searchCourseMaterials(
  courseId: number, 
  query: string
): Promise<Array<{ title: string; excerpt: string; materialId: string }>> {
  try {
    const materials = await getCourseMaterials(courseId);
    if (!materials) return [];
    
    const results: Array<{ title: string; excerpt: string; materialId: string }> = [];
    const lowerQuery = query.toLowerCase();
    
    for (const material of materials.materials) {
      // Search in excerpt or display name
      const searchText = (material.textExcerpt + ' ' + material.displayName).toLowerCase();
      if (searchText.includes(lowerQuery)) {
        results.push({
          title: material.displayName,
          excerpt: material.textExcerpt.slice(0, 200) + (material.textExcerpt.length > 200 ? '...' : ''),
          materialId: material.id,
        });
      }
    }
    
    return results.slice(0, 5);
  } catch {
    return [];
  }
}

// Tool to get study guides for a course
export async function getStudyGuides(courseId: number): Promise<CourseStudyGuideList | null> {
  try {
    if (!window.canvasApi) {
      throw new Error('Canvas API not available');
    }
    return await window.canvasApi.listStudyGuides(courseId);
  } catch {
    return null;
  }
}

// Tool to get a specific study guide
export async function getStudyGuide(
  courseId: number, 
  guideId: string
): Promise<{ title: string; content: string } | null> {
  try {
    if (!window.canvasApi) {
      throw new Error('Canvas API not available');
    }
    const guide = await window.canvasApi.getStudyGuideMarkdown(courseId, guideId);
    if (!guide) return null;
    
    return {
      title: guide.guide.title,
      content: guide.markdown,
    };
  } catch {
    return null;
  }
}

// Tool to get coding problems for a course
export async function getCodingProblems(courseId: number): Promise<CourseCodingProblemList | null> {
  try {
    if (!window.canvasApi) {
      throw new Error('Canvas API not available');
    }
    return await window.canvasApi.listCodingProblems(courseId);
  } catch {
    return null;
  }
}

// Tool to get a specific coding problem
export async function getCodingProblem(
  courseId: number,
  problemId: string
): Promise<{ title: string; description: string; starterCode: string; testCases: unknown[] } | null> {
  try {
    if (!window.canvasApi) {
      throw new Error('Canvas API not available');
    }
    const doc = await window.canvasApi.getCodingProblem(courseId, problemId);
    if (!doc) return null;
    
    const problem = doc.payload?.problem;
    if (!problem) return null;
    
    return {
      title: problem.title,
      description: problem.description?.join('\n') || '',
      starterCode: problem.starter_code || '',
      testCases: problem.test_cases || [],
    };
  } catch {
    return null;
  }
}

// Tool to run code in workspace (simplified version)
export async function runCode(
  code: string,
  language: 'python' | 'javascript' | 'typescript'
): Promise<{ output: string; success: boolean; error?: string }> {
  try {
    // This is a placeholder - actual implementation would use the runCodingWorkspace API
    return {
      output: 'Code execution not yet implemented for chat tools',
      success: false,
    };
  } catch (error) {
    return {
      output: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Tool to download files from Canvas and save to local storage
export async function downloadCourseFiles(
  courseId: number,
  fileIds: string[],
  options?: {
    maxTextChars?: number;
    maxFileSize?: number;
    concurrency?: number;
  }
): Promise<{
  success: boolean;
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
  message: string;
}> {
  try {
    if (!window.canvasApi) {
      throw new Error('Canvas API not available');
    }

    // Get Canvas session
    const session = await window.canvasApi.loadSharedSession();
    if (!session) {
      throw new Error('No Canvas session available. Please configure your Canvas credentials first.');
    }

    // Call the MCP server's bulk download via IPC
    // We'll need to add this endpoint to main.ts
    const result = await window.canvasApi.bulkDownloadFiles(courseId, fileIds, {
      maxTextChars: options?.maxTextChars || 12000,
      maxFileSize: options?.maxFileSize || 50 * 1024 * 1024, // 50MB
      concurrency: options?.concurrency || 3,
    });

    return {
      success: true,
      downloaded: result.downloaded,
      failed: result.failed,
      materials: result.materials,
      errors: result.errors,
      message: `Downloaded ${result.downloaded}/${fileIds.length} files from Canvas. ${result.failed > 0 ? `${result.failed} files failed.` : ''}`,
    };
  } catch (error) {
    return {
      success: false,
      downloaded: 0,
      failed: fileIds.length,
      materials: [],
      errors: fileIds.map(id => ({ fileId: id, fileName: `File ${id}`, error: error instanceof Error ? error.message : 'Unknown error' })),
      message: `Failed to download files: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// Tool to upload local files to course knowledge base
export async function uploadLocalFiles(
  courseId: number,
  filePaths: string[]
): Promise<{
  success: boolean;
  imported: number;
  skipped: number;
  materials: Array<{
    id: string;
    displayName: string;
    sizeBytes: number;
    textExtracted: boolean;
  }>;
  errors: Array<{ fileName: string; reason: string }>;
  message: string;
}> {
  try {
    if (!window.canvasApi) {
      throw new Error('Canvas API not available');
    }

    const result = await window.canvasApi.uploadCourseMaterials(courseId, filePaths);

    return {
      success: true,
      imported: result.imported.length,
      skipped: result.skipped.length,
      materials: result.imported.map(m => ({
        id: m.id,
        displayName: m.displayName,
        sizeBytes: m.sizeBytes,
        textExtracted: m.textExtracted,
      })),
      errors: result.skipped.map(s => ({ fileName: s.name, reason: s.reason })),
      message: `Uploaded ${result.imported.length} files to course knowledge base. ${result.skipped.length > 0 ? `${result.skipped.length} files skipped.` : ''}`,
    };
  } catch (error) {
    return {
      success: false,
      imported: 0,
      skipped: filePaths.length,
      materials: [],
      errors: filePaths.map(path => ({ fileName: path, reason: error instanceof Error ? error.message : 'Unknown error' })),
      message: `Failed to upload files: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
