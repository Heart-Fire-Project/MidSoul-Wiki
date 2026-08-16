import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '..');
export const CHARSET_MANIFEST = path.join(import.meta.dirname, 'font-charset.txt');

/** 标题可能用到的文字来源：文档与博客正文，以及配置和首页里写死的中文串。 */
const CONTENT_DIRS = [
  { dir: 'docs', match: /\.mdx?$/ },
  { dir: 'blog', match: /\.mdx?$/ },
  { dir: 'src/pages', match: /\.tsx$/ },
];
const CONTENT_FILES = ['docusaurus.config.ts'];

const CJK = /[　-〿㐀-䶿一-鿿＀-￯]/;

function walk(dir, match, found = []) {
  if (!fs.existsSync(dir)) return found;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, match, found);
    else if (match.test(entry.name)) found.push(full);
  }
  return found;
}

/**
 * 全站出现过的中日韩字符，排序去重。
 *
 * 取整站用字而不是只取标题用字：标题是会变的，用整站词汇留余量，否则新
 * 标题里的字一旦落在子集外，就会逐字回落系统宋体，同一行出现两种字形。
 */
export function collectCharset() {
  const files = [
    ...CONTENT_DIRS.flatMap(({ dir, match }) => walk(path.join(ROOT, dir), match)),
    ...CONTENT_FILES.map((file) => path.join(ROOT, file)),
  ];
  const chars = new Set();
  for (const file of files) {
    for (const char of fs.readFileSync(file, 'utf8')) if (CJK.test(char)) chars.add(char);
  }
  return [...chars].sort().join('');
}
