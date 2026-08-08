/*
  Markdown 里的表格 ←→ 编辑器网格模型 的双向转换。

  网格模型：
    { cells: (Cell|null)[][], head: number, align: ('l'|'c'|'r'|null)[] }
  cells 是稠密矩阵，null 表示"被左边/上面的合并单元格覆盖"。
  Cell 字段同 DataTable：t cs rs bg fg b i u s size font al va

  能读三种来源：管道表格、<ColorTable>、<DataTable>。
  写回时：没有合并也没有单元格样式 → 写成管道表格（保持 Markdown 原味）；
          否则一律写成 <DataTable>。
*/

const STYLE_KEYS = ['bg', 'op', 'fg', 'b', 'i', 'u', 's', 'size', 'font', 'al', 'va'];

// ── 工具 ──────────────────────────────────────────────

// 解析 .md 里的 JS 字面量（本地编辑器读自家仓库，和 MDX 求值同一个信任级别）
function evalLiteral(src) {
  try {
    // eslint-disable-next-line no-new-func
    return new Function(`return (${src})`)();
  } catch {
    return undefined;
  }
}

// 从 `name={` 位置起做花括号配对，取出完整表达式
function readBraced(src, from) {
  let depth = 0;
  for (let i = from; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return { expr: src.slice(from + 1, i), end: i + 1 };
  }
  return null;
}

function parseProps(attrs) {
  const props = {};
  const re = /(\w+)\s*(=)?/g;
  let m;
  while ((m = re.exec(attrs))) {
    const name = m[1];
    if (m[2]) {
      const rest = attrs.slice(re.lastIndex).match(/^\s*/)[0].length + re.lastIndex;
      if (attrs[rest] === '{') {
        const b = readBraced(attrs, rest);
        if (!b) break;
        props[name] = evalLiteral(b.expr);
        re.lastIndex = b.end;
      } else if (attrs[rest] === '"' || attrs[rest] === "'") {
        const q = attrs.indexOf(attrs[rest], rest + 1);
        props[name] = attrs.slice(rest + 1, q);
        re.lastIndex = q + 1;
      }
    } else {
      props[name] = true; // 布尔简写：hideHeader / noFirstCol
    }
  }
  return props;
}

const splitRow = (line) =>
  line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));

// ── 读：管道表格 ───────────────────────────────────────

const PIPE_RE = /^[ \t]*\|.*\|[ \t]*\r?\n[ \t]*\|[ :\-|]+\|[ \t]*\r?\n(?:[ \t]*\|.*\|[ \t]*(?:\r?\n|$))*/gm;

function parsePipe(block) {
  const lines = block.trimEnd().split(/\r?\n/);
  const align = splitRow(lines[1]).map((s) =>
    s.startsWith(':') && s.endsWith(':') ? 'c' : s.endsWith(':') ? 'r' : s.startsWith(':') ? 'l' : null
  );
  const rows = [lines[0], ...lines.slice(2)].map((l) => splitRow(l).map((t) => ({ t })));
  const width = Math.max(...rows.map((r) => r.length));
  rows.forEach((r) => { while (r.length < width) r.push({ t: '' }); });
  return { cells: rows, head: 1, align };
}

// ── 读：<ColorTable> ──────────────────────────────────

const parseColor = (v) => (!v ? null : typeof v === 'string' ? { bg: v } : { bg: v.bg, fg: v.text });

function applyColor(cell, c) {
  if (!c) return;
  if (c.bg) cell.bg = c.bg;
  if (c.fg) cell.fg = c.fg;
}

