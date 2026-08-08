import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { usePluginData } from '@docusaurus/useGlobalData';
import Layout from '@theme/Layout';
import type { JSONContent } from '@tiptap/core';
import { Folder, Save } from 'lucide-react';
import FileTree from '../components/editorWorkspace/FileTree';
import type { DirectoryNode, FileNode, TreeNode } from '../components/editorWorkspace/fsTree';
import type { EditorFile, TiptapStoredDocument } from '../components/editor/documentTypes';
import { errorMessage } from '../components/editor/documentTypes';
import { markdownToTiptap } from '../components/editor/fromMarkdown';
import TiptapEditor, { INITIAL_DOCUMENT, type EditorLinkTarget } from '../components/editor/TiptapEditor';
import { findPairedPreset } from '../components/editor/ColorPalette';
import { addBaseToTiptapImages, stripBaseFromTiptapImages } from '../components/editor/imagePaths';
import { tiptapDocToMarkdown } from '../components/editor/toMarkdown.js';
import s from '../components/editor/EditorWorkspace.module.css';

type OpenableFile = FileNode & { path: string };
type EditorSession = { version: 1; path: string; saved: boolean; document: TiptapStoredDocument };
type ImageLibraryData = { images?: string[] };
type DocsGlobalData = { versions?: Array<{ docs?: Array<{ id: string; path: string }> }> };

const isDirectory = (node: TreeNode): node is DirectoryNode => 'children' in node;
const stripDocusaurusNumberPrefix = (segment: string) => {
  if (/^\d+[-_.]\d+/.test(segment)) return segment;
  return segment.replace(/^\d+\s*[-_.]+\s*(?=[^-_.\s])/, '');
};
const documentIdFromPath = (path: string) => {
  const parts = path.split('/').filter(Boolean);
  const docs = parts.indexOf('docs');
  return (docs >= 0 ? parts.slice(docs + 1) : parts).map((part, index, all) =>
    stripDocusaurusNumberPrefix(index === all.length - 1 ? part.replace(/\.mdx?$/i, '') : part),
  ).join('/');
};
const linkTargetsFromTree = (tree: DirectoryNode | null, routes: Record<string, string>): EditorLinkTarget[] => {
  if (!tree) return [];
  const targets: EditorLinkTarget[] = [];
  const visit = (node: TreeNode) => {
    if (isDirectory(node)) { node.children.forEach(visit); return; }
    if ('draft' in node && node.draft) return;
    if ('handle' in node && node.id) targets.push({ name: node.name, path: node.id, route: routes[documentIdFromPath(node.id)], handle: node.handle });
  };
  tree.children.forEach(visit);
  return targets;
};

const LAST_FILE_KEY = 'midsoul-editor3-last-file';
const SESSION_KEY = 'midsoul-editor3-session';

const isTiptapDocument = (value: unknown): value is TiptapStoredDocument => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<TiptapStoredDocument>;
  return candidate.format === 'tiptap-v1' && candidate.content?.type === 'doc';
};

// Early versions of the paired palette saved whichever theme was active into
// the light slot. Upgrade browser recovery drafts and existing JSON documents
// on read so the editor itself immediately uses the correct theme color.
const restorePairedInkColors = (node: JSONContent): JSONContent => ({
  ...node,
  ...(node.marks && {
    marks: node.marks.map((mark) => {
      if (mark.type !== 'ink') return mark;
      const attributes = { ...(mark.attrs ?? {}) };
      const foreground = !attributes.fgDark && findPairedPreset(attributes.fg as string | null, 'text');
      const background = !attributes.bgDark && findPairedPreset(attributes.bg as string | null, 'background');
      if (foreground) { attributes.fg = foreground.light; attributes.fgDark = foreground.dark; }
      if (background) { attributes.bg = background.light; attributes.bgDark = background.dark; }
      return { ...mark, attrs: attributes };
    }),
  }),
  ...(node.content && { content: node.content.map(restorePairedInkColors) }),
});

const readSession = (): EditorSession | null => {
  try {
    const value = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null') as Partial<EditorSession> | null;
    return value?.version === 1 && typeof value.path === 'string' && typeof value.saved === 'boolean' && isTiptapDocument(value.document)
      ? value as EditorSession : null;
  } catch { return null; }
};

