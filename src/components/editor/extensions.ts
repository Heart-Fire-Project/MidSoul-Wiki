import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Extension, Mark, Node, mergeAttributes, type Extensions, type JSONContent } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { Mathematics } from '@tiptap/extension-mathematics';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import Placeholder from '@tiptap/extension-placeholder';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';
import StarterKit from '@tiptap/starter-kit';
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from '@tiptap/suggestion';
import {
  AlignLeft, AlertCircle, AlertTriangle, BadgeInfo, BookOpenText, CheckCircle2, Code2,
  FileImage, Heading1, Heading2, Heading3, Heading4, Heading5, Heading6, Info, Lightbulb, List,
  ListChecks, ListOrdered, MessageSquareQuote, Minus, Pilcrow, ShieldAlert, Sparkles, Table2,
  Sigma, Variable,
} from 'lucide-react';
import SlashCommandMenu, { type CommandMenuItem } from './SlashCommandMenu';
import { displayImageSource } from './imagePaths';

export type CellColors = {
  backgroundColor: string | null;
  backgroundOpacity: number;
  textColor: string | null;
  layoutMode: TableLayoutMode;
  tableHideHeader: boolean;
  tableNoFirstCol: boolean;
};

export type TableLayoutMode = 'equal' | 'content';

const numberInRange = (value: string | null, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : fallback;
};

const colorAttributes = () => ({
  backgroundColor: {
    default: null,
    parseHTML: (element: HTMLElement) => element.dataset.backgroundColor ?? null,
    renderHTML: (attributes: CellColors) => attributes.backgroundColor
      ? { 'data-background-color': attributes.backgroundColor, style: `--ms-cell-bg:${attributes.backgroundColor}` }
      : {},
  },
  backgroundOpacity: {
    default: 1,
    parseHTML: (element: HTMLElement) => numberInRange(element.dataset.backgroundOpacity ?? null, 1),
    renderHTML: (attributes: CellColors) => attributes.backgroundColor && attributes.backgroundOpacity !== 1
      ? { 'data-background-opacity': String(attributes.backgroundOpacity), style: `--ms-cell-bg-opacity:${attributes.backgroundOpacity}` }
      : {},
  },
  textColor: {
    default: null,
    parseHTML: (element: HTMLElement) => element.dataset.textColor ?? null,
    renderHTML: (attributes: CellColors) => attributes.textColor
      ? { 'data-text-color': attributes.textColor, style: `--ms-cell-fg:${attributes.textColor}` }
      : {},
  },
  layoutMode: {
    default: 'equal' as TableLayoutMode,
    parseHTML: (element: HTMLElement): TableLayoutMode => element.dataset.tableLayoutMode === 'content' ? 'content' : 'equal',
    renderHTML: (attributes: CellColors) => ({ 'data-table-layout-mode': attributes.layoutMode }),
  },
  tableHideHeader: {
    default: false,
    parseHTML: (element: HTMLElement) => element.dataset.tableHideHeader === 'true',
    renderHTML: (attributes: CellColors) => attributes.tableHideHeader ? { 'data-table-hide-header': 'true' } : {},
  },
  tableNoFirstCol: {
    default: false,
    parseHTML: (element: HTMLElement) => element.dataset.tableNoFirstCol === 'true',
    renderHTML: (attributes: CellColors) => attributes.tableNoFirstCol ? { 'data-table-no-first-col': 'true' } : {},
  },
});

/*
 * 颜色是单元格节点属性，而不是 React 事后修改 td 的 style。
 * `setCellAttribute` 会把整块 CellSelection 放进同一个 ProseMirror transaction，
 * 因此多个格子一起改色不会触发 DOMObserver 回写循环。
 */
