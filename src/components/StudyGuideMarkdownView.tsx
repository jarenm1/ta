import { useCallback, useMemo, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { StudyGuideMarkdownDocument } from '../lib/studyGuides';

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

function slugifyHeading(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function extractStudyGuideHeadings(markdown: string): StudyGuideHeading[] {
  const seenIds = new Map<string, number>();
  const headingRegex = /^(#{1,3})\s+(.+)$/gm;
  const headings: StudyGuideHeading[] = [];
  let match;

  while ((match = headingRegex.exec(markdown)) !== null) {
    const level = match[1].length as 1 | 2 | 3;
    const text = match[2].trim();
    const baseId = slugifyHeading(text) || `section-${level}`;
    const duplicateCount = seenIds.get(baseId) || 0;
    seenIds.set(baseId, duplicateCount + 1);

    headings.push({
      id: duplicateCount === 0 ? baseId : `${baseId}-${duplicateCount + 1}`,
      level,
      text,
    });
  }

  return headings;
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

  // Custom components for ReactMarkdown
  const components = useMemo(() => ({
    h1: ({ children, ...props }: { children: React.ReactNode }) => {
      const text = String(children);
      const heading = headings.find(h => h.text === text && h.level === 1);
      return (
        <h1 
          id={heading?.id} 
          className="mt-8 scroll-mt-24 text-3xl font-semibold tracking-tight first:mt-0 text-neutral-900 dark:text-neutral-100"
          {...props}
        >
          {children}
        </h1>
      );
    },
    h2: ({ children, ...props }: { children: React.ReactNode }) => {
      const text = String(children);
      const heading = headings.find(h => h.text === text && h.level === 2);
      return (
        <h2 
          id={heading?.id} 
          className="mt-8 scroll-mt-24 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100"
          {...props}
        >
          {children}
        </h2>
      );
    },
    h3: ({ children, ...props }: { children: React.ReactNode }) => {
      const text = String(children);
      const heading = headings.find(h => h.text === text && h.level === 3);
      return (
        <h3 
          id={heading?.id} 
          className="mt-6 scroll-mt-24 text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100"
          {...props}
        >
          {children}
        </h3>
      );
    },
    p: ({ children, ...props }: { children: React.ReactNode }) => (
      <p className="mt-4 text-base leading-7 text-neutral-700 dark:text-neutral-300" {...props}>
        {children}
      </p>
    ),
    ul: ({ children, ...props }: { children: React.ReactNode }) => (
      <ul className="mt-4 list-disc space-y-2 pl-6 text-base leading-7 text-neutral-700 dark:text-neutral-300" {...props}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }: { children: React.ReactNode }) => (
      <ol className="mt-4 list-decimal space-y-2 pl-6 text-base leading-7 text-neutral-700 dark:text-neutral-300" {...props}>
        {children}
      </ol>
    ),
    li: ({ children, ...props }: { children: React.ReactNode }) => (
      <li className="mt-1" {...props}>{children}</li>
    ),
    code: ({ inline, className, children, ...props }: { inline?: boolean; className?: string; children: React.ReactNode }) => {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';
      
      if (!inline && language) {
        return (
          <SyntaxHighlighter
            style={vscDarkPlus}
            language={language}
            PreTag="div"
            className="mt-4 rounded-lg overflow-hidden"
            {...props}
          >
            {String(children).replace(/\n$/, '')}
          </SyntaxHighlighter>
        );
      }
      
      return (
        <code 
          className="rounded bg-neutral-200 px-1.5 py-0.5 text-[0.95em] text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100 font-mono"
          {...props}
        >
          {children}
        </code>
      );
    },
    pre: ({ children }: { children: React.ReactNode }) => (
      <div className="mt-4">{children}</div>
    ),
    strong: ({ children, ...props }: { children: React.ReactNode }) => (
      <strong className="font-semibold text-neutral-900 dark:text-neutral-100" {...props}>
        {children}
      </strong>
    ),
    em: ({ children, ...props }: { children: React.ReactNode }) => (
      <em className="italic text-neutral-700 dark:text-neutral-300" {...props}>
        {children}
      </em>
    ),
    a: ({ children, href, ...props }: { children: React.ReactNode; href?: string }) => (
      <a 
        href={href} 
        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      >
        {children}
      </a>
    ),
    blockquote: ({ children, ...props }: { children: React.ReactNode }) => (
      <blockquote 
        className="mt-4 pl-4 border-l-4 border-neutral-300 dark:border-neutral-700 italic text-neutral-600 dark:text-neutral-400"
        {...props}
      >
        {children}
      </blockquote>
    ),
    hr: () => (
      <hr className="my-8 border-neutral-200 dark:border-neutral-800" />
    ),
    table: ({ children, ...props }: { children: React.ReactNode }) => (
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full border-collapse border border-neutral-300 dark:border-neutral-700" {...props}>
          {children}
        </table>
      </div>
    ),
    thead: ({ children, ...props }: { children: React.ReactNode }) => (
      <thead className="bg-neutral-100 dark:bg-neutral-800" {...props}>
        {children}
      </thead>
    ),
    th: ({ children, ...props }: { children: React.ReactNode }) => (
      <th 
        className="px-4 py-2 text-left text-sm font-semibold text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-700"
        {...props}
      >
        {children}
      </th>
    ),
    td: ({ children, ...props }: { children: React.ReactNode }) => (
      <td 
        className="px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-700"
        {...props}
      >
        {children}
      </td>
    ),
    tr: ({ children, ...props }: { children: React.ReactNode }) => (
      <tr className="even:bg-neutral-50 dark:even:bg-neutral-900/50" {...props}>
        {children}
      </tr>
    ),
  }), [headings]);

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

      <div className="mt-6 prose dark:prose-invert max-w-none">
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          components={components}
        >
          {document.markdown}
        </ReactMarkdown>
      </div>
    </article>
  );
}

export { extractStudyGuideHeadings };
export type { StudyGuideHeading };
export default StudyGuideMarkdownView;
