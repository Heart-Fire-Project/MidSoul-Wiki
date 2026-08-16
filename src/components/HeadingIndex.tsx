import React from 'react';
import Link from '@docusaurus/Link';
import styles from './HeadingIndex.module.css';

export type TOCItem = { readonly value: string; readonly id: string; readonly level: number };

/** 少于这个数就不铺索引：右侧 TOC 已经够用，再加一排只是噪音。 */
const MIN_ENTRIES = 6;

/** 只考虑 h2~h4，与 themeConfig.tableOfContents 的范围一致。 */
const MIN_LEVEL = 2;
const MAX_LEVEL = 4;

/**
 * 挑出「条目最多的那一层级」作为索引层。
 *
 * 各页的结构差别很大：能力一览是 4 个 h2 / 4 个 h3 / 32 个 h4（每个能力
 * 一个 h4），回响记录则是 10 个 h2 平铺。固定取某一层都会漏，取最深层也
 * 不对——全局机制的 h4 只有 4 条，远不如它的 10 条 h3 有用。数量最多的
 * 那层恰好就是这一页的「条目」所在。
 */
export function indexEntries(toc: readonly TOCItem[]): TOCItem[] {
	const byLevel = new Map<number, TOCItem[]>();
	for (const item of toc) {
		if (item.level < MIN_LEVEL || item.level > MAX_LEVEL) continue;
		const bucket = byLevel.get(item.level);
		if (bucket) bucket.push(item);
		else byLevel.set(item.level, [item]);
	}
	let best: TOCItem[] = [];
	for (const bucket of byLevel.values()) {
		if (bucket.length > best.length) best = bucket;
	}
	return best.length >= MIN_ENTRIES ? best : [];
}

export default function HeadingIndex({ toc }: { toc: readonly TOCItem[] }) {
	const entries = indexEntries(toc);
	if (entries.length === 0) return null;
	return (
		<nav className={styles.index} aria-label="页内快速跳转">
			<span className={styles.label}>快速跳转</span>
			<ul className={styles.chips}>
				{entries.map((entry) => (
					<li key={entry.id}>
						<Link className={styles.chip} to={`#${entry.id}`}>{entry.value}</Link>
					</li>
				))}
			</ul>
		</nav>
	);
}
