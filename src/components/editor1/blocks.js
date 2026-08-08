import { findTables } from './tableIO.js';

/*
  文档 ←→ 块列表。

  每个块都带着自己那段**原始 Markdown**（src）。没被动过的块保存时一字不改地写回去，
  所以富文本编辑器不可能把没碰过的 MDX 语法搞坏 —— 这是全文所见即所得敢做的前提。

  块类型：frontmatter 之外的 heading / para / list / quote / code / table
          / admonition / divider / raw（未知 MDX，原样渲染 + 源码编辑兜底）
*/

let seq = 0;
export const mkBlock = (type, src) => ({ id: `b${++seq}`, type, src });

// 行内级的标签（<Label>、<span> 等）开头的仍是普通段落，只有块级 MDX 才走 raw 兜底
const INLINE_TAG = /^<(Label|span|a|code|em|strong|b|i|u|del|br|img)\b/;

export const classify = (s) => {
  // 整段就是一张表（管道表格 / ColorTable / DataTable）→ 表格块，判定复用 findTables
  const t = findTables(s);
  if (t.length === 1 && t[0].start === 0 && t[0].end >= s.trimEnd().length) return 'table';
  return classifyText(s);
};

const classifyText = (s) =>
  /^#{1,6}\s/.test(s) ? 'heading'
  : /^([-*+]\s|\d+[.)]\s)/.test(s) ? 'list'
  : /^>\s?/.test(s) ? 'quote'
  : /^(-{3,}|\*{3,}|_{3,})$/.test(s.trim()) ? 'divider'
  : /^(import|export)\s/.test(s) || (/^</.test(s) && !INLINE_TAG.test(s)) ? 'raw'
  : 'para';

function* eachLine(text, from, to) {
  for (let i = from; i < to;) {
    let end = text.indexOf('\n', i);
    if (end < 0 || end > to) end = to;
    yield [i, text.slice(i, end)];
    i = end + 1;
  }
}

// 把两个表格之间的普通文本切成块（围栏代码块和 ::: 提示框内部的空行不算分隔）
function pushChunk(out, text, from, to) {
  const lines = [...eachLine(text, from, to)];
  let start = -1, stop = -1;
  const flush = () => {
    if (start < 0) return;
    const src = text.slice(start, stop);
    out.push({ ...mkBlock(classify(src), src), start, end: stop });
    start = -1;
  };
  for (let k = 0; k < lines.length; k++) {
    const [off, line] = lines[k];
    const isCode = /^\s*```/.test(line);
    if (isCode || /^:::/.test(line)) {
      flush();
      const closes = isCode ? /^\s*```/ : /^:::\s*$/;
      let k2 = k + 1;
      while (k2 < lines.length && !closes.test(lines[k2][1])) k2++;
      const end = k2 < lines.length ? lines[k2][0] + lines[k2][1].length : to;
      out.push({ ...mkBlock(isCode ? 'code' : 'admonition', text.slice(off, end)), start: off, end });
      k = k2;
      continue;
    }
    if (!line.trim()) flush();
    else {
      if (start < 0) start = off;
      stop = off + line.length;
    }
  }
  flush();
}

export function parseDoc(text) {
  const fm = text.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/)?.[0] ?? '';
  const found = [];
  let pos = fm.length;
  for (const t of findTables(text)) {
    if (t.start < pos) continue;
    pushChunk(found, text, pos, t.start);
    found.push({ ...mkBlock('table', text.slice(t.start, t.end)), start: t.start, end: t.end });
    pos = t.end;
  }
  pushChunk(found, text, pos, text.length);

  // 记下每块前面那段原始空白，保存时原样还给它 —— 没编辑过的文件 diff 必须是空的
  let cursor = fm.length;
  const blocks = found.map(({ id, type, src, start, end }) => {
    const gap = text.slice(cursor, start);
    cursor = end;
    return { id, type, src, gap };
  });
  if (!blocks.length) blocks.push({ ...mkBlock('para', ''), gap: '\n' });
  return { frontmatter: fm, blocks, tail: text.slice(cursor) };
}

