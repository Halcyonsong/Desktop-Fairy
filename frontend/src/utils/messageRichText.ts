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
  // 先统一换行符
  let result = content.replace(/\r\n/g, '\n');
  // 始终转换字面 \n 和 \t（即使已有真实换行，也可能混合存在）
  result = result.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
  return result;
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

    // <br> 标签
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

    // 转义的 \$ 不作为数学分隔符
    if (current === '\\' && content[index + 1] === '$') {
      buffer += '$';
      index += 2;
      continue;
    }

    // 块级数学 $$...$$ （内联出现在段落中时）
    if (current === '$' && content[index + 1] === '$') {
      const end = content.indexOf('$$', index + 2);
      if (end > index + 2) {
        flushBuffer();
        tokens.push({ type: 'math', content: content.slice(index + 2, end) });
        index = end + 2;
        continue;
      }
    }

    // LaTeX 行内数学 \(...\)
    if (current === '\\' && content[index + 1] === '(') {
      const end = content.indexOf('\\)', index + 2);
      if (end > index + 2) {
        flushBuffer();
        tokens.push({ type: 'math', content: content.slice(index + 2, end) });
        index = end + 2;
        continue;
      }
    }

    // LaTeX 块级数学 \[...\]
    if (current === '\\' && content[index + 1] === '[') {
      const end = content.indexOf('\\]', index + 2);
      if (end > index + 2) {
        flushBuffer();
        tokens.push({ type: 'math', content: content.slice(index + 2, end) });
        index = end + 2;
        continue;
      }
    }

    // 行内数学 $...$
    // 先检查是否为 $$...$$ 的情况（块级数学内联出现在段落中）
    if (current === '$' && content[index + 1] === '$') {
      const blockEnd = content.indexOf('$$', index + 2);
      if (blockEnd > index + 2) {
        flushBuffer();
        tokens.push({ type: 'math', content: content.slice(index + 2, blockEnd) });
        index = blockEnd + 2;
        continue;
      }
    }

    // 行内数学 $...$（确保不是 $$ 的起始）
    if (current === '$' && content[index + 1] !== '$') {
      const end = content.indexOf('$', index + 1);
      if (end > index + 1 && content[end + 1] !== '$') {
        flushBuffer();
        tokens.push({ type: 'math', content: content.slice(index + 1, end) });
        index = end + 1;
        continue;
      }
    }

    // 粗体 **text**
    if (content.slice(index, index + 2) === '**') {
      const end = content.indexOf('**', index + 2);
      if (end > index + 2) {
        flushBuffer();
        tokens.push({ type: 'bold', content: content.slice(index + 2, end) });
        index = end + 2;
        continue;
      }
    }

    // 斜体 *text*
    if (current === '*' && content[index + 1] !== '*') {
      const end = content.indexOf('*', index + 1);
      if (end > index + 1 && content[end - 1] !== ' ') {
        flushBuffer();
        tokens.push({ type: 'italic', content: content.slice(index + 1, end) });
        index = end + 1;
        continue;
      }
    }

    // 行内代码 `code`
    if (current === '`') {
      const end = content.indexOf('`', index + 1);
      if (end > index + 1) {
        flushBuffer();
        tokens.push({ type: 'code', content: content.slice(index + 1, end) });
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

    // 块级数学 $$ ... $$（独占行）
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

    // 块级数学 $$...$$ （单行）
    if (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length > 4) {
      blocks.push({ type: 'math', content: trimmed.slice(2, -2).trim() });
      index += 1;
      continue;
    }

    // LaTeX 块级数学 \[...\] （独占行）
    if (trimmed === '\\[') {
      const mathLines: string[] = [];
      index += 1;
      while (index < lines.length && lines[index].trim() !== '\\]') {
        mathLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) {
        index += 1;
      }
      blocks.push({ type: 'math', content: mathLines.join('\n').trim() });
      continue;
    }

    // LaTeX 块级数学 \[...\] （单行）
    if (trimmed.startsWith('\\[') && trimmed.endsWith('\\]') && trimmed.length > 4) {
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

    // 兼容无表头表格：分隔符作为第一行（非标准 markdown，但后端可能输出）
    // 生成默认表头 "列1"、"列2"...，所有数据行都作为数据行
    if (isTableSeparator(line) && index + 1 < lines.length && looksLikeTableRow(lines[index + 1])) {
      const dataRows: string[] = [];
      index += 1;
      while (index < lines.length && looksLikeTableRow(lines[index])) {
        dataRows.push(lines[index]);
        index += 1;
      }
      if (dataRows.length > 0) {
        const columnCount = splitTableRow(dataRows[0]).length;
        const header = Array.from({ length: columnCount }, (_, i) =>
          parseInlineSegments(`列${i + 1}`),
        );
        const rows = dataRows.map((row) => splitTableRow(row).map(parseInlineSegments));
        blocks.push({ type: 'table', header, rows });
      }
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

      if (currentTrimmed.startsWith('```') || currentTrimmed === '$$' || currentTrimmed === '\\[') {
        break;
      }

      // 单行 $$...$$ 也应该中断段落
      if (currentTrimmed.startsWith('$$') && currentTrimmed.endsWith('$$') && currentTrimmed.length > 4) {
        break;
      }

      // 单行 \[...\] 也应该中断段落
      if (currentTrimmed.startsWith('\\[') && currentTrimmed.endsWith('\\]') && currentTrimmed.length > 4) {
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