export const MidSoulTableCell = TableCell.extend({
  addAttributes() {
    return { ...(this.parent?.() ?? {}), ...colorAttributes() };
  },
  renderHTML({ HTMLAttributes }) {
    return ['td', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },
});

export const MidSoulTableHeader = TableHeader.extend({
  addAttributes() {
    return { ...(this.parent?.() ?? {}), ...colorAttributes() };
  },
  renderHTML({ HTMLAttributes }) {
    return ['th', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },
});

/** 表格行可拥有独立锚点，供「跳转到某一行」使用。 */
export const MidSoulTableRow = TableRow.extend({
  addAttributes() {
    return {
      ...(this.parent?.() ?? {}),
      anchorId: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('id') ?? element.dataset.rowAnchor ?? null,
        renderHTML: (attributes: { anchorId: string | null }) => attributes.anchorId ? { id: attributes.anchorId, 'data-row-anchor': 'true' } : {},
      },
    };
  },
});

export const MidSoulTable = Table.extend({
  addAttributes() {
    return {
      ...(this.parent?.() ?? {}),
      hideHeader: {
        default: false,
        parseHTML: (element: HTMLElement) => element.dataset.hideHeader === 'true',
        renderHTML: (attributes: { hideHeader: boolean }) => attributes.hideHeader ? { 'data-hide-header': 'true' } : {},
      },
      noFirstCol: {
        default: false,
        parseHTML: (element: HTMLElement) => element.dataset.noFirstCol === 'true',
        renderHTML: (attributes: { noFirstCol: boolean }) => attributes.noFirstCol ? { 'data-no-first-col': 'true' } : {},
      },
      anchorId: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('id') ?? element.dataset.tableAnchor ?? null,
        renderHTML: (attributes: { anchorId: string | null }) => attributes.anchorId ? { id: attributes.anchorId, 'data-table-anchor': 'true' } : {},
      },
    };
  },
});

/** 项目自有内容同样存为 ProseMirror 节点，发布与协作时不依赖 React 组件状态。 */
export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'inline*',
  defining: true,
  addAttributes() {
    return {
      color: { default: 'green', parseHTML: (element: HTMLElement) => element.dataset.calloutColor ?? 'green', renderHTML: (attributes: { color: string }) => ({ 'data-callout-color': attributes.color }) },
      emoji: { default: '💡', parseHTML: (element: HTMLElement) => element.dataset.calloutEmoji ?? '💡', renderHTML: (attributes: { emoji: string }) => ({ 'data-callout-emoji': attributes.emoji }) },
    };
  },
  parseHTML() { return [{ tag: 'aside[data-callout]' }]; },
  renderHTML({ HTMLAttributes }) {
    return ['aside', mergeAttributes({ 'data-callout': '' }, HTMLAttributes), ['span', { class: 'ms-callout__emoji', contenteditable: 'false' }, HTMLAttributes['data-callout-emoji'] as string], ['span', { class: 'ms-callout__content' }, 0]];
  },
});

export const Admonition = Node.create({
  name: 'admonition',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      kind: { default: 'note', parseHTML: (element: HTMLElement) => element.dataset.admonitionKind ?? 'note', renderHTML: (attributes: { kind: string }) => ({ 'data-admonition-kind': attributes.kind }) },
      title: { default: '提示', parseHTML: (element: HTMLElement) => element.dataset.admonitionTitle ?? '提示', renderHTML: (attributes: { title: string }) => ({ 'data-admonition-title': attributes.title }) },
    };
  },
  parseHTML() { return [{ tag: 'aside[data-admonition]' }]; },
  renderHTML({ HTMLAttributes }) {
    return ['aside', mergeAttributes({ 'data-admonition': '' }, HTMLAttributes),
      ['div', { class: 'ms-admonition__title', contenteditable: 'false' }, HTMLAttributes['data-admonition-title'] as string],
      ['div', { class: 'ms-admonition__body' }, 0]];
  },
});

export const Label = Mark.create({
  name: 'label',
  inclusive: false,
  addAttributes() {
    return {
      color: { default: 'purple', parseHTML: (element: HTMLElement) => element.dataset.labelColor ?? 'purple', renderHTML: (attributes: { color: string }) => ({ 'data-label-color': attributes.color }) },
      background: { default: '', parseHTML: (element: HTMLElement) => element.dataset.labelBackground ?? '', renderHTML: (attributes: { background: string }) => attributes.background ? ({ 'data-label-background': attributes.background }) : ({}) },
    };
  },
  parseHTML() { return [{ tag: 'span[data-label]' }]; },
  renderHTML({ HTMLAttributes }) { return ['span', mergeAttributes({ 'data-label': '' }, HTMLAttributes), 0]; },
});