export function serializeDoc({ frontmatter, blocks, tail = '' }) {
  const out = frontmatter + blocks.map((b) => (b.gap ?? '\n\n') + b.src).join('') + tail;
  return out.endsWith('\n') ? out : `${out}\n`;
}

// ── 块内容 ←→ 块源码 ─────────────────────────────

export const headingLevel = (src) => src.match(/^(#{1,6})\s/)?.[1].length ?? 2;
export const stripPrefix = (src, type) =>
  type === 'heading' ? src.replace(/^#{1,6}\s+/, '')
  : type === 'quote' ? src.replace(/^>\s?/gm, '')
  : src;

// 一项可能折行写（下一行没有列表符号），要并回上一项而不是当成新的一项
export const listItems = (src) => {
  const items = [];
  for (const line of src.split(/\r?\n/)) {
    const m = line.match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
    if (m) items.push(m[2]);
    else if (items.length && line.trim()) items[items.length - 1] += ` ${line.trim()}`;
  }
  return items;
};
export const isOrdered = (src) => /^\s*\d+[.)]\s/.test(src);

export const admonitionParts = (src) => {
  const m = src.match(/^:::(\w+)[ \t]*(.*)\r?\n([\s\S]*?)\r?\n?:::\s*$/);
  return m ? { type: m[1], title: m[2].trim(), body: m[3] } : { type: 'note', title: '', body: '' };
};

// contentEditable 的 DOM → Markdown 行内语法。
// 用字面量 3/1 而不是 Node.TEXT_NODE，好让它能脱离浏览器跑单元测试。
export function domToMd(node) {
  return [...node.childNodes].map((n) => {
    if (n.nodeType === 3) return n.nodeValue;
    if (n.nodeType !== 1) return '';
    if (n.dataset?.md != null) return n.dataset.md; // 原子块（Label / 图片…）原样吐回
    const inner = domToMd(n);
    switch (n.tagName) {
      case 'BR': return '<br>';
      case 'STRONG': case 'B': return inner ? `**${inner}**` : '';
      case 'EM': case 'I': return inner ? `*${inner}*` : '';
      case 'DEL': case 'S': case 'STRIKE': return inner ? `~~${inner}~~` : '';
      case 'CODE': return inner ? `\`${inner}\`` : '';
      case 'A': return `[${inner}](${n.getAttribute('href') || ''})`;
      case 'IMG': return `![${n.alt || ''}](${n.getAttribute('src') || ''})`;
      case 'SPAN': case 'FONT': {
        if (n.classList.contains('muted')) return `<span className="muted">${inner}</span>`;
        const color = n.style?.color || n.getAttribute('color');
        const bg = n.style?.backgroundColor;
        if (!color && !bg) return inner;
        const style = [color && `color:'${color}'`, bg && `backgroundColor:'${bg}'`].filter(Boolean).join(',');
        return `<span style={{${style}}}>${inner}</span>`;
      }
      default: return inner;
    }
  }).join('');
}

// 把编辑后的 DOM 拼回该块完整的 Markdown
export function blockToMd(type, el, src) {
  switch (type) {
    case 'heading': return `${'#'.repeat(headingLevel(src))} ${domToMd(el).trim()}`;
    case 'quote': return domToMd(el).split('\n').map((l) => `> ${l}`).join('\n');
    case 'list': {
      const ordered = isOrdered(src);
      return [...el.querySelectorAll('li')]
        .map((li, i) => `${ordered ? `${i + 1}.` : '-'} ${domToMd(li).trim()}`)
        .filter((l) => l.trim().length > 2 || !ordered)
        .join('\n');
    }
    case 'code': return src.replace(/(^\s*```.*\r?\n)[\s\S]*?(\r?\n\s*```\s*$)/, `$1${el.innerText.replace(/\n$/, '')}$2`);
    case 'admonition': {
      const { type: t, title } = admonitionParts(src);
      return `:::${t}${title ? ` ${title}` : ''}\n${domToMd(el).trim()}\n:::`;
    }
    default: return domToMd(el).trim();
  }
}
