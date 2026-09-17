#!/usr/bin/env node
/**
 * 图片体积护栏，CI 的 verify job 专用。
 *
 * 与 check-assets.mjs 的区别：这里不检查字体子集覆盖——文档出现子集未
 * 覆盖的新字时，macOS 的 fonts job 会自动重新生成并提交，verify 不应
 * 因此拦红。（本地的完整护栏是 `pnpm check:assets`。）
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './charset.mjs';

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

checkImages(IMAGE_DIR);

if (problems.length > 0) {
  console.error('资源检查未通过：\n');
  for (const problem of problems) console.error(`  ✗ ${problem}\n`);
  process.exit(1);
}
console.log('✓ 图片体积检查通过');