function parseColorTable(attrs, inner) {
  const pipe = PIPE_RE.exec(inner);
  PIPE_RE.lastIndex = 0;
  if (!pipe) return null;
  const grid = parsePipe(pipe[0]);
  const p = parseProps(attrs);
  const body = grid.cells.slice(1);

  p.header?.forEach((v, i) => applyColor(grid.cells[0][i] ?? {}, parseColor(v)));
  p.cols?.forEach((v, i) => body.forEach((row) => row[i] && applyColor(row[i], parseColor(v))));
  p.rows?.forEach((v, r) => body[r]?.forEach((cell) => applyColor(cell, parseColor(v))));
  p.cells?.forEach(([r, c, v]) => applyColor(body[r - 1]?.[c - 1] ?? {}, parseColor(v)));

  // 旧 ColorTable 的显示选项也按无损开关迁移：保留表头语义和原始颜色，
  // 这样在可视化编辑器里再次点击就能完整恢复。
  if (p.hideHeader) grid.hideHeader = true;
  if (p.noFirstCol) grid.noFirstCol = true;
  return grid;
}

// ── 读：<DataTable> ───────────────────────────────────

function parseDataTable(attrs) {
  const p = parseProps(attrs);
  if (!Array.isArray(p.data)) return null;
  const rows = p.data.map((row) => row.map((c) => (typeof c === 'string' ? { t: c } : { ...c })));
  return expand({ cells: rows, head: p.head ?? 1, align: [], layout: p.layout, widths: p.widths,
    hideHeader: Boolean(p.hideHeader), noFirstCol: Boolean(p.noFirstCol), id: typeof p.id === 'string' ? p.id : undefined,
    rowIds: Array.isArray(p.rowIds) ? p.rowIds.map((id) => typeof id === 'string' ? id : null) : undefined });
}

// 紧凑行（省略被覆盖格）→ 稠密矩阵（null 占位）
function expand({ cells, head, align, layout, widths, hideHeader, noFirstCol, id, rowIds }) {
  const out = [];
  const put = (r, c, v) => {
    while (out.length <= r) out.push([]);
    out[r][c] = v;
  };
  cells.forEach((row, r) => {
    let c = 0;
    row.forEach((cell) => {
      while (out[r]?.[c] !== undefined) c++;
      put(r, c, cell);
      for (let dr = 0; dr < (cell.rs || 1); dr++)
        for (let dc = 0; dc < (cell.cs || 1); dc++)
          if (dr || dc) put(r + dr, c + dc, null);
      c += cell.cs || 1;
    });
  });
  const width = Math.max(...out.map((r) => r.length));
  out.forEach((row) => { for (let i = 0; i < width; i++) if (row[i] === undefined) row[i] = { t: '' }; });
  return { cells: out, head, align, ...(layout && { layout }), ...(widths && { widths }), ...(id && { id }), ...(rowIds?.some(Boolean) && { rowIds }),
    ...(hideHeader && { hideHeader: true }), ...(noFirstCol && { noFirstCol: true }) };
}

// ── 扫描整篇文档 ──────────────────────────────────────

const CT_RE = /<ColorTable\b([^>]*)>([\s\S]*?)<\/ColorTable>/g;
const DT_RE = /<DataTable\b/g;

export function findTables(src) {
  const blocks = [];

  for (const m of src.matchAll(CT_RE)) {
    const grid = parseColorTable(m[1], m[2]);
    if (grid) blocks.push({ start: m.index, end: m.index + m[0].length, grid });
  }
  for (const m of src.matchAll(DT_RE)) {
    const open = src.indexOf('{', m.index);
    if (open < 0) continue;
    // 逐个属性跳过花括号，直到标签闭合
    let i = m.index + m[0].length;
    while (i < src.length) {
      const brace = src.indexOf('{', i);
      const close = src.indexOf('>', i);
      if (close < 0) break;
      if (brace < 0 || brace > close) { i = close + 1; break; }
      const b = readBraced(src, brace);
      if (!b) { i = close + 1; break; }
      i = b.end;
    }
    const grid = parseDataTable(src.slice(m.index + m[0].length, i - 1));
    if (grid) blocks.push({ start: m.index, end: i, grid });
  }
  for (const m of src.matchAll(PIPE_RE)) {
    const inside = blocks.some((b) => m.index > b.start && m.index < b.end);
    if (!inside) blocks.push({ start: m.index, end: m.index + m[0].length, grid: parsePipe(m[0]) });
  }

  return blocks.sort((a, b) => a.start - b.start);
}

