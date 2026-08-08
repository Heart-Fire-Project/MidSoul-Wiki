import React, { type CSSProperties, type ReactNode } from 'react';
import { useColorMode } from '@docusaurus/theme-common';
import { CALLOUT, INK, type CalloutColor } from './theme';
import styles from './Callout.module.css';

export type CalloutProps = { color?: CalloutColor | string; emoji?: ReactNode; children?: ReactNode };

export default function Callout({ color = 'green', emoji, children }: CalloutProps) {
	const { colorMode } = useColorMode();
	const isDark = colorMode === 'dark';
	const palette = (CALLOUT[color as CalloutColor] ?? CALLOUT.green)[isDark ? 'dark' : 'light'];
	const style = {
		'--callout-border': palette.border,
		'--callout-background': palette.bg,
		'--callout-ink': isDark ? INK.dark : INK.light,
	} as CSSProperties & Record<`--${string}`, string>;
	return <div className={styles.callout} style={style}>
		{emoji && <span className={styles.emoji}>{emoji}</span>}
		<div className={styles.content}>{children}</div>
	</div>;
}
