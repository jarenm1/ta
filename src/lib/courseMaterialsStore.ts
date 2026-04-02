import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { extractBinaryFileText } from '../../mcp-server/file-extractor.mjs';
import type {
  CourseKnowledgeBase,
  CourseKnowledgeBaseSummary,
  CourseMaterialRecord,
  UploadCourseMaterialsResult,
} from './courseMaterials';

const COURSE_MATERIALS_ENV_VAR = 'TA_COURSE_MATERIALS_DIR';
const DEFAULT_BASE_DIR = path.join('.teaching-assistant', 'course-materials');
const MANIFEST_FILE_NAME = 'materials.json';
const MAX_TEXT_EXTRACTION_BYTES = 2_000_000;
const TEXT_EXCERPT_LENGTH = 320;

const MIME_TYPES: Record<string, string> = {
  // Text/code files
  '.c': 'text/x-c',
  '.cpp': 'text/x-c++',
  '.css': 'text/css',
  '.csv': 'text/csv',
  '.go': 'text/x-go',
  '.h': 'text/x-c',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.java': 'text/x-java-source',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.jsx': 'text/jsx',
  '.md': 'text/markdown',
  '.markdown': 'text/markdown',
  '.mjs': 'text/javascript',
  '.py': 'text/x-python',
  '.sql': 'application/sql',
  '.svg': 'image/svg+xml',
  '.ts': 'text/typescript',
  '.tsx': 'text/tsx',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',
  // Binary extractable files
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.ppt': 'application/vnd.ms-powerpoint',
  // Images (OCR)
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.webp': 'image/webp',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
};

