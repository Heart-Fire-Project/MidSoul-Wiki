import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import katex from 'katex';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { Editor, JSONContent } from '@tiptap/core';
import { TableMap, moveTableColumn, moveTableRow, selectedRect } from '@tiptap/pm/tables';
import { TextSelection } from '@tiptap/pm/state';
import type { LucideIcon } from 'lucide-react';
import {
  AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowLeft, ArrowRight, ArrowUp,
  BetweenHorizontalStart, BetweenVerticalStart, Bold, Braces, Check, ChevronDown, Code2,
  Bookmark, Columns3, Combine, Equal, EyeOff, FileImage, FileText, Highlighter, ImagePlus, Italic,
  Heading1, Heading2, Heading3, Heading4, Heading5, Heading6, Link2, List, ListChecks,
  ListOrdered, MessageSquareQuote, Minus, MoreHorizontal, Palette, Pilcrow, Plus, Paintbrush,
  Redo2, Rows3, ScanLine, Search, Sigma, SmilePlus, Sparkles, SquareCode, Strikethrough, Table2, Trash2, Underline, Undo2, Variable, X,
  PanelTop,
} from 'lucide-react';
import { tiptapExtensions, type MathSelectionKind, type TableLayoutMode } from './extensions';
import { ColorMenu, ColorPalette, type ColorSelection } from './ColorPalette';
import { displayImageSource } from './imagePaths';
import s from './TiptapEditor.module.css';

export const INITIAL_DOCUMENT: JSONContent = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: '地图导览' }] },
    { type: 'paragraph', content: [{ type: 'text', text: '记录午夜灵魂世界中的地点、路线与探索进度。选中文字会出现格式工具栏，空行输入 / 可以插入内容。' }] },
    {
      type: 'table', content: [
        { type: 'tableRow', content: [
          { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: '地点' }] }] },
          { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: '危险度' }] }] },
          { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: '状态' }] }] },
        ] },
        { type: 'tableRow', content: [
          { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '聚光圣殿' }] }] },
          { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '高' }] }] },
          { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '探索中' }] }] },
        ] },
      ],
    },
    { type: 'paragraph' },
  ],
};

export type EditorLinkTarget = { name: string; path: string; route?: string; handle: FileSystemFileHandle };
type Props = { content?: JSONContent; baseUrl?: string; images?: string[]; currentPath?: string; linkTargets?: EditorLinkTarget[]; onChange?: (document: JSONContent) => void };
const EMPTY_IMAGES: string[] = [];
const EMPTY_LINK_TARGETS: EditorLinkTarget[] = [];
type ToolProps = {
  active?: boolean;
  disabled?: boolean;
  icon: LucideIcon;
  label: string;
  command: () => unknown;
  text?: boolean;
  danger?: boolean;
};
type TablePanel = 'color' | 'more' | null;
type FloatingPanelPosition = { left: number; top: number; maxHeight: number; side: 'top' | 'bottom' };
type HintPosition = { left: number; top: number; side: 'top' | 'bottom' };
type TextAlignment = 'left' | 'center' | 'right';
type TableMove = 'rowUp' | 'rowDown' | 'columnLeft' | 'columnRight';
type MathTarget = { kind: MathSelectionKind; position: number };
type CalloutColor = 'green' | 'blue' | 'yellow' | 'red' | 'purple' | 'gray';
type AdmonitionKind = 'note' | 'tip' | 'info' | 'caution' | 'danger';
type BlockType = 'paragraph' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  | 'bulletList' | 'orderedList' | 'taskList' | 'blockquote' | 'code';

type BlockTypeItem = { value: BlockType; label: string; detail: string; icon: LucideIcon };
const BLOCK_TYPE_GROUPS: Array<{ label: string; columns?: boolean; items: BlockTypeItem[] }> = [
  { label: '文本', items: [{ value: 'paragraph', label: '正文', detail: '普通文本段落', icon: Pilcrow }] },
  { label: '标题', columns: true, items: [
    { value: 'h1', label: '一级标题', detail: '页面主标题', icon: Heading1 },
    { value: 'h2', label: '二级标题', detail: '主要章节', icon: Heading2 },
    { value: 'h3', label: '三级标题', detail: '章节小标题', icon: Heading3 },
    { value: 'h4', label: '四级标题', detail: '内容小节', icon: Heading4 },
    { value: 'h5', label: '五级标题', detail: '深层小节', icon: Heading5 },
    { value: 'h6', label: '六级标题', detail: '最深层级', icon: Heading6 },
  ] },
  { label: '列表与引用', items: [
    { value: 'bulletList', label: '无序列表', detail: '并列项目', icon: List },
    { value: 'orderedList', label: '有序列表', detail: '步骤或排名', icon: ListOrdered },
    { value: 'taskList', label: '检查清单', detail: '可以勾选的任务', icon: ListChecks },
    { value: 'blockquote', label: '引用', detail: '突出引用内容', icon: MessageSquareQuote },
    { value: 'code', label: '代码块', detail: '多行源码', icon: SquareCode },
  ] },
];

const CALLOUT_COLORS: Array<{ color: CalloutColor; name: string; value: string }> = [
  { color: 'green', name: '绿色', value: '#86d9a0' }, { color: 'blue', name: '蓝色', value: '#8fb6f0' },
  { color: 'yellow', name: '黄色', value: '#e5c86a' }, { color: 'red', name: '红色', value: '#eda19b' },
  { color: 'purple', name: '紫色', value: '#a89df5' }, { color: 'gray', name: '灰色', value: '#c9ccd4' },
];
const CALLOUT_EMOJIS = ['💡', '🗺️', 'ℹ️', '⚠️', '✅', '📌', '🎯', '🔥', '⭐', '👻'];
const EMOJI_GRAPHEME = /(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Regional_Indicator})/u;
const ADMONITIONS: Array<{ kind: AdmonitionKind; label: string; title: string }> = [
  { kind: 'note', label: 'Note', title: '笔记' }, { kind: 'tip', label: 'Tip', title: '技巧' },
  { kind: 'info', label: 'Info', title: '信息' }, { kind: 'caution', label: 'Caution', title: '注意' },
  { kind: 'danger', label: 'Danger', title: '危险' },
];

function Hint({ label, children, delay = 260 }: { label: string; children: ReactNode; delay?: number }) {
  const [position, setPosition] = useState<HintPosition | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setPosition(null);
  };
  const show = (target: HTMLElement, wait: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const rect = target.getBoundingClientRect();
      const side = rect.top > 54 ? 'top' : 'bottom';
      setPosition({
        left: Math.max(72, Math.min(window.innerWidth - 72, rect.left + rect.width / 2)),
        top: side === 'top' ? rect.top - 8 : rect.bottom + 8,
        side,
      });
    }, wait);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return <span className={s.hintAnchor}
    onMouseEnter={(event) => show(event.currentTarget, delay)} onMouseLeave={hide}
    onFocusCapture={(event) => show(event.currentTarget, 0)} onBlurCapture={hide}>
    {children}
    {position && createPortal(<span role="tooltip" className={s.tooltip} data-side={position.side}
      style={{ left: position.left, top: position.top }}>{label}</span>, document.body)}
  </span>;
}

function Tool({ active, disabled, icon: Icon, label, command, text, danger }: ToolProps) {
  return <Hint label={label}><button type="button" aria-label={label} aria-pressed={active || undefined} disabled={disabled}
    className={`${s.tool} ${active ? s.active : ''} ${text ? s.textTool : ''} ${danger ? s.danger : ''}`}
    onMouseDown={(event) => { event.preventDefault(); if (!disabled) command(); }}>
    <Icon size={15.5} strokeWidth={1.9} />{text && <span>{label}</span>}
  </button></Hint>;
}

function Divider() { return <span className={s.divider} aria-hidden="true" />; }

