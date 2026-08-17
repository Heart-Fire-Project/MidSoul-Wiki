import React, { type CSSProperties, type ReactNode } from 'react';
import { CALLOUT, INK, type CalloutColor } from './theme';
import styles from './Callout.module.css';

export type CalloutProps = { color?: CalloutColor | string; emoji?: ReactNode; children?: ReactNode };

export default function Callout({ color = 'green', emoji, children }: CalloutProps) {
	// 明暗两套都发出去，由 Callout.module.css 挑；在 JS 里二选一会让 SSR
	// 按 defaultMode 烤死一种，另一种主题的读者首屏会闪一下。
	const palette = CALLOUT[color as CalloutColor] ?? CALLOUT.green;
	const style = {
		'--callout-border-l': palette.light.border,
		'--callout-border-d': palette.dark.border,
		'--callout-bg-l': palette.light.bg,
		'--callout-bg-d': palette.dark.bg,
		'--callout-ink-l': INK.light,
		'--callout-ink-d': INK.dark,
	} as CSSProperties & Record<`--${string}`, string>;
	return <div className={styles.callout} style={style}>
		{emoji && <span className={styles.emoji}>{emoji}</span>}
		<div className={styles.content}>{children}</div>
	</div>;
}
