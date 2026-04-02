import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const COURSE_CODING_PROBLEMS_ENV_VAR = 'TA_COURSE_CODING_PROBLEMS_DIR';
const DEFAULT_BASE_DIR = path.join('.teaching-assistant', 'coding-problems');
const MANIFEST_FILE_NAME = 'coding-problems.json';

function assertCourseId(courseId) {
  if (!Number.isInteger(courseId) || courseId <= 0) {
    throw new Error('A valid course id is required.');
  }
}

function resolveCourseCodingProblemsBaseDir() {
  const configuredDir = String(process.env[COURSE_CODING_PROBLEMS_ENV_VAR] || '').trim();
  return configuredDir || path.join(os.homedir(), DEFAULT_BASE_DIR);
}

function getCourseDirectory(courseId) {
  return path.join(resolveCourseCodingProblemsBaseDir(), 'courses', String(courseId));
}

function getProblemStorageDirectory(courseId) {
  return path.join(getCourseDirectory(courseId), 'problems');
}

function getManifestPath(courseId) {
  return path.join(getCourseDirectory(courseId), MANIFEST_FILE_NAME);
}

function slugifySegment(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function compareByCreatedAt(left, right) {
  return String(right.createdAt || '').localeCompare(String(left.createdAt || ''));
}

function sameProblemTitle(left, right) {
  return slugifySegment(left) === slugifySegment(right);
}

function normalizeManifest(manifest, courseId) {
  const codingProblems = Array.isArray(manifest.codingProblems) ? manifest.codingProblems : [];

  return {
    courseId,
    schemaVersion: 1,
    updatedAt: manifest.updatedAt || null,
    codingProblems: codingProblems
      .filter((problem) => problem && typeof problem.id === 'string')
      .map((problem) => ({
        id: problem.id,
        courseId,
        title: problem.title || 'Coding problem',
        createdAt: problem.createdAt || new Date().toISOString(),
        topic: problem.topic || '',
        difficulty: problem.difficulty || 'Medium',
        language: problem.language || 'cpp',
        runnerKind: problem.runnerKind || 'cpp-stdin-console',
        markdownRelativePath: problem.markdownRelativePath,
        jsonRelativePath: problem.jsonRelativePath,
      }))
      .sort(compareByCreatedAt),
  };
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureCourseDirectories(courseId) {
  await Promise.all([
    fs.mkdir(getCourseDirectory(courseId), { recursive: true }),
    fs.mkdir(getProblemStorageDirectory(courseId), { recursive: true }),
  ]);
}

async function readManifest(courseId) {
  assertCourseId(courseId);

  const manifestPath = getManifestPath(courseId);

  if (!(await fileExists(manifestPath))) {
    return {
      courseId,
      schemaVersion: 1,
      updatedAt: null,
      codingProblems: [],
    };
  }

  const rawManifest = await fs.readFile(manifestPath, 'utf8');
  const parsedManifest = JSON.parse(rawManifest);

  return normalizeManifest(parsedManifest, courseId);
}

async function writeManifest(courseId, codingProblems) {
  assertCourseId(courseId);
  await ensureCourseDirectories(courseId);

  const nextManifest = {
    courseId,
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    codingProblems: [...codingProblems].sort(compareByCreatedAt),
  };

  await fs.writeFile(getManifestPath(courseId), JSON.stringify(nextManifest, null, 2), 'utf8');

  return nextManifest;
}

function toCodingProblemList(manifest) {
  return {
    courseId: manifest.courseId,
    updatedAt: manifest.updatedAt,
    codingProblems: manifest.codingProblems,
  };
}

async function listCodingProblems(courseId) {
  return toCodingProblemList(await readManifest(courseId));
}

async function getCodingProblem(courseId, problemId) {
  assertCourseId(courseId);

  if (!String(problemId || '').trim()) {
    throw new Error('A coding problem id is required.');
  }

  const manifest = await readManifest(courseId);
  const problem = manifest.codingProblems.find((entry) => entry.id === problemId);

  if (!problem) {
    throw new Error('The selected coding problem could not be found.');
  }

  const jsonPath = path.join(resolveCourseCodingProblemsBaseDir(), problem.jsonRelativePath);
  const markdownPath = path.join(resolveCourseCodingProblemsBaseDir(), problem.markdownRelativePath);

  if (!(await fileExists(jsonPath))) {
    throw new Error('The selected coding problem data file is missing.');
  }

  return {
    problem,
    payload: JSON.parse(await fs.readFile(jsonPath, 'utf8')),
    markdown: (await fileExists(markdownPath)) ? await fs.readFile(markdownPath, 'utf8') : '',
  };
}

async function removeCodingProblemFiles(problems) {
  await Promise.all(
    problems.flatMap((problem) => {
      const baseDir = resolveCourseCodingProblemsBaseDir();
      return [problem.jsonRelativePath, problem.markdownRelativePath]
        .filter(Boolean)
        .map(async (relativePath) => {
          const absolutePath = path.join(baseDir, relativePath);
          if (await fileExists(absolutePath)) {
            await fs.unlink(absolutePath);
          }
        });
    }),
  );
}

async function saveCodingProblem(courseId, codingProblem, markdown) {
  assertCourseId(courseId);

  const manifest = await readManifest(courseId);
  await ensureCourseDirectories(courseId);

  const nextTitle = codingProblem?.problem?.title || codingProblem?.request?.title || 'Coding problem';
  const replacedProblems = manifest.codingProblems.filter((record) => sameProblemTitle(record.title, nextTitle));
  const remainingProblems = manifest.codingProblems.filter(
    (record) => !sameProblemTitle(record.title, nextTitle),
  );

  const problemId = randomUUID();
  const titleSlug = slugifySegment(nextTitle || 'coding-problem') || 'coding-problem';
  const filePrefix = `${new Date().toISOString().slice(0, 10)}-${titleSlug}-${problemId.slice(0, 8)}`;
  const jsonRelativePath = path.join('courses', String(courseId), 'problems', `${filePrefix}.json`);
  const markdownRelativePath = path.join('courses', String(courseId), 'problems', `${filePrefix}.md`);

  await Promise.all([
    fs.writeFile(
      path.join(resolveCourseCodingProblemsBaseDir(), jsonRelativePath),
      JSON.stringify(codingProblem, null, 2),
      'utf8',
    ),
    fs.writeFile(path.join(resolveCourseCodingProblemsBaseDir(), markdownRelativePath), markdown, 'utf8'),
  ]);

  const record = {
    id: problemId,
    courseId,
    title: nextTitle,
    createdAt: codingProblem?.generated_at || new Date().toISOString(),
    topic: codingProblem?.problem?.topic || '',
    difficulty: codingProblem?.problem?.difficulty || 'Medium',
    language: codingProblem?.problem?.language || 'cpp',
    runnerKind: codingProblem?.problem?.runner_kind || 'cpp-stdin-console',
    markdownRelativePath,
    jsonRelativePath,
  };

  await removeCodingProblemFiles(replacedProblems);
  await writeManifest(courseId, [record, ...remainingProblems]);

  return record;
}

export {
  COURSE_CODING_PROBLEMS_ENV_VAR,
  getCodingProblem,
  listCodingProblems,
  resolveCourseCodingProblemsBaseDir,
  saveCodingProblem,
};
