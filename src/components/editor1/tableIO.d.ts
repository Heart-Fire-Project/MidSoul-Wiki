import type { TableGrid, TableMatch } from './blockTypes';

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