const TEXT_EXTENSIONS = new Set(Object.keys(MIME_TYPES).filter(ext => 
  !['.pdf', '.docx', '.xlsx', '.xls', '.pptx', '.ppt', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.tiff', '.tif'].includes(ext)
));
const BINARY_EXTRACTABLE_EXTENSIONS = new Set([
  '.pdf', '.docx', '.xlsx', '.xls', '.pptx', '.ppt',
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.tiff', '.tif',
]);
const HTML_EXTENSIONS = new Set(['.htm', '.html']);

type CourseMaterialsManifest = {
  courseId: number;
  schemaVersion: 1;
  updatedAt: string | null;
  materials: CourseMaterialRecord[];
};

function assertCourseId(courseId: number) {
  if (!Number.isInteger(courseId) || courseId <= 0) {
    throw new Error('A valid course id is required.');
  }
}

function resolveCourseMaterialsBaseDir() {
  const configuredDir = String(process.env[COURSE_MATERIALS_ENV_VAR] || '').trim();
  return configuredDir || path.join(os.homedir(), DEFAULT_BASE_DIR);
}

function getCourseDirectory(courseId: number) {
  return path.join(resolveCourseMaterialsBaseDir(), 'courses', String(courseId));
}

function getManifestPath(courseId: number) {
  return path.join(getCourseDirectory(courseId), MANIFEST_FILE_NAME);
}

function getFileStorageDirectory(courseId: number) {
  return path.join(getCourseDirectory(courseId), 'files');
}

function getTextStorageDirectory(courseId: number) {
  return path.join(getCourseDirectory(courseId), 'text');
}

function buildKnowledgeBaseSummary(materials: CourseMaterialRecord[]): CourseKnowledgeBaseSummary {
  return {
    totalCount: materials.length,
    extractedTextCount: materials.filter((material) => material.textExtracted).length,
    metadataOnlyCount: materials.filter((material) => !material.textExtracted).length,
    totalSizeBytes: materials.reduce((total, material) => total + material.sizeBytes, 0),
  };
}

function compareByAddedAt(left: Pick<CourseMaterialRecord, 'addedAt'>, right: Pick<CourseMaterialRecord, 'addedAt'>) {
  return String(right.addedAt || '').localeCompare(String(left.addedAt || ''));
}

function normalizeManifest(manifest: CourseMaterialsManifest, courseId: number): CourseMaterialsManifest {
  const materials = Array.isArray(manifest.materials) ? manifest.materials : [];

  return {
    courseId,
    schemaVersion: 1,
    updatedAt: manifest.updatedAt || null,
    materials: materials
      .filter((material) => material && typeof material.id === 'string')
      .map((material) => ({
        ...material,
        courseId,
        extractionStatus: material.extractionStatus || (material.textExtracted ? 'ready' : 'unsupported'),
        extractionNote: material.extractionNote || null,
        extension: material.extension || path.extname(material.displayName || '').toLowerCase(),
        mimeType: material.mimeType || null,
        textExcerpt: material.textExcerpt || '',
        textLength: Number(material.textLength) || 0,
        textRelativePath: material.textRelativePath || null,
        textTruncated: material.textTruncated === true,
      }))
      .sort(compareByAddedAt),
  };
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureCourseDirectories(courseId: number) {
  await Promise.all([
    fs.mkdir(getCourseDirectory(courseId), { recursive: true }),
    fs.mkdir(getFileStorageDirectory(courseId), { recursive: true }),
    fs.mkdir(getTextStorageDirectory(courseId), { recursive: true }),
  ]);
}

async function readManifest(courseId: number): Promise<CourseMaterialsManifest> {
  assertCourseId(courseId);

  const manifestPath = getManifestPath(courseId);

  if (!(await fileExists(manifestPath))) {
    return {
      courseId,
      schemaVersion: 1,
      updatedAt: null,
      materials: [],
    };
  }

  const rawManifest = await fs.readFile(manifestPath, 'utf8');
  const parsedManifest = JSON.parse(rawManifest) as CourseMaterialsManifest;

  return normalizeManifest(parsedManifest, courseId);
}

async function writeManifest(courseId: number, materials: CourseMaterialRecord[]) {
  assertCourseId(courseId);
  await ensureCourseDirectories(courseId);

  const nextManifest: CourseMaterialsManifest = {
    courseId,
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    materials: [...materials].sort(compareByAddedAt),
  };

  await fs.writeFile(getManifestPath(courseId), JSON.stringify(nextManifest, null, 2), 'utf8');
  return nextManifest;
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripHtml(value: string) {
  return decodeHtmlEntities(
    value
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|tr|section|article|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  );
}

function normalizeText(value: string) {
  return value
    .replace(/\r/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function decodeBuffer(buffer: Buffer) {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.subarray(2).toString('utf16le');
  }

  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.subarray(3).toString('utf8');
  }

  return buffer.toString('utf8');
}

function getMimeType(filePath: string) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || null;
}

function isTextLikeFile(filePath: string) {
  return TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function isBinaryExtractableFile(filePath: string) {
  return BINARY_EXTRACTABLE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function buildExcerpt(value: string) {
  if (value.length <= TEXT_EXCERPT_LENGTH) {
    return value;
  }

  return `${value.slice(0, TEXT_EXCERPT_LENGTH).trimEnd()}…`;
}

async function readFileSlice(filePath: string, maxBytes: number) {
  const handle = await fs.open(filePath, 'r');

  try {
    const buffer = Buffer.alloc(maxBytes);
    const { bytesRead } = await handle.read(buffer, 0, maxBytes, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

async function extractText(filePath: string, sizeBytes: number, absoluteStoragePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  
  // Handle binary extractable files (PDFs, Office docs, Images)
  if (BINARY_EXTRACTABLE_EXTENSIONS.has(extension)) {
    const extractionResult = await extractBinaryFileText(absoluteStoragePath, {
      maxChars: MAX_TEXT_EXTRACTION_BYTES,
      maxFileSize: 50 * 1024 * 1024, // 50MB
    });
    
    if (extractionResult.success) {
      return {
        extractionStatus: 'ready' as const,
        extractionNote: extractionResult.truncated 
          ? 'File extracted (truncated for storage)'
          : 'File extracted successfully',
        textContent: extractionResult.text,
        textTruncated: extractionResult.truncated,
        textLength: extractionResult.fullTextLength,
      };
    } else {
      return {
        extractionStatus: 'error' as const,
        extractionNote: extractionResult.error,
        textContent: '',
        textTruncated: false,
        textLength: 0,
      };
    }
  }
  
  // Handle text-like files
  if (!isTextLikeFile(filePath)) {
    return {
      extractionStatus: 'unsupported' as const,
      extractionNote: 'Text extraction is not available for this file type yet.',
      textContent: '',
      textTruncated: false,
      textLength: 0,
    };
  }

  const buffer = await readFileSlice(filePath, Math.min(sizeBytes, MAX_TEXT_EXTRACTION_BYTES));
  const decodedText = decodeBuffer(buffer);
  const replacementCount = (decodedText.match(/\uFFFD/g) || []).length;

  if (decodedText.length > 0 && replacementCount / decodedText.length > 0.05) {
    return {
      extractionStatus: 'unsupported' as const,
      extractionNote: 'This file looks binary or uses an unsupported text encoding.',
      textContent: '',
      textTruncated: false,
      textLength: 0,
    };
  }

  const normalizedText = normalizeText(
    HTML_EXTENSIONS.has(extension) ? stripHtml(decodedText) : decodedText,
  );

  if (!normalizedText) {
    return {
      extractionStatus: 'empty' as const,
      extractionNote: 'No readable text was found in this file.',
      textContent: '',
      textTruncated: false,
      textLength: 0,
    };
  }

  return {
    extractionStatus: 'ready' as const,
    extractionNote:
      sizeBytes > MAX_TEXT_EXTRACTION_BYTES
        ? 'Only the first part of this file was indexed for MCP access.'
        : null,
    textContent: normalizedText,
    textTruncated: sizeBytes > MAX_TEXT_EXTRACTION_BYTES,
    textLength: normalizedText.length,
  };
}

function toKnowledgeBase(manifest: CourseMaterialsManifest): CourseKnowledgeBase {
  return {
    courseId: manifest.courseId,
    updatedAt: manifest.updatedAt,
    materials: manifest.materials,
    summary: buildKnowledgeBaseSummary(manifest.materials),
  };
}

async function listCourseMaterials(courseId: number): Promise<CourseKnowledgeBase> {
  return toKnowledgeBase(await readManifest(courseId));
}

async function importCourseMaterials(
  courseId: number,
  filePaths: string[],
): Promise<UploadCourseMaterialsResult> {
  assertCourseId(courseId);
  await ensureCourseDirectories(courseId);

  const existingManifest = await readManifest(courseId);
  const imported: CourseMaterialRecord[] = [];
  const skipped: UploadCourseMaterialsResult['skipped'] = [];

  for (const filePath of filePaths) {
    const baseName = path.basename(filePath);
    const baseDir = resolveCourseMaterialsBaseDir();
    let absoluteStoragePath = '';
    let absoluteTextPath = '';

    try {
      const fileStats = await fs.stat(filePath);

      if (!fileStats.isFile()) {
        skipped.push({
          name: baseName,
          reason: 'Only regular files can be added to the course knowledge base.',
        });
        continue;
      }

      const materialId = randomUUID();
      const extension = path.extname(filePath).toLowerCase();
      const storedFileName = `${materialId}${extension}`;
      const storageRelativePath = path.join('courses', String(courseId), 'files', storedFileName);
      absoluteStoragePath = path.join(baseDir, storageRelativePath);

      await fs.copyFile(filePath, absoluteStoragePath);

      const extractionResult = await extractText(filePath, fileStats.size, absoluteStoragePath);
      let textRelativePath: string | null = null;

      if (extractionResult.extractionStatus === 'ready') {
        const textFileName = `${materialId}.txt`;
        textRelativePath = path.join('courses', String(courseId), 'text', textFileName);
        absoluteTextPath = path.join(baseDir, textRelativePath);
        await fs.writeFile(absoluteTextPath, extractionResult.textContent, 'utf8');
      }

      imported.push({
        id: materialId,
        courseId,
        displayName: baseName,
        extension,
        mimeType: getMimeType(filePath),
        sizeBytes: fileStats.size,
        addedAt: new Date().toISOString(),
        storageRelativePath,
        textRelativePath,
        textExtracted: extractionResult.extractionStatus === 'ready',
        textLength: extractionResult.textLength,
        textExcerpt: buildExcerpt(extractionResult.textContent),
        textTruncated: extractionResult.textTruncated,
        extractionStatus: extractionResult.extractionStatus,
        extractionNote: extractionResult.extractionNote,
      });
    } catch (error) {
      skipped.push({
        name: baseName,
        reason: error instanceof Error ? error.message : 'Unable to import this file.',
      });

      await Promise.all([
        absoluteStoragePath ? fs.rm(absoluteStoragePath, { force: true }) : Promise.resolve(),
        absoluteTextPath ? fs.rm(absoluteTextPath, { force: true }) : Promise.resolve(),
      ]);
    }
  }

  const nextManifest = await writeManifest(courseId, [...imported, ...existingManifest.materials]);
  const knowledgeBase = toKnowledgeBase(nextManifest);

  return {
    ...knowledgeBase,
    canceled: false,
    imported,
    skipped,
  };
}

async function removeCourseMaterial(courseId: number, materialId: string): Promise<CourseKnowledgeBase> {
  assertCourseId(courseId);

  if (!materialId.trim()) {
    throw new Error('A material id is required.');
  }

  const manifest = await readManifest(courseId);
  const materialToRemove = manifest.materials.find((material) => material.id === materialId);

  if (!materialToRemove) {
    throw new Error('The selected material could not be found.');
  }

  const nextMaterials = manifest.materials.filter((material) => material.id !== materialId);

  await Promise.all([
    fs.rm(path.join(resolveCourseMaterialsBaseDir(), materialToRemove.storageRelativePath), {
      force: true,
    }),
    materialToRemove.textRelativePath
      ? fs.rm(path.join(resolveCourseMaterialsBaseDir(), materialToRemove.textRelativePath), {
          force: true,
        })
      : Promise.resolve(),
  ]);

  return toKnowledgeBase(await writeManifest(courseId, nextMaterials));
}

export {
  COURSE_MATERIALS_ENV_VAR,
  importCourseMaterials,
  listCourseMaterials,
  removeCourseMaterial,
  resolveCourseMaterialsBaseDir,
};
