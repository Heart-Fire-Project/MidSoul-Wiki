/** th/td 的 nth-child 序号只在没有 colspan/rowspan 时才等于列号；有合并单元格
 * 时（分区标题行的整行 cs、跨行说明的 rs）需要按网格占位逐行推进——跳过被上方
 * rowspan 占住的格子、按 colspan 跨过多列——才能把每个单列格归到它真正所在的
 * 列，跨列/跨行的合并格本身不参与任何一列的宽度测量。
 *
 * 只按 rows/cells/colSpan/rowSpan 的形状读取，真实 HTMLTableElement 与测试里
 * 的 plain object 都能喂进来。 */
export function columnCellGroups(table, columnCount) {
	const groups = Array.from({ length: columnCount }, () => []);
	const rowSpanCarry = new Array(columnCount).fill(0);
	Array.from(table.rows).forEach((row) => {
		const cells = Array.from(row.cells);
		let cellIndex = 0;
		for (let col = 0; col < columnCount;) {
			if (rowSpanCarry[col] > 0) { rowSpanCarry[col] -= 1; col += 1; continue; }
			const cell = cells[cellIndex++];
			if (!cell) break;
			const span = Math.max(1, cell.colSpan);
			if (span === 1) groups[col].push(cell);
			for (let i = 0; i < span && col < columnCount; i += 1, col += 1) {
				if (cell.rowSpan > 1) rowSpanCarry[col] = cell.rowSpan - 1;
			}
		}
	});
	return groups;
}
