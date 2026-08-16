import React, { useId, type ReactNode } from 'react';
import { darkBg } from './colorUtils';
import { INK } from './theme';

export type ColorValue = string | { bg?: string; text?: string } | null | undefined;
export type ColorTableProps = {
	header?: ColorValue[]; cols?: ColorValue[]; rows?: ColorValue[]; cells?: Array<[number, number, ColorValue]>;
	hideHeader?: boolean; noFirstCol?: boolean; children?: ReactNode;
};

function parse(value: ColorValue): { bg?: string; text?: string } | null {
	if (!value) return null;
	return typeof value === 'string' ? { bg: value } : value;
}

export default function ColorTable({ header, cols, rows, cells, hideHeader, noFirstCol, children }: ColorTableProps) {
	const id = useId().replace(/:/g, '');
	const selector = `#t${id}`;
	const rules: string[] = [];
	// 明暗两套规则一起写进 <style>，由 [data-theme] 挑。在 JS 里二选一时
	// SSR 只能按 defaultMode 烤死一种，另一种主题的读者首屏会闪一下。
	const applyColor = (target: string, color: { bg?: string; text?: string }) => {
		const dark = `[data-theme='dark'] ${target}`;
		if (color.bg) {
			rules.push(`${target} { background-color: ${color.bg} !important; }`);
			rules.push(`${dark} { background-color: ${darkBg(color.bg)} !important; }`);
		}
		if (color.bg || color.text) {
			rules.push(`${target} { color: ${color.text ?? INK.light} !important; }`);
			rules.push(`${dark} { color: ${color.text ?? INK.dark} !important; }`);
		}
	};
	header?.forEach((value, index) => { const color = parse(value); if (color) applyColor(`${selector} thead th:nth-child(${index + 1})`, color); });
	cols?.forEach((value, index) => { const color = parse(value); if (color) applyColor(`${selector} tbody td:nth-child(${index + 1})`, color); });
	rows?.forEach((value, index) => { const color = parse(value); if (color) applyColor(`${selector} tbody tr:nth-child(${index + 1}) td`, color); });
	cells?.forEach(([row, col, value]) => { const color = parse(value); if (color) applyColor(`${selector} tbody tr:nth-child(${row}) td:nth-child(${col})`, color); });
	if (hideHeader) rules.push(`${selector} thead { display: none; }`);
	// 只关闭正文第一列的默认底色；手动列色/行色/单元格色带有更高
	// 优先级，仍然可以正常覆盖这个透明背景。
	if (noFirstCol) rules.push(
		`${selector} tbody td:first-child { background: transparent; }`,
		`${selector} thead th:first-child { background: var(--ms-table-head); }`,
	);
	return <div id={`t${id}`}>{rules.length > 0 && <style>{rules.join('\n')}</style>}{children}</div>;
}
