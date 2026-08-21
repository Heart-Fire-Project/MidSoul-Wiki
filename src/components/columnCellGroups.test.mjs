import assert from 'node:assert/strict';
import { columnCellGroups } from './columnCellGroups.js';

// 模拟 HTMLTableElement 的最小形状：table.rows[].cells[].{colSpan,rowSpan}
const cell = (colSpan = 1, rowSpan = 1, tag = 'td') => ({ colSpan, rowSpan, tag });
const row = (...cells) => ({ cells });
const table = (...rows) => ({ rows });

// 「未定义」表格的真实结构：表头 6 列，随后一行 cs:6 的分区标题，再是普通数据行。
{
	const head = row(cell(), cell(), cell(), cell(), cell(), cell());
	const divider = row(cell(6));
	const data = row(cell(), cell(), cell(), cell(), cell(), cell());
	const groups = columnCellGroups(table(head, divider, data), 6);
	assert.equal(groups.length, 6);
	groups.forEach((group, index) => {
		assert.equal(group.length, 2, `column ${index} should only see head+data, not the cs:6 divider`);
		assert.equal(group[0], head.cells[index]);
		assert.equal(group[1], data.cells[index]);
	});
}

// rowspan：第一行末列 rs:3 应占住后两行同一列的格位，不消耗它们的单元格。
{
	const r0 = row(cell(), cell(), cell(1, 3));
	const r1 = row(cell(), cell());
	const r2 = row(cell(), cell());
	const groups = columnCellGroups(table(r0, r1, r2), 3);
	assert.deepEqual(groups[0], [r0.cells[0], r1.cells[0], r2.cells[0]]);
	assert.deepEqual(groups[1], [r0.cells[1], r1.cells[1], r2.cells[1]]);
	// rowspan 格自身跨 3 行 1 列，colspan===1 所以它也计入第 2 列——但只出现一次
	assert.deepEqual(groups[2], [r0.cells[2]]);
}

console.log('columnCellGroups: 全部通过');