export const Ink = Mark.create({
  name: 'ink',
  addAttributes() {
    return {
      fg: { default: null, parseHTML: (element: HTMLElement) => element.dataset.inkFg ?? null, renderHTML: (attributes: { fg: string | null }) => attributes.fg ? ({ 'data-ink-fg': attributes.fg, style: `--ms-ink-fg:${attributes.fg}` }) : ({}) },
      bg: { default: null, parseHTML: (element: HTMLElement) => element.dataset.inkBg ?? null, renderHTML: (attributes: { bg: string | null }) => attributes.bg ? ({ 'data-ink-bg': attributes.bg, style: `--ms-ink-bg:${attributes.bg}` }) : ({}) },
      fgDark: { default: null, parseHTML: (element: HTMLElement) => element.dataset.inkFgDark ?? null, renderHTML: (attributes: { fgDark: string | null }) => attributes.fgDark ? ({ 'data-ink-fg-dark': attributes.fgDark, style: `--ms-ink-fg-dark:${attributes.fgDark}` }) : ({}) },
      bgDark: { default: null, parseHTML: (element: HTMLElement) => element.dataset.inkBgDark ?? null, renderHTML: (attributes: { bgDark: string | null }) => attributes.bgDark ? ({ 'data-ink-bg-dark': attributes.bgDark, style: `--ms-ink-bg-dark:${attributes.bgDark}` }) : ({}) },
    };
  },
  parseHTML() { return [{ tag: 'span[data-ink-fg], span[data-ink-bg]' }]; },
  renderHTML({ HTMLAttributes }) { return ['span', mergeAttributes({ 'data-ink': '' }, HTMLAttributes), 0]; },
});

/** 给任意选中文字一个稳定的 DOM id，用于跨文档精确跳转。 */
export const Anchor = Mark.create({
  name: 'anchor',
  inclusive: false,
  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('id'),
        renderHTML: (attributes: { id: string | null }) => attributes.id ? { id: attributes.id, 'data-ms-anchor': 'true' } : {},
      },
    };
  },
  parseHTML() { return [{ tag: 'span[data-ms-anchor], span[id]' }]; },
  renderHTML({ HTMLAttributes }) { return ['span', mergeAttributes(HTMLAttributes), 0]; },
});

export const RawMdx = Node.create({
  name: 'rawMdx',
  group: 'block',
  atom: true,
  selectable: true,
  addAttributes() {
    return { source: { default: '', parseHTML: (element: HTMLElement) => element.dataset.mdxSource ?? element.textContent ?? '', renderHTML: (attributes: { source: string }) => ({ 'data-mdx-source': attributes.source }) } };
  },
  parseHTML() { return [{ tag: 'pre[data-mdx-source]' }]; },
  renderHTML({ HTMLAttributes }) { return ['pre', mergeAttributes({ 'data-mdx': '', contenteditable: 'false' }, HTMLAttributes), ['code', {}, HTMLAttributes['data-mdx-source'] as string]]; },
});

type SlashAction = 'content' | 'table' | 'image' | 'inlineMath' | 'blockMath';
type SlashItem = CommandMenuItem & { action: SlashAction; content?: JSONContent };
const contentItem = (item: Omit<SlashItem, 'action'>): SlashItem => ({ ...item, action: 'content' });
const CALLOUTS = [
  ['green', '绿色提示条', '适合技巧、推荐与正向信息', CheckCircle2],
  ['blue', '蓝色提示条', '适合说明、补充与地图资料', Info],
  ['yellow', '黄色提示条', '适合注意事项与操作提醒', Lightbulb],
  ['red', '红色提示条', '适合风险、禁止与严重警告', ShieldAlert],
  ['purple', '紫色提示条', '适合特殊机制与重要设定', Sparkles],
  ['gray', '灰色提示条', '适合次要信息与编辑备注', AlignLeft],
] as const;
const ADMONITIONS = [
  ['note', '提示框 · Note', '普通补充说明', '笔记', BookOpenText],
  ['tip', '提示框 · Tip', '技巧和推荐操作', '技巧', Lightbulb],
  ['info', '提示框 · Info', '背景资料和详细解释', '信息', BadgeInfo],
  ['caution', '提示框 · Caution', '需要谨慎处理的事项', '注意', AlertTriangle],
  ['danger', '提示框 · Danger', '高风险或不可逆操作', '危险', AlertCircle],
] as const;