// ── 写 ────────────────────────────────────────────────

const isPlain = (grid) =>
  !grid.layout && !grid.widths?.some(Boolean) && !grid.hideHeader && !grid.noFirstCol && !grid.id && !grid.rowIds?.some(Boolean) &&
  grid.head === 1 &&
  grid.cells.every((row) =>
    row.every((c) => c && (c.cs || 1) === 1 && (c.rs || 1) === 1 && !STYLE_KEYS.some((k) => c[k] != null))
  );

function toPipe({ cells, align }) {
  const esc = (t) => (t ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
  const width = cells[0].length;
  const sep = Array.from({ length: width }, (_, i) =>
    ({ c: ':---:', r: '---:', l: ':---' }[align?.[i]] ?? '---')
  );
  const line = (arr) => `| ${arr.join(' | ')} |`;
  return [line(cells[0].map((c) => esc(c.t))), line(sep), ...cells.slice(1).map((r) => line(r.map((c) => esc(c.t))))].join('\n');
}

const quote = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

function cellLiteral(cell, colAlign) {
  const c = { ...cell };
  if (c.al == null && colAlign && colAlign !== 'l') c.al = colAlign; // 左对齐是默认值，不必写出来
  if ((c.cs || 1) === 1) delete c.cs;
  if ((c.rs || 1) === 1) delete c.rs;
  const keys = ['t', 'cs', 'rs', 'bg', 'op', 'fg', 'b', 'i', 'u', 's', 'size', 'font', 'al', 'va']
    .filter((k) => c[k] != null && c[k] !== '' && c[k] !== false);
  if (keys.length === 0) return "''";
  if (keys.length === 1 && keys[0] === 't') return quote(c.t);
  const body = keys.map((k) => `${k}:${typeof c[k] === 'number' || c[k] === true ? (c[k] === true ? 1 : c[k]) : quote(c[k])}`);
  return `{${body.join(',')}}`;
}

function toDataTable({ cells, head, align, layout, widths, hideHeader, noFirstCol, id, rowIds }) {
  const rows = cells.map((row) =>
    `  [${row.filter(Boolean).map((c, i) => cellLiteral(c, align?.[i])).join(', ')}],`
  );
  const headAttr = head === 1 ? '' : ` head={${head}}`;
  const layoutAttr = layout ? ` layout="${layout}"` : '';
  const widthsAttr = widths?.some(Boolean) ? ` widths={${JSON.stringify(widths)}}` : '';
  const idAttr = id ? ` id=${JSON.stringify(id)}` : '';
  const rowIdsAttr = rowIds?.some(Boolean) ? ` rowIds={${JSON.stringify(rowIds)}}` : '';
  const displayAttrs = `${hideHeader ? ' hideHeader' : ''}${noFirstCol ? ' noFirstCol' : ''}`;
  return `<DataTable${headAttr}${layoutAttr}${widthsAttr}${idAttr}${rowIdsAttr}${displayAttrs} data={[\n${rows.join('\n')}\n]}/>`;
}

export function serialize(grid) {
  return isPlain(grid) ? toPipe(grid) : toDataTable(grid);
}

// ── 网格操作（编辑器用）──────────────────────────────

export const emptyGrid = (rows = 3, cols = 3) => ({
  cells: Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ t: '' }))),
  head: 1,
  align: Array(cols).fill(null),
});

