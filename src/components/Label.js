import React from 'react';
import { useColorMode } from '@docusaurus/theme-common';
import { darkBg } from './colorUtils';

const PRESETS = {
  purple: { bg: 'rgba(115,103,240,0.15)', text: '#5a50d4', textDark: '#9d94f5', border: 'rgba(115,103,240,0.35)' },
  blue:   { bg: 'rgba(59,130,246,0.12)',  text: '#1d4ed8', textDark: '#93c5fd', border: 'rgba(59,130,246,0.35)'  },
  green:  { bg: 'rgba(34,197,94,0.12)',   text: '#15803d', textDark: '#86efac', border: 'rgba(34,197,94,0.35)'   },
  red:    { bg: 'rgba(239,68,68,0.12)',   text: '#b91c1c', textDark: '#fca5a5', border: 'rgba(239,68,68,0.35)'   },
  yellow: { bg: 'rgba(234,179,8,0.12)',   text: '#92400e', textDark: '#fde68a', border: 'rgba(234,179,8,0.35)'   },
  gray:   { bg: 'rgba(107,114,128,0.12)', text: '#4b5563', textDark: '#d1d5db', border: 'rgba(107,114,128,0.35)' },
};

export default function Label({ color, bg, text, border, children }) {
  const { colorMode } = useColorMode();
  const isDark = colorMode === 'dark';
  const preset = PRESETS[color];

  const resolvedBg = bg ?? preset?.bg;
  const style = {
    display: 'inline-block',
    padding: '0.1em 0.55em',
    fontSize: '0.78em',
    fontWeight: 500,
    lineHeight: 1.6,
    borderRadius: '3px',
    border: `1px solid ${border ?? preset?.border ?? 'rgba(107,114,128,0.3)'}`,
    backgroundColor: resolvedBg ? (isDark ? darkBg(resolvedBg) : resolvedBg) : 'transparent',
    color: text ?? (isDark ? (preset?.textDark ?? 'inherit') : (preset?.text ?? 'inherit')),
    whiteSpace: 'nowrap',
    verticalAlign: 'middle',
  };

  return <span style={style}>{children}</span>;
}
