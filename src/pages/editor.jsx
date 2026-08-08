import React, { useState, useRef, useEffect, useCallback } from 'react';
import Layout from '@theme/Layout';
import BrowserOnly from '@docusaurus/BrowserOnly';
import { useColorMode } from '@docusaurus/theme-common';
import useBaseUrl from '@docusaurus/useBaseUrl';
import Block from '@site/src/components/editor1/Block';
import SelectionToolbar from '@site/src/components/editor1/SelectionToolbar';
import Toolbar, { CONVERT, INSERT } from '@site/src/components/editor1/Toolbar';
import { Icon, Menu, MenuItem, MenuGroup } from '@site/src/components/editor1/ui';
import { parseDoc, serializeDoc, mkBlock, classify } from '@site/src/components/editor1/blocks';
import s from '@site/src/components/editor1/editor.module.css';
import FileTree from '@site/src/components/editorWorkspace/FileTree';
import { pick } from '@site/src/components/editorWorkspace/pick';

const DRAFT = 'midsoul-editor-draft';
const DRAG = 'application/x-msw-block'; // 块排序专用的拖放类型，避免和文字拖放混淆

const SAMPLE = `---
sidebar_position: 1
---

# 新文档

正文直接改；选中文字出格式条，空行敲 \`/\` 唤出插入菜单，工具栏作用于当前块。

| 名称 | 说明 |
| :--- | :--- |
| 示例 | 点表格进网格编辑 |
`;

// frontmatter 里最常改的三项，其余行原样保留
const FM_FIELDS = [
  ['sidebar_position', '位置', 'number'],
  ['title', '标题', 'text'],
  ['description', '描述', 'text'],
];

const BLOCK_NAME = {
  heading: '标题', para: '正文', list: '列表', quote: '引用',
  code: '代码块', table: '表格', admonition: '提示框', divider: '分割线', raw: 'MDX',
};

const readFm = (fm, key) => fm.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'))?.[1]?.trim() ?? '';

function writeFm(fm, key, value) {
  const line = `${key}: ${value}`;
  if (!fm) return value ? `---\n${line}\n---\n` : '';
  if (readFm(fm, key)) {
    return value
      ? fm.replace(new RegExp(`^${key}:.*$`, 'm'), line)
      : fm.replace(new RegExp(`^${key}:.*\\n`, 'm'), '');
  }
  return value ? fm.replace(/\n---/, `\n${line}\n---`) : fm;
}