const SLASH_ITEMS: SlashItem[] = [
  contentItem({ id: 'paragraph', title: '正文', detail: '普通文本段落', group: '基础内容', aliases: ['text', 'paragraph', '文本'], icon: Pilcrow, content: { type: 'paragraph' } }),
  contentItem({ id: 'heading-1', title: '一级标题', detail: '页面主标题', group: '基础内容', aliases: ['h1', '标题'], icon: Heading1, content: { type: 'heading', attrs: { level: 1 } } }),
  contentItem({ id: 'heading-2', title: '二级标题', detail: '主要章节标题', group: '基础内容', aliases: ['h2', '标题'], icon: Heading2, content: { type: 'heading', attrs: { level: 2 } } }),
  contentItem({ id: 'heading-3', title: '三级标题', detail: '章节内的小标题', group: '基础内容', aliases: ['h3', '标题'], icon: Heading3, content: { type: 'heading', attrs: { level: 3 } } }),
  contentItem({ id: 'heading-4', title: '四级标题', detail: '更细一级的小节', group: '基础内容', aliases: ['h4', '标题'], icon: Heading4, content: { type: 'heading', attrs: { level: 4 } } }),
  contentItem({ id: 'heading-5', title: '五级标题', detail: '较深层级的小节', group: '基础内容', aliases: ['h5', '标题'], icon: Heading5, content: { type: 'heading', attrs: { level: 5 } } }),
  contentItem({ id: 'heading-6', title: '六级标题', detail: '最深层级的小节', group: '基础内容', aliases: ['h6', '标题'], icon: Heading6, content: { type: 'heading', attrs: { level: 6 } } }),
  contentItem({ id: 'bullet-list', title: '无序列表', detail: '创建项目列表', group: '列表与引用', aliases: ['list', 'ul', '列表'], icon: List, content: { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] } }),
  contentItem({ id: 'ordered-list', title: '有序列表', detail: '创建步骤或排名', group: '列表与引用', aliases: ['list', 'ol', '编号'], icon: ListOrdered, content: { type: 'orderedList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] } }),
  contentItem({ id: 'task-list', title: '检查清单', detail: '创建可以勾选的任务', group: '列表与引用', aliases: ['task', 'todo', 'check', '待办', '清单'], icon: ListChecks, content: { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] }] } }),
  contentItem({ id: 'quote', title: '引用', detail: '突出一段引用文字', group: '列表与引用', aliases: ['quote', '引用'], icon: MessageSquareQuote, content: { type: 'blockquote', content: [{ type: 'paragraph' }] } }),
  contentItem({ id: 'code', title: '代码块', detail: '插入多行代码', group: '列表与引用', aliases: ['code', '代码'], icon: Code2, content: { type: 'codeBlock' } }),
  contentItem({ id: 'divider', title: '分割线', detail: '分隔不同内容区域', group: '媒体与数据', aliases: ['line', 'hr'], icon: Minus, content: { type: 'horizontalRule' } }),
  { id: 'table', title: '表格', detail: '插入 3 × 3 数据表格', group: '媒体与数据', aliases: ['table', '表格'], icon: Table2, action: 'table' },
  { id: 'image', title: '图片', detail: '通过站点路径或网址插入图片', group: '媒体与数据', aliases: ['image', 'photo', '图片'], icon: FileImage, action: 'image' },
  { id: 'inline-math', title: '行内公式', detail: '在正文中插入 LaTeX 公式', group: '媒体与数据', aliases: ['math', 'latex', 'formula', '公式'], icon: Variable, action: 'inlineMath' },
  { id: 'block-math', title: '公式块', detail: '单独一行显示 LaTeX 公式', group: '媒体与数据', aliases: ['math', 'latex', 'formula', '公式'], icon: Sigma, action: 'blockMath' },
  ...CALLOUTS.map(([color, title, detail, icon]): SlashItem => contentItem({ id: `callout-${color}`, title, detail, group: 'MidSoul 提示条', aliases: ['callout', '提示条', color], icon, content: { type: 'callout', attrs: { color, emoji: '💡' }, content: [{ type: 'text', text: '输入提示内容' }] } })),
  ...ADMONITIONS.map(([kind, title, detail, label, icon]): SlashItem => contentItem({ id: `admonition-${kind}`, title, detail, group: 'Docusaurus 提示框', aliases: ['admonition', '提示框', kind], icon, content: { type: 'admonition', attrs: { kind, title: label }, content: [{ type: 'paragraph', content: [{ type: 'text', text: '输入提示内容' }] }] } })),
];

