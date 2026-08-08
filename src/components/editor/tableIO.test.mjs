// 自检：node src/components/editor/tableIO.test.mjs
import assert from 'node:assert';
import { findTables, serialize, mergeRange, splitCell, insertRow, deleteCol } from './tableIO.js';

const pipe = `| 颜色 | **红色** | 蓝色 |
| :--- | :------: | ---: |
| 灵魂 | ≤ 12 格 | > 24 格 |
`;

// 管道表格：读得出、原样写回
{
  const [b] = findTables(pipe);
  assert.equal(b.grid.cells.length, 2);
  assert.deepEqual(b.grid.align, ['l', 'c', 'r']);
  assert.equal(b.grid.cells[1][0].t, '灵魂');
  assert.ok(serialize(b.grid).includes('| :--- | :---: | ---: |'));
}

// ColorTable：颜色落到单元格上；旧显示开关无损迁移
{
  const src = `<ColorTable hideHeader noFirstCol cells={[[2, 3, 'rgba(240,251,239)']]} cols={['#eee', null]}>\n\n${pipe}\n</ColorTable>`;
  const [b] = findTables(src);
  assert.equal(b.grid.head, 1);
  assert.equal(b.grid.hideHeader, true);
  assert.equal(b.grid.noFirstCol, true);
  assert.equal(b.grid.cells[1][0].bg, '#eee');       // cols[0] → 正文首列
  assert.equal(b.end, src.length);
  const out = serialize(b.grid);
  assert.ok(out.startsWith('<DataTable hideHeader noFirstCol'), out);
  assert.ok(out.includes("bg:'#eee'"), out);
}

// DataTable：合并单元格往返不丢
{
  const src = `<DataTable data={[\n  [{t:'跨两列',cs:2,bg:'#fde'}],\n  ['a', {t:'红',fg:'#c00',b:1}],\n]}/>`;
  const [b] = findTables(src);
  assert.equal(b.end, src.length);
  assert.equal(b.grid.cells[0][1], null, '被覆盖的格子应为 null');
  assert.equal(b.grid.cells[1][1].fg, '#c00');
  const round = findTables(serialize(b.grid))[0].grid;
  assert.deepEqual(round.cells, b.grid.cells);
}

// Tiptap 导出附带的布局、列宽和透明度必须往返保留
{
  const src = `<DataTable layout="equal" widths={["120px",null]} hideHeader noFirstCol data={[\n  [{t:'半透明',bg:'#fff3a3',op:0.4}, '普通'],\n]}/>`;
  const [block] = findTables(src);
  assert.equal(block.grid.layout, 'equal');
  assert.deepEqual(block.grid.widths, ['120px', null]);
  assert.equal(block.grid.cells[0][0].op, 0.4);
  assert.equal(block.grid.hideHeader, true);
  assert.equal(block.grid.noFirstCol, true);
  const output = serialize(block.grid);
  assert.ok(output.includes('layout="equal"'));
  assert.ok(output.includes('widths={["120px",null]}'));
  assert.ok(output.includes('hideHeader noFirstCol'));
  assert.ok(output.includes('op:0.4'));
}

// 嵌在 ColorTable 里的管道表格不该被重复识别
{
  const src = `前言\n\n<ColorTable>\n\n${pipe}\n</ColorTable>\n\n${pipe}`;
  assert.equal(findTables(src).length, 2);
}

// 合并 / 拆分
{
  let g = findTables(pipe)[0].grid;
  g = mergeRange(g, 0, 0, 1, 1);
  assert.equal(g.cells[0][0].rs, 2);
  assert.equal(g.cells[0][0].cs, 2);
  assert.equal(g.cells[1][0], null);
  g = splitCell(g, 0, 0);
  assert.equal(g.cells[1][1].t, '');
  assert.equal(g.cells[0][0].cs, 1);
}

// 插行时，跨过插入位置的合并块要长高
{
  let g = mergeRange(findTables(pipe)[0].grid, 0, 0, 1, 0);
  g = insertRow(g, 1);
  assert.equal(g.cells[0][0].rs, 3);
  assert.equal(g.cells[1][0], null);
  assert.equal(g.cells[1][1].t, '');
}

// 删列时，跨过该列的合并块要变窄
{
  let g = mergeRange(findTables(pipe)[0].grid, 0, 0, 0, 1);
  g = deleteCol(g, 1);
  assert.equal(g.cells[0][0].cs, 1);
  assert.equal(g.cells[0].length, 2);
}

// 空单元格与行内 span：转成 DataTable 后文本要一字不差
{
  const src = `| a | |\n| :--- | :--- |\n| <span style={{color:'rgb(36, 91, 219)'}}>%s</span> | b |\n`;
  let g = findTables(src)[0].grid;
  assert.ok(serialize(g).startsWith('|'), '没有合并没有样式时应保持管道表格');
  g = mergeRange(g, 1, 0, 1, 1);
  const out = serialize(g);
  assert.ok(out.includes("''"), '空单元格应写成 \'\' 而不是 {}');
  const round = findTables(out)[0].grid;
  assert.equal(round.cells[1][0].t, "<span style={{color:'rgb(36, 91, 219)'}}>%s</span> b");
}

console.log('tableIO: 全部通过');
