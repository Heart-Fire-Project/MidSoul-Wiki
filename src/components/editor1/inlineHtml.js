import { INLINE, parseStyle, attrsOf } from '../inlineSyntax';
import { labelStyle } from '../Label';

/*
  行内 Markdown → HTML 字符串。

  为什么不复用渲染成 React 的 inlineMd：contentEditable 里的 DOM 会被浏览器和
  execCommand 直接改，React 一旦还想 diff 那棵子树就会炸（removeChild 报错）。
  所以编辑态用 dangerouslySetInnerHTML 把子树交给浏览器，React 不再插手。
  语法表（INLINE）和标签配色（labelStyle）都还是从原处 import，没有第二份。
*/

export const escapeHtml = (s) =>
  String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

const css = (style) =>
  Object.entries(style)
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${v}`)
    .join(';');

export function mdToHtml(md, isDark) {
  if (!md) return '';
  return String(md).split(INLINE).map((part) => {
    if (!part) return '';
    if (/^<br/.test(part)) return '<br>';
    if (part.startsWith('<Label')) {
      const open = part.slice(0, part.indexOf('>') + 1);
      const props = attrsOf(open);
      const inner = part.slice(open.length, -'</Label>'.length);
      // 标签是原子：contenteditable=false + data-md，改不坏也能原样写回
      return `<span data-md="${escapeHtml(part).replace(/"/g, '&quot;')}" contenteditable="false" style="${css(labelStyle(props, isDark))}">${escapeHtml(inner)}</span>`;
    }
    if (part.startsWith('<span')) {
      const open = part.slice(0, part.indexOf('>') + 1);
      const inner = part.slice(open.length, -'</span>'.length);
      const cls = open.match(/className="([^"]+)"/)?.[1];
      const style = css(parseStyle(open));
      const attr = [cls && `class="${cls}"`, style && `style="${style}"`].filter(Boolean).join(' ');
      return `<span ${attr}>${mdToHtml(inner, isDark)}</span>`;
    }
    if (part.startsWith('![')) {
      const m = part.match(/^!\[([^\]]*)\]\(([^)]*)\)$/);
      return `<img data-md="${escapeHtml(part).replace(/"/g, '&quot;')}" src="${m[2]}" alt="${escapeHtml(m[1])}">`;
    }
    if (part.startsWith('**')) return `<b>${mdToHtml(part.slice(2, -2), isDark)}</b>`;
    if (part.startsWith('~~')) return `<del>${mdToHtml(part.slice(2, -2), isDark)}</del>`;
    if (part.startsWith('`')) return `<code>${escapeHtml(part.slice(1, -1))}</code>`;
    if (part.startsWith('*')) return `<i>${mdToHtml(part.slice(1, -1), isDark)}</i>`;
    const link = part.match(/^\[([^\]]*)\]\(([^)]*)\)$/);
    if (link) return `<a href="${link[2]}">${mdToHtml(link[1], isDark)}</a>`;
    return escapeHtml(part);
  }).join('');
}
