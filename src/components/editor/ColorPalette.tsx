import React, { useState, type CSSProperties } from 'react';
import { useColorMode } from '@docusaurus/theme-common';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { LucideIcon } from 'lucide-react';
import { Check, Palette } from 'lucide-react';
import s from './TiptapEditor.module.css';

type PaletteVariant = 'text' | 'background';
type ThemeColor = { name: string; light: string; dark: string };
export type ColorSelection = { light: string; dark: string } | string | null;
type ColorPaletteProps = {
  label: string;
  automaticLabel: string;
  value?: string | null;
  darkValue?: string | null;
  customDefault?: string;
  variant?: PaletteVariant;
  onChange: (color: ColorSelection) => void;
};
type ColorMenuProps = ColorPaletteProps & { icon: LucideIcon };

// Values sampled from the Feishu color picker. Each preset has an intentional
// light/dark counterpart instead of relying on a mechanical color inversion.
const TEXT_COLORS: ThemeColor[] = [
  { name: '灰色', light: '#8F959E', dark: '#757575' },
  { name: '红色', light: '#D83931', dark: '#FA7974' },
  { name: '橙色', light: '#DF7805', dark: '#F6A54A' },
  { name: '黄色', light: '#DD9B02', dark: '#FDD456' },
  { name: '绿色', light: '#2EA122', dark: '#6DD163' },
  { name: '蓝色', light: '#245BDB', dark: '#71A0FF' },
  { name: '紫色', light: '#6525D0', dark: '#A472FC' },
];

const HIGHLIGHT_COLORS: ThemeColor[] = [
  { name: '浅灰高亮', light: '#F2F3F5', dark: '#333333' },
  { name: '浅红高亮', light: '#FBC0BC', dark: '#623836' },
  { name: '浅橙高亮', light: '#FFDDB6', dark: '#55412C' },
  { name: '浅黄高亮', light: '#FFF897', dark: '#49472E' },
  { name: '浅绿高亮', light: '#C5F1C1', dark: '#344B32' },
  { name: '浅蓝高亮', light: '#CEDCFE', dark: '#344365' },
  { name: '浅紫高亮', light: '#DCC9FC', dark: '#4C3A69' },
];

const STRONG_BACKGROUND_COLORS: ThemeColor[] = [
  { name: '灰色高亮', light: '#E5E6E9', dark: '#3D3D3D' },
  { name: '深灰高亮', light: '#BBBFC5', dark: '#4A4A4A' },
  { name: '红色高亮', light: '#F76965', dark: '#88413F' },
  { name: '橙色高亮', light: '#FFA53D', dark: '#72512E' },
  { name: '黄色高亮', light: '#FFE927', dark: '#5E5930' },
  { name: '绿色高亮', light: '#62D356', dark: '#3A6036' },
  { name: '蓝色高亮', light: '#A0BBFF', dark: '#3A558C' },
  { name: '紫色高亮', light: '#C4A5FC', dark: '#614692' },
];

const normalized = (color?: string | null) => color?.toLowerCase() ?? null;
export const findPairedPreset = (value: string | null | undefined, variant: PaletteVariant) => {
  const selected = normalized(value);
  if (!selected) return null;
  const colors = variant === 'text' ? TEXT_COLORS : [...HIGHLIGHT_COLORS, ...STRONG_BACKGROUND_COLORS];
  const match = colors.find((color) => selected === normalized(color.light) || selected === normalized(color.dark));
  return match ? { light: match.light, dark: match.dark } : null;
};
const presetSelected = (selected: Array<string | null>, color: ThemeColor) =>
  selected.some((value) => value === normalized(color.light) || value === normalized(color.dark));

function ColorSwatch({ color, displayColor, selected, variant, onChange }: {
  color: ThemeColor;
  displayColor: string;
  selected: boolean;
  variant: PaletteVariant;
  onChange: (color: ColorSelection) => void;
}) {
  return <button type="button" className={s.colorSwatch} data-variant={variant}
    data-selected={selected || undefined} aria-label={`${color.name} ${displayColor}`} aria-pressed={selected}
    style={{ '--swatch-color': displayColor } as CSSProperties}
    onMouseDown={(event) => event.preventDefault()} onClick={() => onChange({ light: color.light, dark: color.dark })}>
    {variant === 'text' ? <span aria-hidden="true">A</span> : selected && <Check size={12} strokeWidth={2.6} />}
  </button>;
}

