import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getFileText } from './canvas-client.mjs';
import { extractBinaryFileText, isBinaryExtractable } from './file-extractor.mjs';
import { resolveCourseMaterialsBaseDir } from './course-materials.mjs';

async function ensureDirectory(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

function generateMaterialId(fileName, fileId) {
  const base = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const timestamp = Date.now();
  return `${base}_${fileId}_${timestamp}`;
}

async function downloadAndExtractFile(session, fileMetadata, options = {}) {
  const courseId = options.courseId;
  const maxTextChars = Math.max(2000, Number(options.maxTextChars) || 12000);
  
  const baseDir = resolveCourseMaterialsBaseDir();
  const courseDir = path.join(baseDir, 'courses', String(courseId));
  const filesDir = path.join(courseDir, 'files');
  const textDir = path.join(courseDir, 'text');
  
  await ensureDirectory(filesDir);
  await ensureDirectory(textDir);
  
  const materialId = generateMaterialId(fileMetadata.display_name, fileMetadata.id);
  const storagePath = path.join('courses', String(courseId), 'files', materialId);
  const absoluteStoragePath = path.join(baseDir, storagePath);
  
  let textContent = null;
  let textTruncated = false;
  let textLength = 0;
  let textExtracted = false;
  let extractionStatus = 'pending';
  let extractionNote = '';
  let extractionMetadata = null;
  
  try {
    // Download the file
    const response = await fetch(fileMetadata.url, {
      headers: {
        Authorization: `Bearer ${session.token}`,
      },
    });
    
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }
    
    const buffer = await response.arrayBuffer();
    await fs.writeFile(absoluteStoragePath, Buffer.from(buffer));
    
    // Extract text based on file type
    if (isBinaryExtractable(fileMetadata.display_name)) {
      // For binary files, use the file-extractor
      const extractionResult = await extractBinaryFileText(absoluteStoragePath, {
        maxChars: maxTextChars,
        maxFileSize: options.maxFileSize,
      });
      
      if (extractionResult.success) {
        textContent = extractionResult.text;
        textLength = extractionResult.fullTextLength;
        textTruncated = extractionResult.truncated;
        textExtracted = true;
        extractionStatus = 'ready';
        extractionNote = 'Binary file extracted successfully.';
        extractionMetadata = extractionResult.metadata;
      } else {
        extractionStatus = 'error';
        extractionNote = extractionResult.error;
        textExtracted = false;
      }
    } else {
      // For text files, read directly
      try {
        const text = await fs.readFile(absoluteStoragePath, 'utf8');
        textLength = text.length;
        textTruncated = text.length > maxTextChars;
        textContent = textTruncated 
          ? text.slice(0, maxTextChars).trimEnd() + '…'
          : text;
        textExtracted = true;
        extractionStatus = 'ready';
        extractionNote = 'Text file loaded successfully.';
      } catch (readError) {
        extractionStatus = 'error';
        extractionNote = `Text file read failed: ${readError.message}`;
        textExtracted = false;
      }
    }
    
    // Save extracted text if we have it
    const textRelativePath = textContent 
      ? path.join('courses', String(courseId), 'text', `${materialId}.txt`)
      : null;
      
    if (textContent) {
      const absoluteTextPath = path.join(baseDir, textRelativePath);
      await fs.writeFile(absoluteTextPath, textContent, 'utf8');
    }
    
    return {
      success: true,
      material: {
        id: materialId,
        courseId,
        displayName: fileMetadata.display_name,
        extension: path.extname(fileMetadata.display_name).toLowerCase(),
        mimeType: fileMetadata.content_type || null,
        sizeBytes: fileMetadata.size,
        addedAt: new Date().toISOString(),
        storageRelativePath: storagePath,
        textRelativePath,
        textExtracted,
        textLength,
        textExcerpt: textContent 
          ? textContent.slice(0, 320).trimEnd() + (textContent.length > 320 ? '…' : '')
          : null,
        textTruncated,
        extractionStatus,
        extractionNote,
        extractionMetadata,
        canvasFileId: fileMetadata.id,
        source_origin: 'canvas_file',
        text_content: options.includeTextContent !== false ? textContent : null,
        text_content_truncated: textTruncated,
      },
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      material: null,
    };
  }
}

async function bulkDownloadFiles(session, files, options = {}) {
  const results = [];
  const errors = [];
  
  const concurrency = Math.max(1, Math.min(5, Number(options.concurrency) || 3));
  const maxFileSize = Number(options.maxFileSize) || 50 * 1024 * 1024; // 50MB default
  
  // Filter files by size and type
  const eligibleFiles = files.filter(file => {
    if (file.size > maxFileSize) {
      errors.push({
        fileId: file.id,
        fileName: file.display_name,
        error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB)`,
        skipped: true,
      });
      return false;
    }
    return true;
  });
  
  // Process files with concurrency limit
  let index = 0;
  
  async function worker() {
    while (index < eligibleFiles.length) {
      const currentIndex = index++;
      const file = eligibleFiles[currentIndex];
      
      try {
        const result = await downloadAndExtractFile(session, file, {
          ...options,
          maxFileSize,
        });
        
        if (result.success) {
          results.push(result.material);
        } else {
          errors.push({
            fileId: file.id,
            fileName: file.display_name,
            error: result.error,
            skipped: false,
          });
        }
      } catch (error) {
        errors.push({
          fileId: file.id,
          fileName: file.display_name,
          error: error.message,
          skipped: false,
        });
      }
    }
  }
  
  // Run workers
  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  
  return {
    downloaded: results.length,
    failed: errors.length,
    materials: results,
    errors,
  };
}

async function saveMaterialsToManifest(courseId, materials) {
  const baseDir = resolveCourseMaterialsBaseDir();
  const courseDir = path.join(baseDir, 'courses', String(courseId));
  const manifestPath = path.join(courseDir, 'materials.json');
  
  await ensureDirectory(courseDir);
  
  let existingManifest = { courseId, updatedAt: null, materials: [] };
  
  try {
    const existing = await fs.readFile(manifestPath, 'utf8');
    existingManifest = JSON.parse(existing);
  } catch {
    // No existing manifest, start fresh
  }
  
  // Merge new materials with existing (avoid duplicates by id)
  const existingIds = new Set(existingManifest.materials.map(m => m.id));
  const newMaterials = materials.filter(m => !existingIds.has(m.id));
  
  const updatedManifest = {
    courseId,
    updatedAt: new Date().toISOString(),
    materials: [...newMaterials, ...existingManifest.materials].sort(
      (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
    ),
  };
  
  await fs.writeFile(manifestPath, JSON.stringify(updatedManifest, null, 2), 'utf8');
  
  return {
    saved: newMaterials.length,
    total: updatedManifest.materials.length,
  };
}

export {
  bulkDownloadFiles,
  downloadAndExtractFile,
  saveMaterialsToManifest,
};
