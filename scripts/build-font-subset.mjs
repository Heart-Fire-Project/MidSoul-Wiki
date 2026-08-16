#!/usr/bin/env node
/**
 * 生成自托管的 Noto Serif SC 子集。
 *
 * 站点原先从 fonts.googleapis.com 加载 Noto Serif SC / Noto Sans SC。中文
 * 受众多半在国内，那个域名基本不可达，且 @import 写在 CSS 首行是阻塞渲染
 * 的。正文已回落系统字体栈（PingFang SC / 微软雅黑），标题衬线体是设计
 * 主特征，改成自托管子集。
 *
 *   pnpm fonts
 *
 * 需要 uv（https://docs.astral.sh/uv/）——用它跑 fonttools，不污染系统
 * Python。源字体从 jsDelivr 拉，缓存在 .cache-fonts/（已 gitignore）。
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, CHARSET_MANIFEST, collectCharset } from './charset.mjs';

const CACHE = path.join(ROOT, '.cache-fonts');
// 放在 src/css 下而不是 static/：@font-face 用相对 url() 交给打包器处理，
// 才能自动带上 baseUrl（/midsoul/）并加内容哈希。
const OUT = path.join(ROOT, 'src', 'css', 'fonts');
const SOURCE = 'https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main/Serif/SubsetOTF/SC';

// 400：h1/h2/h3、页脚标题、翻页标签、首页大标题。
// 700：Infima 的 --ifm-heading-font-weight，作用于 h4~h6 与博客标题。
// 600 全站没有任何规则用到，不生成。
const WEIGHTS = [
  { weight: 400, source: 'NotoSerifSC-Regular.otf' },
  { weight: 700, source: 'NotoSerifSC-Bold.otf' },
];

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
  console.log(`✓ NotoSerifSC-${weight}.woff2  ${(fs.statSync(output).size / 1024).toFixed(1)} KB`);
}