function ClearSwatch({ label, selected, variant, onChange }: {
  label: string;
  selected: boolean;
  variant: PaletteVariant;
  onChange: (color: ColorSelection) => void;
}) {
  return <button type="button" className={s.colorClearSwatch} data-variant={variant}
    data-selected={selected || undefined} aria-label={label} aria-pressed={selected}
    onMouseDown={(event) => event.preventDefault()} onClick={() => onChange(null)}>
    {variant === 'text' ? <span aria-hidden="true">A</span> : <span className={s.clearDiagonal} aria-hidden="true" />}
  </button>;
}

export function ColorPalette({ label, automaticLabel, value, darkValue, customDefault = '#7367f0', variant = 'background', onChange }: ColorPaletteProps) {
  const { colorMode } = useColorMode();
  const isDark = colorMode === 'dark';
  const selected = normalized(value);
  const selectedDark = normalized(darkValue);
  const customValue = /^#[\da-f]{6}$/i.test(value ?? '') ? value! : customDefault;
  const activeColor = (color: ThemeColor) => isDark ? color.dark : color.light;

  return <div className={s.colorPalette} aria-label={label} data-variant={variant}>
    <span className={s.colorGroupLabel}>{label}</span>
    <div className={s.paletteGrid}>
      <ClearSwatch label={automaticLabel} selected={!selected && !selectedDark} variant={variant} onChange={onChange} />
      {(variant === 'text' ? TEXT_COLORS : HIGHLIGHT_COLORS).map((color) => <ColorSwatch key={color.name}
        color={color} displayColor={activeColor(color)} selected={presetSelected([selected, selectedDark], color)}
        variant={variant} onChange={onChange} />)}
    </div>

    {variant === 'background' && <div className={s.paletteGrid}>
      {STRONG_BACKGROUND_COLORS.map((color) => <ColorSwatch key={color.name}
        color={color} displayColor={activeColor(color)} selected={presetSelected([selected, selectedDark], color)}
        variant={variant} onChange={onChange} />)}
    </div>}

    <button type="button" className={s.colorAutomatic} data-selected={!selected && !selectedDark || undefined}
      onMouseDown={(event) => event.preventDefault()} onClick={() => onChange(null)}>
      <span>{automaticLabel}</span>{!selected && <Check size={14} />}
    </button>

    <label className={s.moreColor}>
      <Palette size={16} /><span>更多颜色…</span><i style={{ background: customValue }} />
      <input type="color" aria-label={`${label}：更多颜色`} value={customValue}
        onChange={(event) => onChange(event.target.value)} />
    </label>
  </div>;
}

export function ColorMenu({ icon: Icon, label, automaticLabel, value, darkValue, customDefault, variant, onChange }: ColorMenuProps) {
  const [open, setOpen] = useState(false);
  const { colorMode } = useColorMode();
  const select = (color: ColorSelection) => { onChange(color); setOpen(false); };
  return <DropdownMenu.Root open={open} onOpenChange={setOpen}>
    <DropdownMenu.Trigger asChild>
      <button type="button" className={s.colorTrigger} aria-label={label} aria-expanded={open}
        style={{ '--picked-color': colorMode === 'dark' ? (darkValue ?? value ?? 'var(--ifm-font-color-base)') : (value ?? 'var(--ifm-font-color-base)') } as CSSProperties}
        onMouseDown={(event) => event.preventDefault()}>
        <Icon size={15.5} strokeWidth={1.9} /><span className={s.colorTriggerBar} aria-hidden="true" />
      </button>
    </DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content className={s.colorMenuContent} align="start" sideOffset={7} collisionPadding={8}
        onCloseAutoFocus={(event) => event.preventDefault()}>
        <ColorPalette label={label} automaticLabel={automaticLabel} value={value} darkValue={darkValue}
          customDefault={customDefault} variant={variant} onChange={select} />
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>;
}
