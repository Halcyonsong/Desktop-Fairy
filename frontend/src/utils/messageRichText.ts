export interface MessageInlineToken {
  type: 'text' | 'code' | 'math' | 'bold' | 'italic' | 'linebreak';
  content: string;
}

export type MessageBlock =
  | { type: 'paragraph'; segments: MessageInlineToken[] }
  | { type: 'heading'; level: 1 | 2 | 3; segments: MessageInlineToken[] }
  | { type: 'divider' }
  | { type: 'code'; language: string; content: string }
  | { type: 'math'; content: string }
  | { type: 'table'; header: MessageInlineToken[][]; rows: MessageInlineToken[][][] };

function pushTextToken(tokens: MessageInlineToken[], buffer: string) {
  if (!buffer) {
    return;
  }
  tokens.push({ type: 'text', content: buffer });
}

function normalizeSource(content: string) {
  const normalizedLineEndings = content.replace(/\r\n/g, '\n');
  if (!normalizedLineEndings.includes('\n') && normalizedLineEndings.includes('\\n')) {
    return normalizedLineEndings.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
  }
  return normalizedLineEndings;
}

function parseInlineSegments(content: string): MessageInlineToken[] {
  const tokens: MessageInlineToken[] = [];
  let index = 0;
  let buffer = '';

  const flushBuffer = () => {
    pushTextToken(tokens, buffer);
    buffer = '';
  };

  while (index < content.length) {
    const current = content[index];

    if (content.slice(index, index + 4).toLowerCase() === '<br>') {
      flushBuffer();
      tokens.push({ type: 'linebreak', content: '' });
      index += 4;
      continue;
    }

    if (content.slice(index, index + 5).toLowerCase() === '<br/>') {
      flushBuffer();
      tokens.push({ type: 'linebreak', content: '' });
      index += 5;
      continue;
    }

    if (content.slice(index, index + 6).toLowerCase() === '<br />') {
      flushBuffer();
      tokens.push({ type: 'linebreak', content: '' });
      index += 6;
      continue;
    }

    if (content.slice(index, index + 2) === '**') {
      const end = content.indexOf('**', index + 2);
      if (end > index + 2) {
        flushBuffer();
        tokens.push({ type: 'bold', content: content.slice(index + 2, end) });
        index = end + 2;
        continue;
      }
    }

    if (current === '*' && content[index + 1] !== '*') {
      const end = content.indexOf('*', index + 1);
      if (end > index + 1 && content[end - 1] !== ' ') {
        flushBuffer();
        tokens.push({ type: 'italic', content: content.slice(index + 1, end) });
        index = end + 1;
        continue;
      }
    }

    if (current === '`') {
      const end = content.indexOf('`', index + 1);
      if (end > index + 1) {
        flushBuffer();
        tokens.push({ type: 'code', content: content.slice(index + 1, end) });
        index = end + 1;
        continue;
      }
    }

    if (current === '$' && content[index + 1] !== '$') {
      const end = content.indexOf('$', index + 1);
      if (end > index + 1) {
        flushBuffer();
        tokens.push({ type: 'math', content: content.slice(index + 1, end) });
        index = end + 1;
        continue;
      }
    }

    buffer += current;
    index += 1;
  }

  flushBuffer();
  return tokens;
}

function isTableSeparator(line: string): boolean {
  const normalized = line.trim();
  return /^\|?(\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?$/.test(normalized);
}

function looksLikeTableRow(line: string): boolean {
  const normalized = line.trim();
  return normalized.includes('|') && normalized.replace(/\|/g, '').trim().length > 0;
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((cell) => cell.trim());
}

function parseHeading(line: string): { level: 1 | 2 | 3; content: string } | null {
  const trimmed = line.trim();
  const match = trimmed.match(/^(#{1,3})\s+(.*)$/);
  if (!match) {
    return null;
  }

  const level = Math.min(match[1].length, 3) as 1 | 2 | 3;
  return { level, content: match[2].trim() };
}

function isDivider(line: string) {
  return /^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$/.test(line);
}

export function parseMessageBlocks(content: string): MessageBlock[] {
  const normalized = normalizeSource(content);
  const lines = normalized.split('\n');
  const blocks: MessageBlock[] = [];
  let index = 0;

  const flushParagraph = (paragraphLines: string[]) => {
    const paragraph = paragraphLines.join('\n').trim();
    if (!paragraph) {
      return;
    }
    blocks.push({ type: 'paragraph', segments: parseInlineSegments(paragraph) });
  };

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (isDivider(line)) {
      blocks.push({ type: 'divider' });
      index += 1;
      continue;
    }

    const heading = parseHeading(line);
    if (heading) {
      blocks.push({ type: 'heading', level: heading.level, segments: parseInlineSegments(heading.content) });
      index += 1;
      continue;
    }

    if (trimmed.startsWith('```')) {
      const language = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) {
        index += 1;
      }
      blocks.push({ type: 'code', language, content: codeLines.join('\n') });
      continue;
    }

    if (trimmed === '$$') {
      const mathLines: string[] = [];
      index += 1;
      while (index < lines.length && lines[index].trim() !== '$$') {
        mathLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) {
        index += 1;
      }
      blocks.push({ type: 'math', content: mathLines.join('\n').trim() });
      continue;
    }

    if (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length > 4) {
      blocks.push({ type: 'math', content: trimmed.slice(2, -2).trim() });
      index += 1;
      continue;
    }

    if (index + 1 < lines.length && looksLikeTableRow(line) && isTableSeparator(lines[index + 1])) {
      const header = splitTableRow(line).map(parseInlineSegments);
      const rows: MessageInlineToken[][][] = [];
      index += 2;
      while (index < lines.length && looksLikeTableRow(lines[index])) {
        rows.push(splitTableRow(lines[index]).map(parseInlineSegments));
        index += 1;
      }
      blocks.push({ type: 'table', header, rows });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const current = lines[index];
      const currentTrimmed = current.trim();
      const next = lines[index + 1];

      if (!currentTrimmed) {
        break;
      }

      if (isDivider(current) || parseHeading(current)) {
        break;
      }

      if (currentTrimmed.startsWith('```') || currentTrimmed === '$$') {
        break;
      }

      if (index + 1 < lines.length && looksLikeTableRow(current) && isTableSeparator(next ?? '')) {
        break;
      }

      paragraphLines.push(current);
      index += 1;
    }

    flushParagraph(paragraphLines);
  }

  return blocks;
}
