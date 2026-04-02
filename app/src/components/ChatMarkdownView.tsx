type MarkdownBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'unordered-list'; items: string[] }
  | { type: 'ordered-list'; items: string[] }
  | { type: 'code'; text: string }
  | { type: 'math'; text: string };

function isMarkdownBoundary(line: string) {
  return (
    /^#{1,3}\s+/.test(line) ||
    /^-\s+/.test(line) ||
    /^\d+\.\s+/.test(line) ||
    /^```/.test(line) ||
    /^\$\$/.test(line.trim())
  );
}

function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trimEnd();
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      index += 1;
      continue;
    }

    const headingMatch = trimmedLine.match(/^(#{1,3})\s+(.*)$/);

    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length as 1 | 2 | 3,
        text: headingMatch[2].trim(),
      });
      index += 1;
      continue;
    }

    if (/^```/.test(trimmedLine)) {
      const codeLines: string[] = [];
      index += 1;

      while (index < lines.length && !/^```/.test(lines[index].trim())) {
        codeLines.push(lines[index]);
        index += 1;
      }

      blocks.push({ type: 'code', text: codeLines.join('\n').trimEnd() });
      index += 1;
      continue;
    }

    if (/^\$\$/.test(trimmedLine)) {
      const mathLines: string[] = [];
      const singleLineMath = trimmedLine.match(/^\$\$(.*)\$\$$/);

      if (singleLineMath) {
        blocks.push({ type: 'math', text: singleLineMath[1].trim() });
        index += 1;
        continue;
      }

      index += 1;

      while (index < lines.length && !/^\$\$$/.test(lines[index].trim())) {
        mathLines.push(lines[index]);
        index += 1;
      }

      blocks.push({ type: 'math', text: mathLines.join('\n').trim() });
      index += 1;
      continue;
    }

    if (/^-\s+/.test(trimmedLine)) {
      const items: string[] = [];

      while (index < lines.length && /^-\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^-\s+/, ''));
        index += 1;
      }

      blocks.push({ type: 'unordered-list', items });
      continue;
    }

    if (/^\d+\.\s+/.test(trimmedLine)) {
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

    blocks.push({ type: 'paragraph', text: paragraphLines.join(' ').trim() });
  }

  return blocks;
}

function renderInlineMarkdown(text: string, keyPrefix: string) {
  return text
    .split(/(`[^`]+`|\*\*[^*]+\*\*|\$[^$\n]+\$|\[[^\]]+\]\([^\s)]+\))/g)
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

      if (part.startsWith('$') && part.endsWith('$')) {
        return (
          <span
            className="rounded bg-violet-500/10 px-1.5 py-0.5 font-serif italic text-violet-900 dark:text-violet-200"
            key={key}
          >
            {part.slice(1, -1)}
          </span>
        );
      }

      const linkMatch = part.match(/^\[([^\]]+)\]\(([^\s)]+)\)$/);
      if (linkMatch) {
        return (
          <a
            className="underline decoration-neutral-400 underline-offset-4 hover:decoration-current"
            href={linkMatch[2]}
            key={key}
            rel="noreferrer"
            target="_blank"
          >
            {linkMatch[1]}
          </a>
        );
      }

      return <span key={key}>{part}</span>;
    });
}

function ChatMarkdownView({ markdown }: { markdown: string }) {
  const blocks = parseMarkdownBlocks(markdown);

  return (
    <div className="space-y-3 break-words">
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;

        switch (block.type) {
          case 'heading':
            if (block.level === 1) {
              return (
                <h3 className="text-base font-semibold tracking-tight" key={key}>
                  {renderInlineMarkdown(block.text, key)}
                </h3>
              );
            }

            return (
              <h4 className="text-sm font-semibold tracking-tight" key={key}>
                {renderInlineMarkdown(block.text, key)}
              </h4>
            );

          case 'paragraph':
            return (
              <p className="text-sm leading-6" key={key}>
                {renderInlineMarkdown(block.text, key)}
              </p>
            );

          case 'unordered-list':
            return (
              <ul className="list-disc space-y-1 pl-5 text-sm leading-6" key={key}>
                {block.items.map((item, itemIndex) => (
                  <li key={`${key}-${itemIndex}`}>{renderInlineMarkdown(item, `${key}-${itemIndex}`)}</li>
                ))}
              </ul>
            );

          case 'ordered-list':
            return (
              <ol className="list-decimal space-y-1 pl-5 text-sm leading-6" key={key}>
                {block.items.map((item, itemIndex) => (
                  <li key={`${key}-${itemIndex}`}>{renderInlineMarkdown(item, `${key}-${itemIndex}`)}</li>
                ))}
              </ol>
            );

          case 'code':
            return (
              <pre
                className="overflow-x-auto rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-3 text-xs leading-5 text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-200"
                key={key}
              >
                <code>{block.text}</code>
              </pre>
            );

          case 'math':
            return (
              <div
                className="overflow-x-auto rounded-xl bg-violet-500/10 px-3 py-3 text-center font-serif text-sm italic text-violet-950 dark:text-violet-100"
                key={key}
              >
                {block.text}
              </div>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}

export default ChatMarkdownView;
