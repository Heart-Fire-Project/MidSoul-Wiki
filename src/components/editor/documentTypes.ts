import type { JSONContent } from '@tiptap/core';
import type { FileNode } from '../editorWorkspace/fsTree';

export type TiptapStoredDocument = {
  format: 'tiptap-v1';
  frontmatter: string;
  content: JSONContent;
};

export type EditorFile = FileNode & {
  id: string;
  path: string;
  base: string;
};

export const errorMessage = (caught: unknown) =>
  caught instanceof Error ? caught.message : String(caught);
