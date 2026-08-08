import React, { useEffect, useState, type ComponentType, type MouseEventHandler } from 'react';
import * as runtime from 'react/jsx-runtime';
import MDXComponents from '@theme/MDXComponents';
import Admonition from '@theme/Admonition';
import s from './editor.module.css';

// 用站点自己的 MDX 组件求值，保证编辑器预览与文档页复用同一套渲染代码。
export const stripFrontmatter = (source: string) => source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');

const ADMONITION = /^:::(\w+)[ \t]*(.*)\r?\n([\s\S]*?)^:::[ \t]*$/gm;
const prepare = (source: string) => stripFrontmatter(source).replace(ADMONITION, (_, type: string, title: string, body: string) =>
  `<Admonition type="${type}"${title ? ` title="${title.trim()}"` : ''}>\n\n${body}\n</Admonition>`
);

type MdxContent = ComponentType<{ components?: Record<string, unknown> }>;
export type MdxPreviewProps = { source: string; onClick?: MouseEventHandler<HTMLDivElement>; className?: string };

export default function MdxPreview({ source, onClick, className = '' }: MdxPreviewProps) {
  const [Content, setContent] = useState<MdxContent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stale = false;
    const timer = window.setTimeout(async () => {
      try {
        const [{ evaluate }, { default: remarkGfm }] = await Promise.all([import('@mdx-js/mdx'), import('remark-gfm')]);
        const mod = await evaluate(prepare(source), { ...runtime, remarkPlugins: [remarkGfm], baseUrl: 'https://localhost/' });
        if (stale) return;
        setContent(() => mod.default as MdxContent);
        setError(null);
      } catch (caught) {
        if (!stale) setError(caught instanceof Error ? caught.message : String(caught));
      }
    }, 250);
    return () => { stale = true; window.clearTimeout(timer); };
  }, [source]);

  return (
    <div className={`${className} markdown`} onClick={onClick}>
      {error && <p className={s.error}>⚠ {error}</p>}
      {Content && <Content components={{ ...MDXComponents, Admonition } as Record<string, unknown>} />}
    </div>
  );
}