function BlockTypeMenu({ value, onSelect }: { value: BlockType; onSelect: (value: BlockType) => void }) {
  const current = BLOCK_TYPE_GROUPS.flatMap((group) => group.items).find((item) => item.value === value)
    ?? BLOCK_TYPE_GROUPS[0].items[0];
  const CurrentIcon = current.icon;
  return <DropdownMenu.Root>
    <Hint label="块类型：切换正文、标题、列表、引用或代码块">
      <DropdownMenu.Trigger asChild>
        <button type="button" className={s.blockMenuTrigger} aria-label={`块类型：${current.label}`}>
          <CurrentIcon size={16} strokeWidth={1.85} />
          <span>{current.label}</span>
          <ChevronDown size={13} className={s.blockMenuChevron} />
        </button>
      </DropdownMenu.Trigger>
    </Hint>
    <DropdownMenu.Portal>
      <DropdownMenu.Content className={s.blockMenuContent} align="start" sideOffset={7} collisionPadding={8}
        aria-label="选择块类型" onCloseAutoFocus={(event) => event.preventDefault()}>
        {BLOCK_TYPE_GROUPS.map((group) => <DropdownMenu.Group key={group.label} className={s.blockMenuGroup}
          data-columns={group.columns || undefined}>
          <DropdownMenu.Label className={s.blockMenuLabel}>{group.label}</DropdownMenu.Label>
          {group.items.map((item) => {
            const ItemIcon = item.icon;
            const selected = item.value === value;
            return <DropdownMenu.Item key={item.value} className={s.blockMenuItem} data-selected={selected || undefined}
              onSelect={() => onSelect(item.value)}>
              <span className={s.blockMenuIcon}><ItemIcon size={18} strokeWidth={1.75} /></span>
              <span className={s.blockMenuCopy}><b>{item.label}</b><small>{item.detail}</small></span>
              {selected && <Check className={s.blockMenuCheck} size={15} strokeWidth={2.3} />}
            </DropdownMenu.Item>;
          })}
        </DropdownMenu.Group>)}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>;
}

const firstEmoji = (value: string) => {
  const text = value.trim();
  if (!text) return '';
  const segments = typeof Intl.Segmenter === 'function'
    ? Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), ({ segment }) => segment)
    : Array.from(text);
  return segments.find((segment) => EMOJI_GRAPHEME.test(segment)) ?? '';
};

function CustomEmojiMenu({ value, onApply }: { value?: string; onApply: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const custom = value && !CALLOUT_EMOJIS.includes(value) ? value : '';
  const emoji = firstEmoji(input);
  useEffect(() => {
    if (!open) return undefined;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);
  const apply = () => {
    if (!emoji) return;
    onApply(emoji);
    setInput(emoji);
    setOpen(false);
  };
  return <DropdownMenu.Root open={open} onOpenChange={(next) => { setOpen(next); if (next) setInput(custom); }}>
    <Hint label="自定义 emoji">
      <DropdownMenu.Trigger asChild>
        <button type="button" className={s.emojiCustomTrigger} aria-label="自定义 emoji" aria-expanded={open}
          data-on={Boolean(custom) || undefined} onMouseDown={(event) => event.preventDefault()}>
          {custom ? <span>{custom}</span> : <SmilePlus size={15} strokeWidth={1.8} />}
        </button>
      </DropdownMenu.Trigger>
    </Hint>
    <DropdownMenu.Portal>
      <DropdownMenu.Content className={s.emojiCustomMenu} sideOffset={7} collisionPadding={8} align="end"
        onCloseAutoFocus={(event) => event.preventDefault()}>
        <label><span>粘贴或输入一个 emoji</span><input ref={inputRef} value={input} placeholder="例如：🪄"
          aria-label="自定义提示条 emoji" onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); apply(); } }} /></label>
        <button type="button" disabled={!emoji} onClick={apply}><Check size={14} />应用</button>
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>;
}

function closestNodeReference(editor: Editor, selector: string, position = editor.state.selection.from) {
  const domNode = editor.view.domAtPos(position).node;
  const element = domNode instanceof Element ? domNode : domNode.parentElement;
  const target = element?.closest(selector);
  if (!target) return null;
  return {
    contextElement: target,
    getBoundingClientRect: () => target.getBoundingClientRect(),
  };
}

function activeBubbleMenuKeys(editor: Editor) {
  return editor.isActive('table') ? ['table-cell-menu']
    : editor.isActive('callout') ? ['callout-menu']
      : editor.isActive('admonition') ? ['admonition-menu']
        : editor.state.selection.from !== editor.state.selection.to ? ['text-format-menu'] : [];
}

function refreshActiveBubbleMenu(editor: Editor) {
  if (editor.isDestroyed) return;
  const keys = activeBubbleMenuKeys(editor);
  if (!keys.length) return;
  const transaction = editor.state.tr;
  keys.forEach((key) => transaction.setMeta(key, 'updatePosition'));
  editor.view.dispatch(transaction);
}

