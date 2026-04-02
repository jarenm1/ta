import { useCallback, useMemo, useRef } from 'react';
import { CodeBlock } from './ui';
import type { StudyGuideMarkdownDocument } from '../lib/studyGuides';

type MarkdownBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'unordered-list'; items: string[] }
  | { type: 'ordered-list'; items: string[] }
  | { type: 'code'; text: string };

type StudyGuideHeading = {
  id: string;
  level: 1 | 2 | 3;
  text: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function isMarkdownBoundary(line: string) {
  return (
    /^#{1,3}\s+/.test(line) ||
    /^-\s+/.test(line) ||
    /^\d+\.\s+/.test(line) ||
    /^```/.test(line)
  );
}

function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trimEnd();

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);

    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length as 1 | 2 | 3,
        text: headingMatch[2].trim(),
      });
      index += 1;
      continue;
    }

    if (/^```/.test(line)) {
      const codeLines: string[] = [];
      index += 1;

      while (index < lines.length && !/^```/.test(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }

      blocks.push({ type: 'code', text: codeLines.join('\n').trimEnd() });
      index += 1;
      continue;
    }

    if (/^-\s+/.test(line)) {
      const items: string[] = [];

      while (index < lines.length && /^-\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^-\s+/, ''));
        index += 1;
      }

      blocks.push({ type: 'unordered-list', items });
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];

      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ''));
        index += 1;
      }

      blocks.push({ type: 'ordered-list', items });
      continue;
    }

    const paragraphLines: string[] = [];

    while (index < lines.length) {
      const nextLine = lines[index].trimEnd();

      if (!nextLine.trim() || isMarkdownBoundary(nextLine)) {
        break;
      }

      paragraphLines.push(nextLine.trim());
      index += 1;
    }

    blocks.push({
      type: 'paragraph',
      text: paragraphLines.join(' ').trim(),
    });
  }

  return blocks;
}

function slugifyHeading(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function extractStudyGuideHeadings(markdown: string): StudyGuideHeading[] {
  const seenIds = new Map<string, number>();

  return parseMarkdownBlocks(markdown)
    .filter((block): block is Extract<MarkdownBlock, { type: 'heading' }> => block.type === 'heading')
    .map((block) => {
      const baseId = slugifyHeading(block.text) || `section-${block.level}`;
      const duplicateCount = seenIds.get(baseId) || 0;
      seenIds.set(baseId, duplicateCount + 1);

      return {
        id: duplicateCount === 0 ? baseId : `${baseId}-${duplicateCount + 1}`,
        level: block.level,
        text: block.text,
      };
    });
}

function renderInlineMarkdown(text: string, keyPrefix: string) {
  return text
    .split(/(`[^`]+`|\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part, index) => {
      const key = `${keyPrefix}-${index}`;

      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            className="rounded bg-neutral-200 px-1.5 py-0.5 text-[0.95em] text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
            key={key}
          >
            {part.slice(1, -1)}
          </code>
        );
      }

      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={key}>{part.slice(2, -2)}</strong>;
      }

      return <span key={key}>{part}</span>;
    });
}

function renderMarkdownBlocks(markdown: string) {
  const blocks = parseMarkdownBlocks(markdown);
  const headings = extractStudyGuideHeadings(markdown);
  let headingIndex = 0;

  return blocks.map((block, index) => {
    const key = `${block.type}-${index}`;

    switch (block.type) {
      case 'heading': {
        const heading = headings[headingIndex];
        headingIndex += 1;

        if (block.level === 1) {
          return (
            <h1
              className="mt-8 scroll-mt-24 text-3xl font-semibold tracking-tight first:mt-0"
              id={heading?.id}
              key={key}
            >
              {renderInlineMarkdown(block.text, key)}
            </h1>
          );
        }

        if (block.level === 2) {
          return (
            <h2
              className="mt-8 scroll-mt-24 text-2xl font-semibold tracking-tight"
              id={heading?.id}
              key={key}
            >
              {renderInlineMarkdown(block.text, key)}
            </h2>
          );
        }

        return (
          <h3
            className="mt-6 scroll-mt-24 text-xl font-semibold tracking-tight"
            id={heading?.id}
            key={key}
          >
            {renderInlineMarkdown(block.text, key)}
          </h3>
        );
      }

      case 'paragraph':
        return (
          <p className="mt-4 text-base leading-7 text-neutral-700 dark:text-neutral-300" key={key}>
            {renderInlineMarkdown(block.text, key)}
          </p>
        );

      case 'unordered-list':
        return (
          <ul className="mt-4 list-disc space-y-2 pl-6 text-base leading-7 text-neutral-700 dark:text-neutral-300" key={key}>
            {block.items.map((item, itemIndex) => (
              <li key={`${key}-${itemIndex}`}>{renderInlineMarkdown(item, `${key}-${itemIndex}`)}</li>
            ))}
          </ul>
        );

      case 'ordered-list':
        return (
          <ol className="mt-4 list-decimal space-y-2 pl-6 text-base leading-7 text-neutral-700 dark:text-neutral-300" key={key}>
            {block.items.map((item, itemIndex) => (
              <li key={`${key}-${itemIndex}`}>{renderInlineMarkdown(item, `${key}-${itemIndex}`)}</li>
            ))}
          </ol>
        );

      case 'code':
        return (
          <CodeBlock className="mt-4" key={key}>
            {block.text}
          </CodeBlock>
        );

      default:
        return null;
    }
  });
}

type StudyGuideMarkdownViewProps = {
  document: StudyGuideMarkdownDocument;
  onSelectionChange?: (selectionText: string) => void;
};

function StudyGuideMarkdownView({ document, onSelectionChange }: StudyGuideMarkdownViewProps) {
  const articleRef = useRef<HTMLElement | null>(null);
  const headings = useMemo(() => extractStudyGuideHeadings(document.markdown), [document.markdown]);

  const handleSelectionCapture = useCallback(() => {
    if (!onSelectionChange || !articleRef.current) {
      return;
    }

    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      onSelectionChange('');
      return;
    }

    const anchorNode = selection.anchorNode;
    const focusNode = selection.focusNode;

    if (
      (anchorNode && !articleRef.current.contains(anchorNode)) ||
      (focusNode && !articleRef.current.contains(focusNode))
    ) {
      return;
    }

    onSelectionChange(selection.toString().replace(/\s+/g, ' ').trim());
  }, [onSelectionChange]);

  return (
    <article
      className="min-w-0 border border-neutral-300 bg-white px-8 py-8 dark:border-neutral-800 dark:bg-neutral-900/60"
      onKeyUp={handleSelectionCapture}
      onMouseUp={handleSelectionCapture}
      ref={articleRef}
    >
      <div className="border-b border-neutral-200 pb-4 dark:border-neutral-800">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          {document.guide.title}
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Saved {formatDate(document.guide.createdAt)}
        </p>
        <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
          {headings.length} section{headings.length === 1 ? '' : 's'} in this guide.
        </p>
      </div>

      <div className="mt-6">{renderMarkdownBlocks(document.markdown)}</div>
    </article>
  );
}

export { extractStudyGuideHeadings };
export type { StudyGuideHeading };
export default StudyGuideMarkdownView;