// 合并一个矩形区域：左上角吃掉整块，其余置 null
export function mergeRange(grid, r1, c1, r2, c2) {
  const cells = grid.cells.map((row) => row.slice());
  const anchor = { ...(cells[r1][c1] ?? { t: '' }) };
  const texts = [];
  for (let r = r1; r <= r2; r++)
    for (let c = c1; c <= c2; c++) {
      if (cells[r][c]?.t) texts.push(cells[r][c].t);
      cells[r][c] = null;
    }
  anchor.t = [...new Set(texts)].join(' ');
  anchor.cs = c2 - c1 + 1;
  anchor.rs = r2 - r1 + 1;
  cells[r1][c1] = anchor;
  return { ...grid, cells };
}

export function splitCell(grid, r, c) {
  const cells = grid.cells.map((row) => row.slice());
  const cell = cells[r][c];
  if (!cell) return grid;
  for (let dr = 0; dr < (cell.rs || 1); dr++)
    for (let dc = 0; dc < (cell.cs || 1); dc++)
      if (dr || dc) cells[r + dr][c + dc] = { t: '' };
  cells[r][c] = { ...cell, cs: 1, rs: 1 };
  return { ...grid, cells };
}

// 行列增删。跨过插入/删除位置的合并单元格会同步伸缩。
export function insertRow(grid, at) {
  const cells = grid.cells.map((row) => row.slice());
  const width = cells[0].length;
  const row = Array.from({ length: width }, (_, c) => {
    const [ar] = anchorOf({ ...grid, cells }, at, c);
    const owner = ar < at ? cells[ar][c] : null;
    if (owner && ar + (owner.rs || 1) > at) { owner.rs = (owner.rs || 1) + 1; return null; }
    return { t: '' };
  });
  cells.splice(at, 0, row);
  return { ...grid, cells };
}

export function deleteRow(grid, at) {
  if (grid.cells.length <= 1) return grid;
  const cells = grid.cells.map((row) => row.slice());
  cells[at].forEach((cell, c) => {
    if (cell?.rs > 1) cells[at + 1][c] = { ...cell, rs: cell.rs - 1 }; // 合并块的头被删 → 顺延到下一行
    else {
      const [ar] = anchorOf({ ...grid, cells }, at, c);
      if (ar < at && cells[ar][c]?.rs > 1) cells[ar][c].rs -= 1;
    }
  });
  cells.splice(at, 1);
  return { ...grid, cells, head: Math.min(grid.head, cells.length) };
}

export function insertCol(grid, at) {
  const cells = grid.cells.map((row, r) => {
    const copy = row.slice();
    const [, ac] = anchorOf(grid, r, at);
    const owner = ac < at ? copy[ac] : null;
    if (owner && ac + (owner.cs || 1) > at) { owner.cs = (owner.cs || 1) + 1; copy.splice(at, 0, null); }
    else copy.splice(at, 0, { t: '' });
    return copy;
  });
  const align = grid.align.slice();
  align.splice(at, 0, null);
  return { ...grid, cells, align };
}

export function deleteCol(grid, at) {
  if (grid.cells[0].length <= 1) return grid;
  const cells = grid.cells.map((row, r) => {
    const copy = row.slice();
    const cell = copy[at];
    if (cell?.cs > 1) copy[at + 1] = { ...cell, cs: cell.cs - 1 };
    else {
      const [, ac] = anchorOf(grid, r, at);
      if (ac < at && copy[ac]?.cs > 1) copy[ac] = { ...copy[ac], cs: copy[ac].cs - 1 };
    }
    copy.splice(at, 1);
    return copy;
  });
  const align = grid.align.slice();
  align.splice(at, 1);
  return { ...grid, cells, align };
}

// 定位每个单元格的显示锚点（跳过被覆盖的格子）
export function anchorOf(grid, r, c) {
  if (grid.cells[r]?.[c]) return [r, c];
  for (let rr = r; rr >= 0; rr--)
    for (let cc = c; cc >= 0; cc--) {
      const cell = grid.cells[rr]?.[cc];
      if (cell && rr + (cell.rs || 1) > r && cc + (cell.cs || 1) > c) return [rr, cc];
    }
  return [r, c];
}
