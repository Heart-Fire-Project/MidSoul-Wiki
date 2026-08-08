import { attrsOf, INLINE, openTagOf, parseStyle } from '../inlineSyntax.js';
import { findTables } from './tableIO.js';

const unescapeMarkdown = (value) => String(value ?? '').replace(/\\([\\*`_~[\]()#+\-.!<>|{}])/g, '$1');
const textNode = (value, marks = []) => {
  const text = unescapeMarkdown(value).replace(/\r?\n/g, ' ');
  return text ? [{ type: 'text', text, ...(marks.length ? { marks } : {}) }] : [];
};
const withMark = (nodes, mark) => nodes.map((node) => node.type === 'text' ? { ...node, marks: [...(node.marks ?? []), mark] } : node);

export function markdownInlineToTiptap(markdown, marks = []) {
  if (!markdown) return [];
  const output = [];
  const source = String(markdown).replace(/(<br\s*\/?>)\s*\n/g, '$1');
  for (const part of source.split(INLINE)) {
    if (!part) continue;
    if (/^<br/.test(part)) { output.push({ type: 'hardBreak' }); continue; }

    if (part.startsWith('$') && part.endsWith('$')) {
      output.push({ type: 'inlineMath', attrs: { latex: part.slice(1, -1) } });
      continue;
    }

    if (part.startsWith('<Label')) {
      const open = openTagOf(part);
      const label = attrsOf(open);
      output.push(...withMark(markdownInlineToTiptap(part.slice(open.length, -'</Label>'.length), marks), {
        type: 'label', attrs: { color: label.color ?? '', background: label.bg ?? '' },
      }));
      continue;
    }

    if (part.startsWith('<span')) {
      const open = openTagOf(part);
      const style = parseStyle(open);
      const attributes = attrsOf(open);
      const nextMarks = [...marks];
      if (attributes.id) nextMarks.push({ type: 'anchor', attrs: { id: attributes.id } });
      const ink = {
        fg: style.color ?? style['--fg'] ?? null,
        bg: style.backgroundColor ?? style['--bg'] ?? null,
        fgDark: style['--fg-d'] ?? null,
        bgDark: style['--bg-d'] ?? null,
      };
      if (Object.values(ink).some(Boolean)) nextMarks.push({ type: 'ink', attrs: ink });
      if (String(style.textDecoration ?? '').includes('underline')) nextMarks.push({ type: 'underline' });
      output.push(...markdownInlineToTiptap(part.slice(open.length, -'</span>'.length), nextMarks));
      continue;
    }

    if (part.startsWith('![')) {
      const image = part.match(/^!\[([^\]]*)\]\(([^)]*)\)$/);
      output.push(...textNode(image?.[1] || image?.[2] || part, marks));
      continue;
    }
    const link = part.match(/^\[([^\]]*)\]\((\S+?)(?:\s+"([^"]*)")?\)$/);
    if (link) {
      output.push(...withMark(markdownInlineToTiptap(link[1], marks), { type: 'link', attrs: { href: link[2], title: link[3] ?? null } }));
      continue;
    }
    if (part.startsWith('**')) { output.push(...markdownInlineToTiptap(part.slice(2, -2), [...marks, { type: 'bold' }])); continue; }
    if (part.startsWith('~~')) { output.push(...markdownInlineToTiptap(part.slice(2, -2), [...marks, { type: 'strike' }])); continue; }
    if (part.startsWith('`')) { output.push(...textNode(part.slice(1, -1), [...marks, { type: 'code' }])); continue; }
    if (part.startsWith('*')) { output.push(...markdownInlineToTiptap(part.slice(1, -1), [...marks, { type: 'italic' }])); continue; }
    output.push(...textNode(part, marks));
  }
  return output;
}

const INLINE_TAG = /^<(Label|span|a|code|em|strong|b|i|u|del|br|img)\b/;
const PARAGRAPH_TAG = /^<p>([\s\S]*)<\/p>$/;
const classifyText = (source) => /^#{1,6}\s/.test(source) ? 'heading'
  : /^([-*+]\s|\d+[.)]\s)/.test(source) ? 'list'
    : /^>\s?/.test(source) ? 'quote'
      : /^(-{3,}|\*{3,}|_{3,})$/.test(source.trim()) ? 'divider'
        : /^(import|export)\s/.test(source) || (/^</.test(source) && !INLINE_TAG.test(source)) ? 'raw'
          : 'paragraph';

const classify = (source) => {
  const tables = findTables(source);
  return tables.length === 1 && tables[0].start === 0 && tables[0].end >= source.trimEnd().length
    ? 'table' : classifyText(source);
};