const rememberSession = (path: string, frontmatter: string, content: JSONContent, baseUrl: string, saved: boolean) => {
  if (!path) return;
  try {
    const session: EditorSession = {
      version: 1,
      path,
      saved,
      document: { format: 'tiptap-v1', frontmatter, content: stripBaseFromTiptapImages(content, baseUrl) },
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    localStorage.setItem(LAST_FILE_KEY, path);
  } catch { /* Storage may be unavailable or full; disk save still works. */ }
};

async function readJson(dir: FileSystemDirectoryHandle, name: string): Promise<unknown | null> {
  try {
    const handle = await dir.getFileHandle(name);
    return JSON.parse(await (await handle.getFile()).text()) as unknown;
  } catch { return null; }
}

async function writeFile(handle: FileSystemFileHandle, content: string) {
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}

function Workspace({ baseUrl, images, documentRoutes }: { baseUrl: string; images: string[]; documentRoutes: Record<string, string> }) {
  const [recovery] = useState<EditorSession | null>(() => readSession());
  const [initialContent] = useState<JSONContent>(() => recovery
    ? addBaseToTiptapImages(restorePairedInkColors(recovery.document.content), baseUrl)
    : INITIAL_DOCUMENT);
  const [initialPath] = useState<string | undefined>(() => recovery?.path || localStorage.getItem(LAST_FILE_KEY) || undefined);
  const [file, setFile] = useState<EditorFile | null>(null);
  const [content, setContent] = useState<JSONContent>(initialContent);
  const [editorKey, setEditorKey] = useState(0);
  const [saved, setSaved] = useState(recovery?.saved ?? true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(recovery ? '已恢复上次编辑内容，正在重新连接文件…' : '从左侧打开文档，或直接试用编辑器');
  const [showTree, setShowTree] = useState(true);
  const [linkTargets, setLinkTargets] = useState<EditorLinkTarget[]>([]);
  const frontmatter = useRef(recovery?.document.frontmatter ?? '');
  const currentDocument = useRef<JSONContent>(initialContent);
  const currentPath = useRef(recovery?.path ?? initialPath ?? '');
  const recoveryRef = useRef(recovery);
  const savingRef = useRef(false);

  const openFile = async (node: OpenableFile) => {
    try {
      const base = node.name.replace(/\.mdx?$/, '');
      let migrated: TiptapStoredDocument;
      let source: string;
      let restoredDraft = false;
      const cached = recoveryRef.current;

      if (cached?.path === node.path && !cached.saved) {
        migrated = cached.document;
        source = '浏览器中恢复的未保存草稿';
        restoredDraft = true;
      } else {
        const tiptapJson = await readJson(node.dir, `${base}.tiptap.json`);
        if (isTiptapDocument(tiptapJson)) {
          migrated = tiptapJson;
          source = `${base}.tiptap.json`;
        } else {
          const markdown = await (await node.handle.getFile()).text();
          migrated = markdownToTiptap(markdown);
          source = `${node.name}（已直接导入 Tiptap，尚未落盘）`;
        }
      }

      const displayContent = addBaseToTiptapImages(restorePairedInkColors(migrated.content), baseUrl);
      recoveryRef.current = null;
      frontmatter.current = migrated.frontmatter;
      currentDocument.current = displayContent;
      currentPath.current = node.path;
      setContent(displayContent);
      setEditorKey((key) => key + 1);
      setFile({ ...node, id: node.id ?? node.path, base });
      setSaved(!restoredDraft);
      rememberSession(node.path, migrated.frontmatter, displayContent, baseUrl, !restoredDraft);
      setMessage(`已打开 ${node.name} · 源：${source}`);
    } catch (caught: unknown) {
      setMessage(`打开失败：${errorMessage(caught)}`);
    }
  };

  const save = useCallback(async () => {
    if (!file) { setMessage('先从左侧选择一个 Markdown 文件'); return; }
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const content = stripBaseFromTiptapImages(currentDocument.current, baseUrl);
      const document: TiptapStoredDocument = {
        format: 'tiptap-v1',
        frontmatter: frontmatter.current,
        content,
      };
      const markdown = tiptapDocToMarkdown(content, frontmatter.current);
      const jsonHandle = await file.dir.getFileHandle(`${file.base}.tiptap.json`, { create: true });
      // JSON 是无损编辑源，先写它；Markdown 导出失败时可以安全重试，不会丢编辑内容。
      await writeFile(jsonHandle, JSON.stringify(document, null, 2));
      rememberSession(file.path, frontmatter.current, currentDocument.current, baseUrl, true);
      await writeFile(file.handle, markdown);
      setSaved(true);
      setMessage(`已保存 ${file.base}.tiptap.json · 已自动导出 ${file.name}`);
    } catch (caught: unknown) {
      if (file) rememberSession(file.path, frontmatter.current, currentDocument.current, baseUrl, false);
      setSaved(false);
      setMessage(`保存失败：${errorMessage(caught)}`);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [baseUrl, file]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void save(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [save]);

  useEffect(() => {
    if (saved) return undefined;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      // Writing Markdown can make the Docusaurus dev server reload this page.
      // The JSON source and browser recovery snapshot are already persisted then.
      if (savingRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [saved]);

  const guardUnsaved = () => {
    if (saved) return true;
    setMessage(`「${file?.name ?? '当前文档'}」还有未保存的改动，请先保存`);
    return false;
  };
  const handleTreeChange = useCallback((tree: DirectoryNode | null) => {
    setLinkTargets(linkTargetsFromTree(tree, documentRoutes));
  }, [documentRoutes]);

  return (
    <div className={s.page}>
      <header className={s.appbar} data-chrome>
        <button type="button" className={s.tool} title="显示 / 隐藏资源管理器" data-on={showTree}
          onClick={() => setShowTree((visible) => !visible)}><Folder size={15} /></button>
        <span className={s.docName}>
          <b>{file?.name ?? '未打开文件'}</b>
          {file && <span className={s.docPath}>{file.path.replace(/\/[^/]+$/, '')}</span>}
          {!saved && <span className={s.dot} title="有未保存的改动" />}
        </span>
        <span className={s.spacer} />
        <span className={s.hint}>Tiptap 编辑器</span>
        <button type="button" className={`${s.tool} ${s.primary}`} disabled={saving} onClick={() => { void save(); }}><Save size={15} />{saving ? '保存中…' : '保存'}</button>
      </header>

      <div className={s.panes}>
        <FileTree collapsed={!showTree} current={file?.path} initialPath={initialPath} onOpen={openFile} onError={setMessage} onTreeChange={handleTreeChange} guard={guardUnsaved} sidecarSuffix=".tiptap.json" />
        <TiptapEditor key={editorKey} content={content} baseUrl={baseUrl} images={images} currentPath={file?.path} linkTargets={linkTargets} onChange={(document) => {
          currentDocument.current = document;
          setSaved((wasSaved) => wasSaved ? false : wasSaved);
          rememberSession(currentPath.current, frontmatter.current, document, baseUrl, false);
        }} />
      </div>

      <footer className={s.statusBar}>
        <span className={saved ? s.ok : s.dirty}>{saved ? '已保存' : '未保存'}</span>
        <span className={s.spacer} />
        <span className={s.msg}>{message}</span>
        <span className={s.hint}>选中文字显示格式栏 · 空行输入 / · ⌘S 保存</span>
      </footer>
    </div>
  );
}

export default function TiptapPage() {
  const { siteConfig } = useDocusaurusContext();
  const imageLibrary = usePluginData('midsoul-image-library') as ImageLibraryData;
  const docsData = usePluginData('docusaurus-plugin-content-docs') as DocsGlobalData;
  const documentRoutes = useMemo(() => Object.fromEntries((docsData.versions ?? []).flatMap((version) => version.docs ?? []).map((doc) => [doc.id, doc.path])), [docsData]);
  return <Layout noFooter title="可视化编辑器（Tiptap）" description="MidSoul Wiki Tiptap 可视化编辑器"><BrowserOnly>{() => <Workspace baseUrl={siteConfig.baseUrl} images={imageLibrary.images ?? []} documentRoutes={documentRoutes} />}</BrowserOnly></Layout>;
}