function TableMenu({ label, icon: Icon, open, align = 'start', onToggle, children }: {
  label: string;
  icon: LucideIcon;
  open: boolean;
  align?: 'start' | 'end';
  onToggle: () => void;
  children: ReactNode;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<FloatingPanelPosition | null>(null);
  useLayoutEffect(() => {
    if (!open) { setPosition(null); return undefined; }
    const place = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const gap = 8;
      const panelWidth = Math.min(272, window.innerWidth - gap * 2);
      const below = window.innerHeight - rect.bottom - gap;
      const above = rect.top - gap;
      const side = below >= Math.min(280, above) ? 'bottom' : 'top';
      const idealLeft = align === 'end' ? rect.right - panelWidth : rect.left;
      setPosition({
        left: Math.max(gap, Math.min(window.innerWidth - panelWidth - gap, idealLeft)),
        top: side === 'bottom' ? rect.bottom + gap : rect.top - gap,
        maxHeight: Math.max(112, side === 'bottom' ? below : above),
        side,
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [align, open]);

  return <span className={s.tableMenu}>
    <Hint label={label}><button ref={triggerRef} type="button" className={`${s.tool} ${open ? s.active : ''}`} aria-label={label}
      aria-expanded={open} onMouseDown={(event) => { event.preventDefault(); onToggle(); }}>
      <Icon size={15.5} strokeWidth={1.9} /><ChevronDown className={s.menuChevron} size={10.5} />
    </button></Hint>
    {open && position && createPortal(<span className={s.tablePanel} data-side={position.side} role="dialog" aria-label={label}
      style={{ left: position.left, top: position.top, maxHeight: position.maxHeight }}>{children}</span>, document.body)}
  </span>;
}

function TableMenuAction({ icon: Icon, label, command, disabled, active, danger }: ToolProps) {
  return <button type="button" className={`${s.tableMenuAction} ${active ? s.active : ''} ${danger ? s.danger : ''}`}
    aria-pressed={active || undefined} disabled={disabled}
    onMouseDown={(event) => { event.preventDefault(); if (!disabled) command(); }}>
    <Icon size={15} strokeWidth={1.85} /><span>{label}</span>
  </button>;
}

function setTableLayout(editor: Editor, layoutMode: TableLayoutMode) {
  const { $from } = editor.state.selection;
  let tableDepth = $from.depth;
  while (tableDepth > 0 && $from.node(tableDepth).type.name !== 'table') tableDepth -= 1;
  if (tableDepth === 0) return false;
  const table = $from.node(tableDepth);
  const tablePosition = $from.before(tableDepth);
  // equal：按表格当前可视宽度给每列写入相同 colwidth，编辑器内立即等宽；
  // content：清空所有 colwidth，交给内容自适应（发布端 DataTable 也如此）。
  let equalWidth: number | null = null;
  if (layoutMode === 'equal') {
    const dom = editor.view.nodeDOM(tablePosition) as HTMLElement | null;
    const map = TableMap.get(table);
    if (dom && map.width > 0) equalWidth = Math.max(64, Math.floor(dom.getBoundingClientRect().width / map.width));
  }
  const transaction = editor.state.tr;
  table.descendants((node, position) => {
    if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
      const colspan = Math.max(1, Number(node.attrs.colspan ?? 1));
      const colwidth = equalWidth ? Array.from({ length: colspan }, () => equalWidth) : null;
      transaction.setNodeMarkup(tablePosition + position + 1, undefined, { ...node.attrs, colwidth, layoutMode });
    }
  });
  editor.view.dispatch(transaction);
  editor.commands.focus();
  return true;
}

/** 读取当前选中列的实际渲染宽度（优先 DOM colgroup，回退 cell colwidth）。 */
function currentColumnWidth(editor: Editor): number | null {
  if (!editor.isActive('table')) return null;
  const rect = selectedRect(editor.state);
  const col = rect.left;
  const tableDom = editor.view.nodeDOM(rect.tableStart - 1) as HTMLElement | null;
  const domWidth = tableDom?.querySelectorAll('col')[col]?.getBoundingClientRect().width;
  if (domWidth && Number.isFinite(domWidth) && domWidth > 0) return Math.round(domWidth);
  let column = 0;
  let width: number | null = null;
  rect.table.firstChild?.forEach((cell) => {
    const colspan = Math.max(1, Number(cell.attrs.colspan ?? 1));
    for (let offset = 0; offset < colspan; offset += 1, column += 1) {
      if (column === col) {
        const value = Number(cell.attrs.colwidth?.[offset]);
        if (Number.isFinite(value) && value > 0) width = value;
      }
    }
  });
  return width;
}

/** 将指定像素宽度应用到当前选中列（参照 prosemirror-tables 的 updateColumnWidth）。 */
function applyColumnWidth(editor: Editor, width: number) {
  if (!editor.isActive('table') || !Number.isFinite(width) || width < 64) return false;
  const rect = selectedRect(editor.state);
  const { table, tableStart, map } = rect;
  const col = rect.left;
  const transaction = editor.state.tr;
  for (let row = 0; row < map.height; row += 1) {
    const mapIndex = row * map.width + col;
    if (row && map.map[mapIndex] === map.map[mapIndex - map.width]) continue;
    const pos = map.map[mapIndex];
    const attrs = table.nodeAt(pos)!.attrs;
    const index = attrs.colspan === 1 ? 0 : col - map.colCount(pos);
    const colwidth = attrs.colwidth ? attrs.colwidth.slice() : Array(Math.max(1, Number(attrs.colspan ?? 1))).fill(0);
    colwidth[index] = width;
    transaction.setNodeMarkup(tableStart + pos, null, { ...attrs, colwidth });
  }
  if (transaction.docChanged) editor.view.dispatch(transaction);
  editor.commands.focus();
  return true;
}

/** 从文档中当前表格上方的最近一张同列数表格复制列宽方案。 */
function copyColumnWidthFromAbove(editor: Editor) {
  const { $from } = editor.state.selection;
  let tableDepth = $from.depth;
  while (tableDepth > 0 && $from.node(tableDepth).type.name !== 'table') tableDepth -= 1;
  if (tableDepth === 0) return false;
  const currentTable = $from.node(tableDepth);
  const currentTablePos = $from.before(tableDepth);
  const currentMap = TableMap.get(currentTable);
  const doc = editor.state.doc;

  // 向上找最近一张同列数、且每列都有明确宽度的表格
  let source: { widths: number[] } | null = null;
  doc.nodesBetween(0, currentTablePos, (node, pos) => {
    if (source || node.type.name !== 'table' || pos >= currentTablePos) return;
    const map = TableMap.get(node);
    if (map.width !== currentMap.width) return;
    // colwidth 未设置的列用表格实际渲染宽度兜底，保证整行宽度可读
    const tableDom = editor.view.nodeDOM(pos) as HTMLElement | null;
    const domColWidths = tableDom
      ? [...tableDom.querySelectorAll('col')].map((col) => col.getBoundingClientRect().width)
      : [];
    const widths: number[] = [];
    let column = 0;
    node.firstChild?.forEach((cell) => {
      const colspan = Math.max(1, Number(cell.attrs.colspan ?? 1));
      for (let offset = 0; offset < colspan; offset += 1, column += 1) {
        const width = Number(cell.attrs.colwidth?.[offset]);
        widths[column] = Number.isFinite(width) && width > 0 ? width : Math.round(domColWidths[column] ?? 0);
      }
    });
    if (widths.every((width) => width > 0)) source = { widths };
  });
  if (!source) return false;

  const transaction = editor.state.tr;
  const tableStart = currentTablePos + 1;
  for (let row = 0; row < currentMap.height; row += 1) {
    for (let col = 0; col < currentMap.width; col += 1) {
      const mapIndex = row * currentMap.width + col;
      if (row && currentMap.map[mapIndex] === currentMap.map[mapIndex - currentMap.width]) continue;
      const pos = currentMap.map[mapIndex];
      const attrs = currentTable.nodeAt(pos)!.attrs;
      const colspan = Math.max(1, Number(attrs.colspan ?? 1));
      // 按绝对列索引取宽度（colwidth 数组以 cell 起点为 0，需用当前列补 offset）
      const colwidth = Array.from({ length: colspan }, (_, offset) => source!.widths[col + offset]);
      transaction.setNodeMarkup(tableStart + pos, null, { ...attrs, colwidth });
    }
  }
  if (transaction.docChanged) editor.view.dispatch(transaction);
  editor.commands.focus();
  return true;
}

function tableMoveState(editor: Editor) {
  if (!editor.isActive('table')) return null;
  const rect = selectedRect(editor.state);
  let headerRows = 0;
  rect.table.forEach((row, _offset, index) => {
    if (index === headerRows && row.childCount > 0 && Array.from({ length: row.childCount }, (_, cellIndex) => row.child(cellIndex)).every((cell) => cell.type.name === 'tableHeader')) headerRows += 1;
  });
  return {
    canMoveRowUp: rect.top > 0,
    canMoveRowDown: rect.bottom < rect.map.height,
    canMoveColumnLeft: rect.left > 0,
    canMoveColumnRight: rect.right < rect.map.width,
    hasHeader: headerRows > 0,
    hideHeader: Boolean(rect.table.attrs.hideHeader),
    noFirstCol: Boolean(rect.table.attrs.noFirstCol),
    layoutMode: (rect.table.firstChild?.firstChild?.attrs.layoutMode ?? 'equal') as TableLayoutMode,
  };
}

function setTableDisplayOption(editor: Editor, option: 'hideHeader' | 'noFirstCol', enabled: boolean) {
  if (!editor.isActive('table')) return false;
  const rect = selectedRect(editor.state);
  const transaction = editor.state.tr.setNodeMarkup(rect.tableStart - 1, undefined, { ...rect.table.attrs, [option]: enabled });
  const cellAttribute = option === 'hideHeader' ? 'tableHideHeader' : 'tableNoFirstCol';
  rect.table.descendants((node, position) => {
    if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
      transaction.setNodeMarkup(rect.tableStart + position, undefined, { ...node.attrs, [cellAttribute]: enabled });
    }
  });
  if (option === 'hideHeader' && enabled && rect.top === 0 && rect.map.height > 1) {
    const cellPosition = rect.tableStart + rect.map.positionAt(1, Math.min(rect.left, rect.map.width - 1), rect.table);
    transaction.setSelection(TextSelection.near(transaction.doc.resolve(cellPosition + 1)));
  }
  editor.view.dispatch(transaction);
  editor.commands.focus();
  return true;
}

function setTableAnchor(editor: Editor, anchorId: string | null) {
  if (!editor.isActive('table')) return false;
  const rect = selectedRect(editor.state);
  editor.view.dispatch(editor.state.tr.setNodeMarkup(rect.tableStart - 1, undefined, { ...rect.table.attrs, anchorId }));
  editor.commands.focus();
  return true;
}

function setTableRowAnchor(editor: Editor, anchorId: string | null) {
  if (!editor.isActive('table')) return false;
  const rect = selectedRect(editor.state);
  const transaction = editor.state.tr;
  // 之前「整张表格」的跳转点可能恰好用了这一行的名称。行级锚点应当
  // 优先，避免渲染后出现两个相同的 id，导致浏览器永远只能跳到表格顶部。
  if (anchorId && rect.table.attrs.anchorId === anchorId) {
    transaction.setNodeMarkup(rect.tableStart - 1, undefined, { ...rect.table.attrs, anchorId: null });
  }
  let offset = 0;
  for (let index = 0; index < rect.top; index += 1) offset += rect.table.child(index).nodeSize;
  for (let index = rect.top; index < rect.bottom; index += 1) {
    const row = rect.table.child(index);
    transaction.setNodeMarkup(rect.tableStart + offset, undefined, { ...row.attrs, anchorId });
    offset += row.nodeSize;
  }
  editor.view.dispatch(transaction);
  editor.commands.focus();
  return true;
}

function moveCurrentTablePart(editor: Editor, direction: TableMove) {
  if (!editor.isActive('table')) return false;
  const rect = selectedRect(editor.state);
  const command = direction === 'rowUp'
    ? moveTableRow({ from: rect.top, to: rect.top - 1 })
    : direction === 'rowDown'
      ? moveTableRow({ from: rect.top, to: rect.bottom })
      : direction === 'columnLeft'
        ? moveTableColumn({ from: rect.left, to: rect.left - 1 })
        : moveTableColumn({ from: rect.left, to: rect.right });
  const moved = command(editor.state, editor.view.dispatch);
  if (moved) editor.commands.focus();
  return moved;
}

function insertBlockAfter(editor: Editor, content: JSONContent) {
  const { $from } = editor.state.selection;
  const position = $from.depth > 0 ? $from.after(1) : editor.state.selection.to;
  return editor.chain().focus().insertContentAt(position, content).run();
}

function tableBlock(rows = 3, columns = 3): JSONContent {
  return {
    type: 'table',
    content: Array.from({ length: rows }, (_, row) => ({
      type: 'tableRow',
      content: Array.from({ length: columns }, () => ({
        type: row === 0 ? 'tableHeader' : 'tableCell',
        content: [{ type: 'paragraph' }],
      })),
    })),
  };
}

function insertCallout(editor: Editor, color: CalloutColor) {
  return insertBlockAfter(editor, { type: 'callout', attrs: { color, emoji: '💡' }, content: [{ type: 'text', text: '输入提示内容' }] });
}

function insertAdmonition(editor: Editor, kind: AdmonitionKind, title: string) {
  return insertBlockAfter(editor, { type: 'admonition', attrs: { kind, title }, content: [{ type: 'paragraph', content: [{ type: 'text', text: '输入提示内容' }] }] });
}

type LinkDestination = { label: string; anchor: string; level: number; kind: 'heading' | 'table' | 'row' | 'text' };

function headingAnchor(text: string) {
  // Docusaurus 使用 GitHub 风格的标题 id。中文会原样保留，空格转为连字符；
  // 这里足以覆盖编辑器能识别的普通 Markdown 标题。
  return text.trim().toLocaleLowerCase('zh').replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-');
}

function destinationsFromMarkdown(markdown: string): LinkDestination[] {
  const headings = markdown.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!match) return [];
    const label = match[2].replace(/[`*_~]/g, '').trim();
    const anchor = headingAnchor(label);
    return label && anchor ? [{ label, anchor, level: match[1].length, kind: 'heading' as const }] : [];
  });
  const exact: LinkDestination[] = [];
  for (const match of markdown.matchAll(/<DataTable\b(?=[^>]*\bid=["']([^"']+)["'])[^>]*>/g)) {
    exact.push({ label: `表格 · ${match[1]}`, anchor: match[1], level: 1, kind: 'table' });
  }
  // 行级跳转点保存在 DataTable 的 rowIds 属性中；它们不是标题，也要出现在
  // 链接选择器里，才能从任意文档精确链接到表格中的某一行。
  for (const match of markdown.matchAll(/<DataTable\b[^>]*\browIds=\{(\[[^\]]*\])\}[^>]*>/g)) {
    try {
      const rowIds = JSON.parse(match[1]);
      if (Array.isArray(rowIds)) {
        for (const rowId of rowIds) {
          if (typeof rowId === 'string' && rowId) exact.push({ label: `表格行 · ${rowId}`, anchor: rowId, level: 1, kind: 'row' });
        }
      }
    } catch {
      // 手写的 MDX 即使 rowIds 不是标准 JSON，也不应让整个链接选择器失效。
    }
  }
  for (const match of markdown.matchAll(/<span\b(?=[^>]*\bid=["']([^"']+)["'])[^>]*>([\s\S]*?)<\/span>/g)) {
    const label = match[2].replace(/<[^>]+>/g, '').replace(/[`*_~]/g, '').trim();
    exact.push({ label: `文字 · ${label || match[1]}`, anchor: match[1], level: 1, kind: 'text' });
  }
  return [...headings, ...exact].filter((item, index, all) => all.findIndex((other) => other.anchor === item.anchor) === index);
}

