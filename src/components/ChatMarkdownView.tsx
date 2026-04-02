import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

function ChatMarkdownView({ markdown }: { markdown: string }) {
  const components = {
    h1: ({ children, ...props }: { children: React.ReactNode }) => (
      <h1 className="text-xl font-semibold tracking-tight mt-4 mb-2" {...props}>
        {children}
      </h1>
    ),
    h2: ({ children, ...props }: { children: React.ReactNode }) => (
      <h2 className="text-lg font-semibold tracking-tight mt-3 mb-2" {...props}>
        {children}
      </h2>
    ),
    h3: ({ children, ...props }: { children: React.ReactNode }) => (
      <h3 className="text-base font-semibold tracking-tight mt-3 mb-1" {...props}>
        {children}
      </h3>
    ),
    p: ({ children, ...props }: { children: React.ReactNode }) => (
      <p className="text-sm leading-6 mb-2" {...props}>
        {children}
      </p>
    ),
    ul: ({ children, ...props }: { children: React.ReactNode }) => (
      <ul className="list-disc space-y-1 pl-5 text-sm leading-6 mb-2" {...props}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }: { children: React.ReactNode }) => (
      <ol className="list-decimal space-y-1 pl-5 text-sm leading-6 mb-2" {...props}>
        {children}
      </ol>
    ),
    li: ({ children, ...props }: { children: React.ReactNode }) => (
      <li className="mt-0.5" {...props}>{children}</li>
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
            className="rounded-lg overflow-hidden my-2 text-xs"
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
      <div className="my-2">{children}</div>
    ),
    strong: ({ children, ...props }: { children: React.ReactNode }) => (
      <strong className="font-semibold" {...props}>
        {children}
      </strong>
    ),
    em: ({ children, ...props }: { children: React.ReactNode }) => (
      <em className="italic" {...props}>
        {children}
      </em>
    ),
    a: ({ children, href, ...props }: { children: React.ReactNode; href?: string }) => (
      <a 
        href={href} 
        className="underline decoration-neutral-400 underline-offset-4 hover:decoration-current text-blue-600 dark:text-blue-400"
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      >
        {children}
      </a>
    ),
    blockquote: ({ children, ...props }: { children: React.ReactNode }) => (
      <blockquote 
        className="pl-3 border-l-2 border-neutral-300 dark:border-neutral-700 italic text-neutral-600 dark:text-neutral-400 my-2"
        {...props}
      >
        {children}
      </blockquote>
    ),
    hr: () => (
      <hr className="my-4 border-neutral-200 dark:border-neutral-800" />
    ),
    table: ({ children, ...props }: { children: React.ReactNode }) => (
      <div className="overflow-x-auto my-2">
        <table className="min-w-full border-collapse border border-neutral-300 dark:border-neutral-700 text-xs" {...props}>
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
        className="px-2 py-1 text-left text-xs font-semibold border border-neutral-300 dark:border-neutral-700"
        {...props}
      >
        {children}
      </th>
    ),
    td: ({ children, ...props }: { children: React.ReactNode }) => (
      <td 
        className="px-2 py-1 text-xs border border-neutral-300 dark:border-neutral-700"
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
  };

  return (
    <div className="space-y-1 break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

export default ChatMarkdownView;
