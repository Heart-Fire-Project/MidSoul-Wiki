import React, { useState, useRef, useEffect } from 'react';
import { useColorMode } from '@docusaurus/theme-common';
import DataTable, { cellStyle } from '../DataTable';
import { mergeRange, splitCell, insertRow, deleteRow, insertCol, deleteCol } from './tableIO';
import { mdToHtml } from './inlineHtml';
import { domToMd } from './blocks';
import s from './editor.module.css';

const PALETTE = [
  ['#fee2e2', '#ffedd5', '#fef9c3', '#dcfce7', '#d1fae5', '#e0f2fe', '#e0e7ff', '#f3e8ff', '#fce7f3', '#f1f5f9'],
  ['#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981', '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#64748b'],
  ['#000000', '#1f2937', '#4b5563', '#9ca3af', '#ffffff', '#7367f0', '#245bdb', '#0e7490', '#b45309', '#9f1239'],
];

const box = (sel) => ({
  r1: Math.min(sel.r1, sel.r2), r2: Math.max(sel.r1, sel.r2),
  c1: Math.min(sel.c1, sel.c2), c2: Math.max(sel.c1, sel.c2),
});

function ColorPop({ label, value, onPick }) {
  const [open, setOpen] = useState(false);
  return (
    <span className={s.popWrap}>
      <button onClick={() => setOpen(!open)} title={label}>
        {label}
        <span style={{
          display: 'inline-block', width: '0.7em', height: '0.7em', marginLeft: '0.35em',
          borderRadius: 2, border: '1px solid rgba(127,127,127,.5)', background: value || 'transparent',
        }} />
      </button>
      {open && (
        <span className={s.swatchPop} onMouseLeave={() => setOpen(false)}>
          {PALETTE.map((row, i) => (
            <span className={s.swatchRow} key={i}>
              {row.map((c) => (
                <button key={c} className={s.swatch} style={{ background: c }}
                  onClick={() => { onPick(c); setOpen(false); }} title={c} />
              ))}
            </span>
          ))}
          <span className={s.popFoot}>
            <input type="color" value={value || '#ffffff'} onChange={(e) => onPick(e.target.value)} />
            <button onClick={() => { onPick(null); setOpen(false); }}>清除</button>
          </span>
        </span>
      )}
    </span>
  );
}

