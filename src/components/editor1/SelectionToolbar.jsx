import React, { useState, useEffect, useRef } from 'react';
import { cmd, hold, wrapCode } from './format';
import { Icon, ColorButton } from './ui';
import s from './editor.module.css';

// 选中文字浮出的快捷条：只放最常用的六个，完整功能在编辑栏
const QUICK = [
  ['bold', 'bold', '粗体'],
  ['italic', 'italic', '斜体'],
  ['strikeThrough', 'strike', '删除线'],
];

export default function SelectionToolbar({ containerRef }) {
  const [rect, setRect] = useState(null);
  const [linking, setLinking] = useState(false);
  // 取色盘是系统窗口，打开时页面会失焦；这条一旦被收起，input 跟着卸载，
  // 选完颜色就什么也不会发生 —— 所以取色期间钉住不收
  const [busy, setBusy] = useState(false);
  const saved = useRef(null);
  const pinned = linking || busy;

  useEffect(() => {
    const onSel = () => {
      const sel = window.getSelection();
      const node = sel?.anchorNode;
      const el = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
      // 只在真正能改的地方浮出来：只读表格上选中文字不该给一根点了没用的工具条
      const editable = el?.closest('[contenteditable=true]');
      if (!sel || sel.isCollapsed || !editable || !containerRef.current?.contains(editable)) {
        if (!pinned) setRect(null);
        return;
      }
      saved.current = sel.getRangeAt(0).cloneRange();
      setRect(sel.getRangeAt(0).getBoundingClientRect());
    };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, [pinned]);

  if (!rect || !containerRef.current) return null;

  const restore = () => {
    if (!saved.current) return;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(saved.current);
  };

  return (
    <div className={s.floating} data-chrome style={{ top: Math.max(8, rect.top - 42), left: rect.left }}>
      {linking ? (
        <input
          autoFocus
          className={s.linkInput}
          placeholder="链接地址，回车确认（如 ./进度碑刻）"
          onKeyDown={(e) => {
            if (e.key === 'Enter') { restore(); cmd('createLink', e.target.value); setLinking(false); }
            if (e.key === 'Escape') setLinking(false);
          }}
          onBlur={() => setLinking(false)}
        />
      ) : (
        <>
          {QUICK.map(([command, icon, title]) => (
            <button key={command} className={s.tool} title={title} {...hold(() => cmd(command))}>
              <Icon name={icon} />
            </button>
          ))}
          <button className={s.tool} title="行内代码" {...hold(wrapCode)}><Icon name="inlineCode" /></button>
          <button className={s.tool} title="链接" {...hold(() => setLinking(true))}><Icon name="link" /></button>
          <ColorButton command="foreColor" icon="palette" title="文字颜色" onBusy={setBusy} />
          <ColorButton command="hiliteColor" icon="highlight" title="背景颜色" initial="#fef9c3" onBusy={setBusy} />
          <button className={s.tool} title="清除格式" {...hold(() => cmd('removeFormat'))}>清除</button>
        </>
      )}
    </div>
  );
}
