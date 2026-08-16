#!/usr/bin/env node
/**
 * 生成自托管的 Noto Serif SC 子集。
 *
 * 站点原先从 fonts.googleapis.com 加载 Noto Serif SC / Noto Sans SC。中文
 * 受众多半在国内，那个域名基本不可达，且 @import 写在 CSS 首行是阻塞渲染
 * 的。正文已回落系统字体栈（PingFang SC / 微软雅黑），标题衬线体是设计
 * 主特征，改成自托管子集。
 *
 * 子集范围取「全站正文出现过的全部汉字」而非「标题里出现过的」：标题是
 * 会变的，用整站词汇留余量，否则新标题里的生僻字会逐字回落系统宋体，同
 * 一行出现两种字形。
 *
 *   pnpm fonts
 *
 * 需要 uv（https://docs.astral.sh/uv/）——用它跑 fonttools，不污染系统
 * Python。源字体从 jsDelivr 拉，缓存在 .cache-fonts/（已 gitignore）。
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CACHE = path.join(ROOT, '.cache-fonts');
// 放在 src/css 下而不是 static/：@font-face 用相对 url() 交给打包器处理，
// 才能自动带上 baseUrl（/midsoul/）并加内容哈希。
const OUT = path.join(ROOT, 'src', 'css', 'fonts');
const CHARSET_MANIFEST = path.join(import.meta.dirname, 'font-charset.txt');
const SOURCE = 'https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main/Serif/SubsetOTF/SC';

// 400：h1/h2/h3、页脚标题、翻页标签、首页大标题。
// 700：Infima 的 --ifm-heading-font-weight，作用于 h4~h6 与博客标题。
// 600 全站没有任何规则用到，不生成。
const WEIGHTS = [
  { weight: 400, source: 'NotoSerifSC-Regular.otf' },
  { weight: 700, source: 'NotoSerifSC-Bold.otf' },
];

/** 标题可能用到的文字来源：文档与博客正文、以及配置里写死的中文串。 */
const CONTENT_GLOBS = [
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

function collectCharset() {
  const files = [
    ...CONTENT_GLOBS.flatMap(({ dir, match }) => walk(path.join(ROOT, dir), match)),
    ...CONTENT_FILES.map((f) => path.join(ROOT, f)),
  ];
  const chars = new Set();
  for (const file of files) {
    for (const char of fs.readFileSync(file, 'utf8')) if (CJK.test(char)) chars.add(char);
  }
  return [...chars].sort().join('');
}

function download(name) {
  const target = path.join(CACHE, name);
  if (fs.existsSync(target)) return target;
  fs.mkdirSync(CACHE, { recursive: true });
  console.log(`下载 ${name}（约 11MB，只需一次）…`);
  execFileSync('curl', ['-sfL', '--max-time', '300', `${SOURCE}/${name}`, '-o', target]);
  return target;
}

const charset = collectCharset();
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(CACHE, { recursive: true });
// CI 用这份清单比对：仓库里出现了子集外的字就提示重新生成，不必解析字体。
fs.writeFileSync(CHARSET_MANIFEST, charset);
const charsetFile = path.join(CACHE, 'charset.txt');
fs.writeFileSync(charsetFile, charset);
console.log(`字符集：${charset.length} 个中日韩字符 + 拉丁基本区`);

for (const { weight, source } of WEIGHTS) {
  const input = download(source);
  const output = path.join(OUT, `NotoSerifSC-${weight}.woff2`);
  execFileSync('uvx', [
    '--quiet', '--from', 'fonttools[woff]', 'pyftsubset', input,
    `--output-file=${output}`,
    '--flavor=woff2',
    `--text-file=${charsetFile}`,
    // 拉丁基本区 + 常用符号：标题里混排英文与数字。
    '--unicodes=U+0020-007E,U+00A0-00FF,U+2010-2027,U+2030-205E',
    '--no-hinting',
    '--desubroutinize',
    '--drop-tables+=DSIG',
  ], { stdio: 'inherit' });
  const size = fs.statSync(output).size;
  console.log(`✓ NotoSerifSC-${weight}.woff2  ${(size / 1024).toFixed(1)} KB`);
}
