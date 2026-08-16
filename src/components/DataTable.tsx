import React, { type CSSProperties, type ReactNode, useEffect, useRef } from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import { darkBg, withAlpha } from './colorUtils';
import { INK } from './theme';
import Label from './Label';
import { INLINE, attrsOf, parseStyle } from './inlineSyntax';

type Alignment = 'l' | 'c' | 'r';
type VerticalAlignment = 't' | 'm' | 'b';
export type TableCell = string | { t?: string; cs?: number; rs?: number; bg?: string; op?: number; fg?: string; b?: boolean | number; i?: boolean | number; u?: boolean | number; s?: boolean | number; size?: number; font?: string; al?: Alignment; va?: VerticalAlignment };
export type DataTableProps = { id?: string; rowIds?: Array<string | null | undefined>; data?: TableCell[][]; head?: number; widths?: Array<string | null | undefined>; layout?: 'equal' | 'content'; hideHeader?: boolean; noFirstCol?: boolean };

type CSSVariables = CSSProperties & Record<`--${string}`, string>;

const FONTS: Record<string, string> = { sans: 'var(--ifm-font-family-base)', serif: 'var(--ifm-heading-font-family)', mono: 'var(--ifm-font-family-monospace)' };
const ALIGN: Record<Alignment, CSSProperties['textAlign']> = { l: 'left', c: 'center', r: 'right' };
const VALIGN: Record<VerticalAlignment, CSSProperties['verticalAlign']> = { t: 'top', m: 'middle', b: 'bottom' };

function CellImage({ md, src, alt }: { md: string; src: string; alt: string }) { return <img data-md={md} src={useBaseUrl(src)} alt={alt} />; }

/** toMarkdown 的 escapeText 会把 <、* 等转义为反斜杠形式（如 K\<1.6、
 * 10\*(10-灵魂数)）；inlineMd 的语法分支只识别未转义形式，落入普通
 * 文本的转义序列需要还原，避免发布页把反斜杠显示出来。 */
