import type { TiptapStoredDocument } from './documentTypes';

export function markdownInlineToTiptap(markdown: string, marks?: unknown[]): unknown[];
export function markdownToTiptap(markdown: string): TiptapStoredDocument;
