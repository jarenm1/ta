import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const COURSE_MATERIALS_ENV_VAR = 'TA_COURSE_MATERIALS_DIR';
const RAW_COURSE_DATA_ENV_VAR = 'TA_RAW_COURSE_DATA_DIR';
const RAW_COURSE_ALIASES_ENV_VAR = 'TA_RAW_COURSE_ALIASES_PATH';
const DEFAULT_BASE_DIR = path.join('.teaching-assistant', 'course-materials');
const DEFAULT_RAW_BASE_DIR = path.join('.teaching-assistant', 'data', 'courses');
const DEFAULT_RAW_ALIASES_PATH = path.join('.teaching-assistant', 'data', 'course-aliases.json');
const DEFAULT_MAX_TEXT_CHARS = 12000;
const DEFAULT_MAX_RAW_FILES = 150;
const RAW_TEXT_EXTENSIONS = new Set([
  '.c', '.cc', '.cpp', '.csv', '.h', '.hpp', '.htm', '.html', '.java', '.js', '.json', '.md', '.markdown', '.py', '.sql', '.svg', '.tex', '.ts', '.tsx', '.txt', '.xml', '.yaml', '.yml',
]);
const IGNORED_DIRECTORY_NAMES = new Set(['.git', '.idea', '.vscode', 'node_modules', '__pycache__']);

function resolveCourseMaterialsBaseDir() {
  const configuredDir = String(process.env[COURSE_MATERIALS_ENV_VAR] || '').trim();
  return configuredDir || path.join(os.homedir(), DEFAULT_BASE_DIR);
}

function resolveRawCourseDataBaseDir() {
  const configuredDir = String(process.env[RAW_COURSE_DATA_ENV_VAR] || '').trim();
  return configuredDir || path.join(os.homedir(), DEFAULT_RAW_BASE_DIR);
}

function resolveRawCourseAliasesPath() {
  const configuredPath = String(process.env[RAW_COURSE_ALIASES_ENV_VAR] || '').trim();
  return configuredPath || path.join(os.homedir(), DEFAULT_RAW_ALIASES_PATH);
}

function getManifestPath(courseId) {
  return path.join(resolveCourseMaterialsBaseDir(), 'courses', String(courseId), 'materials.json');
}

function buildSummary(materials) {
  return {
    total_count: materials.length,
    extracted_text_count: materials.filter((material) => material.textExtracted).length,
    metadata_only_count: materials.filter((material) => !material.textExtracted).length,
    total_size_bytes: materials.reduce((total, material) => total + (material.sizeBytes || 0), 0),
  };
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripHtml(value) {
  return decodeHtmlEntities(
    String(value || '')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|tr|section|article|h[1-6]|td|th|ul|ol|pre)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  );
}