type SlashCommandOptions = { baseUrl: string };

export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: 'slashCommand',
  addOptions() { return { baseUrl: '/' }; },
  addProseMirrorPlugins() {
    const editor = this.editor;
    const baseUrl = this.options.baseUrl;
    let selected = 0;
    let current: SuggestionProps<SlashItem, SlashItem> | null = null;
    let menu: HTMLDivElement | null = null;
    let root: Root | null = null;
    let unmount: (() => void) | null = null;
    const draw = () => {
      if (!root || !current) return;
      root.render(React.createElement(SlashCommandMenu, { items: current.items, selected,
        onSelected: (index: number) => { selected = index; draw(); },
        onChoose: (item: CommandMenuItem) => current?.command(item as SlashItem) }));
    };
    return [Suggestion<SlashItem, SlashItem>({
      editor,
      char: '/',
      startOfLine: true,
      items: ({ query }) => {
        const term = query.trim().toLowerCase();
        return SLASH_ITEMS.filter((item) => !term || `${item.title} ${item.detail} ${item.aliases.join(' ')}`.toLowerCase().includes(term));
      },
      command: ({ editor: activeEditor, range, props }) => {
        const chain = activeEditor.chain().focus().deleteRange(range);
        if (props.action === 'table') chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
        else if (props.action === 'inlineMath') chain.insertInlineMath({ latex: 'E = mc^2' }).run();
        else if (props.action === 'blockMath') chain.insertBlockMath({ latex: '\\sum_{i=1}^{n} x_i' }).run();
        else if (props.action === 'image') {
          const source = window.prompt('输入图片路径或网址', '/img/');
          if (source?.trim()) chain.setImage({ src: displayImageSource(source.trim(), baseUrl) }).run();
          else chain.run();
        } else if (props.content) chain.insertContent(props.content).run();
      },
      render: () => ({
        onStart: (props: SuggestionProps<SlashItem, SlashItem>) => {
          current = props; selected = 0; menu = document.createElement('div'); menu.className = 'ms-command-host'; root = createRoot(menu); draw(); unmount = props.mount(menu);
        },
        onUpdate: (props: SuggestionProps<SlashItem, SlashItem>) => { current = props; selected = 0; draw(); },
        onKeyDown: ({ event }: SuggestionKeyDownProps) => {
          if (!current?.items.length) return false;
          if (event.key === 'Escape') { unmount?.(); root?.unmount(); unmount = null; root = null; menu = null; current = null; return true; }
          if (event.key === 'ArrowDown') { selected = (selected + 1) % current.items.length; draw(); return true; }
          if (event.key === 'ArrowUp') { selected = (selected - 1 + current.items.length) % current.items.length; draw(); return true; }
          if (event.key === 'Enter') { current.command(current.items[selected]); return true; }
          return false;
        },
        onExit: () => { unmount?.(); root?.unmount(); unmount = null; root = null; menu = null; current = null; },
      }),
    })];
  },
});

export type MathSelectionKind = 'inline' | 'block';
export type MathSelectionHandler = (kind: MathSelectionKind, latex: string, position: number) => void;

export const tiptapExtensions = (baseUrl = '/', onMathSelect?: MathSelectionHandler): Extensions => [
  StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5, 6] }, link: false }),
  TaskList,
  TaskItem.configure({ nested: true }),
  TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right'] }),
  Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noreferrer noopener' } }),
  Image.configure({ allowBase64: false }),
  Placeholder.configure({ placeholder: '输入内容，或键入 / 插入内容…' }),
  Callout,
  Admonition,
  Label,
  Ink,
  Anchor,
  RawMdx,
  Mathematics.configure({
    katexOptions: { throwOnError: false, strict: false },
    inlineOptions: { onClick: (node, position) => onMathSelect?.('inline', String(node.attrs.latex ?? ''), position) },
    blockOptions: { onClick: (node, position) => onMathSelect?.('block', String(node.attrs.latex ?? ''), position) },
  }),
  SlashCommand.configure({ baseUrl }),
  MidSoulTable.configure({
    resizable: true,
    handleWidth: 7,
    cellMinWidth: 64,
    lastColumnResizable: true,
  }),
  MidSoulTableRow,
  MidSoulTableHeader,
  MidSoulTableCell,
];