function stripDocusaurusNumberPrefix(segment: string) {
  if (/^\d+[-_.]\d+/.test(segment)) return segment;
  return segment.replace(/^\d+\s*[-_.]+\s*(?=[^-_.\s])/, '');
}

function documentLinkHref(baseUrl: string, target: EditorLinkTarget, anchor?: string) {
  if (target.route) return anchor ? `${target.route}#${encodeURIComponent(anchor)}` : target.route;
  const targetPath = target.path;
  const segments = targetPath.split('/').filter(Boolean);
  const docs = segments.indexOf('docs');
  const documentSegments = (docs >= 0 ? segments.slice(docs + 1) : segments).map((part, index, all) =>
    stripDocusaurusNumberPrefix(index === all.length - 1 ? part.replace(/\.mdx?$/i, '') : part),
  );
  const route = `${baseUrl.replace(/\/?$/, '/') }wiki/${documentSegments.map(encodeURIComponent).join('/')}`;
  return anchor ? `${route}#${encodeURIComponent(anchor)}` : route;
}

function LinkPicker({ baseUrl, targets, initialHref, onApply, onRemove, onClose }: {
  baseUrl: string;
  targets: EditorLinkTarget[];
  initialHref?: string;
  onApply: (href: string) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState<EditorLinkTarget | null>(null);
  const [destinations, setDestinations] = useState<LinkDestination[]>([]);
  const [anchor, setAnchor] = useState('');
  const [webHref, setWebHref] = useState(initialHref ?? '');
  const filtered = useMemo(() => {
    const value = query.trim().toLocaleLowerCase('zh');
    return value ? targets.filter((item) => `${item.name} ${item.path}`.toLocaleLowerCase('zh').includes(value)) : targets;
  }, [query, targets]);

  useEffect(() => {
    let alive = true;
    setDestinations([]);
    setAnchor('');
    if (!target) return undefined;
    target.handle.getFile().then((file) => file.text()).then((markdown) => {
      if (alive) setDestinations(destinationsFromMarkdown(markdown));
    }).catch(() => { if (alive) setDestinations([]); });
    return () => { alive = false; };
  }, [target]);

  const applyDocument = () => {
    if (!target) return;
    onApply(documentLinkHref(baseUrl, target, anchor || undefined));
  };
  const applyWeb = () => {
    const href = webHref.trim();
    if (href) onApply(href);
  };

  return <div className={s.linkBackdrop} role="presentation" onMouseDown={onClose}>
    <div className={s.linkPicker} role="dialog" aria-modal="true" aria-label="插入链接" onMouseDown={(event) => event.stopPropagation()}>
      <div className={s.linkPickerHead}><div><b>插入链接</b><small>选择 Wiki 文档和章节，或填写普通网页地址</small></div><button type="button" aria-label="关闭链接窗口" onClick={onClose}><X size={16} /></button></div>
      <div className={s.linkPickerGrid}>
        <section className={s.linkPickerSection}>
          <label className={s.linkPickerLabel}><FileText size={14} />Wiki 文档</label>
          <div className={s.linkSearch}><Search size={14} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`搜索已打开文件夹中的文档（${targets.length} 篇）`} /></div>
          <div className={s.linkDocumentList} aria-label="Wiki 文档列表">
            {filtered.length ? filtered.map((item) => <button key={item.path} type="button" data-selected={target?.path === item.path}
              onClick={() => setTarget(item)}><b>{item.name.replace(/\.mdx?$/i, '')}</b><small>{item.path}</small></button>) : <p>没有匹配文档</p>}
          </div>
          <label className={s.linkPickerLabel}><span>#</span>跳转位置</label>
          <select value={anchor} disabled={!target} onChange={(event) => setAnchor(event.target.value)}>
            <option value="">文档开头</option>
            {destinations.map((destination, index) => <option key={`${destination.anchor}-${index}`} value={destination.anchor}>{`${destination.kind === 'heading' ? '　'.repeat(Math.max(0, destination.level - 1)) : '　'}${destination.label}`}</option>)}
          </select>
          <button className={s.linkApply} type="button" disabled={!target} onClick={applyDocument}>链接到所选位置</button>
        </section>
        <section className={s.linkPickerSection}>
          <label className={s.linkPickerLabel}><Link2 size={14} />网页或手动地址</label>
          <input className={s.linkUrlInput} value={webHref} onChange={(event) => setWebHref(event.target.value)} placeholder="https://… 或 /docs/…#章节" />
          <p className={s.linkPickerHint}>外部网址、站内页面或你已有的链接都可以直接粘贴在这里。</p>
          <button className={s.linkApply} type="button" disabled={!webHref.trim()} onClick={applyWeb}>应用此地址</button>
          {initialHref && <button className={s.linkRemove} type="button" onClick={onRemove}>移除现有链接</button>}
        </section>
      </div>
    </div>
  </div>;
}

