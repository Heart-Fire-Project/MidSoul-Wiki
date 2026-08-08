import { del, get, set } from 'idb-keyval';

/* 浏览器文件系统数据层：只处理磁盘与 IndexedDB，不处理 React 界面。 */

const KEY = 'midsoul-editor-dir';
const SKIP = /^(node_modules|build|dist|\.git|\.docusaurus)$/;
const newDocumentMarkdown = (fileName: string) => `---
sidebar_position: 1
---

# ${fileName.replace(/\.mdx?$/i, '')}
`;

export type DirectoryNode = {
  id: string;
  name: string;
  handle: FileSystemDirectoryHandle;
  children: TreeNode[];
};
export type FileNode = {
  id?: string;
  name: string;
  handle: FileSystemFileHandle;
  dir: FileSystemDirectoryHandle;
  current?: boolean;
  path?: string;
};
export type DraftFileNode = {
  id: string;
  name: string;
  dir: FileSystemDirectoryHandle;
  draft: true;
};
export type TreeNode = DirectoryNode | FileNode | DraftFileNode;
export type RestoredDirectory = FileSystemDirectoryHandle | { needsPermission: true; handle: FileSystemDirectoryHandle } | null;
type PermissionDirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission: (options: { mode: 'readwrite' }) => Promise<PermissionState>;
  requestPermission: (options: { mode: 'readwrite' }) => Promise<PermissionState>;
};

export const rememberDir = (handle: FileSystemDirectoryHandle) => set(KEY, handle);
export const forgetDir = () => del(KEY);
export const storedDir = () => get<FileSystemDirectoryHandle>(KEY);

export async function restoreDir({ prompt = false }: { prompt?: boolean } = {}): Promise<RestoredDirectory> {
  const handle = await storedDir() as PermissionDirectoryHandle | undefined;
  if (!handle) return null;
  const options = { mode: 'readwrite' } as const;
  if ((await handle.queryPermission(options)) === 'granted') return handle;
  if (!prompt) return { needsPermission: true, handle };
  return (await handle.requestPermission(options)) === 'granted' ? handle : null;
}

const isDirectory = (node: TreeNode): node is DirectoryNode => 'children' in node;
export const isDraftFile = (node: TreeNode): node is DraftFileNode => 'draft' in node && node.draft;

export async function readTree(handle: FileSystemDirectoryHandle, path = handle.name): Promise<DirectoryNode> {
  const children: TreeNode[] = [];
  for await (const [name, childHandle] of handle.entries()) {
    if (name.startsWith('.') || SKIP.test(name)) continue;
    if (childHandle.kind === 'directory') children.push(await readTree(childHandle, `${path}/${name}`));
    else if (/\.mdx?$/.test(name)) children.push({ id: `${path}/${name}`, name, handle: childHandle, dir: handle });
  }
  children.sort((a, b) => (Number(isDirectory(b)) - Number(isDirectory(a))) || a.name.localeCompare(b.name, 'zh'));
  return { id: path, name: handle.name, handle, children };
}

export function findNode(node: TreeNode, id: string): TreeNode | null {
  if (node.id === id) return node;
  if (!isDirectory(node)) return null;
  for (const child of node.children) {
    const hit = findNode(child, id);
    if (hit) return hit;
  }
  return null;
}

const write = async (handle: FileSystemFileHandle, text: string) => {
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
};

const sidecarName = (fileName: string, suffix: string) => `${fileName.replace(/\.mdx?$/i, '')}${suffix}`;
const withExt = (name: string) => (/\.mdx?$/i.test(name) ? name : `${name}.md`);

export function documentFileName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('请输入文档名称');
  if (trimmed === '.' || trimmed === '..' || /[\\/:*?"<>|]/.test(trimmed)) throw new Error('文档名称不能包含 \\ / : * ? " < > |');
  return withExt(trimmed);
}

async function assertFileDoesNotExist(dir: FileSystemDirectoryHandle, file: string) {
  try {
    await dir.getFileHandle(file);
  } catch (caught) {
    if (caught instanceof DOMException && caught.name === 'NotFoundError') return;
    throw caught;
  }
  throw new Error(`“${file}”已经存在，请换一个名称`);
}

export async function createFile(dir: FileSystemDirectoryHandle, name: string): Promise<FileNode> {
  const file = documentFileName(name);
  await assertFileDoesNotExist(dir, file);
  const handle = await dir.getFileHandle(file, { create: true });
  await write(handle, newDocumentMarkdown(file));
  return { name: file, handle, dir };
}

export const createFolder = (dir: FileSystemDirectoryHandle, name: string) => dir.getDirectoryHandle(name, { create: true });

export async function renameFile(node: FileNode, name: string, sidecarSuffix?: string) {
  const file = documentFileName(name);
  if (file === node.name) return file;
  await assertFileDoesNotExist(node.dir, file);
  await write(await node.dir.getFileHandle(file, { create: true }), await (await node.handle.getFile()).text());
  if (sidecarSuffix) try {
    const oldJson = await node.dir.getFileHandle(sidecarName(node.name, sidecarSuffix));
    await write(await node.dir.getFileHandle(sidecarName(file, sidecarSuffix), { create: true }), await (await oldJson.getFile()).text());
    await node.dir.removeEntry(sidecarName(node.name, sidecarSuffix));
  } catch { /* Markdown 还没有对应的结构化编辑源。 */ }
  await node.dir.removeEntry(node.name);
  return file;
}

export async function removeFile(node: FileNode, sidecarSuffix?: string) {
  await node.dir.removeEntry(node.name);
  if (sidecarSuffix) try { await node.dir.removeEntry(sidecarName(node.name, sidecarSuffix)); } catch { /* 没有就算了 */ }
}
