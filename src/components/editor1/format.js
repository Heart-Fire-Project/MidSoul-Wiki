import { mdToHtml } from './inlineHtml';

/*
  行内格式化统一走浏览器原生 execCommand：它处理 contentEditable 选区比手写 Range 靠谱，
  改出来的 DOM 由 blocks.js 的 domToMd 读回 Markdown。

  styleWithCSS 关掉，让它生成 <b>/<i>/<strike>/<font color> 这类标签 ——
  正好是 domToMd 认得的；开着会变成 <span style="font-weight:bold">，读不回去。
*/
export function cmd(name, value, useCss = false) {
  document.execCommand('styleWithCSS', false, useCss);
  document.execCommand(name, false, value);
}

export const selectedText = () => window.getSelection()?.toString() ?? '';

// 直接插入一段 Markdown 的渲染结果（Label、灰字、图片这类"原子"）
export const insertMd = (md, isDark) => cmd('insertHTML', mdToHtml(md, isDark));

export const wrapCode = () => {
  const text = selectedText();
  if (text) insertMd(`\`${text}\``);
};

export const wrapMuted = (isDark) =>
  insertMd(`<span className="muted">${selectedText() || '灰色文本'}</span>`, isDark);

export const insertLabel = (color, isDark) =>
  insertMd(`<Label color="${color}">${selectedText() || '标签'}</Label>`, isDark);

// 按下工具栏按钮时不夺走焦点，选区才留得住
export const hold = (fn) => ({ onMouseDown: (e) => { e.preventDefault(); fn(); } });

export const currentRange = () => {
  const sel = window.getSelection();
  return sel?.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
};

/*
  上色：先把选区放回去再执行，然后把执行完的新选区存回来。
  execCommand 会把选中的文字换成新的 <font> 节点，旧 Range 指向的节点已经不在了，
  连续拖动取色盘时不重新取一次就只有第一下生效。
*/
export function applyColor(range, color, command = 'foreColor') {
  if (range) {
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
  // 背景色走 CSS 模式，生成 <span style="background-color">；字色用标签模式生成 <font color>
  cmd(command, color, command === 'hiliteColor');
  return currentRange() ?? range;
}