function AnchorDialog({ kind, initialId, suggestedId, onApply, onRemove, onClose }: {
  kind: 'text' | 'table' | 'row';
  initialId?: string | null;
  suggestedId: string;
  onApply: (id: string) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initialId ?? suggestedId);
  const normalized = headingAnchor(value);
  return <div className={s.linkBackdrop} role="presentation" onMouseDown={onClose}>
    <div className={s.anchorDialog} role="dialog" aria-modal="true" aria-label="设置精确跳转点" onMouseDown={(event) => event.stopPropagation()}>
      <div className={s.linkPickerHead}><div><b>设置精确跳转点</b><small>{kind === 'table' ? '为整张表格生成一个可被其它文档链接到的位置。' : kind === 'row' ? '为当前表格行生成一个可被其它文档链接到的位置。' : '为选中的文字生成一个可被其它文档链接到的位置。'}</small></div><button type="button" aria-label="关闭跳转点窗口" onClick={onClose}><X size={16} /></button></div>
      <label className={s.anchorField}><span>跳转点名称</span><input autoFocus value={value} onChange={(event) => setValue(event.target.value)} placeholder="例如：饰品-装配说明" /><small>实际锚点：#{normalized || '未填写'} · 同一篇文档内请勿重复</small></label>
      <div className={s.anchorActions}><button className={s.linkApply} type="button" disabled={!normalized} onClick={() => onApply(normalized)}>保存跳转点</button>{initialId && <button className={s.linkRemove} type="button" onClick={onRemove}>移除此跳转点</button>}</div>
    </div>
  </div>;
}

