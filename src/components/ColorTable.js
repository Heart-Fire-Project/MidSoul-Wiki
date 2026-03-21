import React, { useId } from 'react';
import { useColorMode } from '@docusaurus/theme-common';
import { darkBg } from './colorUtils';

// 解析单个颜色值：null → 跳过，字符串 → 只改背景，对象 → 背景+文字
function parse(val) {
  if (!val) return null;
  if (typeof val === 'string') return { bg: val };
  return val;
}


// 当只设背景色时，自动补深色字保证浅色背景可读
const AUTO_TEXT_LIGHT = 'rgba(20, 15, 50, 0.85)';
const AUTO_TEXT_DARK  = 'inherit';

export default function ColorTable({ header, cols, rows, cells, hideHeader, noFirstCol, children }) {
  const { colorMode } = useColorMode();
  const isDark = colorMode === 'dark';
  const id = useId().replace(/:/g, '');
  const rules = [];
  const sel = `#t${id}`;

  const applyColor = (s, c) => {
    const bg = c.bg ? (isDark ? darkBg(c.bg) : c.bg) : null;
    if (bg) rules.push(`${s} { background-color: ${bg} !important; }`);
    const textColor = c.text ?? (isDark ? AUTO_TEXT_DARK : AUTO_TEXT_LIGHT);
    if (c.bg) rules.push(`${s} { color: ${textColor} !important; }`);
  };

  header?.forEach((val, i) => {
    const c = parse(val); if (!c) return;
    applyColor(`${sel} thead th:nth-child(${i + 1})`, c);
  });

  cols?.forEach((val, i) => {
    const c = parse(val); if (!c) return;
    applyColor(`${sel} tbody td:nth-child(${i + 1})`, c);
  });

  rows?.forEach((val, i) => {
    const c = parse(val); if (!c) return;
    applyColor(`${sel} tbody tr:nth-child(${i + 1}) td`, c);
  });

  cells?.forEach(([row, col, val]) => {
    const c = parse(val); if (!c) return;
    applyColor(`${sel} tbody tr:nth-child(${row}) td:nth-child(${col})`, c);
  });

  if (hideHeader) rules.push(`${sel} thead { display: none; }`);
  if (noFirstCol) rules.push(
    `${sel} tbody td:first-child, ${sel} thead th:first-child { background: none !important; }`
  );

  return (
    <div id={`t${id}`}>
      {rules.length > 0 && <style>{rules.join('\n')}</style>}
      {children}
    </div>
  );
}
