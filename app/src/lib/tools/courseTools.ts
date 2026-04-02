import { type CourseKnowledgeBase } from '../courseMaterials';
import { type CourseCodingProblemList } from '../codingProblems';
import { type CourseStudyGuideList } from '../studyGuides';

// Tool to list all courses
export async function listCourses(): Promise<Array<{ id: number; name: string; code: string }>> {
  try {
    const coursesJson = await import('../../data/courses.json', { assert: { type: 'json' } });
    const courses = coursesJson.default || coursesJson;
    return courses.map((c: { id: number; name: string; code: string }) => ({
      id: c.id,
      name: c.name,
      code: c.code,
    }));
  } catch {
    return [];
  }
}

// Tool to get course materials
export async function getCourseMaterials(courseId: number): Promise<CourseKnowledgeBase | null> {
  try {
    const { listCourseMaterials } = await import('../canvasApi');
    return await listCourseMaterials(courseId);
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
      if (material.extractedText?.toLowerCase().includes(lowerQuery)) {
        results.push({
          title: material.fileName,
          excerpt: material.extractedText.slice(0, 200) + '...',
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
    const { listStudyGuides } = await import('../canvasApi');
    return await listStudyGuides(courseId);
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
    const { getStudyGuideMarkdown } = await import('../canvasApi');
    const guide = await getStudyGuideMarkdown(courseId, guideId);
    if (!guide) return null;
    
    return {
      title: guide.title,
      content: guide.content,
    };
  } catch {
    return null;
  }
}

// Tool to get coding problems for a course
export async function getCodingProblems(courseId: number): Promise<CourseCodingProblemList | null> {
  try {
    const { listCodingProblems } = await import('../canvasApi');
    return await listCodingProblems(courseId);
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
    const { getCodingProblem } = await import('../canvasApi');
    const problem = await getCodingProblem(courseId, problemId);
    if (!problem) return null;
    
    return {
      title: problem.title,
      description: problem.description,
      starterCode: problem.starterCode || '',
      testCases: problem.testCases || [],
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
