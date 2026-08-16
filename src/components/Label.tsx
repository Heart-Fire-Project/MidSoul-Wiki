import React, { type CSSProperties, type ReactNode } from 'react';
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

/** 明暗两套色值一起发出去，由 Label.module.css 挑，服务端渲染因此与主题无关。
 * 用 useColorMode 在 JS 里二选一时，SSR 只能按 defaultMode 烤死一种，
 * 另一种主题的读者会看到首屏闪烁——与 .ms-ink 的取舍同理。 */
function labelVariables({ color, bg, text, border }: Omit<LabelProps, 'children'>): CSSVariables {
	const preset = PRESETS[color as LabelColor];
	const background = bg ?? preset?.bg;
	return {
		'--label-border': border ?? preset?.border ?? 'rgba(107,114,128,0.3)',
		'--label-bg-l': background ?? 'transparent',
		'--label-bg-d': background ? darkBg(background) : 'transparent',
		'--label-fg-l': text ?? preset?.text ?? 'inherit',
		'--label-fg-d': text ?? preset?.textDark ?? 'inherit',
	};
}

export default function Label({ children, ...props }: LabelProps) {
	return <span className={styles.label} style={labelVariables(props)}>{children}</span>;
}
