#!/usr/bin/env node
/**
 * 资源护栏，CI 里跑。
 *
 * 1. static/img 单文件不得超过 MAX_IMAGE_BYTES。站点曾经因为一张 2400×741
 *    的 logo（860KB，实际只渲染 104×32）和 6 张未压缩的地图 PNG（合计
 *    8.3MB）而首屏极重。压完之后需要一道闸，否则下次有人直接拖张原图进来
 *    就白做了。
 * 2. 仓库用字必须落在 scripts/font-charset.txt 之内。超出的字在标题里会
 *    逐字回落系统宋体，同一行出现两种字形——提示跑 `pnpm fonts` 重生成。
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, CHARSET_MANIFEST, collectCharset } from './charset.mjs';

const MAX_IMAGE_BYTES = 500 * 1024;
const IMAGE_DIR = path.join(ROOT, 'static', 'img');
const IMAGE_FILE = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i;

const problems = [];

function checkImages(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { checkImages(full); continue; }
    if (!IMAGE_FILE.test(entry.name)) continue;
    const size = fs.statSync(full).size;
    if (size > MAX_IMAGE_BYTES) {
      problems.push(
        `图片过大：${path.relative(ROOT, full)} 为 ${(size / 1024).toFixed(0)}KB，` +
        `上限 ${MAX_IMAGE_BYTES / 1024}KB。请压缩后再提交（截图类内容建议 cwebp -q 82）。`,
      );
    }
  }
}

function checkCharset() {
  if (!fs.existsSync(CHARSET_MANIFEST)) {
    problems.push('缺少 scripts/font-charset.txt，请运行 `pnpm fonts` 生成。');
    return;
  }
  const covered = new Set(fs.readFileSync(CHARSET_MANIFEST, 'utf8'));
  const missing = [...collectCharset()].filter((char) => !covered.has(char));
  if (missing.length > 0) {
    problems.push(
      `字体子集缺少 ${missing.length} 个字：${missing.slice(0, 30).join('')}` +
      `${missing.length > 30 ? '…' : ''}\n  这些字出现在标题里时会回落系统宋体。请运行 \`pnpm fonts\` 重新生成子集。`,
    );
  }
}

checkImages(IMAGE_DIR);
checkCharset();

if (problems.length > 0) {
  console.error('资源检查未通过：\n');
  for (const problem of problems) console.error(`  ✗ ${problem}\n`);
  process.exit(1);
}
console.log('✓ 资源检查通过');