function normalizeText(value) {
  return String(value || '')
    .replace(/\r/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildExcerpt(value, maxLength = 320) {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength).trimEnd()}…`;
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

function compactAlphaNumeric(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function extractCourseCodeAliases(value) {
  const source = String(value || '').toLowerCase();
  const matches = [...source.matchAll(/([a-z]{2,})\s*\.?\s*(\d{4})/g)];

  return matches.flatMap((match) => {
    const subject = match[1];
    const digits = match[2];
    return [`${subject}${digits}`, `${subject}-${digits}`];
  });
}

function buildRawCourseAliases(courseId, course = {}) {
  const aliases = new Set([String(courseId), `course-${courseId}`]);

  for (const candidate of [course.course_code, course.name, course.original_name]) {
    if (!candidate) {
      continue;
    }

    aliases.add(slugifySegment(candidate));
    aliases.add(compactAlphaNumeric(candidate));

    for (const extractedAlias of extractCourseCodeAliases(candidate)) {
      aliases.add(extractedAlias);
      aliases.add(slugifySegment(extractedAlias));
    }
  }

  return [...aliases].filter(Boolean);
}

async function readRawCourseAliases() {
  const aliasesPath = resolveRawCourseAliasesPath();

  if (!(await fileExists(aliasesPath))) {
    return {};
  }

  try {
    const rawAliases = await fs.readFile(aliasesPath, 'utf8');
    const parsedAliases = JSON.parse(rawAliases);
    return parsedAliases && typeof parsedAliases === 'object' ? parsedAliases : {};
  } catch {
    return {};
  }
}

async function findRawCourseDirectories(courseId, course = {}) {
  const baseDir = resolveRawCourseDataBaseDir();

  if (!(await fileExists(baseDir))) {
    return [];
  }

  const aliasMap = await readRawCourseAliases();
  const configuredAliases = aliasMap[String(courseId)];
  const aliases = new Set(buildRawCourseAliases(courseId, course));

  for (const alias of Array.isArray(configuredAliases) ? configuredAliases : [configuredAliases]) {
    if (typeof alias === 'string' && alias.trim()) {
      aliases.add(alias.trim());
      aliases.add(slugifySegment(alias));
      aliases.add(compactAlphaNumeric(alias));
    }
  }

  const entries = await fs.readdir(baseDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      absolutePath: path.join(baseDir, entry.name),
      compactName: compactAlphaNumeric(entry.name),
      name: entry.name,
      slugName: slugifySegment(entry.name),
    }))
    .filter((entry) => aliases.has(entry.name) || aliases.has(entry.slugName) || aliases.has(entry.compactName))
    .map((entry) => entry.absolutePath);
}

async function walkRawCourseFiles(rootDirectory, options = {}) {
  const discoveredFiles = [];
  const maxFiles = Math.max(20, Number(options.maxRawFiles) || DEFAULT_MAX_RAW_FILES);
  const pendingDirectories = [rootDirectory];

  while (pendingDirectories.length > 0 && discoveredFiles.length < maxFiles) {
    const currentDirectory = pendingDirectories.pop();
    const entries = await fs.readdir(currentDirectory, { withFileTypes: true });

    for (const entry of entries) {
      if (discoveredFiles.length >= maxFiles) {
        break;
      }

      const absolutePath = path.join(currentDirectory, entry.name);

      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORY_NAMES.has(entry.name)) {
          pendingDirectories.push(absolutePath);
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (!RAW_TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        continue;
      }

      discoveredFiles.push(absolutePath);
    }
  }

  return discoveredFiles.sort((left, right) => left.localeCompare(right));
}

async function readRawCourseFile(filePath, maxTextChars) {
  const rawText = await fs.readFile(filePath, 'utf8');
  const extension = path.extname(filePath).toLowerCase();
  const normalizedText = normalizeText(extension === '.htm' || extension === '.html' ? stripHtml(rawText) : rawText);
  const truncated = normalizedText.length > maxTextChars;
  const textContent = truncated ? `${normalizedText.slice(0, maxTextChars).trimEnd()}…` : normalizedText;

  return {
    textContent,
    textLength: normalizedText.length,
    textTruncated: truncated,
  };
}

async function getRawCourseMaterials(courseId, options = {}) {
  const directories = await findRawCourseDirectories(courseId, options.course || {});

  if (directories.length === 0) {
    return {
      materials: [],
      updatedAt: null,
    };
  }

  const maxTextChars = Math.max(2000, Number(options.maxTextChars) || DEFAULT_MAX_TEXT_CHARS);
  const filePaths = [];

  for (const directory of directories) {
    filePaths.push(...(await walkRawCourseFiles(directory, options)));
  }

  const uniqueFilePaths = [...new Set(filePaths)];
  let latestTimestamp = 0;

  const materials = await Promise.all(
    uniqueFilePaths.map(async (filePath) => {
      const stats = await fs.stat(filePath);
      latestTimestamp = Math.max(latestTimestamp, stats.mtimeMs);
      const { textContent, textLength, textTruncated } = await readRawCourseFile(filePath, maxTextChars);

      return {
        id: `raw:${slugifySegment(path.relative(resolveRawCourseDataBaseDir(), filePath))}`,
        courseId,
        displayName: path.basename(filePath),
        extension: path.extname(filePath).toLowerCase(),
        mimeType: null,
        sizeBytes: stats.size,
        addedAt: new Date(stats.mtimeMs).toISOString(),
        storageRelativePath: path.relative(resolveRawCourseDataBaseDir(), filePath),
        textRelativePath: null,
        textExtracted: true,
        textLength,
        textExcerpt: buildExcerpt(textContent),
        textTruncated,
        extractionStatus: 'ready',
        extractionNote: 'Loaded from raw course data directory.',
        source_origin: 'raw_course_data',
        text_content: options.includeTextContent === false ? null : textContent,
        text_content_truncated: textTruncated,
      };
    }),
  );

  return {
    materials: materials.sort((left, right) => String(right.addedAt || '').localeCompare(String(left.addedAt || ''))),
    updatedAt: latestTimestamp > 0 ? new Date(latestTimestamp).toISOString() : null,
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

async function readCourseMaterialsManifest(courseId) {
  const manifestPath = getManifestPath(courseId);

  if (!(await fileExists(manifestPath))) {
    return {
      courseId,
      updatedAt: null,
      materials: [],
    };
  }

  const rawManifest = await fs.readFile(manifestPath, 'utf8');
  const parsedManifest = JSON.parse(rawManifest);
  const materials = Array.isArray(parsedManifest.materials) ? parsedManifest.materials : [];

  return {
    courseId,
    updatedAt: parsedManifest.updatedAt || null,
    materials: materials
      .filter((material) => material && typeof material.id === 'string')
      .sort((left, right) => String(right.addedAt || '').localeCompare(String(left.addedAt || ''))),
  };
}

async function readMaterialText(material, maxTextChars) {
  if (!material.textRelativePath) {
    return {
      text_content: null,
      text_content_truncated: false,
    };
  }

  const absoluteTextPath = path.join(resolveCourseMaterialsBaseDir(), material.textRelativePath);

  if (!(await fileExists(absoluteTextPath))) {
    return {
      text_content: null,
      text_content_truncated: false,
    };
  }

  const rawText = await fs.readFile(absoluteTextPath, 'utf8');

  if (rawText.length <= maxTextChars) {
    return {
      text_content: rawText,
      text_content_truncated: false,
    };
  }

  return {
    text_content: `${rawText.slice(0, maxTextChars).trimEnd()}…`,
    text_content_truncated: true,
  };
}

async function getCourseKnowledgeBase(courseId, options = {}) {
  const manifest = await readCourseMaterialsManifest(courseId);
  const maxTextChars = Math.max(2000, Number(options.maxTextChars) || DEFAULT_MAX_TEXT_CHARS);
  const includeTextContent = options.includeTextContent !== false;

  const sharedMaterials = await Promise.all(
    manifest.materials.map(async (material) => {
      if (!includeTextContent) {
        return {
          ...material,
          text_content: null,
          text_content_truncated: false,
        };
      }

      return {
        ...material,
        ...(await readMaterialText(material, maxTextChars)),
      };
    }),
  );

  const rawMaterialsResult = options.includeRawCourseData === false
    ? { materials: [], updatedAt: null }
    : await getRawCourseMaterials(courseId, {
        course: options.course,
        includeTextContent,
        maxRawFiles: options.maxRawFiles,
        maxTextChars,
      });

  const materials = [...sharedMaterials, ...rawMaterialsResult.materials].sort(
    (left, right) => String(right.addedAt || '').localeCompare(String(left.addedAt || '')),
  );

  const updatedAtCandidates = [manifest.updatedAt, rawMaterialsResult.updatedAt].filter(Boolean).sort();

  return {
    course_id: courseId,
    updated_at: updatedAtCandidates.length > 0 ? updatedAtCandidates[updatedAtCandidates.length - 1] : null,
    storage_directory: resolveCourseMaterialsBaseDir(),
    raw_storage_directory: resolveRawCourseDataBaseDir(),
    materials,
    summary: buildSummary(materials),
  };
}

export {
  COURSE_MATERIALS_ENV_VAR,
  RAW_COURSE_ALIASES_ENV_VAR,
  RAW_COURSE_DATA_ENV_VAR,
  getCourseKnowledgeBase,
  resolveCourseMaterialsBaseDir,
  resolveRawCourseDataBaseDir,
};