export default function TiptapEditor({ content = INITIAL_DOCUMENT, baseUrl = '/', images = EMPTY_IMAGES, currentPath, linkTargets = EMPTY_LINK_TARGETS, onChange }: Props) {
  const [backgroundColor, setBackgroundColor] = useState<string | null>(null);
  const [opacity, setOpacity] = useState(0.75);
  const [insertOpen, setInsertOpen] = useState(false);
  const [mathLatex, setMathLatex] = useState('E = mc^2');
  const [mathTarget, setMathTarget] = useState<MathTarget | null>(null);
  const [imageSource, setImageSource] = useState('/img/');
  const [imageQuery, setImageQuery] = useState('');
  const [tablePanel, setTablePanel] = useState<TablePanel>(null);
  const [columnWidthDraft, setColumnWidthDraft] = useState('');
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const [anchorDialog, setAnchorDialog] = useState<{ kind: 'text' | 'table' | 'row'; initialId?: string | null; suggestedId: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [bubbleScrollTarget, setBubbleScrollTarget] = useState<HTMLDivElement | null>(null);
  const bindScrollTarget = useCallback((node: HTMLDivElement | null) => {
    scrollRef.current = node;
    setBubbleScrollTarget((current) => current === node ? current : node);
  }, []);
  const getEditorOverlayRoot = useCallback(() => scrollRef.current?.parentElement ?? document.body, []);
  const openInsertPanel = useCallback(() => { setMathTarget(null); setInsertOpen(true); }, []);
  const closeInsertPanel = useCallback(() => { setMathTarget(null); setInsertOpen(false); }, []);
  const handleMathSelect = useCallback((kind: MathSelectionKind, latex: string, position: number) => {
    setMathLatex(latex);
    setMathTarget({ kind, position });
    setInsertOpen(true);
  }, []);
  const editorExtensions = useMemo(() => tiptapExtensions(baseUrl, handleMathSelect), [baseUrl, handleMathSelect]);
  const mathPreview = useMemo(() => katex.renderToString(mathLatex || '\\square', {
    displayMode: true,
    throwOnError: false,
    strict: false,
  }), [mathLatex]);
  const filteredImages = useMemo(() => {
    const query = imageQuery.trim().toLocaleLowerCase('zh');
    return query ? images.filter((path) => path.toLocaleLowerCase('zh').includes(query)) : images;
  }, [imageQuery, images]);
  const editor = useEditor({
    extensions: editorExtensions, content, immediatelyRender: false,
    editorProps: { attributes: { class: 'tiptap', 'aria-label': '文档正文' } },
    onUpdate: ({ editor: current }) => onChange?.(current.getJSON()),
  });
  const getTableReference = useCallback(() => {
    if (!editor) return null;
    // 长表格不能以整张 table 的顶部作为锚点：工具栏会留在表头，编辑底部
    // 单元格时必须来回滚动。CellSelection 的 head 才是用户当前拖到的单元格，
    // 普通文本选区则直接使用 selection.head；最后再回退到整张 table。
    const selection = editor.state.selection as typeof editor.state.selection & { $headCell?: { pos: number } };
    const activeCellPosition = selection.$headCell ? selection.$headCell.pos + 1 : selection.head;
    return closestNodeReference(editor, 'td, th', activeCellPosition)
      ?? closestNodeReference(editor, 'table', activeCellPosition);
  }, [editor]);
  const getCalloutReference = useCallback(() => editor ? closestNodeReference(editor, '[data-callout]') : null, [editor]);
  const getAdmonitionReference = useCallback(() => editor ? closestNodeReference(editor, '[data-admonition]') : null, [editor]);
  const bubbleOptions = useMemo(() => ({
    strategy: 'fixed' as const,
    placement: 'top-start' as const,
    offset: 10,
    // 页面本身不滚动，真正滚动的是编辑器内部的 .scroll。把它直接交给
    // BubbleMenu，Tiptap 才会在长表格上下滚动时调用 updatePosition。
    scrollTarget: bubbleScrollTarget ?? undefined,
    // 上下文工具栏必须始终待在内容上方。垂直翻转会造成滚动到顶端时
    // 突然跳到内容下方；只保留水平方向的视口防溢出。
    flip: false as const,
    shift: { padding: 8, mainAxis: true, crossAxis: false },
  }), [bubbleScrollTarget]);

  useEffect(() => {
    if (!editor) return undefined;
    let frame = 0;
    const syncBubbleMenuToSelection = () => {
      setTablePanel(null);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => { refreshActiveBubbleMenu(editor); });
    };
    editor.on('selectionUpdate', syncBubbleMenuToSelection);
    return () => {
      cancelAnimationFrame(frame);
      editor.off('selectionUpdate', syncBubbleMenuToSelection);
    };
  }, [editor]);

  useEffect(() => {
    if (!tablePanel) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setTablePanel(null); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [tablePanel]);

  useEffect(() => {
    if (!editor) return undefined;
    const scrollTarget = bubbleScrollTarget;
    if (!scrollTarget) return undefined;
    const updateBubbleMenuPositions = () => {
      if (!activeBubbleMenuKeys(editor).length) return;
      setTablePanel(null);
      // 与编辑区的滚动同一帧重定位，避免长表格快速滚动时工具栏追赶单元格。
      refreshActiveBubbleMenu(editor);
    };
    scrollTarget.addEventListener('scroll', updateBubbleMenuPositions, true);
    return () => {
      scrollTarget.removeEventListener('scroll', updateBubbleMenuPositions, true);
    };
  }, [editor, bubbleScrollTarget]);

  const toolbarState = useEditorState({
    editor,
    selector: ({ editor: current }) => current ? ({
      tableMove: tableMoveState(current),
      columnWidth: current.isActive('table') ? currentColumnWidth(current) : null,
      block: current.isActive('heading', { level: 1 }) ? 'h1' : current.isActive('heading', { level: 2 }) ? 'h2'
        : current.isActive('heading', { level: 3 }) ? 'h3' : current.isActive('heading', { level: 4 }) ? 'h4'
          : current.isActive('heading', { level: 5 }) ? 'h5' : current.isActive('heading', { level: 6 }) ? 'h6'
            : current.isActive('taskList') ? 'taskList' : current.isActive('bulletList') ? 'bulletList'
              : current.isActive('orderedList') ? 'orderedList' : current.isActive('blockquote') ? 'blockquote'
                : current.isActive('codeBlock') ? 'code' : 'paragraph',
      bold: current.isActive('bold'), italic: current.isActive('italic'), underline: current.isActive('underline'),
      strike: current.isActive('strike'), code: current.isActive('code'), bulletList: current.isActive('bulletList'),
      orderedList: current.isActive('orderedList'), blockquote: current.isActive('blockquote'), label: current.isActive('label'),
      inkFg: current.getAttributes('ink').fg as string | undefined,
      inkBg: current.getAttributes('ink').bg as string | undefined,
      inkFgDark: current.getAttributes('ink').fgDark as string | undefined,
      inkBgDark: current.getAttributes('ink').bgDark as string | undefined,
      textAlign: (current.isActive({ textAlign: 'center' }) ? 'center'
        : current.isActive({ textAlign: 'right' }) ? 'right' : 'left') as TextAlignment,
      canUndo: current.can().undo(), canRedo: current.can().redo(),
      calloutColor: current.getAttributes('callout').color as CalloutColor | undefined,
      calloutEmoji: current.getAttributes('callout').emoji as string | undefined,
      admonitionKind: current.getAttributes('admonition').kind as AdmonitionKind | undefined,
      admonitionTitle: current.getAttributes('admonition').title as string | undefined,
    }) : null,
  });

  if (!editor) return <div className={s.editor}><div className={s.loading}>正在加载编辑器…</div></div>;
  const setCellBackground = (color: string | null, nextOpacity = opacity) => editor.chain().focus()
    .setCellAttribute('backgroundColor', color).setCellAttribute('backgroundOpacity', nextOpacity).run();
  const toggleCellColorMenu = () => {
    if (tablePanel === 'color') { setTablePanel(null); return; }
    const { $from } = editor.state.selection;
    let depth = $from.depth;
    while (depth > 0 && !['tableCell', 'tableHeader'].includes($from.node(depth).type.name)) depth -= 1;
    const attributes = depth > 0 ? $from.node(depth).attrs : {};
    setBackgroundColor(typeof attributes.backgroundColor === 'string' ? attributes.backgroundColor : null);
    setOpacity(typeof attributes.backgroundOpacity === 'number' ? attributes.backgroundOpacity : 1);
    setTablePanel('color');
  };
  const setInkColor = (attribute: 'fg' | 'bg', color: ColorSelection) => {
    const current = editor.getAttributes('ink') as { fg?: string | null; bg?: string | null; fgDark?: string | null; bgDark?: string | null };
    const darkAttribute = attribute === 'fg' ? 'fgDark' : 'bgDark';
    const next = {
      ...current,
      [attribute]: color && typeof color === 'object' ? color.light : color,
      [darkAttribute]: color && typeof color === 'object' ? color.dark : null,
    };
    const chain = editor.chain().focus();
    return next.fg || next.bg || next.fgDark || next.bgDark ? chain.setMark('ink', next).run() : chain.unsetMark('ink').run();
  };
  const runInsert = (command: () => unknown) => { command(); closeInsertPanel(); };
  const insertImage = (source: string) => {
    const trimmed = source.trim();
    if (!trimmed) return;
    runInsert(() => insertBlockAfter(editor, { type: 'image', attrs: { src: displayImageSource(trimmed, baseUrl) } }));
  };
  const setBlock = (value: BlockType) => {
    if (value === toolbarState?.block) { editor.commands.focus(); return; }
    const chain = editor.chain().focus().clearNodes();
    if (value === 'paragraph') chain.setParagraph().run();
    else if (value === 'bulletList') chain.toggleBulletList().run();
    else if (value === 'orderedList') chain.toggleOrderedList().run();
    else if (value === 'taskList') chain.toggleTaskList().run();
    else if (value === 'blockquote') chain.toggleBlockquote().run();
    else if (value === 'code') chain.setCodeBlock().run();
    else chain.setHeading({ level: Number(value.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6 }).run();
  };
  const openLinkPicker = () => setLinkPickerOpen(true);
  const applyLink = (href: string) => {
    const applied = editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    if (applied) setLinkPickerOpen(false);
    return applied;
  };
  const removeLink = () => {
    const removed = editor.chain().focus().extendMarkRange('link').unsetLink().run();
    if (removed) setLinkPickerOpen(false);
    return removed;
  };
  const openTextAnchorDialog = () => {
    const { from, to } = editor.state.selection;
    if (from === to) return false;
    const text = editor.state.doc.textBetween(from, to, ' ').trim();
    setAnchorDialog({ kind: 'text', initialId: editor.getAttributes('anchor').id as string | undefined, suggestedId: headingAnchor(text) || '文字定位' });
    return true;
  };
  const openTableAnchorDialog = () => {
    const table = tableMoveState(editor);
    if (!table) return false;
    const rect = selectedRect(editor.state);
    setAnchorDialog({ kind: 'table', initialId: rect.table.attrs.anchorId as string | undefined, suggestedId: '表格定位' });
    setTablePanel(null);
    return true;
  };
  const openTableRowAnchorDialog = () => {
    if (!tableMoveState(editor)) return false;
    const rect = selectedRect(editor.state);
    const row = rect.table.child(rect.top);
    const firstCellText = row.firstChild?.textContent.trim() || row.textContent.trim();
    setAnchorDialog({ kind: 'row', initialId: row.attrs.anchorId as string | undefined, suggestedId: headingAnchor(firstCellText) || '表格行定位' });
    setTablePanel(null);
    return true;
  };
  const applyAnchor = (anchorId: string) => {
    if (!anchorDialog) return false;
    const applied = anchorDialog.kind === 'table'
      ? setTableAnchor(editor, anchorId)
      : anchorDialog.kind === 'row'
        ? setTableRowAnchor(editor, anchorId)
      : editor.chain().focus().setMark('anchor', { id: anchorId }).run();
    if (applied) setAnchorDialog(null);
    return applied;
  };
  const removeAnchor = () => {
    if (!anchorDialog) return false;
    const removed = anchorDialog.kind === 'table'
      ? setTableAnchor(editor, null)
      : anchorDialog.kind === 'row'
        ? setTableRowAnchor(editor, null)
      : editor.chain().focus().unsetMark('anchor').run();
    if (removed) setAnchorDialog(null);
    return removed;
  };
  const saveMath = (kind: MathSelectionKind) => {
    const latex = mathLatex.trim();
    if (!latex) return false;
    const chain = editor.chain().focus();
    const applied = mathTarget
      ? mathTarget.kind === 'inline'
        ? chain.updateInlineMath({ latex, pos: mathTarget.position }).run()
        : chain.updateBlockMath({ latex, pos: mathTarget.position }).run()
      : kind === 'inline'
        ? chain.insertInlineMath({ latex }).run()
        : insertBlockAfter(editor, { type: 'blockMath', attrs: { latex } });
    if (applied) closeInsertPanel();
    return applied;
  };
  const deleteMath = () => {
    if (!mathTarget) return false;
    const chain = editor.chain().focus();
    const deleted = mathTarget.kind === 'inline'
      ? chain.deleteInlineMath({ pos: mathTarget.position }).run()
      : chain.deleteBlockMath({ pos: mathTarget.position }).run();
    if (deleted) closeInsertPanel();
    return deleted;
  };

  return <section className={s.editor}>
    <div className={s.toolbar} aria-label="文档工具栏">
      <div className={s.toolbarGroup}>
        <Tool icon={Undo2} label="撤销" disabled={!toolbarState?.canUndo} command={() => editor.chain().focus().undo().run()} />
        <Tool icon={Redo2} label="重做" disabled={!toolbarState?.canRedo} command={() => editor.chain().focus().redo().run()} />
      </div>
      <Divider />
      <BlockTypeMenu value={(toolbarState?.block ?? 'paragraph') as BlockType} onSelect={setBlock} />
      <Divider />
      <div className={s.toolbarGroup}>
        <Tool icon={Bold} label="粗体 ⌘B" active={toolbarState?.bold} command={() => editor.chain().focus().toggleBold().run()} />
        <Tool icon={Italic} label="斜体 ⌘I" active={toolbarState?.italic} command={() => editor.chain().focus().toggleItalic().run()} />
        <Tool icon={Underline} label="下划线 ⌘U" active={toolbarState?.underline} command={() => editor.chain().focus().toggleUnderline().run()} />
        <Tool icon={Strikethrough} label="删除线" active={toolbarState?.strike} command={() => editor.chain().focus().toggleStrike().run()} />
        <Tool icon={Code2} label="行内代码" active={toolbarState?.code} command={() => editor.chain().focus().toggleCode().run()} />
      </div>
      <Divider />
      <div className={s.toolbarGroup}>
        <Tool icon={Link2} label="链接到文档或网页" active={editor.isActive('link')} command={openLinkPicker} />
      </div>
      <Divider />
      <div className={s.toolbarGroup}>
        <Tool icon={AlignLeft} label="左对齐" active={toolbarState?.textAlign === 'left'} command={() => editor.chain().focus().setTextAlign('left').run()} />
        <Tool icon={AlignCenter} label="居中对齐" active={toolbarState?.textAlign === 'center'} command={() => editor.chain().focus().setTextAlign('center').run()} />
        <Tool icon={AlignRight} label="右对齐" active={toolbarState?.textAlign === 'right'} command={() => editor.chain().focus().setTextAlign('right').run()} />
      </div>
      <Divider />
      <Hint label="文字颜色"><ColorMenu icon={Palette} label="文字颜色" automaticLabel="自动颜色"
        variant="text" value={toolbarState?.inkFg} darkValue={toolbarState?.inkFgDark} customDefault="#7367f0" onChange={(color) => setInkColor('fg', color)} /></Hint>
      <Hint label="文字底色"><ColorMenu icon={Highlighter} label="文字底色" automaticLabel="无底色"
        variant="background" value={toolbarState?.inkBg} darkValue={toolbarState?.inkBgDark} customDefault="#FFF897" onChange={(color) => setInkColor('bg', color)} /></Hint>
      <span className={s.toolbarSpacer} />
      <Tool icon={Plus} label="插入" text active={insertOpen} command={() => insertOpen ? closeInsertPanel() : openInsertPanel()} />
      <span className={s.slashHint}><kbd>/</kbd><span>命令</span></span>
    </div>

    {insertOpen && <div className={s.insertPanel} data-math-editing={mathTarget ? 'true' : undefined} role="dialog" aria-label="插入内容">
      <div className={s.insertHead}><div><b>{mathTarget ? '编辑公式' : '插入内容'}</b><small>也可以在空行输入 / 搜索全部内容块</small></div><Hint label="关闭插入面板" delay={100}><button type="button" aria-label="关闭插入面板" onClick={closeInsertPanel}>×</button></Hint></div>
      <div className={s.insertGrid}>
        <button type="button" onClick={() => runInsert(() => insertBlockAfter(editor, tableBlock()))}><Table2 /><span><b>表格</b><small>3 × 3 数据表</small></span></button>
        <button type="button" onClick={() => runInsert(() => insertBlockAfter(editor, { type: 'codeBlock' }))}><SquareCode /><span><b>代码块</b><small>多行源码</small></span></button>
        <button type="button" onClick={() => runInsert(() => insertBlockAfter(editor, { type: 'blockquote', content: [{ type: 'paragraph' }] }))}><MessageSquareQuote /><span><b>引用</b><small>引用一段内容</small></span></button>
        <button type="button" onClick={() => runInsert(() => insertBlockAfter(editor, { type: 'horizontalRule' }))}><Minus /><span><b>分割线</b><small>分隔内容区域</small></span></button>
      </div>
      <div className={s.insertSection}>
        <span>LaTeX 公式</span>
        <div className={s.mathEditor}>
          <label><Variable size={16} /><textarea aria-label="LaTeX 公式" rows={2} value={mathLatex} onChange={(event) => setMathLatex(event.target.value)} placeholder="例如：E = mc^2" /></label>
          <div className={s.mathPreview} aria-label="公式预览" aria-live="polite" dangerouslySetInnerHTML={{ __html: mathPreview }} />
          <div className={s.mathActions}>
            {mathTarget
              ? <button type="button" disabled={!mathLatex.trim()} onClick={() => saveMath(mathTarget.kind)}><Sigma size={14} />更新{mathTarget.kind === 'inline' ? '行内公式' : '公式块'}</button>
              : <><button type="button" disabled={!mathLatex.trim()} onClick={() => saveMath('inline')}><Variable size={14} />插入行内公式</button><button type="button" disabled={!mathLatex.trim()} onClick={() => saveMath('block')}><Sigma size={14} />插入公式块</button></>}
            {mathTarget && <button type="button" className={s.mathDelete} onClick={deleteMath}><Trash2 size={14} />删除公式</button>}
          </div>
        </div>
      </div>
      <div className={`${s.insertSection} ${s.insertExtras}`}><span>MidSoul 提示条</span><div className={s.calloutChoices}>{CALLOUT_COLORS.map(({ color, name, value }) => <button key={color} type="button" title={`${name}提示条`} onClick={() => runInsert(() => insertCallout(editor, color))}><i style={{ background: value }} />{name}</button>)}</div></div>
      <div className={`${s.insertSection} ${s.insertExtras}`}><span>Docusaurus 提示框</span><div className={s.admonitionChoices}>{ADMONITIONS.map(({ kind, label, title }) => <button key={kind} type="button" data-kind={kind} onClick={() => runInsert(() => insertAdmonition(editor, kind, title))}>{label}</button>)}</div></div>
      <div className={`${s.insertSection} ${s.insertExtras}`}>
        <span>图片</span>
        <div className={s.imageInsert}><ImagePlus size={16} /><input aria-label="图片路径" value={imageSource} onChange={(event) => setImageSource(event.target.value)} placeholder="/img/maps/example.PNG" /><button type="button" onClick={() => insertImage(imageSource)}>插入图片</button></div>
        <div className={s.imageLibraryHead}><Search size={14} /><input aria-label="搜索图片库" value={imageQuery} onChange={(event) => setImageQuery(event.target.value)} placeholder={`搜索 static/img（${images.length} 张）`} /></div>
        {filteredImages.length > 0 ? <div className={s.imageLibrary} aria-label="static/img 图片库">{filteredImages.map((path) => {
          const selected = imageSource === path;
          return <button type="button" key={path} data-selected={selected} title={`${path} · 双击直接插入`}
            onClick={() => setImageSource(path)} onDoubleClick={() => insertImage(path)}>
            <img src={displayImageSource(path, baseUrl)} alt="" loading="lazy" /><span>{path.replace(/^\/img\//, '')}</span>{selected && <Check size={13} />}
          </button>;
        })}</div> : <p className={s.imageLibraryEmpty}>{images.length ? '没有匹配的图片' : 'static/img 里暂时没有可用图片'}</p>}
      </div>
    </div>}

    <div ref={bindScrollTarget} className={s.scroll}>
      <div className={s.canvas}>
        <aside className={s.quickRail} aria-label="快速插入">
          <Tool icon={Plus} label="打开插入面板" command={openInsertPanel} />
          <Tool icon={Sparkles} label="插入提示条" command={() => insertCallout(editor, 'purple')} />
          <Tool icon={Table2} label="插入表格" command={() => insertBlockAfter(editor, tableBlock())} />
          <Tool icon={Sigma} label="插入公式" command={openInsertPanel} />
          <Tool icon={FileImage} label="插入图片" command={openInsertPanel} />
        </aside>
        <EditorContent editor={editor} className={s.content} />
      </div>
    </div>

    <BubbleMenu editor={editor} pluginKey="text-format-menu" className={s.bubble}
      appendTo={getEditorOverlayRoot} options={bubbleOptions} updateDelay={0} resizeDelay={0}
      shouldShow={({ editor: current, from, to }) => from !== to && !current.isActive('table') && !current.isActive('callout') && !current.isActive('admonition')}>
      <Tool icon={Bold} label="粗体" active={toolbarState?.bold} command={() => editor.chain().focus().toggleBold().run()} />
      <Tool icon={Italic} label="斜体" active={toolbarState?.italic} command={() => editor.chain().focus().toggleItalic().run()} />
      <Tool icon={Underline} label="下划线" active={toolbarState?.underline} command={() => editor.chain().focus().toggleUnderline().run()} />
      <Tool icon={Strikethrough} label="删除线" active={toolbarState?.strike} command={() => editor.chain().focus().toggleStrike().run()} />
      <Divider /><Tool icon={Braces} label="标签" active={toolbarState?.label} command={() => editor.chain().focus().toggleMark('label', { color: 'purple' }).run()} />
      <Tool icon={Link2} label="链接到文档或网页" command={openLinkPicker} />
      <Tool icon={Bookmark} label="将选中文字设为精确跳转点" command={openTextAnchorDialog} />
    </BubbleMenu>

    {linkPickerOpen && <LinkPicker baseUrl={baseUrl} targets={linkTargets}
      initialHref={editor.getAttributes('link').href as string | undefined} onApply={applyLink} onRemove={removeLink} onClose={() => setLinkPickerOpen(false)} />}
    {anchorDialog && <AnchorDialog {...anchorDialog} onApply={applyAnchor} onRemove={removeAnchor} onClose={() => setAnchorDialog(null)} />}

    <BubbleMenu editor={editor} pluginKey="table-cell-menu" className={`${s.bubble} ${s.tableBubble}`}
      appendTo={getEditorOverlayRoot} getReferencedVirtualElement={getTableReference} options={bubbleOptions} updateDelay={0} resizeDelay={0}
      shouldShow={({ editor: current }) => current.isActive('table')}>
      <Tool icon={Combine} label="合并 / 拆分单元格" command={() => editor.chain().focus().mergeOrSplit().run()} />
      <Tool icon={BetweenHorizontalStart} label="增加行" command={() => editor.chain().focus().addRowAfter().run()} />
      <Tool icon={BetweenVerticalStart} label="增加列" command={() => editor.chain().focus().addColumnAfter().run()} />
      <Divider />
      <TableMenu icon={Palette} label="单元格颜色" open={tablePanel === 'color'}
        onToggle={toggleCellColorMenu}>
        <ColorPalette label="单元格底色" automaticLabel="清除底色" value={backgroundColor}
          variant="background" customDefault="#FFF897" onChange={(selection) => { const color = selection && typeof selection === 'object' ? selection.light : selection; setBackgroundColor(color); setCellBackground(color, color ? opacity : 1); }} />
        <label className={s.panelOpacity}><span>透明度</span><input aria-label="单元格底色透明度" type="range" min="0" max="1" step="0.05" value={opacity} onChange={(event) => { const next = Number(event.target.value); setOpacity(next); setCellBackground(backgroundColor, next); }} /><b>{Math.round(opacity * 100)}%</b></label>
      </TableMenu>
      <TableMenu icon={MoreHorizontal} label="更多表格操作" open={tablePanel === 'more'} align="end"
        onToggle={() => setTablePanel((current) => current === 'more' ? null : 'more')}>
        <span className={s.panelLabel}>移动与删除</span>
        <span className={s.panelGrid}>
          <TableMenuAction icon={ArrowUp} label="行上移" disabled={!toolbarState?.tableMove?.canMoveRowUp} command={() => moveCurrentTablePart(editor, 'rowUp')} />
          <TableMenuAction icon={ArrowDown} label="行下移" disabled={!toolbarState?.tableMove?.canMoveRowDown} command={() => moveCurrentTablePart(editor, 'rowDown')} />
          <TableMenuAction icon={ArrowLeft} label="列左移" disabled={!toolbarState?.tableMove?.canMoveColumnLeft} command={() => moveCurrentTablePart(editor, 'columnLeft')} />
          <TableMenuAction icon={ArrowRight} label="列右移" disabled={!toolbarState?.tableMove?.canMoveColumnRight} command={() => moveCurrentTablePart(editor, 'columnRight')} />
          <TableMenuAction icon={Rows3} label="删除当前行" command={() => editor.chain().focus().deleteRow().run()} />
          <TableMenuAction icon={Columns3} label="删除当前列" command={() => editor.chain().focus().deleteColumn().run()} />
        </span>
        <span className={s.panelLabel}>列宽布局</span>
        <span className={s.panelGrid}>
          <TableMenuAction icon={Equal} label="平均分列" active={toolbarState?.tableMove?.layoutMode === 'equal'} command={() => setTableLayout(editor, 'equal')} />
          <TableMenuAction icon={ScanLine} label="适应内容" active={toolbarState?.tableMove?.layoutMode === 'content'} command={() => setTableLayout(editor, 'content')} />
        </span>
        <span className={s.panelRow}>
          <input className={s.panelInput} aria-label="当前列宽（像素）" type="number" min={64} step={1}
            placeholder={toolbarState?.columnWidth ? `当前 ${toolbarState.columnWidth}px` : '列宽 px'} value={columnWidthDraft}
            onChange={(event) => setColumnWidthDraft(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter' && applyColumnWidth(editor, Number(columnWidthDraft))) setColumnWidthDraft(''); }} />
          <button type="button" className={s.panelApply} aria-label="应用列宽" title="应用列宽"
            onMouseDown={(event) => { event.preventDefault(); if (applyColumnWidth(editor, Number(columnWidthDraft))) setColumnWidthDraft(''); }}>
            <Check size={13} strokeWidth={2} />
          </button>
        </span>
        <TableMenuAction icon={PanelTop} label="参考上方表格列宽" command={() => copyColumnWidthFromAbove(editor)} />
        <span className={s.panelLabel}>表格显示</span>
        <span className={s.panelStack}>
          <TableMenuAction icon={EyeOff} label="隐藏表头" active={toolbarState?.tableMove?.hideHeader} disabled={!toolbarState?.tableMove?.hasHeader}
            command={() => setTableDisplayOption(editor, 'hideHeader', !toolbarState?.tableMove?.hideHeader)} />
          <TableMenuAction icon={Paintbrush} label="关闭第一列自动底色" active={toolbarState?.tableMove?.noFirstCol}
            command={() => setTableDisplayOption(editor, 'noFirstCol', !toolbarState?.tableMove?.noFirstCol)} />
        </span>
        <span className={s.panelLabel}>跳转定位</span>
        <span className={s.panelStack}>
          <TableMenuAction icon={Bookmark} label="设置当前行跳转点" command={openTableRowAnchorDialog} />
          <TableMenuAction icon={Bookmark} label="设置整张表格跳转点" command={openTableAnchorDialog} />
        </span>
        <span className={s.panelDanger}><TableMenuAction icon={Trash2} label="删除整个表格" danger command={() => editor.chain().focus().deleteTable().run()} /></span>
      </TableMenu>
    </BubbleMenu>

    <BubbleMenu editor={editor} pluginKey="callout-menu" className={`${s.bubble} ${s.componentBubble}`}
      appendTo={getEditorOverlayRoot} getReferencedVirtualElement={getCalloutReference} options={bubbleOptions} updateDelay={0} resizeDelay={0}
      shouldShow={({ editor: current }) => current.isActive('callout')}>
      <span className={s.contextLabel}>提示条</span>
      <div className={s.emojiChoices}>{CALLOUT_EMOJIS.map((emoji) => <Hint key={emoji} label={`提示条图标 ${emoji}`}><button type="button" aria-label={`图标 ${emoji}`} data-on={toolbarState?.calloutEmoji === emoji} onMouseDown={(event) => { event.preventDefault(); editor.chain().focus().updateAttributes('callout', { emoji }).run(); }}>{emoji}</button></Hint>)}
        <CustomEmojiMenu value={toolbarState?.calloutEmoji} onApply={(emoji) => editor.chain().focus().updateAttributes('callout', { emoji }).run()} />
      </div>
      <Divider /><span className={s.swatches}>{CALLOUT_COLORS.map(({ color, name, value }) => <Hint key={color} label={`${name}提示条`}><button type="button" className={s.swatch} aria-label={`${name}提示条`} data-on={toolbarState?.calloutColor === color} style={{ background: value }} onMouseDown={(event) => { event.preventDefault(); editor.chain().focus().updateAttributes('callout', { color }).run(); }} /></Hint>)}</span>
    </BubbleMenu>

    <BubbleMenu editor={editor} pluginKey="admonition-menu" className={`${s.bubble} ${s.componentBubble}`}
      appendTo={getEditorOverlayRoot} getReferencedVirtualElement={getAdmonitionReference} options={bubbleOptions} updateDelay={0} resizeDelay={0}
      shouldShow={({ editor: current }) => current.isActive('admonition')}>
      <span className={s.contextLabel}>提示框</span>
      <div className={s.kindChoices}>{ADMONITIONS.map(({ kind, label }) => <button key={kind} type="button" data-on={toolbarState?.admonitionKind === kind} onMouseDown={(event) => { event.preventDefault(); editor.chain().focus().updateAttributes('admonition', { kind }).run(); }}>{label}</button>)}</div>
      <Divider /><input className={s.titleInput} aria-label="提示框标题" value={toolbarState?.admonitionTitle ?? ''} placeholder="提示框标题" onMouseDown={(event) => event.stopPropagation()} onChange={(event) => editor.chain().updateAttributes('admonition', { title: event.target.value }).run()} />
    </BubbleMenu>
  </section>;
}