function Editor() {
  const { colorMode } = useColorMode();
  const isDark = colorMode === 'dark';
  const newEditorUrl = useBaseUrl('/editor3');
  const [doc, setDoc] = useState(() => parseDoc(localStorage.getItem(DRAFT) ?? SAMPLE));
  const [file, setFile] = useState(null); // { name, path, handle }
  const [saved, setSaved] = useState(true);
  const [focusId, setFocusId] = useState(null);
  const [menuFor, setMenuFor] = useState(null); // 打开插入菜单的块 id
  const [source, setSource] = useState(null); // 源码模式：整篇 Markdown 文本
  const [showFm, setShowFm] = useState(false);
  const [showTree, setShowTree] = useState(true);
  const [dropAt, setDropAt] = useState(null);
  const [msg, setMsg] = useState('');
  const canvas = useRef(null);

  // 工具栏点击发生在块 blur 之后，闭包里的 doc 可能是旧的 —— 统一从 ref 取最新
  const live = useRef(doc);
  live.current = doc;

  const text = serializeDoc(doc);
  useEffect(() => { localStorage.setItem(DRAFT, text); }, [text]);
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(''), 4000); return () => clearTimeout(t); }, [msg]);

  const edit = (blocks) => { setDoc({ ...live.current, blocks }); setSaved(false); };
  const idx = (id) => live.current.blocks.findIndex((b) => b.id === id);
  const currentId = () => (idx(focusId) >= 0 ? focusId : live.current.blocks.at(-1).id);
  const currentBlock = () => live.current.blocks[idx(currentId())];

  const updateBlock = (b) => edit(live.current.blocks.map((x) => (x.id === b.id ? b : x)));

  const insertAfter = (id, src = '', type) => {
    const b = mkBlock(type ?? classify(src), src);
    const at = idx(id) + 1;
    edit([...live.current.blocks.slice(0, at), b, ...live.current.blocks.slice(at)]);
    setFocusId(b.id);
    return b;
  };

  const removeBlock = (id) => {
    const at = idx(id);
    const { blocks } = live.current;
    if (blocks.length === 1) return;
    edit(blocks.filter((b) => b.id !== id));
    setFocusId(blocks[Math.max(0, at - 1)].id);
  };

  const move = (from, to) => {
    const blocks = live.current.blocks.slice();
    blocks.splice(to, 0, ...blocks.splice(from, 1));
    edit(blocks);
  };

  const plainOf = (b) => b.src.replace(/^(#{1,6}\s+|[-*+]\s+|\d+[.)]\s+|>\s?)/, '');

  // 转换当前块（标题 / 引用 / 列表 / 正文）
  const convert = (make, id = currentId()) => {
    const b = live.current.blocks[idx(id)];
    if (!b) return;
    const src = make(b.src.trim() === '/' ? '' : plainOf(b));
    updateBlock({ ...b, type: classify(src), src });
    setMenuFor(null);
    setFocusId(b.id);
  };

  // 插入新块；当前块是空的就直接变成它
  const insert = (make, id = currentId()) => {
    const b = live.current.blocks[idx(id)];
    setMenuFor(null);
    if (b && !b.src.replace('/', '').trim()) return convert(make, id);
    insertAfter(id, make(''));
  };

  // ── 文件 ──────────────────────────────────────────
  const openFile = async (node) => {
    const f = await node.handle.getFile();
    setDoc(parseDoc(await f.text()));
    setFile(node);
    setSaved(true);
    setSource(null);
  };

  const openSingle = async () => {
    if (!window.showOpenFilePicker) {
      const input = Object.assign(document.createElement('input'), { type: 'file', accept: '.md,.mdx' });
      input.onchange = async () => { setDoc(parseDoc(await input.files[0].text())); setSaved(true); };
      return input.click();
    }
    const picked = await pick(() => window.showOpenFilePicker({
      types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md', '.mdx'] } }],
    }));
    if (picked) await openFile({ name: picked[0].name, path: picked[0].name, handle: picked[0] });
  };

  const save = useCallback(async () => {
    try {
      let handle = file?.handle;
      if (!handle) {
        if (!window.showSaveFilePicker) {
          const a = Object.assign(document.createElement('a'), {
            href: URL.createObjectURL(new Blob([text], { type: 'text/markdown' })),
            download: 'document.md',
          });
          return a.click();
        }
        handle = await pick(() => window.showSaveFilePicker({ suggestedName: 'document.md' }));
        if (!handle) return;
        setFile({ name: handle.name, path: handle.name, handle });
      }
      const w = await handle.createWritable();
      await w.write(text);
      await w.close();
      setSaved(true);
      setMsg(`已写入 ${file?.name ?? handle.name}`);
    } catch (e) {
      setMsg(`保存失败：${e.message}`);
    }
  }, [file, text]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save(); }
      if (e.key === 'Escape') setMenuFor(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  // 有未保存的改动时不切换文件，也不让页面悄悄卸载
  const guardUnsaved = () => {
    if (saved) return true;
    setMsg(`「${file?.name ?? '当前文档'}」还有未保存的改动，先按 ⌘S 保存`);
    return false;
  };

  useEffect(() => {
    if (saved) return undefined;
    const beforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [saved]);

  const toggleSource = () => {
    if (source == null) return setSource(text);
    setDoc(parseDoc(source));
    setSource(null);
    setSaved(false);
  };

  // 没在编辑任何块时不假装当前样式是什么
  const styleName = focusId ? (BLOCK_NAME[currentBlock()?.type] ?? '正文') : '段落样式';

  return (
    <div className={s.page}>
      {/* 应用栏：这个文件是谁、拿它做什么 */}
      <div className={s.appbar} data-chrome>
        <button className={s.tool} title="显示 / 隐藏资源管理器" data-on={showTree}
          onClick={() => setShowTree(!showTree)}>
          <Icon name="folder" />
        </button>
        <span className={s.docName}>
          <b>{file?.name ?? '未命名文档'}</b>
          {file && <span className={s.docPath}>{file.path.replace(/\/[^/]+$/, '')}</span>}
          {!saved && <span className={s.dot} title="有未保存的改动" />}
        </span>
        <span className={s.spacer} />
        <a className={s.tool} href={newEditorUrl} title="Tiptap 新编辑器：结构化 JSON 为源，Markdown 为导出产物">
          使用新版编辑器
        </a>
        <button className={s.tool} onClick={openSingle}>打开文件</button>
        <button className={s.tool} onClick={() => navigator.clipboard.writeText(text)} title="复制整篇 Markdown">
          <Icon name="copy" />
        </button>
        <button className={s.tool} data-on={showFm} onClick={() => setShowFm(!showFm)} title="文档信息">
          <Icon name="info" />
        </button>
        <button className={s.tool} data-on={source != null} onClick={toggleSource} title="查看 Markdown 源码">
          <Icon name="code" />
        </button>
        <button className={`${s.tool} ${s.primary}`} onClick={save}>
          <Icon name="save" />保存
        </button>
      </div>

      {/* 编辑栏：这段内容怎么排 */}
      {source == null && (
        <Toolbar isDark={isDark} onConvert={convert} onInsert={insert} currentLabel={styleName} />
      )}

      {showFm && (
        <div className={s.fmBar} data-chrome>
          {FM_FIELDS.map(([key, label, type]) => (
            <label key={key} className={s.fmField}>
              {label}
              <input
                type={type}
                value={readFm(doc.frontmatter, key)}
                placeholder={key}
                onChange={(e) => {
                  setDoc({ ...live.current, frontmatter: writeFm(live.current.frontmatter, key, e.target.value) });
                  setSaved(false);
                }}
              />
            </label>
          ))}
          <span className={s.hint}>其余 frontmatter 字段在源码里改，不会被动到</span>
        </div>
      )}

      <div className={s.panes}>
        <FileTree
          collapsed={!showTree}
          current={file?.path}
          onOpen={openFile}
          onError={setMsg}
          guard={guardUnsaved}
        />

        {source != null ? (
          <textarea className={s.source} value={source} spellCheck={false}
            onChange={(e) => setSource(e.target.value)} />
        ) : (
          <div className={s.canvasWrap}>
            <div className={`${s.canvas} markdown`} ref={canvas}>
              {doc.blocks.map((b, i) => (
                <div
                  key={b.id}
                  className={s.row}
                  onDragOver={(e) => {
                    if (!e.dataTransfer.types.includes(DRAG)) return;
                    e.preventDefault();
                    setDropAt(i);
                  }}
                  onDragLeave={() => setDropAt((p) => (p === i ? null : p))}
                  onDrop={(e) => {
                    // 只认把手拖出来的块序号；拖动选中文字用的是 text/plain，不能当成排序
                    const from = e.dataTransfer.getData(DRAG);
                    setDropAt(null);
                    if (!from) return;
                    e.preventDefault();
                    move(+from, i);
                  }}
                >
                  {dropAt === i && <span className={s.dropLine} />}

                  {/* 把手只留两件事：插入、拖动。删除放进菜单，免得挨着光标误点 */}
                  <div className={s.handle}>
                    <Menu
                      open={menuFor === b.id}
                      onOpenChange={(o) => setMenuFor(o ? b.id : null)}
                      trigger={<button className={s.handleBtn} title="插入 / 转换">＋</button>}
                    >
                      <MenuGroup>转换为</MenuGroup>
                      {CONVERT.map((item) => (
                        <MenuItem key={item.label} icon={item.icon}
                          preview={item.preview && s[item.preview]}
                          onClick={() => convert(item.make, b.id)}>
                          {item.label}
                        </MenuItem>
                      ))}
                      <MenuGroup>插入</MenuGroup>
                      {INSERT.map((item) => (
                        <MenuItem key={item.label} icon={item.icon}
                          onClick={() => insert(item.make, b.id)}>
                          {item.label}
                        </MenuItem>
                      ))}
                      <MenuGroup>这一块</MenuGroup>
                      <MenuItem icon="trash" onClick={() => removeBlock(b.id)}>删除</MenuItem>
                    </Menu>
                    <span className={`${s.handleBtn} ${s.grip}`} title="拖动排序"
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData(DRAG, String(i))}>⠿</span>
                  </div>

                  <div className={s.blockBody}>
                    <Block
                      block={b}
                      focus={focusId === b.id}
                      onFocus={() => setFocusId(b.id)}
                      onChange={updateBlock}
                      onEnter={() => insertAfter(b.id, '')}
                      onBackspace={() => removeBlock(b.id)}
                      onSlash={() => setMenuFor(b.id)}
                    />
                  </div>
                </div>
              ))}
              <div className={s.tail} onClick={() => insertAfter(doc.blocks.at(-1).id, '')}>
                点这里继续写…
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={s.statusBar}>
        <span className={saved ? s.ok : s.dirty}>{saved ? '已保存' : '未保存'}</span>
        <span>{doc.blocks.length} 块</span>
        <span>{text.replace(/\s/g, '').length} 字</span>
        <span className={s.spacer} />
        {msg && <span className={s.msg}>{msg}</span>}
        <span className={s.hint}>⌘S 保存 · 拖 ⠿ 排序</span>
      </div>

      <SelectionToolbar containerRef={canvas} />
    </div>
  );
}

export default function EditorPage() {
  return (
    <Layout noFooter title="可视化编辑器（旧版）" description="MidSoul Wiki 旧版 Markdown 可视化编辑器；新版请使用 editor3">
      <BrowserOnly>{() => <Editor />}</BrowserOnly>
    </Layout>
  );
}
