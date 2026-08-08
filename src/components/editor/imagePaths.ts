import type { JSONContent } from '@tiptap/core';

const externalSource = /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i;

const basePath = (baseUrl: string) => {
  const normalized = `/${baseUrl || '/'}`.replace(/\/{2,}/g, '/');
  return normalized === '/' ? '' : normalized.replace(/\/$/, '');
};

/** Convert a persisted /img path into the URL used by the currently deployed editor. */
export const displayImageSource = (raw: string, baseUrl: string) => {
  const source = canonicalImageSource(raw);
  const base = basePath(baseUrl);
  if (!base || externalSource.test(source) || !source.startsWith('/') || source.startsWith(`${base}/`)) return source;
  return `${base}${source}`;
};

/** Keep persisted documents independent from the site's deployment base path. */
export const canonicalImageSource = (source: string) => {
  if (!source || externalSource.test(source)) return source;
  return source
    .replace(/^~\/static\//, '/')
    .replace(/^@site\/static\//, '/')
    .replace(/^\.?\/?static\//, '/')
    .replace(/^\.?\/?img\//, '/img/');
};

const mapImageSources = (node: JSONContent, transform: (source: string) => string): JSONContent => ({
  ...node,
  ...(node.type === 'image' && typeof node.attrs?.src === 'string'
    ? { attrs: { ...node.attrs, src: transform(node.attrs.src) } }
    : {}),
  ...(node.content ? { content: node.content.map((child) => mapImageSources(child, transform)) } : {}),
});

export const addBaseToTiptapImages = (document: JSONContent, baseUrl: string): JSONContent => {
  return mapImageSources(document, (raw) => displayImageSource(raw, baseUrl));
};

export const stripBaseFromTiptapImages = (document: JSONContent, baseUrl: string): JSONContent => {
  const base = basePath(baseUrl);
  return mapImageSources(document, (raw) => {
    const source = canonicalImageSource(raw);
    return base && source.startsWith(`${base}/`) ? source.slice(base.length) : source;
  });
};
