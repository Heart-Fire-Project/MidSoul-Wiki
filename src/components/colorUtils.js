// 暗色模式：保留色相，把亮度压到 ~22%，生成深色背景
export function darkBg(color) {
  const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return color;
  let r = parseInt(m[1]) / 255, g = parseInt(m[2]) / 255, b = parseInt(m[3]) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0, s = 0, l = (max + min) / 2;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if      (max === r) h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else                h = (r - g) / d + 4;
    h /= 6;
  }

  const nl = 0.22, ns = Math.min(s, 0.55);
  const q = nl * (1 + ns), p = 2 * nl - q;
  const hue = (t) => {
    const nt = ((t % 1) + 1) % 1;
    if (nt < 1/6) return p + (q - p) * 6 * nt;
    if (nt < 1/2) return q;
    if (nt < 2/3) return p + (q - p) * (2/3 - nt) * 6;
    return p;
  };
  return `rgb(${Math.round(hue(h+1/3)*255)},${Math.round(hue(h)*255)},${Math.round(hue(h-1/3)*255)})`;
}