function* linesBetween(text, from, to) {
  for (let cursor = from; cursor < to;) {
    let end = text.indexOf('\n', cursor);
    if (end < 0 || end > to) end = to;
    yield [cursor, text.slice(cursor, end)];
    cursor = end + 1;
  }
}

function pushChunks(output, text, from, to) {
  const lines = [...linesBetween(text, from, to)];
  let start = -1;
  let stop = -1;
  const flush = () => {
    if (start < 0) return;
    const source = text.slice(start, stop);
    output.push({ type: classify(source), source });
    start = -1;
  };
  for (let index = 0; index < lines.length; index += 1) {
    const [offset, line] = lines[index];
    const code = /^\s*```/.test(line);
    const oneLineMath = line.match(/^\s*\$\$([^$]+)\$\$\s*$/);
    const math = /^\s*\$\$\s*$/.test(line);
    if (oneLineMath || math) {
      flush();
      let endIndex = index;
      if (math) {
        endIndex = index + 1;
        while (endIndex < lines.length && !/^\s*\$\$\s*$/.test(lines[endIndex][1])) endIndex += 1;
      }
      const end = endIndex < lines.length ? lines[endIndex][0] + lines[endIndex][1].length : to;
      output.push({ type: 'math', source: text.slice(offset, end) });
      index = endIndex;
      continue;
    }
    if (code || /^:::/.test(line)) {
      flush();
      const closes = code ? /^\s*```/ : /^:::\s*$/;
      let endIndex = index + 1;
      while (endIndex < lines.length && !closes.test(lines[endIndex][1])) endIndex += 1;
      const end = endIndex < lines.length ? lines[endIndex][0] + lines[endIndex][1].length : to;
      output.push({ type: code ? 'code' : 'admonition', source: text.slice(offset, end) });
      index = endIndex;
      continue;
    }
    if (!line.trim()) flush();
    else {
      if (start < 0) start = offset;
      stop = offset + line.length;
    }
  }
  flush();
}

function markdownBlocks(markdown) {
  const blocks = [];
  let cursor = 0;
  for (const table of findTables(markdown)) {
    if (table.start < cursor) continue;
    pushChunks(blocks, markdown, cursor, table.start);
    blocks.push({ type: 'table', source: markdown.slice(table.start, table.end) });
    cursor = table.end;
  }
  pushChunks(blocks, markdown, cursor, markdown.length);
  return blocks;
}

function alignedInline(source) {
  const span = String(source).trim().match(/^(<span\b[^>]*>)([\s\S]*)<\/span>$/);
  if (!span) return { content: markdownInlineToTiptap(source), textAlign: null };
  const style = parseStyle(span[1]);
  const textAlign = style.display === 'block' && ['center', 'right'].includes(style.textAlign) ? style.textAlign : null;
  return textAlign
    ? { content: markdownInlineToTiptap(span[2]), textAlign }
    : { content: markdownInlineToTiptap(source), textAlign: null };
}

const paragraph = (source) => {
  const wrapped = String(source).trim().match(PARAGRAPH_TAG);
  const parsed = alignedInline(wrapped?.[1] ?? source);
  return { type: 'paragraph', ...(parsed.textAlign && { attrs: { textAlign: parsed.textAlign } }), ...(parsed.content.length && { content: parsed.content }) };
};

function listNodes(source) {
  const items = [];
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
    if (match) items.push({ marker: match[1], source: match[2] });
    else if (items.length && line.trim()) items[items.length - 1].source += ` ${line.trim()}`;
  }
  const groups = [];
  for (const item of items) {
    const task = item.source.match(/^\[([ xX])\]\s+(.*)$/);
    const kind = /^\d/.test(item.marker) ? 'ordered' : task ? 'task' : 'bullet';
    const current = groups.at(-1);
    if (!current || current.kind !== kind) groups.push({ kind, items: [] });
    groups.at(-1).items.push({ source: task ? task[2] : item.source, checked: task?.[1].toLowerCase() === 'x' });
  }
  return groups.map((group) => ({
    type: group.kind === 'ordered' ? 'orderedList' : group.kind === 'task' ? 'taskList' : 'bulletList',
    content: group.items.map((item) => ({
      type: group.kind === 'task' ? 'taskItem' : 'listItem',
      ...(group.kind === 'task' && { attrs: { checked: item.checked } }),
      content: [paragraph(item.source)],
    })),
  }));
}

