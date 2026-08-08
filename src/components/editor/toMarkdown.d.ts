import type { JSONContent } from '@tiptap/core';

export function tiptapInlineToMarkdown(content?: JSONContent[]): string;
export function blocksToMarkdown(content?: JSONContent[]): string;
export function tiptapDocToMarkdown(document: JSONContent, frontmatter?: string): string;
