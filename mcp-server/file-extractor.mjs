import { promises as fs } from 'node:fs';
import path from 'node:path';

// Lazy imports - only load when needed to reduce startup time
let pdfParse = null;
let mammoth = null;
let xlsx = null;
let pptxParser = null;
let tesseract = null;
let sharp = null;

async function loadPdfParse() {
  if (!pdfParse) {
    const { default: pdfParseLib } = await import('pdf-parse/lib/pdf-parse.js');
    pdfParse = pdfParseLib;
  }
  return pdfParse;
}

async function loadMammoth() {
  if (!mammoth) {
    mammoth = await import('mammoth');
  }
  return mammoth;
}

async function loadXlsx() {
  if (!xlsx) {
    xlsx = await import('xlsx');
  }
  return xlsx;
}

async function loadPptxParser() {
  if (!pptxParser) {
    const { default: PptxParser } = await import('pptx-parser');
    pptxParser = PptxParser;
  }
  return pptxParser;
}

async function loadTesseract() {
  if (!tesseract) {
    const { createWorker } = await import('tesseract.js');
    tesseract = { createWorker };
  }
  return tesseract;
}

async function loadSharp() {
  if (!sharp) {
    const { default: sharpLib } = await import('sharp');
    sharp = sharpLib;
  }
  return sharp;
}

const SUPPORTED_BINARY_EXTENSIONS = new Set([
  '.pdf',
  '.docx',
  '.xlsx',
  '.xls',
  '.pptx',
  '.ppt',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.bmp',
  '.webp',
  '.tiff',
  '.tif',
]);

const OFFICE_EXTENSIONS = new Set(['.docx', '.xlsx', '.xls', '.pptx', '.ppt']);
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.tiff', '.tif']);

function isBinaryExtractable(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return SUPPORTED_BINARY_EXTENSIONS.has(extension);
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

function truncateText(text, maxChars) {
  if (text.length <= maxChars) {
    return { text, truncated: false };
  }
  return {
    text: text.slice(0, maxChars).trimEnd() + '…',
    truncated: true,
  };
}

async function extractPdfText(filePath, maxChars) {
  try {
    const pdfParse = await loadPdfParse();
    const dataBuffer = await fs.readFile(filePath);
    const result = await pdfParse(dataBuffer);
    const text = normalizeText(result.text);
    const { text: truncatedText, truncated } = truncateText(text, maxChars);

    return {
      success: true,
      text: truncatedText,
      fullTextLength: text.length,
      truncated,
      metadata: {
        pageCount: result.numpages || null,
        info: result.info || null,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `PDF extraction failed: ${error.message}`,
      text: null,
    };
  }
}

async function extractDocxText(filePath, maxChars) {
  try {
    const mammoth = await loadMammoth();
    const result = await mammoth.extractRawText({ path: filePath });
    const text = normalizeText(result.value);
    const { text: truncatedText, truncated } = truncateText(text, maxChars);

    return {
      success: true,
      text: truncatedText,
      fullTextLength: text.length,
      truncated,
      metadata: {
        messages: result.messages || [],
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `DOCX extraction failed: ${error.message}`,
      text: null,
    };
  }
}

async function extractXlsxText(filePath, maxChars) {
  try {
    const xlsx = await loadXlsx();
    const workbook = xlsx.readFile(filePath);
    let text = '';

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const sheetText = xlsx.utils.sheet_to_csv(sheet);
      text += `\n=== Sheet: ${sheetName} ===\n${sheetText}`;
    }

    text = normalizeText(text);
    const { text: truncatedText, truncated } = truncateText(text, maxChars);

    return {
      success: true,
      text: truncatedText,
      fullTextLength: text.length,
      truncated,
      metadata: {
        sheetCount: workbook.SheetNames.length,
        sheetNames: workbook.SheetNames,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `XLSX extraction failed: ${error.message}`,
      text: null,
    };
  }
}

async function extractPptxText(filePath, maxChars) {
  try {
    // Read file as buffer for pptx-parser
    const buffer = await fs.readFile(filePath);
    const PptxParser = await loadPptxParser();
    const parser = new PptxParser();
    const result = await parser.parse(buffer);

    let text = '';
    if (result.slides && Array.isArray(result.slides)) {
      for (let i = 0; i < result.slides.length; i++) {
        const slide = result.slides[i];
        if (slide.text) {
          text += `\n=== Slide ${i + 1} ===\n${slide.text}`;
        }
      }
    }

    text = normalizeText(text);
    const { text: truncatedText, truncated } = truncateText(text, maxChars);

    return {
      success: true,
      text: truncatedText,
      fullTextLength: text.length,
      truncated,
      metadata: {
        slideCount: result.slides?.length || 0,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `PPTX extraction failed: ${error.message}`,
      text: null,
    };
  }
}

async function extractImageText(filePath, maxChars) {
  try {
    const tesseract = await loadTesseract();
    const sharp = await loadSharp();

    // Preprocess image with sharp for better OCR
    const processedBuffer = await sharp(filePath)
      .grayscale()
      .normalize()
      .toBuffer();

    const worker = await tesseract.createWorker('eng');
    const result = await worker.recognize(processedBuffer);
    await worker.terminate();

    const text = normalizeText(result.data.text);
    const { text: truncatedText, truncated } = truncateText(text, maxChars);

    return {
      success: true,
      text: truncatedText,
      fullTextLength: text.length,
      truncated,
      metadata: {
        confidence: result.data.confidence,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `OCR extraction failed: ${error.message}`,
      text: null,
    };
  }
}

async function extractBinaryFileText(filePath, options = {}) {
  const maxChars = Math.max(1000, Number(options.maxChars) || 12000);
  const extension = path.extname(filePath).toLowerCase();

  if (!isBinaryExtractable(filePath)) {
    return {
      success: false,
      error: `Unsupported file extension: ${extension}`,
      text: null,
    };
  }

  const stats = await fs.stat(filePath);
  const maxFileSize = Number(options.maxFileSize) || 50 * 1024 * 1024; // 50MB default

  if (stats.size > maxFileSize) {
    return {
      success: false,
      error: `File too large (${(stats.size / 1024 / 1024).toFixed(1)}MB > ${(maxFileSize / 1024 / 1024).toFixed(1)}MB limit)`,
      text: null,
    };
  }

  switch (extension) {
    case '.pdf':
      return extractPdfText(filePath, maxChars);
    case '.docx':
      return extractDocxText(filePath, maxChars);
    case '.xlsx':
    case '.xls':
      return extractXlsxText(filePath, maxChars);
    case '.pptx':
    case '.ppt':
      return extractPptxText(filePath, maxChars);
    case '.png':
    case '.jpg':
    case '.jpeg':
    case '.gif':
    case '.bmp':
    case '.webp':
    case '.tiff':
    case '.tif':
      return extractImageText(filePath, maxChars);
    default:
      return {
        success: false,
        error: `No extractor available for extension: ${extension}`,
        text: null,
      };
  }
}

async function getFileExtractionInfo(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const stats = await fs.stat(filePath);

  return {
    canExtract: isBinaryExtractable(filePath),
    extension,
    sizeBytes: stats.size,
    sizeMb: (stats.size / 1024 / 1024).toFixed(2),
    category: IMAGE_EXTENSIONS.has(extension)
      ? 'image'
      : OFFICE_EXTENSIONS.has(extension)
        ? 'office'
        : extension === '.pdf'
          ? 'pdf'
          : 'unknown',
  };
}

export {
  extractBinaryFileText,
  getFileExtractionInfo,
  isBinaryExtractable,
  SUPPORTED_BINARY_EXTENSIONS,
};