function tableNode(source) {
  const grid = findTables(source)[0]?.grid;
  if (!grid) return paragraph(source);
  const layoutMode = grid.layout === 'equal' ? 'equal' : 'content';
  return {
    type: 'table',
    attrs: { hideHeader: Boolean(grid.hideHeader), noFirstCol: Boolean(grid.noFirstCol), anchorId: grid.id ?? null },
    content: grid.cells.map((row, rowIndex) => {
      let column = 0;
      return {
        type: 'tableRow',
        ...(grid.rowIds?.[rowIndex] && { attrs: { anchorId: grid.rowIds[rowIndex] } }),
        content: row.filter(Boolean).map((cell) => {
          const colspan = Math.max(1, Number(cell.cs ?? 1));
          const widths = rowIndex === 0 && grid.widths
            ? grid.widths.slice(column, column + colspan).map((width) => width ? Number.parseFloat(width) : 0).filter((width) => width > 0)
            : [];
          column += colspan;
          const textAlign = cell.al === 'c' ? 'center' : cell.al === 'r' ? 'right' : null;
          return {
            type: rowIndex < grid.head ? 'tableHeader' : 'tableCell',
            attrs: {
              colspan, rowspan: Math.max(1, Number(cell.rs ?? 1)), colwidth: widths.length === colspan ? widths : null,
              backgroundColor: cell.bg ?? null, backgroundOpacity: Number.isFinite(cell.op) ? Math.max(0, Number(cell.op)) : 1,
              textColor: cell.fg ?? null, layoutMode,
              tableHideHeader: Boolean(grid.hideHeader), tableNoFirstCol: Boolean(grid.noFirstCol),
            },
            content: [{ type: 'paragraph', ...(textAlign && { attrs: { textAlign } }), ...(cell.t && { content: markdownInlineToTiptap(cell.t) }) }],
          };
        }),
      };
    }),
  };
}

function blockNodes(block) {
  const source = block.source;
  switch (block.type) {
    case 'heading': {
      const match = source.match(/^(#{1,6})\s+([\s\S]*)$/);
      const parsed = alignedInline(match?.[2] ?? source);
      return [{ type: 'heading', attrs: { level: match?.[1].length ?? 2, ...(parsed.textAlign && { textAlign: parsed.textAlign }) }, ...(parsed.content.length && { content: parsed.content }) }];
    }
    case 'list': return listNodes(source);
    case 'quote': return [{ type: 'blockquote', content: [paragraph(source.replace(/^>\s?/gm, ''))] }];
    case 'code': {
      const lines = source.split(/\r?\n/);
      const language = lines[0].replace(/^\s*```/, '').trim() || null;
      const body = lines.slice(1, /^\s*```/.test(lines.at(-1) ?? '') ? -1 : undefined).join('\n');
      return [{ type: 'codeBlock', attrs: { language }, ...(body && { content: [{ type: 'text', text: body }] }) }];
    }
    case 'admonition': {
      const match = source.match(/^:::(\w+)[ \t]*(.*)\r?\n([\s\S]*?)\r?\n?:::\s*$/);
      const body = match?.[3] ?? '';
      return [{ type: 'admonition', attrs: { kind: match?.[1] ?? 'note', title: match?.[2].trim() || '提示' }, content: markdownBlocks(body).flatMap(blockNodes) }];
    }
    case 'table': return [tableNode(source)];
    case 'math': {
      const latex = source.trim().replace(/^\$\$\s*/, '').replace(/\s*\$\$$/, '').trim();
      return [{ type: 'blockMath', attrs: { latex } }];
    }
    case 'divider': return [{ type: 'horizontalRule' }];
    case 'raw': {
      if (PARAGRAPH_TAG.test(source.trim())) return [paragraph(source)];
      const callout = source.match(/^<Callout([^>]*)>([\s\S]*)<\/Callout>$/);
      if (callout) {
        const attributes = attrsOf(`<Callout${callout[1]}>`);
        return [{ type: 'callout', attrs: { color: attributes.color || 'green', emoji: attributes.emoji ?? '💡' }, content: markdownInlineToTiptap(callout[2].trim()) }];
      }
      return [{ type: 'rawMdx', attrs: { source } }];
    }
    default: {
      const image = source.trim().match(/^!\[([^\]]*)\]\((\S+?)(?:\s+"([^"]*)")?\)$/);
      if (image) return [{ type: 'image', attrs: { src: image[2], alt: image[1], title: image[3] ?? null } }];
      return [paragraph(source)];
    }
  }
}

export function markdownToTiptap(markdown) {
  const frontmatter = String(markdown).match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/)?.[0] ?? '';
  const body = String(markdown).slice(frontmatter.length);
  const content = markdownBlocks(body).flatMap(blockNodes);
  return {
    format: 'tiptap-v1',
    frontmatter,
    content: { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] },
  };
}
