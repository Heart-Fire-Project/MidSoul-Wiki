export type ColorModeValue<T = string> = { light: T; dark: T };

export type CalloutColor = 'green' | 'blue' | 'yellow' | 'red' | 'purple' | 'gray';

export const CALLOUT: Record<CalloutColor, { light: { bg: string; border: string }; dark: { bg: string; border: string } }> = {
	green: { light: { bg: '#eefbf1', border: '#86d9a0' }, dark: { bg: 'rgba(34, 197, 94, 0.12)', border: 'rgba(134, 217, 160, 0.45)' } },
	blue: { light: { bg: '#eef4fd', border: '#8fb6f0' }, dark: { bg: 'rgba(59, 130, 246, 0.13)', border: 'rgba(143, 182, 240, 0.45)' } },
	yellow: { light: { bg: '#fdf8e7', border: '#e5c86a' }, dark: { bg: 'rgba(234, 179, 8, 0.13)', border: 'rgba(229, 200, 106, 0.45)' } },
	red: { light: { bg: '#fdeeed', border: '#eda19b' }, dark: { bg: 'rgba(239, 68, 68, 0.13)', border: 'rgba(237, 161, 155, 0.45)' } },
	purple: { light: { bg: '#f1effe', border: '#a89df5' }, dark: { bg: 'rgba(115, 103, 240, 0.16)', border: 'rgba(168, 157, 245, 0.45)' } },
	gray: { light: { bg: '#f4f5f7', border: '#c9ccd4' }, dark: { bg: 'rgba(148, 163, 184, 0.12)', border: 'rgba(201, 204, 212, 0.35)' } },
};

export const INK = { light: 'rgba(20, 15, 50, 0.85)', dark: 'inherit' } as const;
export const DARK_BG = { lightness: 0.22, maxSaturation: 0.55 } as const;
