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

const ASCII_PUNCTUATION = /[!"#$%&'()*+,\-./:;<=>?@\[\\\]^_`{|}~]/;
const isPunctuation = (character) => ASCII_PUNCTUATION.test(character) || /\p{P}/u.test(character);

/**
 * CommonMark 要求 ** 闭合标记前面不能紧跟标点、后面也不能紧跟非标点文字，
 * 否则整个强调无法解析、星号按字面显示——中文文档里「**标题：**正文」的
 * 写法恰好命中这条规则。此时改用行内 HTML <strong> 包裹，保留冒号加粗。
 * 表格单元格由 DataTable.inlineMd 自绘渲染（支持 ** 而不支持 <strong>），
 * 那里必须保持星号语法，由 mode='table' 关闭此改写。
 */
function boldNeedsHtmlStrong(node, next) {
  if (!/[\p{P}]$/u.test(node.text ?? '')) return false;
  if (!next || next.type !== 'text') return false;
  const head = String(next.text ?? '').charAt(0);
  return Boolean(head) && !/\s/.test(head) && !isPunctuation(head);
}

function codeSpan(value) {
  const text = String(value ?? '');
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((part) => part.length));
  const fence = '`'.repeat(longest + 1);
  const padding = /^\s|\s$/.test(text) ? ' ' : '';
  return `${fence}${padding}${text}${padding}${fence}`;
}

function markedText(node, next, mode) {
  const marks = Array.isArray(node.marks) ? node.marks : [];
  const byType = (type) => marks.find((mark) => mark.type === type);
  let output = byType('code') ? codeSpan(node.text) : escapeText(node.text).replace(/\n/g, '<br />');

  if (byType('bold')) {
    // 加粗文本若会被 JSX 包裹（ink/label/anchor 的 span 或标签、Callout 等
    // JSX 文本容器），其中的 ** 永远按字面显示，必须输出 <strong>。
    const jsxWrapped = mode === 'jsx' || byType('ink') || byType('label') || byType('anchor');
    output = mode === 'table' || (!jsxWrapped && !boldNeedsHtmlStrong(node, next)) ? `**${output}**` : `<strong>${output}</strong>`;
  }
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

export function tiptapInlineToMarkdown(content, mode = 'mdx') {
  const nodes = content ?? [];
  return nodes.map((node, index) => {
    if (node.type === 'text') return markedText(node, nodes[index + 1], mode);
    if (node.type === 'hardBreak') return '<br />';
    if (node.type === 'image') return `![${escapeText(attrs(node).alt ?? '')}](${attrs(node).src ?? ''})`;
    if (node.type === 'inlineMath') return `$${attrs(node).latex ?? ''}$`;
    return tiptapInlineToMarkdown(children(node), mode);
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

function listToMarkdown(node, depth = 0, mode = 'mdx') {
  const ordered = node.type === 'orderedList';
  const task = node.type === 'taskList';
  const start = Number(attrs(node).start ?? 1);
  return children(node).map((item, index) => {
    const itemChildren = children(item);
    const first = itemChildren[0];
    const marker = task ? `- [${attrs(item).checked ? 'x' : ' '}]` : ordered ? `${start + index}.` : '-';
    const pad = '  '.repeat(depth);
    const lead = first?.type === 'paragraph'
      ? withAlignment(first, tiptapInlineToMarkdown(children(first), mode))
      : first ? blockToMarkdown(first, depth + 1, mode) : '';
    const rest = itemChildren.slice(1).map((child) => {
      if (child.type === 'bulletList' || child.type === 'orderedList' || child.type === 'taskList') return listToMarkdown(child, depth + 1, mode);
      return blockToMarkdown(child, depth + 1, mode).split('\n').map((line) => `${'  '.repeat(depth + 1)}${line}`).join('\n');
    }).filter(Boolean);
    return `${pad}${marker} ${lead}${rest.length ? `\n${rest.join('\n')}` : ''}`;
  }).join('\n');
}

function cellMarkdown(cell, mode) {
  return children(cell).map((block) => {
    if (block.type === 'paragraph' || block.type === 'heading') return tiptapInlineToMarkdown(children(block), mode);
    if (block.type === 'codeBlock') return codeSpan(children(block).map((node) => node.text ?? '').join(''));
    return blockToMarkdown(block, 0, mode).replace(/\n/g, '<br />');
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
        t: cellMarkdown(cell, 'table'),
        ...(colspan > 1 && { cs: colspan }),
        ...(rowspan > 1 && { rs: rowspan }),
        ...(cellAttrs.backgroundColor && { bg: cellAttrs.backgroundColor }),
        ...(cellAttrs.backgroundColor && Number.isFinite(opacity) && opacity < 1 && { op: Math.max(0, opacity) }),
        ...(cellAttrs.textColor && { fg: cellAttrs.textColor }),
        ...(cellAttrs.verticalAlign === 'top' && { va: 't' }),
        ...(cellAttrs.verticalAlign === 'bottom' && { va: 'b' }),
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

function blockToMarkdown(node, depth = 0, mode = 'mdx') {
  switch (node.type) {
    case 'paragraph':
      return preserveParagraphBoundary(withAlignment(node, tiptapInlineToMarkdown(children(node), mode)));
    case 'heading':
      return `${'#'.repeat(Math.max(1, Math.min(6, Number(attrs(node).level ?? 1))))} ${withAlignment(node, tiptapInlineToMarkdown(children(node), mode))}`;
    case 'bulletList':
    case 'orderedList':
    case 'taskList':
      return listToMarkdown(node, depth, mode);
    case 'listItem':
    case 'taskItem':
      return children(node).map((child) => blockToMarkdown(child, depth, mode)).join('\n');
    case 'blockquote': {
      const quote = blocksToMarkdown(children(node), mode);
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
      // Callout 内容是 JSX 文本，不经过 Markdown 内联解析，加粗用 <strong> 表达。
      return `<Callout color="${escapeAttribute(callout.color ?? 'green')}"${emoji}>${tiptapInlineToMarkdown(children(node), 'jsx')}</Callout>`;
    }
    case 'admonition': {
      const admonition = attrs(node);
      const title = admonition.title ? ` ${String(admonition.title).replace(/\n/g, ' ')}` : '';
      return `:::${admonition.kind ?? 'note'}${title}\n${blocksToMarkdown(children(node), mode)}\n:::`;
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

export function blocksToMarkdown(content, mode = 'mdx') {
  return (content ?? []).map((node) => blockToMarkdown(node, 0, mode)).filter((markdown, index) => {
    if (markdown.trim()) return true;
    return content[index]?.type !== 'paragraph';
  }).join('\n\n');
}

export function tiptapDocToMarkdown(document, frontmatter = '') {
  const body = blocksToMarkdown(children(document));
  const header = frontmatter ? `${frontmatter.trimEnd()}\n\n` : '';
  return `${header}${body}${body ? '\n' : ''}`;
}
