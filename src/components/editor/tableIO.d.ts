export type CellAlignment = 'l' | 'c' | 'r' | null;
export type TableCell = { t: string; cs?: number; rs?: number; bg?: string; op?: number; fg?: string; b?: boolean | number; i?: boolean | number; u?: boolean | number; s?: boolean | number; size?: string | number; font?: string; al?: Exclude<CellAlignment, null>; va?: string };
export type TableGrid = { cells: Array<Array<TableCell | null>>; head: number; align: CellAlignment[]; layout?: 'equal' | 'content'; widths?: Array<string | null>; hideHeader?: boolean; noFirstCol?: boolean };
export type TableMatch = { start: number; end: number; grid: TableGrid };

export function findTables(source: string): TableMatch[];
export function serialize(grid: TableGrid): string;
export function emptyGrid(rows?: number, columns?: number): TableGrid;
export function mergeRange(grid: TableGrid, rowStart: number, columnStart: number, rowEnd: number, columnEnd: number): TableGrid;
export function splitCell(grid: TableGrid, row: number, column: number): TableGrid;
export function insertRow(grid: TableGrid, at: number): TableGrid;
export function deleteRow(grid: TableGrid, at: number): TableGrid;
export function insertCol(grid: TableGrid, at: number): TableGrid;
export function deleteCol(grid: TableGrid, at: number): TableGrid;
export function anchorOf(grid: TableGrid, row: number, column: number): [number, number];