export default function TableGrid({ grid: initial, onSave, onClose, inline }) {
  const { colorMode } = useColorMode();
  const isDark = colorMode === 'dark';
  const [g, setG] = useState(initial);
  const [sel, setSel] = useState({ r1: 0, c1: 0, r2: 0, c2: 0 });
  const [editing, setEditing] = useState(null);
  const [active, setActive] = useState(!inline); // 内联模式下，点进表格才显示工具栏
  const dragging = useRef(false);
  const undo = useRef([]);
  const root = useRef(null);
  const editingEl = useRef(null);

  const rows = g.cells.length;
  const cols = g.cells[0].length;
  const b = box(sel);
  const anchor = g.cells[sel.r1]?.[sel.c1] ?? {};

  // 内联模式改一下就直接写回文档，没有"完成"这一步
  const apply = (next) => { undo.current.push(g); setG(next); if (inline) onSave(next); };

  // 对选区内每个（未被合并覆盖的）单元格打补丁
  const patch = (obj) => {
    const cells = g.cells.map((row, r) => row.map((cell, c) => {
      if (!cell || r < b.r1 || r > b.r2 || c < b.c1 || c > b.c2) return cell;
      const next = { ...cell, ...obj };
      Object.keys(obj).forEach((k) => { if (next[k] == null || next[k] === false) delete next[k]; });
      return next;
    }));
    apply({ ...g, cells });
  };

  const toggle = (k) => patch({ [k]: anchor[k] ? null : true });

  const setText = (r, c, t) => {
    const cells = g.cells.map((row, ri) => row.map((cell, ci) => (ri === r && ci === c && cell ? { ...cell, t } : cell)));
    apply({ ...g, cells });
  };

  const selected = (r, c, cell) =>
    r + (cell.rs || 1) > b.r1 && r <= b.r2 && c + (cell.cs || 1) > b.c1 && c <= b.c2;

  useEffect(() => {
    const up = () => { dragging.current = false; };
    // 点到表格外面才收起。两个例外：
    // e.target 已从 DOM 移除 = 这一下正是"点进来"触发的重渲染；
    // 点的是工具栏 = 用户正在对这张表格动手，更不该收起。
    const down = (e) => {
      if (!inline || !root.current || !e.target.isConnected) return;
      if (root.current.contains(e.target) || e.target.closest('[data-chrome]')) return;
      // 收起前先把正在编辑的单元格存下来，否则这一格的文字随卸载一起没了
      if (editing && editingEl.current) {
        setText(editing[0], editing[1], domToMd(editingEl.current).trim());
        setEditing(null);
      }
      setActive(false);
    };
    window.addEventListener('mousedown', down);
    const key = (e) => {
      if (editing || !active) return;
      if (e.key === 'Escape') onClose?.();
      if (e.key === 'Enter') { e.preventDefault(); setEditing([sel.r1, sel.c1]); }
      if (e.key === 'z' && (e.metaKey || e.ctrlKey) && undo.current.length) { e.preventDefault(); setG(undo.current.pop()); }
    };
    window.addEventListener('mouseup', up);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('mouseup', up);
      window.removeEventListener('keydown', key);
      window.removeEventListener('mousedown', down);
    };
  }, [editing, sel, onClose, inline, active, g]);

  const isMerged = (anchor.cs || 1) > 1 || (anchor.rs || 1) > 1;

  // 没在编辑时，用站点组件本尊渲染 —— 保证画布上看到的就是发布后的样子
  if (inline && !active) {
    return (
      <div ref={root} className={s.inlineTable} onMouseDown={() => setActive(true)}>
        <DataTable data={g.cells.map((row) => row.filter(Boolean))} head={g.head} />
      </div>
    );
  }

  const content = (
    <>
      {active && (
        <div className={`${s.bar} ${inline ? s.floatBar : ''}`}>
          <button onClick={() => apply(mergeRange(g, b.r1, b.c1, b.r2, b.c2))}
            disabled={b.r1 === b.r2 && b.c1 === b.c2}>合并</button>
          <button onClick={() => apply(splitCell(g, sel.r1, sel.c1))} disabled={!isMerged}>拆分</button>
          <span className={s.sep} />
          <button data-on={!!anchor.b} onClick={() => toggle('b')} style={{ fontWeight: 700 }}>B</button>
          <button data-on={!!anchor.i} onClick={() => toggle('i')} style={{ fontStyle: 'italic' }}>I</button>
          <button data-on={!!anchor.u} onClick={() => toggle('u')} style={{ textDecoration: 'underline' }}>U</button>
          <button data-on={!!anchor.s} onClick={() => toggle('s')} style={{ textDecoration: 'line-through' }}>S</button>
          <select value={anchor.size ?? ''} onChange={(e) => patch({ size: e.target.value ? +e.target.value : null })} title="字号">
            <option value="">字号</option>
            {[12, 13, 14, 16, 18, 20, 24, 28].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <select value={anchor.font ?? ''} onChange={(e) => patch({ font: e.target.value || null })} title="字体">
            <option value="">默认</option>
            <option value="serif">衬线</option>
            <option value="mono">等宽</option>
          </select>
          <ColorPop label="字色" value={anchor.fg} onPick={(v) => patch({ fg: v })} />
          <ColorPop label="底色" value={anchor.bg} onPick={(v) => patch({ bg: v })} />
          <span className={s.sep} />
          {[['l', '左'], ['c', '中'], ['r', '右']].map(([v, t]) => (
            <button key={v} data-on={anchor.al === v} onClick={() => patch({ al: anchor.al === v ? null : v })}>{t}</button>
          ))}
          {[['t', '顶'], ['m', '中'], ['b', '底']].map(([v, t]) => (
            <button key={v} data-on={anchor.va === v} onClick={() => patch({ va: anchor.va === v ? null : v })}>{t}</button>
          ))}
          <span className={s.sep} />
          <button onClick={() => apply(insertRow(g, b.r1))}>↑行</button>
          <button onClick={() => apply(insertRow(g, b.r2 + 1))}>↓行</button>
          <button onClick={() => apply(insertCol(g, b.c1))}>←列</button>
          <button onClick={() => apply(insertCol(g, b.c2 + 1))}>→列</button>
          <button onClick={() => { apply(deleteRow(g, b.r1)); setSel({ r1: 0, c1: 0, r2: 0, c2: 0 }); }}>删行</button>
          <button onClick={() => { apply(deleteCol(g, b.c1)); setSel({ r1: 0, c1: 0, r2: 0, c2: 0 }); }}>删列</button>
          <span className={s.sep} />
          <select value={g.head} onChange={(e) => apply({ ...g, head: +e.target.value })} title="表头行数">
            {[0, 1, 2].map((n) => <option key={n} value={n}>表头 {n} 行</option>)}
          </select>
          <span className={s.spacer} />
          {!inline && <span className={s.hint}>拖选多格 · 双击/回车编辑文字 · ⌘Z 撤销</span>}
          {!inline && <button onClick={onClose}>取消</button>}
          {!inline && <button onClick={() => onSave(g)} data-on="true">完成</button>}
        </div>
      )}

      <div className={s.gridWrap}>
          <table className={s.grid}>
            <tbody>
              <tr>
                <th />
                {Array.from({ length: cols }, (_, c) => (
                  <th key={c} onClick={() => setSel({ r1: 0, c1: c, r2: rows - 1, c2: c })}>{c + 1}</th>
                ))}
              </tr>
              {g.cells.map((row, r) => (
                <tr key={r}>
                  <th onClick={() => setSel({ r1: r, c1: 0, r2: r, c2: cols - 1 })}>{r + 1}</th>
                  {row.map((cell, c) => {
                    if (!cell) return null;
                    const editingHere = editing?.[0] === r && editing?.[1] === c;
                    return (
                      <td
                        key={c}
                        colSpan={cell.cs > 1 ? cell.cs : undefined}
                        rowSpan={cell.rs > 1 ? cell.rs : undefined}
                        data-head={r < g.head}
                        data-sel={selected(r, c, cell)}
                        data-anchor={sel.r1 === r && sel.c1 === c}
                        style={cellStyle(cell, isDark)}
                        onMouseDown={(e) => {
                          if (editingHere) return;
                          e.preventDefault();
                          dragging.current = true;
                          setEditing(null);
                          setSel({ r1: r, c1: c, r2: r, c2: c });
                        }}
                        onMouseEnter={() => dragging.current && setSel((p) => ({ ...p, r2: r, c2: c }))}
                        onDoubleClick={() => setEditing([r, c])}
                      >
                        {/* 和正文块同一套：HTML 交给浏览器，失焦时用 domToMd 读回，
                            这样在单元格里加粗/上色也能保留下来（innerText 会把格式吃掉） */}
                        <div
                          className={s.cell}
                          contentEditable={editingHere}
                          suppressContentEditableWarning
                          ref={(el) => {
                            if (!editingHere || !el) return;
                            editingEl.current = el;
                            if (document.activeElement !== el) el.focus();
                          }}
                          dangerouslySetInnerHTML={{ __html: mdToHtml(cell.t, isDark) }}
                          onBlur={(e) => { setText(r, c, domToMd(e.currentTarget).trim()); setEditing(null); }}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) { e.preventDefault(); e.currentTarget.blur(); }
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
      </div>
    </>
  );

  // 内联时长在文档里，模态时套一层遮罩
  return inline ? (
    <div ref={root} className={s.inlineTable} onMouseDown={() => setActive(true)}>{content}</div>
  ) : (
    <div className={s.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={root} className={s.modal}>{content}</div>
    </div>
  );
}
