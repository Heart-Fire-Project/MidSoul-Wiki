import { serialize } from './tableIO.js';

const children = (node) => Array.isArray(node?.content) ? node.content : [];
const attrs = (node) => node?.attrs && typeof node.attrs === 'object' ? node.attrs : {};
// remark-gfm accepts a single ~ as a strikethrough delimiter. In Chinese prose
// an ASCII tilde between numbers means a range instead, so emit the unambiguous
// full-width range glyph while keeping real strike marks as ~~text~~ below.
const normalizeNumericRanges = (value) => String(value ?? '').replace(/(\d)\s*~\s*(?=\d)/g, '$1～');
const escapeText = (value) => normalizeNumericRanges(value).replace(/([\\*`<])/g, '\\$1');
const escapeAttribute = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const quoteCss = (value) => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

function codeSpan(value) {
  const text = String(value ?? '');
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((part) => part.length));
  const fence = '`'.repeat(longest + 1);
  const padding = /^\s|\s$/.test(text) ? ' ' : '';
  return `${fence}${padding}${text}${padding}${fence}`;
}

function markedText(node) {
  const marks = Array.isArray(node.marks) ? node.marks : [];
  const byType = (type) => marks.find((mark) => mark.type === type);
  let output = byType('code') ? codeSpan(node.text) : escapeText(node.text).replace(/\n/g, '<br />');

  if (byType('bold')) output = `**${output}**`;
  if (byType('italic')) output = `*${output}*`;
  if (byType('strike')) output = `~~${output}~~`;

  const ink = attrs(byType('ink'));
  const css = [
    ink.fg && `${ink.fgDark ? quoteCss('--fg') : 'color'}:${quoteCss(ink.fg)}`,
    ink.fgDark && `${quoteCss('--fg-d')}:${quoteCss(ink.fgDark)}`,
    ink.bg && `${ink.bgDark ? quoteCss('--bg') : 'backgroundColor'}:${quoteCss(ink.bg)}`,
    ink.bgDark && `${quoteCss('--bg-d')}:${quoteCss(ink.bgDark)}`,
    byType('underline') && `textDecoration:'underline'`,
  ].filter(Boolean).join(',');
  if (css) output = `<span${ink.fgDark || ink.bgDark ? ' className="ms-ink"' : ''} style={{${css}}}>${output}</span>`;

  const label = attrs(byType('label'));
  if (byType('label')) {
    const labelAttrs = label.color ? ` color="${escapeAttribute(label.color)}"`
      : label.background ? ` bg="${escapeAttribute(label.background)}"` : '';
    output = `<Label${labelAttrs}>${output}</Label>`;
  }

  const link = attrs(byType('link'));
  if (byType('link') && link.href) {
    const title = link.title ? ` "${String(link.title).replace(/"/g, '\\"')}"` : '';
    output = `[${output}](${link.href}${title})`;
  }
  const anchor = attrs(byType('anchor'));
  if (byType('anchor') && anchor.id) output = `<span id="${escapeAttribute(anchor.id)}">${output}</span>`;
  return output;
}

export function tiptapInlineToMarkdown(content) {
  return (content ?? []).map((node) => {
    if (node.type === 'text') return markedText(node);
    if (node.type === 'hardBreak') return '<br />';
    if (node.type === 'image') return `![${escapeText(attrs(node).alt ?? '')}](${attrs(node).src ?? ''})`;
    if (node.type === 'inlineMath') return `$${attrs(node).latex ?? ''}$`;
    return tiptapInlineToMarkdown(children(node));
  }).join('');
}

function withAlignment(node, markdown) {
  const alignment = attrs(node).textAlign;
  if (alignment !== 'center' && alignment !== 'right') return markdown;
  return `<span style={{display:'block',textAlign:'${alignment}'}}>${markdown}</span>`;
}

function preserveParagraphBoundary(markdown) {
  return /^<(?:span|Label)\b/.test(markdown) ? `<p>${markdown}</p>` : markdown;
}

function listToMarkdown(node, depth = 0) {
  const ordered = node.type === 'orderedList';
  const task = node.type === 'taskList';
  const start = Number(attrs(node).start ?? 1);
  return children(node).map((item, index) => {
    const itemChildren = children(item);
    const first = itemChildren[0];
    const marker = task ? `- [${attrs(item).checked ? 'x' : ' '}]` : ordered ? `${start + index}.` : '-';
    const pad = '  '.repeat(depth);
    const lead = first?.type === 'paragraph'
      ? withAlignment(first, tiptapInlineToMarkdown(children(first)))
      : first ? blockToMarkdown(first, depth + 1) : '';
    const rest = itemChildren.slice(1).map((child) => {
      if (child.type === 'bulletList' || child.type === 'orderedList' || child.type === 'taskList') return listToMarkdown(child, depth + 1);
      return blockToMarkdown(child, depth + 1).split('\n').map((line) => `${'  '.repeat(depth + 1)}${line}`).join('\n');
    }).filter(Boolean);
    return `${pad}${marker} ${lead}${rest.length ? `\n${rest.join('\n')}` : ''}`;
  }).join('\n');
}

function cellMarkdown(cell) {
  return children(cell).map((block) => {
    if (block.type === 'paragraph' || block.type === 'heading') return tiptapInlineToMarkdown(children(block));
    if (block.type === 'codeBlock') return codeSpan(children(block).map((node) => node.text ?? '').join(''));
    return blockToMarkdown(block).replace(/\n/g, '<br />');
  }).filter(Boolean).join('<br />');
}

function tableToMarkdown(node) {
  const rows = children(node);
  const tableAttrs = attrs(node);
  const firstCellAttrs = attrs(children(rows[0])[0]);
  const dense = [];
  const widths = [];
  const rowIds = rows.map((row) => attrs(row).anchorId || null);
  let layout = 'content';

  rows.forEach((row, rowIndex) => {
    dense[rowIndex] ??= [];
    let column = 0;
    children(row).forEach((cell) => {
      while (dense[rowIndex][column] !== undefined) column += 1;
      const cellAttrs = attrs(cell);
      const colspan = Math.max(1, Number(cellAttrs.colspan ?? 1));
      const rowspan = Math.max(1, Number(cellAttrs.rowspan ?? 1));
      if (cellAttrs.layoutMode === 'equal') layout = 'equal';
      const paragraph = children(cell).find((child) => child.type === 'paragraph' || child.type === 'heading');
      const alignment = attrs(paragraph).textAlign;
      const opacity = Number(cellAttrs.backgroundOpacity ?? 1);
      dense[rowIndex][column] = {
        t: cellMarkdown(cell),
        ...(colspan > 1 && { cs: colspan }),
        ...(rowspan > 1 && { rs: rowspan }),
        ...(cellAttrs.backgroundColor && { bg: cellAttrs.backgroundColor }),
        ...(cellAttrs.backgroundColor && Number.isFinite(opacity) && opacity < 1 && { op: Math.max(0, opacity) }),
        ...(cellAttrs.textColor && { fg: cellAttrs.textColor }),
        ...(alignment === 'center' && { al: 'c' }),
        ...(alignment === 'right' && { al: 'r' }),
      };
      if (rowIndex === 0 && Array.isArray(cellAttrs.colwidth)) {
        for (let offset = 0; offset < colspan; offset += 1) {
          const width = Number(cellAttrs.colwidth[offset]);
          widths[column + offset] = Number.isFinite(width) && width > 0 ? `${width}px` : null;
        }
      }
      for (let rowOffset = 0; rowOffset < rowspan; rowOffset += 1) {
        dense[rowIndex + rowOffset] ??= [];
        for (let columnOffset = 0; columnOffset < colspan; columnOffset += 1) {
          if (rowOffset || columnOffset) dense[rowIndex + rowOffset][column + columnOffset] = null;
        }
      }
      column += colspan;
    });
  });

  const width = Math.max(0, ...dense.map((row) => row.length));
  dense.forEach((row) => { for (let column = 0; column < width; column += 1) if (row[column] === undefined) row[column] = { t: '' }; });
  let head = 0;
  while (rows[head] && children(rows[head]).length && children(rows[head]).every((cell) => cell.type === 'tableHeader')) head += 1;
  return serialize({
    cells: dense,
    head,
    align: Array(width).fill(null),
    layout,
    ...((tableAttrs.hideHeader || firstCellAttrs.tableHideHeader) && { hideHeader: true }),
    ...((tableAttrs.noFirstCol || firstCellAttrs.tableNoFirstCol) && { noFirstCol: true }),
    ...(tableAttrs.anchorId && { id: tableAttrs.anchorId }),
    ...(rowIds.some(Boolean) && { rowIds }),
    ...(widths.some(Boolean) && { widths: Array.from({ length: width }, (_, index) => widths[index] ?? null) }),
  });
}

function blockToMarkdown(node, depth = 0) {
  switch (node.type) {
    case 'paragraph':
      return preserveParagraphBoundary(withAlignment(node, tiptapInlineToMarkdown(children(node))));
    case 'heading':
      return `${'#'.repeat(Math.max(1, Math.min(6, Number(attrs(node).level ?? 1))))} ${withAlignment(node, tiptapInlineToMarkdown(children(node)))}`;
    case 'bulletList':
    case 'orderedList':
    case 'taskList':
      return listToMarkdown(node, depth);
    case 'listItem':
    case 'taskItem':
      return children(node).map((child) => blockToMarkdown(child, depth)).join('\n');
    case 'blockquote': {
      const quote = blocksToMarkdown(children(node));
      return quote.split('\n').map((line) => line ? `> ${line}` : '>').join('\n');
    }
    case 'codeBlock': {
      const body = children(node).map((child) => child.text ?? '').join('');
      const longest = Math.max(2, ...(body.match(/^`+/gm) ?? []).map((part) => part.length));
      const fence = '`'.repeat(longest + 1);
      return `${fence}${attrs(node).language ?? ''}\n${body}\n${fence}`;
    }
    case 'horizontalRule':
      return '---';
    case 'image': {
      const image = attrs(node);
      const title = image.title ? ` "${String(image.title).replace(/"/g, '\\"')}"` : '';
      return `![${escapeText(image.alt ?? '')}](${image.src ?? ''}${title})`;
    }
    case 'blockMath':
      return `$$\n${attrs(node).latex ?? ''}\n$$`;
    case 'table':
      return tableToMarkdown(node);
    case 'callout': {
      const callout = attrs(node);
      const emoji = callout.emoji ? ` emoji="${escapeAttribute(callout.emoji)}"` : '';
      return `<Callout color="${escapeAttribute(callout.color ?? 'green')}"${emoji}>${tiptapInlineToMarkdown(children(node))}</Callout>`;
    }
    case 'admonition': {
      const admonition = attrs(node);
      const title = admonition.title ? ` ${String(admonition.title).replace(/\n/g, ' ')}` : '';
      return `:::${admonition.kind ?? 'note'}${title}\n${blocksToMarkdown(children(node))}\n:::`;
    }
    case 'rawMdx':
      return String(attrs(node).source ?? '').trimEnd();
    case 'hardBreak':
      return '<br />';
    case 'text':
      return markedText(node);
    default:
      return blocksToMarkdown(children(node));
  }
}

export function blocksToMarkdown(content) {
  return (content ?? []).map((node) => blockToMarkdown(node)).filter((markdown, index) => {
    if (markdown.trim()) return true;
    return content[index]?.type !== 'paragraph';
  }).join('\n\n');
}

export function tiptapDocToMarkdown(document, frontmatter = '') {
  const body = blocksToMarkdown(children(document));
  const header = frontmatter ? `${frontmatter.trimEnd()}\n\n` : '';
  return `${header}${body}${body ? '\n' : ''}`;
}
