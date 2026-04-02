import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const COURSE_STUDY_GUIDES_ENV_VAR = 'TA_COURSE_STUDY_GUIDES_DIR';
const DEFAULT_BASE_DIR = path.join('.teaching-assistant', 'study-guides');
const MANIFEST_FILE_NAME = 'study-guides.json';

function assertCourseId(courseId) {
  if (!Number.isInteger(courseId) || courseId <= 0) {
    throw new Error('A valid course id is required.');
  }
}

function resolveCourseStudyGuidesBaseDir() {
  const configuredDir = String(process.env[COURSE_STUDY_GUIDES_ENV_VAR] || '').trim();
  return configuredDir || path.join(os.homedir(), DEFAULT_BASE_DIR);
}

function getCourseDirectory(courseId) {
  return path.join(resolveCourseStudyGuidesBaseDir(), 'courses', String(courseId));
}

function getGuideStorageDirectory(courseId) {
  return path.join(getCourseDirectory(courseId), 'guides');
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

function sameGuideTitle(left, right) {
  return slugifySegment(left) === slugifySegment(right);
}

function normalizeManifest(manifest, courseId) {
  const studyGuides = Array.isArray(manifest.studyGuides) ? manifest.studyGuides : [];

  return {
    courseId,
    schemaVersion: 1,
    updatedAt: manifest.updatedAt || null,
    studyGuides: studyGuides
      .filter((guide) => guide && typeof guide.id === 'string')
      .map((guide) => ({
        id: guide.id,
        courseId,
        title: guide.title || 'Study guide',
        createdAt: guide.createdAt || new Date().toISOString(),
        markdownRelativePath: guide.markdownRelativePath,
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
    fs.mkdir(getGuideStorageDirectory(courseId), { recursive: true }),
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
      studyGuides: [],
    };
  }

  const rawManifest = await fs.readFile(manifestPath, 'utf8');
  const parsedManifest = JSON.parse(rawManifest);

  return normalizeManifest(parsedManifest, courseId);
}

async function writeManifest(courseId, studyGuides) {
  assertCourseId(courseId);
  await ensureCourseDirectories(courseId);

  const nextManifest = {
    courseId,
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    studyGuides: [...studyGuides].sort(compareByCreatedAt),
  };

  await fs.writeFile(getManifestPath(courseId), JSON.stringify(nextManifest, null, 2), 'utf8');

  return nextManifest;
}

function toStudyGuideList(manifest) {
  return {
    courseId: manifest.courseId,
    updatedAt: manifest.updatedAt,
    studyGuides: manifest.studyGuides,
  };
}

async function listStudyGuides(courseId) {
  return toStudyGuideList(await readManifest(courseId));
}

async function getStudyGuideMarkdown(courseId, guideId) {
  assertCourseId(courseId);

  if (!String(guideId || '').trim()) {
    throw new Error('A study guide id is required.');
  }

  const manifest = await readManifest(courseId);
  const guide = manifest.studyGuides.find((entry) => entry.id === guideId);

  if (!guide) {
    throw new Error('The selected study guide could not be found.');
  }

  const markdownPath = path.join(resolveCourseStudyGuidesBaseDir(), guide.markdownRelativePath);

  if (!(await fileExists(markdownPath))) {
    throw new Error('The selected study guide file is missing.');
  }

  return {
    guide,
    markdown: await fs.readFile(markdownPath, 'utf8'),
  };
}

async function removeStudyGuideFiles(guides) {
  await Promise.all(
    guides.map(async (guide) => {
      const markdownPath = path.join(resolveCourseStudyGuidesBaseDir(), guide.markdownRelativePath);

      if (await fileExists(markdownPath)) {
        await fs.unlink(markdownPath);
      }
    }),
  );
}

async function saveStudyGuide(courseId, guide, markdown) {
  assertCourseId(courseId);

  const manifest = await readManifest(courseId);
  await ensureCourseDirectories(courseId);

  const nextTitle = guide?.request?.title || 'Study guide';
  const replacedGuides = manifest.studyGuides.filter((record) => sameGuideTitle(record.title, nextTitle));
  const remainingGuides = manifest.studyGuides.filter((record) => !sameGuideTitle(record.title, nextTitle));

  const guideId = randomUUID();
  const titleSlug = slugifySegment(nextTitle || 'study-guide') || 'study-guide';
  const fileName = `${new Date().toISOString().slice(0, 10)}-${titleSlug}-${guideId.slice(0, 8)}.md`;
  const markdownRelativePath = path.join('courses', String(courseId), 'guides', fileName);

  await fs.writeFile(path.join(resolveCourseStudyGuidesBaseDir(), markdownRelativePath), markdown, 'utf8');

  const record = {
    id: guideId,
    courseId,
    title: nextTitle,
    createdAt: guide?.generated_at || new Date().toISOString(),
    markdownRelativePath,
  };

  await removeStudyGuideFiles(replacedGuides);
  await writeManifest(courseId, [record, ...remainingGuides]);

  return record;
}

export {
  COURSE_STUDY_GUIDES_ENV_VAR,
  getStudyGuideMarkdown,
  listStudyGuides,
  resolveCourseStudyGuidesBaseDir,
  saveStudyGuide,
};