const unescapeMd = (part: string) => part.replace(/\\([\\`*_[\]<>~!])/g, '$1');

export function inlineMd(text: string | undefined): ReactNode {
	if (!text) return null;
	return String(text).split(INLINE).map((part, index) => {
		if (!part) return null;
		if (/^<br/.test(part)) return <br key={index} />;
		if (part.startsWith('<Label')) { const open = part.slice(0, part.indexOf('>') + 1); return <span key={index} data-md={part} contentEditable={false}><Label {...attrsOf(open)}>{part.slice(open.length, -'</Label>'.length)}</Label></span>; }
		if (part.startsWith('![')) { const image = part.match(/^!\[([^\]]*)\]\(([^)]*)\)$/); return image ? <CellImage key={index} md={part} src={image[2]} alt={image[1]} /> : part; }
		if (part.startsWith('~~')) return <del key={index}>{inlineMd(part.slice(2, -2))}</del>;
		if (part.startsWith('<span')) { const open = part.slice(0, part.indexOf('>') + 1); const className = open.match(/className="([^"]+)"/)?.[1]; const id = open.match(/\bid="([^"]+)"/)?.[1]; const style = parseStyle(open) as CSSProperties; return <span key={index} id={id} className={className} style={Object.keys(style).length ? style : undefined}>{inlineMd(part.slice(open.length, -'</span>'.length))}</span>; }
		if (part.startsWith('**')) return <strong key={index}>{inlineMd(part.slice(2, -2))}</strong>;
		if (part.startsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>;
		if (part.startsWith('*')) return <em key={index}>{inlineMd(part.slice(1, -1))}</em>;
		const link = part.match(/^\[([^\]]*)\]\(([^)]*)\)$/);
		return link ? <a key={index} href={link[2]}>{inlineMd(link[1])}</a> : unescapeMd(part);
	});
}

/** 表格导出会用 <br /> 保留单元格中的块边界；把其中连续的 Markdown
 * `- item` 行还原为真正列表，避免发布页把项目符号显示成普通减号。 */
export function cellMd(text: string | undefined): ReactNode {
	if (!text || !/<br\s*\/?>\s*[-*+]\s+/.test(text)) return inlineMd(text);
	const lines = String(text).split(/<br\s*\/?>/);
	const blocks: ReactNode[] = [];
	for (let index = 0; index < lines.length;) {
		const bullet = lines[index].match(/^\s*[-*+]\s+(.*)$/);
		if (!bullet) {
			blocks.push(<div className="ms-table-cell-line" key={`line-${index}`}>{inlineMd(lines[index])}</div>);
			index += 1;
			continue;
		}
		const items: ReactNode[] = [];
		while (index < lines.length) {
			const item = lines[index].match(/^\s*[-*+]\s+(.*)$/);
			if (!item) break;
			items.push(<li key={index}>{inlineMd(item[1])}</li>);
			index += 1;
		}
		blocks.push(<ul className="ms-table-cell-list" key={`list-${index}`}>{items}</ul>);
	}
	return blocks;
}

/** 明暗两套色值一起发出，由 custom.css 里的 --ms-cell-bg / --ms-cell-fg 挑。
 *
 * 仍然把 backgroundColor / color 写成行内样式（值指向变量），是因为手动
 * 单元格色必须压过 `tbody td:first-child` 的首列底色和 `tr:hover td` 的
 * 悬停底色——搬进样式表就得跟这些选择器比特异性。变量本身没有特异性之争，
 * 于是主题切换归 CSS，优先级归行内，两边都不让步。
 *
 * 用 useColorMode 在 JS 里二选一时，SSR 只能按 defaultMode 烤死一种，
 * 另一种主题的读者首屏会看到错误底色，等 main.js 水合完才翻回来。 */
export function cellStyle(cell: Exclude<TableCell, string>): CSSProperties {
	const style: CSSVariables = {};
	if (cell.bg) {
		const opacity = cell.op == null ? 1 : Math.max(0, Math.min(1, cell.op));
		style['--ms-cell-bg-l'] = withAlpha(cell.bg, opacity) ?? cell.bg;
		style['--ms-cell-bg-d'] = withAlpha(darkBg(cell.bg), opacity) ?? cell.bg;
		style.backgroundColor = 'var(--ms-cell-bg)';
	}
	if (cell.fg) style.color = cell.fg;
	else if (cell.bg) {
		// 浅色下自动配深色墨；深色下沿用继承色（INK.dark 即 inherit）。
		style['--ms-cell-fg-l'] = INK.light;
		style['--ms-cell-fg-d'] = INK.dark;
		style.color = 'var(--ms-cell-fg)';
	}
	if (cell.b) style.fontWeight = 700;
	if (cell.i) style.fontStyle = 'italic';
	if (cell.u || cell.s) style.textDecoration = [cell.u && 'underline', cell.s && 'line-through'].filter(Boolean).join(' ');
	if (cell.size) style.fontSize = `${cell.size}px`;
	if (cell.font) style.fontFamily = FONTS[cell.font] ?? cell.font;
	if (cell.al) style.textAlign = ALIGN[cell.al];
	if (cell.va) style.verticalAlign = VALIGN[cell.va];
	return style;
}

/** 宽表格靠横向滚动查看，但滚动条以外没有任何线索说明右边还有列，读者
 * 容易以为数据到此为止。能滚且没滚到头时给右缘加一道渐隐当提示。
 *
 * 传入已有的 scrollRef 而不是自己建一个：DataTable 的滚动容器归
 * useStickyTableHeader 所有，普通 Markdown 表格则自带一个。 */
export function useScrollAffordance(scrollRef: React.RefObject<HTMLDivElement | null>) {
	useEffect(() => {
		const scroll = scrollRef.current;
		if (!scroll) return undefined;
		const update = () => {
			// 亚像素宽度差会让本来放得下的表格也亮起提示，留 1px 容差。
			const overflow = scroll.scrollWidth - scroll.clientWidth;
			scroll.dataset.scrollable = overflow > 1 ? 'true' : 'false';
			scroll.dataset.scrollEnd = scroll.scrollLeft >= overflow - 1 ? 'true' : 'false';
		};
		const observer = new ResizeObserver(update);
		observer.observe(scroll);
		// 容器宽度不变、表格自身变宽时也要重算。
		if (scroll.firstElementChild) observer.observe(scroll.firstElementChild);
		scroll.addEventListener('scroll', update, { passive: true });
		update();
		return () => {
			observer.disconnect();
			scroll.removeEventListener('scroll', update);
		};
	}, [scrollRef]);
}

/** 横向滚动容器会成为 CSS sticky 的最近滚动祖先，导致 Wiki 页面纵向滚动时
 * 表头不再跟随。这里仅在纵向滚动时移动真实 thead；它仍留在原表格内部，
 * 所以横向滚动、列宽、合并单元格都会天然保持一致。 */

function useStickyTableHeader(enabled: boolean) {
	const shellRef = useRef<HTMLDivElement>(null);
	const scrollRef = useRef<HTMLDivElement>(null);
	const tableRef = useRef<HTMLTableElement>(null);
	const cloneRef = useRef<HTMLTableElement>(null);
	const headRef = useRef<HTMLTableSectionElement>(null);
	useEffect(() => {
		const shell = shellRef.current;
		const scroll = scrollRef.current;
		const table = tableRef.current;
		const clone = cloneRef.current;
		const head = headRef.current;
		if (!enabled || !shell || !scroll || !table || !clone || !head) return undefined;
		const updateLayout = () => {
			clone.style.width = `${table.offsetWidth}px`;
			// sticky 层只覆盖真正能看到的表格视口；scrollbar-gutter 或系统
			// 滚动条不应被误当成表格的一部分，避免右侧出现一条突兀的色块。
			shell.style.setProperty('--ms-table-visible-width', `${scroll.clientWidth}px`);
			const sourceCells = Array.from(table.querySelectorAll<HTMLTableCellElement>('thead th'));
			const cloneCells = Array.from(clone.querySelectorAll<HTMLTableCellElement>('thead th'));
			sourceCells.forEach((cell, index) => {
				const target = cloneCells[index];
				if (!target) return;
				const width = cell.getBoundingClientRect().width;
				target.style.width = `${width}px`;
				target.style.minWidth = `${width}px`;
				target.style.maxWidth = `${width}px`;
			});
			shell.style.setProperty('--ms-table-head-height', `${head.getBoundingClientRect().height}px`);
			shell.dataset.stickyReady = 'true';
		};
		const syncHorizontal = () => { clone.style.transform = `translateX(${-scroll.scrollLeft}px)`; };
		const observer = new ResizeObserver(updateLayout);
		observer.observe(table);
		scroll.addEventListener('scroll', syncHorizontal, { passive: true });
		updateLayout();
		syncHorizontal();
		return () => {
			observer.disconnect();
			scroll.removeEventListener('scroll', syncHorizontal);
			shell.style.removeProperty('--ms-table-head-height');
			shell.style.removeProperty('--ms-table-visible-width');
			delete shell.dataset.stickyReady;
		};
	}, [enabled]);
	return { shellRef, scrollRef, tableRef, cloneRef, headRef };
}

export default function DataTable({ id, rowIds, data = [], head = 1, widths, layout, hideHeader = false, noFirstCol = false }: DataTableProps) {
	const showHeader = head > 0 && !hideHeader;
	const sticky = useStickyTableHeader(showHeader);
	// 横滚提示与吸顶表头无关，隐藏表头的表格同样需要。
	useScrollAffordance(sticky.scrollRef);
	useEffect(() => {
		if ((!id && !rowIds?.length) || typeof window === 'undefined') return undefined;
		let frame = 0;
		try {
			const targetId = decodeURIComponent(window.location.hash.slice(1));
			if (targetId !== id && !rowIds?.includes(targetId)) return undefined;
			// Docusaurus 的页面路由先恢复滚动、再异步挂载 MDX 组件；此时由
			// 表格自身补做一次定位，保证精确表格链接不会停在文档顶端。
			frame = requestAnimationFrame(() => (targetId === id ? sticky.shellRef.current : document.getElementById(targetId))?.scrollIntoView({ block: 'start' }));
		} catch { /* 非法 hash 保持浏览器默认行为。 */ }
		return () => cancelAnimationFrame(frame);
	}, [id, rowIds]);
	const renderRow = (row: TableCell[], rowIndex: number, Tag: 'th' | 'td', rowId?: string | null) => <tr key={rowIndex} id={rowId ?? undefined}>{row.map((raw, index) => {
		const cell = typeof raw === 'string' ? { t: raw } : (raw ?? {});
		const style = cellStyle(cell);
		const colSpan = cell.cs && cell.cs > 1 ? cell.cs : undefined;
		const rowSpan = cell.rs && cell.rs > 1 ? cell.rs : undefined;
		return <Tag key={index} colSpan={colSpan} rowSpan={rowSpan} style={style}>{cellMd(cell.t)}</Tag>;
	})}</tr>;
	const tableStyle = layout ? { tableLayout: layout === 'equal' ? 'fixed' : 'auto', width: '100%' } as CSSProperties : undefined;
	const columns = widths && <colgroup>{widths.map((width, index) => <col key={index} style={width ? { width } : undefined} />)}</colgroup>;
	const header = showHeader && <thead>{data.slice(0, head).map((row, index) => renderRow(row, index, 'th'))}</thead>;
	return <div id={id} ref={sticky.shellRef} className="ms-table-shell">{showHeader && <div className="ms-table-head-sticky" aria-hidden="true"><div className="ms-table-head-clip"><table ref={sticky.cloneRef} data-no-first-col={noFirstCol || undefined} style={tableStyle}>{columns}{header}</table></div></div>}<div ref={sticky.scrollRef} className="ms-table-scroll" role="region" aria-label="可横向滚动的表格" tabIndex={0}><table ref={sticky.tableRef} data-no-first-col={noFirstCol || undefined} style={tableStyle}>{columns}{showHeader && <thead ref={sticky.headRef}>{data.slice(0, head).map((row, index) => renderRow(row, index, 'th', rowIds?.[index]))}</thead>}<tbody>{data.slice(head).map((row, index) => renderRow(row, index + head, 'td', rowIds?.[index + head]))}</tbody></table></div></div>;
}
