import React, { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Tree } from 'react-arborist';
import { Folder, FolderPlus, Plus, RefreshCw } from 'lucide-react';
import { pick } from './pick';
import { createFile, createFolder, documentFileName, findNode, forgetDir, isDraftFile, readTree, rememberDir, removeFile, renameFile, restoreDir, type DirectoryNode, type DraftFileNode, type FileNode, type TreeNode } from './fsTree';
import s from './FileTree.module.css';

type Props = { collapsed?: boolean; current?: string; initialPath?: string; onOpen: (node: FileNode & { path: string }) => void; onError: (message: string) => void; onTreeChange?: (tree: DirectoryNode | null) => void; guard?: () => boolean; sidecarSuffix?: string };
type ArboristNode = any;
type Size = { w: number; h: number };
const isDirectory = (node: TreeNode): node is DirectoryNode => 'children' in node;

function insertChild(node: DirectoryNode, parentId: string, child: TreeNode): DirectoryNode {
  if (node.id === parentId) return { ...node, children: [child, ...node.children] };
  return { ...node, children: node.children.map((item) => isDirectory(item) ? insertChild(item, parentId, child) : item) };
}

function removeTreeNode(node: DirectoryNode, id: string): DirectoryNode {
  return { ...node, children: node.children.filter((item) => item.id !== id).map((item) => isDirectory(item) ? removeTreeNode(item, id) : item) };
}

function Row({ node, style, dragHandle }: { node: ArboristNode; style: CSSProperties; dragHandle?: (element: HTMLDivElement | null) => void }) {
  const isDir = !node.isLeaf;
  const isDraft = node.data.draft === true;
  const [confirmDel, setConfirmDel] = useState(false);
  const submitted = useRef(false);
  const stop = (fn: () => void) => (event: React.MouseEvent) => { event.stopPropagation(); fn(); };
  const cancelEdit = () => { node.reset(); if (isDraft && !submitted.current) node.tree.delete(node.id); };
  const submitEdit = (input: HTMLInputElement) => {
    try { documentFileName(input.value); input.setCustomValidity(''); }
    catch (caught) { input.setCustomValidity(caught instanceof Error ? caught.message : String(caught)); input.reportValidity(); return; }
    submitted.current = true;
    node.submit(input.value.trim());
  };
  return <div ref={dragHandle} className={s.treeRow} style={{ ...style, paddingLeft: Number(style.paddingLeft ?? 0) + 10 }} data-current={node.data.current} data-draft={isDraft} onClick={() => (isDir ? node.toggle() : !isDraft && node.activate())} onMouseLeave={() => setConfirmDel(false)} title={isDraft ? '输入名称后按回车创建，按 Esc 取消' : node.data.id}>
    <span className={s.twisty}>{isDir ? (node.isOpen ? '▾' : '▸') : ''}</span>
    {node.isEditing ? <input className={s.treeInput} autoFocus required defaultValue={node.data.name} placeholder={isDraft ? '输入文档名称' : undefined} aria-label={isDraft ? '新文档名称' : '重命名文档'} onFocus={() => { submitted.current = false; }} onBlur={cancelEdit} onInput={(event) => event.currentTarget.setCustomValidity('')} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); cancelEdit(); } if (event.key === 'Enter') { event.preventDefault(); submitEdit(event.currentTarget); } }} /> : <><span className={s.treeName}>{isDraft ? '未命名文档' : isDir ? node.data.name : node.data.name.replace(/\.mdx?$/, '')}</span><span className={s.rowActions}>{isDir ? <><button title="在这里新建文档" onClick={stop(() => node.tree.create({ type: 'leaf', parentId: node.id }))}><Plus size={13} /></button><button title="在这里新建文件夹" onClick={stop(() => node.tree.create({ type: 'internal', parentId: node.id }))}><FolderPlus size={13} /></button></> : <><button title="重命名（F2）" onClick={stop(() => node.edit())}>✎</button><button title={confirmDel ? '再点一次确认删除' : '删除'} data-danger={confirmDel} onClick={stop(() => (confirmDel ? node.tree.delete(node.id) : setConfirmDel(true)))}>{confirmDel ? '确认' : '✕'}</button></>}</span></>}
  </div>;
}

