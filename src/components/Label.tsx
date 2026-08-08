import React, { type CSSProperties, type ReactNode } from 'react';
import { useColorMode } from '@docusaurus/theme-common';
import { darkBg } from './colorUtils';
import styles from './Label.module.css';

export type LabelColor = 'purple' | 'blue' | 'green' | 'red' | 'yellow' | 'gray';
export type LabelProps = { children?: ReactNode; color?: LabelColor | string; bg?: string; text?: string; border?: string };

export const PRESETS: Record<LabelColor, { bg: string; text: string; textDark: string; border: string }> = {
	purple: { bg: 'rgba(115,103,240,0.15)', text: '#5a50d4', textDark: '#9d94f5', border: 'rgba(115,103,240,0.35)' },
	blue: { bg: 'rgba(59,130,246,0.12)', text: '#1d4ed8', textDark: '#93c5fd', border: 'rgba(59,130,246,0.35)' },
	green: { bg: 'rgba(34,197,94,0.12)', text: '#15803d', textDark: '#86efac', border: 'rgba(34,197,94,0.35)' },
	red: { bg: 'rgba(239,68,68,0.12)', text: '#b91c1c', textDark: '#fca5a5', border: 'rgba(239,68,68,0.35)' },
	yellow: { bg: 'rgba(234,179,8,0.12)', text: '#92400e', textDark: '#fde68a', border: 'rgba(234,179,8,0.35)' },
	gray: { bg: 'rgba(107,114,128,0.12)', text: '#4b5563', textDark: '#d1d5db', border: 'rgba(107,114,128,0.35)' },
};

type CSSVariables = CSSProperties & Record<`--${string}`, string>;

function labelVariables({ color, bg, text, border }: Omit<LabelProps, 'children'>, isDark: boolean): CSSVariables {
	const preset = PRESETS[color as LabelColor];
	const background = bg ?? preset?.bg;
	return {
		'--label-border': border ?? preset?.border ?? 'rgba(107,114,128,0.3)',
		'--label-background': background ? (isDark ? darkBg(background) : background) : 'transparent',
		'--label-text': text ?? (isDark ? (preset?.textDark ?? 'inherit') : (preset?.text ?? 'inherit')),
	};
}

// The legacy editor renders Label as a raw HTML string, so it still needs a
// self-contained style object. The React/MDX component uses Label.module.css.
export function labelStyle(props: Omit<LabelProps, 'children'>, isDark: boolean): CSSProperties {
	const variables = labelVariables(props, isDark);
	return {
		display: 'inline-block', padding: '0.1em 0.55em', fontSize: '0.78em', fontWeight: 500,
		lineHeight: 1.6, borderRadius: '3px', border: `1px solid ${variables['--label-border']}`,
		backgroundColor: variables['--label-background'], color: variables['--label-text'],
		whiteSpace: 'nowrap', verticalAlign: 'middle',
	};
}

export default function Label({ children, ...props }: LabelProps) {
	const { colorMode } = useColorMode();
	return <span className={styles.label} style={labelVariables(props, colorMode === 'dark')}>{children}</span>;
}
