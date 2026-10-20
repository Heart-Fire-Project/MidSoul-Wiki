#!/usr/bin/env node
/**
 * 从主仓库的 GitHub Release 自动生成 blog 更新日志。
 *
 *   MAIN_REPO=Heart-Fire-Project/MidSoul node scripts/sync-releases.mjs [--dry-run]
 *
 * 设计要点：
 * - 幂等：按「版本号」判断是否已存在（`blog/*-v2-1.md`），日期不同也算已同步，
 *   因此可以反复跑，也能一次性补齐历史发版。
 * - 无跨仓库授权：只读主仓库的公开 Releases API（可用 GITHUB_TOKEN 提升限额），
 *   写回本仓库由 workflow 的 GITHUB_TOKEN 负责。
 * - tag 推断见 TAGS 与 inferTags()：小节标题是强信号，条目关键词做细化。
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './charset.mjs';

const MAIN_REPO = process.env.MAIN_REPO ?? 'Heart-Fire-Project/MidSoul';
const BLOG_AUTHORS = (process.env.BLOG_AUTHORS ?? 'hfp,roser').split(',').map((name) => name.trim()).filter(Boolean);
const INCLUDE_PRERELEASE = process.env.INCLUDE_PRERELEASE === '1';
const DRY_RUN = process.argv.includes('--dry-run');
const BLOG_DIR = path.join(ROOT, 'blog');
const API = 'https://api.github.com';

/**
 * 小节标题 → tag。命中的标题整节都算该 tag。
 * 键是「二级小节标题」的包含匹配（如「平衡」命中「平衡调整」）。
 */
const SECTION_TAGS = [
  { match: /平衡/, tag: 'balance' },
  { match: /修复|修正/, tag: 'bugfix' },
  { match: /优化|体验/, tag: 'improvement' },
  { match: /地图/, tag: 'map' },
  { match: /新功能|功能|内容/, tag: 'feature' },
];

/**
 * 条目关键词 → tag（用于小节标题不足以判断、或细化「内容」小节）。
 * 顺序即优先级无关，最终取并集。
 */
const KEYWORD_TAGS = [
  { match: /新增[^。\n]*地图|地图[^。\n]*新增/, tag: 'map' },
  { match: /新增[^。\n]*(?:能力|天赋|技能|宝物)/, tag: 'ability' },
  { match: /修复|修正/, tag: 'bugfix' },
  { match: /优化|流畅|性能/, tag: 'improvement' },
  { match: /平衡|数值|倍率|概率/, tag: 'balance' },
  { match: /新增/, tag: 'feature' },
];