export default function FileTree({ collapsed, current, initialPath, onOpen, onError, onTreeChange, guard, sidecarSuffix }: Props) {
  const allow = () => (guard ? guard() : true);
  const [dir, setDir] = useState<FileSystemDirectoryHandle | null>(null);
  const [tree, setTree] = useState<DirectoryNode | null>(null);
  const [pending, setPending] = useState<FileSystemDirectoryHandle | null>(null);
  const [size, setSize] = useState<Size>({ w: 240, h: 400 });
  const box = useRef<HTMLDivElement>(null); const treeRef = useRef<any>(null); const sizeRef = useRef(size); const resizeFrame = useRef<number | null>(null); sizeRef.current = size;
  const onOpenRef = useRef(onOpen); const initialPathRef = useRef(initialPath); const autoOpenedPath = useRef<string | null>(null);
  onOpenRef.current = onOpen; initialPathRef.current = initialPath;
  const refresh = useCallback(async (handle?: FileSystemDirectoryHandle) => { const next = handle ?? dir; if (next) setTree(await readTree(next)); }, [dir]);
  const useDirectory = useCallback(async (handle: FileSystemDirectoryHandle) => {
    setDir(handle); setPending(null); await rememberDir(handle);
    const nextTree = await readTree(handle);
    setTree(nextTree);
    const path = initialPathRef.current;
    if (!path || autoOpenedPath.current === path) return;
    const previous = findNode(nextTree, path);
    if (previous && !isDirectory(previous) && !isDraftFile(previous)) {
      autoOpenedPath.current = path;
      onOpenRef.current({ ...previous, path });
    }
  }, []);
  useEffect(() => { restoreDir().then((result) => { if (!result) return; if ('needsPermission' in result) setPending(result.handle); else useDirectory(result); }).catch(() => {}); }, [useDirectory]);
  useEffect(() => { onTreeChange?.(tree); }, [onTreeChange, tree]);
  useEffect(() => { if (!box.current) return; const observer = new ResizeObserver(([entry]) => { const next = { w: Math.round(entry.contentRect.width), h: Math.round(entry.contentRect.height) }; if (next.w === sizeRef.current.w && next.h === sizeRef.current.h) return; if (resizeFrame.current) cancelAnimationFrame(resizeFrame.current); resizeFrame.current = requestAnimationFrame(() => { resizeFrame.current = null; if (next.w !== sizeRef.current.w || next.h !== sizeRef.current.h) { sizeRef.current = next; setSize(next); } }); }); observer.observe(box.current); return () => { observer.disconnect(); if (resizeFrame.current) cancelAnimationFrame(resizeFrame.current); }; }, []);
  const choose = async () => { const browser = window as typeof window & { showDirectoryPicker?: (options: { mode: 'readwrite' }) => Promise<FileSystemDirectoryHandle> }; if (!browser.showDirectoryPicker) return onError('这个浏览器不支持直接读写文件夹，请用 Chrome 或 Edge'); try { const picked = await pick(() => browser.showDirectoryPicker!({ mode: 'readwrite' })); if (picked) await useDirectory(picked); } catch (caught) { onError(caught instanceof Error ? caught.message : String(caught)); } };
  const grant = async () => { const handle = await restoreDir({ prompt: true }); if (handle && !('needsPermission' in handle)) await useDirectory(handle); else { await forgetDir(); setPending(null); } };
  const onCreate = async ({ parentId, type }: { parentId: string | null; type: 'internal' | 'leaf' }) => {
    if (!allow() || !tree) return null;
    const parent = findNode(tree, parentId ?? tree.id) ?? tree;
    const folder = isDirectory(parent) ? parent.handle : parent.dir;
    const parentPath = isDirectory(parent) ? parent.id : parent.id?.slice(0, parent.id.lastIndexOf('/')) ?? tree.id;
    try {
      if (type === 'internal') { await createFolder(folder, '新文件夹'); await refresh(); return null; }
      const draft: DraftFileNode = { id: `${parentPath}/.__midsoul-draft-${crypto.randomUUID()}`, name: '', dir: folder, draft: true };
      setTree((currentTree) => currentTree ? insertChild(currentTree, parentPath, draft) : currentTree);
      return draft;
    } catch (caught) { onError(`操作失败：${caught instanceof Error ? caught.message : String(caught)}`); return null; }
  };
  const onRename = async ({ id, name, node: apiNode }: { id: string; name: string; node: ArboristNode }) => {
    if (!allow() || !tree) return;
    const node = findNode(tree, id);
    if (!node || isDirectory(node)) return onError('暂不支持给文件夹改名');
    try {
      if (isDraftFile(node)) {
        const file = await createFile(node.dir, name);
        await refresh();
        onOpen({ ...file, path: `${id.slice(0, id.lastIndexOf('/'))}/${file.name}` });
      } else {
        await renameFile(node, name, sidecarSuffix);
        await refresh();
      }
    } catch (caught) {
      onError(`操作失败：${caught instanceof Error ? caught.message : String(caught)}`);
      if (isDraftFile(node)) setTimeout(() => apiNode?.edit(), 0);
    }
  };
  const onDelete = async ({ ids }: { ids: string[] }) => {
    if (!allow() || !tree) return;
    const draftIds = new Set(ids.filter((id) => { const node = findNode(tree, id); return !!node && isDraftFile(node); }));
    if (draftIds.size) setTree((currentTree) => currentTree ? [...draftIds].reduce(removeTreeNode, currentTree) : currentTree);
    try {
      let changedDisk = false;
      for (const id of ids) {
        const node = findNode(tree, id);
        if (!node || isDraftFile(node)) continue;
        if (isDirectory(node)) { onError('暂不支持删文件夹，先把里面的文档删掉'); continue; }
        await removeFile(node, sidecarSuffix); changedDisk = true;
      }
      if (changedDisk) await refresh();
    } catch (caught) { onError(`操作失败：${caught instanceof Error ? caught.message : String(caught)}`); }
  };
  const mark = (node: TreeNode): TreeNode & { current?: boolean } => ({ ...node, current: !isDraftFile(node) && node.id === current, ...(isDirectory(node) && { children: node.children.map(mark) }) }) as TreeNode & { current?: boolean };
  return <div className={s.sidebar} data-collapsed={!!collapsed}><div className={s.sidebarHead}><span>资源管理器</span><span className={s.headActions}>{tree && <><button title="新建文档" onClick={() => treeRef.current?.createLeaf()}><Plus size={13} /></button><button title="新建文件夹" onClick={() => treeRef.current?.createInternal()}><FolderPlus size={13} /></button><button title="重新读取目录" onClick={() => refresh()}><RefreshCw size={12} /></button></>}<button className={s.tool} onClick={choose} title={tree ? '换一个文件夹' : '选择仓库里的 docs 文件夹'}>{tree ? '换目录' : <><Folder size={13} />打开文件夹</>}</button></span></div><div className={s.tree} ref={box}>{pending && <button className={s.resume} onClick={grant}>继续上次的 <b>{pending.name}</b><span className={s.hint}>刷新后需要点一下恢复权限</span></button>}{tree ? <Tree ref={treeRef} data={(mark(tree) as DirectoryNode).children} idAccessor="id" width={size.w} height={size.h} indent={14} rowHeight={26} openByDefault={false} onActivate={(node: ArboristNode) => node.isLeaf && !isDraftFile(node.data) && allow() && onOpen({ ...node.data, path: node.data.id })} onCreate={onCreate as any} onRename={onRename as any} onDelete={onDelete as any}>{Row as any}</Tree> : !pending && <p className={s.treeEmpty}>选中仓库里的 <code>docs</code> 文件夹，就能新建、改名、删除文档并直接保存回磁盘。</p>}</div></div>;
}
