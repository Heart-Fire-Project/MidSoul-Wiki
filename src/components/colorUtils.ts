import { DARK_BG } from './theme';

function hexRgb(hex: string): [number, number, number] | null {
	const value = hex.trim().replace(/^#/, '');
	if (!/^([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)) return null;
	const expanded = value.length === 3 ? value.replace(/./g, (char) => char + char) : value.slice(0, 6);
	return [0, 2, 4].map((index) => Number.parseInt(expanded.slice(index, index + 2), 16)) as [number, number, number];
}

const RGBA = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)/;

export function alphaOf(color?: string | null): number {
	if (!color) return 1;
	const match = color.match(RGBA);
	if (match) return match[4] === undefined ? 1 : Number(match[4]);
	const hex = color.trim().replace(/^#/, '');
	return hex.length === 8 ? Number.parseInt(hex.slice(6), 16) / 255 : 1;
}

export function withAlpha(color: string | null | undefined, alpha: number): string | null | undefined {
	if (!color) return color;
	const match = color.match(RGBA);
	const rgb = match ? match.slice(1, 4).map(Number) as [number, number, number] : hexRgb(color);
	if (!rgb) return color;
	return alpha >= 1 ? `rgb(${rgb.join(',')})` : `rgba(${rgb.join(',')},${Number(alpha.toFixed(2))})`;
}

export function darkBg(color: string): string {
	const channels = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)?.slice(1).map(Number) ?? hexRgb(color);
	if (!channels) return color;
	let [red, green, blue] = channels.map((channel) => channel / 255);
	const max = Math.max(red, green, blue);
	const min = Math.min(red, green, blue);
	const delta = max - min;
	let hue = 0;
	let saturation = 0;
	const lightness = (max + min) / 2;
	if (delta !== 0) {
		saturation = delta / (1 - Math.abs(2 * lightness - 1));
		if (max === red) hue = ((green - blue) / delta + 6) % 6;
		else if (max === green) hue = (blue - red) / delta + 2;
		else hue = (red - green) / delta + 4;
		hue /= 6;
	}

	const nextLightness = DARK_BG.lightness;
	const nextSaturation = Math.min(saturation, DARK_BG.maxSaturation);
	const q = nextLightness * (1 + nextSaturation);
	const p = 2 * nextLightness - q;
	const channel = (value: number) => {
		const normalized = ((value % 1) + 1) % 1;
		if (normalized < 1 / 6) return p + (q - p) * 6 * normalized;
		if (normalized < 1 / 2) return q;
		if (normalized < 2 / 3) return p + (q - p) * (2 / 3 - normalized) * 6;
		return p;
	};
	return `rgb(${Math.round(channel(hue + 1 / 3) * 255)},${Math.round(channel(hue) * 255)},${Math.round(channel(hue - 1 / 3) * 255)})`;
}
