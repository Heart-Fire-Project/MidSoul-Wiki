import React, { useRef, useEffect } from 'react';
import Admonition from '@theme/Admonition';
import { useColorMode } from '@docusaurus/theme-common';
import MdxPreview from './MdxPreview';
import TableGrid from './TableGrid';
import { mdToHtml, escapeHtml } from './inlineHtml';
import { findTables, serialize } from './tableIO';
import {
  blockToMd, headingLevel, stripPrefix, listItems, isOrdered, admonitionParts,
} from './blocks';
import s from './editor.module.css';

// 光标挪到元素末尾
export function caretToEnd(el) {
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

/*
  一个块 = 一段可直接编辑的真实渲染内容。
  内容用 dangerouslySetInnerHTML 交给浏览器：打字和 execCommand 改的是原生 DOM，
  React 不参与 diff（否则光标乱跳、还会 removeChild 崩溃）。失焦时再读回 Markdown。
*/
export default function Block({ block, focus, onChange, onEnter, onBackspace, onFocus, onSlash }) {
  const wrap = useRef(null);
  const { colorMode } = useColorMode();
  const isDark = colorMode === 'dark';
  const html = (md) => ({ __html: mdToHtml(md, isDark) });
  const editableEl = () => wrap.current?.querySelector('[contenteditable=true]');

  useEffect(() => { if (focus) { const el = editableEl(); if (el) caretToEnd(el); } }, [focus]);

  const commit = () => {
    const el = editableEl();
    if (!el) return;
    const md = blockToMd(block.type, el, block.src);
    if (md !== block.src) onChange({ ...block, src: md });
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !['list', 'code'].includes(block.type)) {
      e.preventDefault();
      commit();
      onEnter();
    }
    if (e.key === 'Backspace' && !e.currentTarget.innerText.trim()) {
      e.preventDefault();
      onBackspace();
    }
    if (e.key === '/' && !e.currentTarget.innerText.trim()) onSlash?.(); // 空块敲 / 唤出插入菜单
  };

  const ed = (md) => ({
    className: s.block,
    contentEditable: true,
    suppressContentEditableWarning: true,
    spellCheck: false,
    onBlur: commit,
    onFocus,
    onKeyDown,
    dangerouslySetInnerHTML: html(md),
  });

  const body = () => {
    switch (block.type) {
      case 'heading': {
        const H = `h${headingLevel(block.src)}`;
        return <H {...ed(stripPrefix(block.src, 'heading'))} />;
      }

      case 'quote':
        return <blockquote {...ed(stripPrefix(block.src, 'quote'))} />;

      case 'list': {
        const L = isOrdered(block.src) ? 'ol' : 'ul';
        const items = listItems(block.src).map((t) => `<li>${mdToHtml(t, isDark)}</li>`).join('');
        return <L {...ed('')} dangerouslySetInnerHTML={{ __html: items }} />;
      }

      case 'code': {
        const text = block.src.split('\n').slice(1, -1).join('\n');
        return (
          <pre className={s.codeBlock}>
            <code {...ed('')} dangerouslySetInnerHTML={{ __html: escapeHtml(text) }} />
          </pre>
        );
      }

      case 'admonition': {
        const { type, title, body: text } = admonitionParts(block.src);
        return (
          <Admonition type={type} title={title || undefined}>
            <div {...ed(text)} />
          </Admonition>
        );
      }

      case 'table': {
        const grid = findTables(block.src)[0]?.grid;
        return grid
          ? <TableGrid inline grid={grid} onSave={(g) => onChange({ ...block, src: serialize(g) })} />
          : <MdxPreview source={block.src} />;
      }

      case 'divider':
        return <hr />;

      // 未知 MDX：用站点组件原样渲染，下方源码框兜底，绝不擅自改写
      case 'raw':
        return (
          <div className={s.rawBlock}>
            <span className={s.rawTag}>MDX 原样保留</span>
            <MdxPreview source={block.src} />
            <textarea
              className={s.rawSource}
              defaultValue={block.src}
              spellCheck={false}
              onFocus={onFocus}
              onBlur={(e) => e.target.value !== block.src && onChange({ ...block, src: e.target.value })}
            />
          </div>
        );

      default:
        return <p {...ed(block.src)} />;
    }
  };

  return <div ref={wrap} className={s.blockWrap} onMouseDown={onFocus}>{body()}</div>;
}
