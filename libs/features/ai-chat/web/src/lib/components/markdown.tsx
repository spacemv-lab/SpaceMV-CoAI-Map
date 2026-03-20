/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import React from 'react';

type Block =
  | { kind: 'paragraph'; content: string }
  | { kind: 'code'; content: string; language?: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'heading'; level: 1 | 2 | 3; content: string }
  | { kind: 'quote'; content: string }
  | { kind: 'hr' };

function splitBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const hr = line.trim() === '---';
    if (hr) {
      blocks.push({ kind: 'hr' });
      i++;
      continue;
    }
    const heading = line.match(/^#{1,3}\s+(.*)$/);
    if (heading) {
      const level = line.match(/^#+/)![0].length as 1 | 2 | 3;
      const content = heading[1];
      blocks.push({ kind: 'heading', level, content });
      i++;
      continue;
    }
    if (line.trim().startsWith('>')) {
      const qs: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        qs.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({ kind: 'quote', content: qs.join('\n') });
      continue;
    }
    const fence = line.match(/^```(\w+)?\s*$/);
    if (fence) {
      const lang = fence[1];
      i++;
      const code: string[] = [];
      while (i < lines.length && !lines[i].startsWith('```')) {
        code.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].startsWith('```')) i++;
      blocks.push({
        kind: 'code',
        content: code.join('\n'),
        language: lang || undefined,
      });
      continue;
    }
    if (line.trim().startsWith('- ')) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('- ')) {
        items.push(lines[i].trim().slice(2));
        i++;
      }
      blocks.push({ kind: 'list', items });
      continue;
    }
    const paras: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('```')
    ) {
      paras.push(lines[i]);
      i++;
    }
    if (paras.length) {
      blocks.push({ kind: 'paragraph', content: paras.join('\n') });
    }
    while (i < lines.length && lines[i].trim() === '') i++;
  }
  return blocks;
}

function renderInline(text: string) {
  const nodes: React.ReactNode[] = [];
  let i = 0;
  while (i < text.length) {
    const codeStart = text.indexOf('`', i);
    const urlMatch = text.slice(i).match(/https?:\/\/[^\s)]+/);
    const nextUrlIdx = urlMatch ? i + urlMatch.index! : -1;
    const boldStart = text.indexOf('**', i);
    const italicStart = text.indexOf('*', i);
    const candidates = [codeStart, nextUrlIdx, boldStart, italicStart]
      .filter((x) => x >= 0)
      .sort((a, b) => a - b);
    const nextIdx = candidates[0];
    if (nextIdx === undefined || nextIdx < 0) {
      nodes.push(text.slice(i));
      break;
    }
    if (nextIdx > i) nodes.push(text.slice(i, nextIdx));
    if (nextIdx === codeStart) {
      const end = text.indexOf('`', codeStart + 1);
      if (end > codeStart) {
        nodes.push(
          <code key={i} className="px-1 rounded bg-black/5 dark:bg-white/10">
            {text.slice(codeStart + 1, end)}
          </code>,
        );
        i = end + 1;
      } else {
        nodes.push(text.slice(codeStart));
        break;
      }
    } else if (urlMatch && nextIdx === nextUrlIdx) {
      const url = urlMatch[0];
      nodes.push(
        <a
          key={i}
          href={url}
          target="_blank"
          rel="noreferrer"
          className="underline text-blue-600 dark:text-blue-400"
        >
          {url}
        </a>,
      );
      i = nextIdx + url.length;
    } else if (nextIdx === boldStart) {
      const end = text.indexOf('**', boldStart + 2);
      if (end > boldStart) {
        nodes.push(<strong key={i}>{text.slice(boldStart + 2, end)}</strong>);
        i = end + 2;
      } else {
        nodes.push(text.slice(boldStart));
        break;
      }
    } else if (nextIdx === italicStart) {
      if (text.slice(italicStart, italicStart + 2) === '**') {
        i = italicStart + 2;
        continue;
      }
      const end = text.indexOf('*', italicStart + 1);
      if (end > italicStart) {
        nodes.push(<em key={i}>{text.slice(italicStart + 1, end)}</em>);
        i = end + 1;
      } else {
        nodes.push(text.slice(italicStart));
        break;
      }
    }
  }
  return <>{nodes}</>;
}

export function MarkdownContent({ text }: { text: string }) {
  const blocks = React.useMemo(() => splitBlocks(text), [text]);
  const [copiedIdx, setCopiedIdx] = React.useState<number | null>(null);
  return (
    <div className="space-y-3">
      {blocks.map((b, idx) => {
        if (b.kind === 'paragraph') {
          return (
            <p key={idx} className="whitespace-pre-wrap break-words">
              {renderInline(b.content)}
            </p>
          );
        }
        if (b.kind === 'heading') {
          const cls =
            b.level === 1
              ? 'text-2xl font-semibold'
              : b.level === 2
                ? 'text-xl font-semibold'
                : 'text-lg font-semibold';
          return (
            <div key={idx} className={cls}>
              {renderInline(b.content)}
            </div>
          );
        }
        if (b.kind === 'quote') {
          return (
            <blockquote
              key={idx}
              className="border-l-4 pl-3 text-sm opacity-80"
              style={{ borderColor: 'var(--ai-border)' }}
            >
              {renderInline(b.content)}
            </blockquote>
          );
        }
        if (b.kind === 'list') {
          return (
            <ul key={idx} className="list-disc pl-6 space-y-1">
              {b.items.map((it, j) => (
                <li key={j}>{renderInline(it)}</li>
              ))}
            </ul>
          );
        }
        if (b.kind === 'hr') {
          return <hr key={idx} className="opacity-50" />;
        }
        return (
          <div key={idx} className="group relative">
            <pre
              className="overflow-auto rounded border p-3 text-xs"
              style={{ borderColor: 'var(--ai-border)' }}
            >
              <code>{b.content}</code>
            </pre>
            <button
              className="absolute top-2 right-2 text-xs px-2 py-1 rounded border opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ borderColor: 'var(--ai-border)' }}
              onClick={async () => {
                await navigator.clipboard.writeText(b.content);
                setCopiedIdx(idx);
                window.setTimeout(() => setCopiedIdx(null), 1500);
              }}
            >
              复制代码
            </button>
            {copiedIdx === idx && (
              <span className="absolute top-2 right-20 text-xs px-2 py-1 rounded-md border bg-white/85 dark:bg-neutral-900/60 transition-opacity">
                已复制
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