/** 按小节 + 条目关键词推断 tags，顺序遵循 tags.yml 的稳定顺序便于 diff。 */
function inferTags(body) {
  const found = new Set();
  const lines = body.split(/\r?\n/);
  let section = '';
  for (const line of lines) {
    const heading = line.match(/^#{2,4}\s*(.+?)\s*$/);
    if (heading) {
      section = heading[1];
      for (const rule of SECTION_TAGS) if (rule.match.test(section)) found.add(rule.tag);
      continue;
    }
    const item = line.trim();
    if (!item || !/^[-*]/.test(item)) continue;
    for (const rule of KEYWORD_TAGS) {
      if (!rule.match.test(item)) continue;
      // 「内容」小节的条目按关键词细化（地图/能力），其他小节已经由标题定性
      if (/内容|新功能|功能/.test(section) || !SECTION_TAGS.some((rule2) => rule2.match.test(section))) {
        found.add(rule.tag);
      }
    }
  }
  const order = ['balance', 'feature', 'bugfix', 'map', 'ability', 'improvement'];
  return order.filter((tag) => found.has(tag));
}

/** tag 名（如 v2.1.1）→ 文件名 slug（v2-1-1）。 */
function versionSlug(version) {
  return `v${version.replace(/^v/i, '').replace(/\./g, '-')}`;
}

/** 从 tag_name 解析版本号：支持 v2.1 / 2.1 / v2.1.1 / v2.1-beta。 */
function parseVersion(tagName) {
  const match = String(tagName).match(/^v?(\d+(?:\.\d+)*)(?:[-+](.+))?$/i);
  if (!match) return null;
  // 规范化：只去掉末尾一个 .0，让 v2.1.0 → v2.1、v2.0.0 → v2.0，
  // 与手写的文件名（v2-1 / v2-0）保持同一版本
  const version = match[1].replace(/\.0$/, '') || match[1];
  return { version, suffix: match[2] ?? null };
}

/** release 正文 → blog 正文：去掉自带的一级/二级标题，避免与生成的标题重复。 */
function normalizeBody(body) {
  return String(body ?? '')
    .replace(/^\s*#\s+.*(?:\r?\n)+/, '')
    .replace(/^\s*##\s+.*(?:\r?\n)+/, '')
    .trim();
}

function renderPost(release, version, tags) {
  const published = release.published_at ?? release.created_at;
  const date = published ? new Date(published).toISOString() : new Date().toISOString();
  const title = `v${version}`;
  const body = normalizeBody(release.body);
  return [
    '---',
    `title: ${title}`,
    `date: ${date}`,
    `authors: [${BLOG_AUTHORS.join(', ')}]`,
    `tags: [${tags.join(', ')}]`,
    '---',
    '',
    `## 午夜灵魂更新日志 » ${version}`,
    '',
    '{/* truncate */}',
    '',
    body,
    '',
  ].join('\n');
}

async function fetchReleases() {
  const headers = { Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const releases = [];
  for (let page = 1; page <= 10; page += 1) {
    const response = await fetch(`${API}/repos/${MAIN_REPO}/releases?per_page=100&page=${page}`, { headers });
    if (!response.ok) {
      throw new Error(`拉取 ${MAIN_REPO} 的 Release 失败：HTTP ${response.status} ${await response.text().catch(() => '')}`);
    }
    const batch = await response.json();
    releases.push(...batch);
    if (batch.length < 100) break;
  }
  return releases;
}

function existingVersions() {
  const exact = new Set();
  const prefixes = [];
  for (const name of fs.readdirSync(BLOG_DIR)) {
    const match = name.match(/^.*-(v[\d-x]+)\.md$/);
    if (!match) continue;
    const slug = match[1];
    // v1-0-x 这种「范围版本」文件视为覆盖该系列：v1-0-1 也跳过
    if (slug.endsWith('-x')) prefixes.push(slug.slice(0, -1));
    else exact.add(slug);
  }
  return { exact, prefixes };
}

async function main() {
  const releases = await fetchReleases();
  const existing = existingVersions();
  const created = [];

  for (const release of releases) {
    if (release.draft) continue;
    if (release.prerelease && !INCLUDE_PRERELEASE) continue;
    const parsed = parseVersion(release.tag_name);
    if (!parsed || parsed.suffix) continue; // 跳过 v2.1-beta 之类
    const slug = versionSlug(parsed.version);
    if (existing.exact.has(slug) || existing.prefixes.some((prefix) => slug.startsWith(prefix))) continue;

    const tags = inferTags(release.body ?? '');
    const date = new Date(release.published_at ?? release.created_at).toISOString().slice(0, 10);
    const fileName = `${date}-${slug}.md`;
    const content = renderPost(release, parsed.version, tags);
    created.push({ fileName, tags, version: parsed.version });
    if (!DRY_RUN) fs.writeFileSync(path.join(BLOG_DIR, fileName), content, 'utf8');
  }

  if (created.length === 0) {
    console.log('没有需要同步的发版');
    return;
  }
  console.log(`${DRY_RUN ? '[dry-run] 将生成' : '已生成'} ${created.length} 篇：`);
  for (const item of created) {
    console.log(`  ${item.fileName}  tags=[${item.tags.join(', ')}]`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
