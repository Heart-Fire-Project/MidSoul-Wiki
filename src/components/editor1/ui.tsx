import React, { useRef, useState, type ComponentProps, type ReactNode } from 'react';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { applyColor, currentRange, hold } from './format';
import s from './editor.module.css';

const PATHS = {
  save: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8', code: 'M16 18l6-6-6-6M8 6l-6 6 6 6', info: 'M12 16v-4M12 8h.01M21 12a9 9 0 1 1-18 0 0 1 18 0z', copy: 'M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1', folder: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z', bold: 'M6 4h8a4 4 0 0 1 0 8H6zM6 12h9a4 4 0 0 1 0 8H6z', italic: 'M19 4h-9M14 20H5M15 4L9 20', strike: 'M17 12H6M8 8a4 4 0 0 1 7.7-1.5M9 16a4 4 0 0 0 6.5.5', underline: 'M6 4v6a6 6 0 0 0 12 0V4M4 21h16', inlineCode: 'M10 8l-4 4 4 4M14 8l4 4-4 4', palette: 'M4 20h16M7 16L12 4l5 12', highlight: 'M4 21h16M6 17l3-3 6 6-3 3zM9 14l7-7 4 4-7 7', link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7', image: 'M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21', plus: 'M12 5v14M5 12h14', chevron: 'M6 9l6 6 6-6', table: 'M3 3h18v18H3zM3 9h18M3 15h18M12 3v18', quote: 'M7 15h3l2-4V5H6v6h3zM17 15h3l2-4V5h-6v6h3z', list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01', listOrdered: 'M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1', divider: 'M3 12h18', tag: 'M20.6 13.4L12 4.8V2H6a2 2 0 0 0-2 2v6h2.8l8.6 8.6a2 2 0 0 0 2.8 0l2.4-2.4a2 2 0 0 0 0-2.8zM7.5 7.5h.01', trash: 'M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6', admonition: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z', text: 'M4 6h16M4 12h10M4 18h13',
} as const;

export type IconName = keyof typeof PATHS;
export const Icon = ({ name, className }: { name: IconName; className?: string }) => <svg className={className ?? s.icon} viewBox="0 0 24 24" aria-hidden="true"><path d={PATHS[name]} /></svg>;

export function Menu({ label, icon, title, trigger, children, open, onOpenChange }: { label?: ReactNode; icon?: IconName; title?: string; trigger?: ReactNode; children: ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  // Radix supports this focus hook at runtime, but the installed type definition
  // predates it. Keep the behavior in one narrow compatibility adapter.
  const openFocus = { onOpenAutoFocus: (event: Event) => event.preventDefault() } as unknown as ComponentProps<typeof Dropdown.Content>;
  return <Dropdown.Root modal={false} open={open} onOpenChange={onOpenChange}><Dropdown.Trigger asChild={!!trigger} className={trigger ? undefined : s.tool} title={title}>{trigger ?? <>{icon && <Icon name={icon} />}{label}<Icon name="chevron" className={s.caret} /></>}</Dropdown.Trigger><Dropdown.Portal><Dropdown.Content className={s.pop} sideOffset={5} align="start" {...openFocus} onCloseAutoFocus={(event) => event.preventDefault()}>{children}</Dropdown.Content></Dropdown.Portal></Dropdown.Root>;
}

export const MenuItem = ({ icon, children, hint, onClick, preview }: { icon?: IconName; children: ReactNode; hint?: ReactNode; onClick?: () => void; preview?: string }) => <Dropdown.Item className={s.popItem} onSelect={onClick}>{icon ? <Icon name={icon} /> : <span className={s.icon} />}<span className={preview}>{children}</span>{hint && <span className={s.popKey}>{hint}</span>}</Dropdown.Item>;
export const MenuAction = ({ icon, children, run, swatch }: { icon?: IconName; children: ReactNode; run: () => void; swatch?: ReactNode }) => <Dropdown.Item className={s.popItem} {...hold(run)}>{swatch ?? (icon ? <Icon name={icon} /> : <span className={s.icon} />)}{children}</Dropdown.Item>;
export const MenuGroup = ({ children }: { children: ReactNode }) => <div className={s.popGroup}>{children}</div>;

export function ColorButton({ command, icon, title, initial = '#245bdb', onBusy }: { command: string; icon: IconName; title: string; initial?: string; onBusy?: (busy: boolean) => void }) {
  const [color, setColor] = useState(initial);
  const range = useRef<Range | null>(null);
  return <label className={s.colorLabel} title={title} onMouseDown={(event) => { event.preventDefault(); range.current = currentRange(); onBusy?.(true); }}><span><Icon name={icon} /><span className={s.colorBar} style={{ background: color }} /></span><input type="color" value={color} onChange={(event) => { setColor(event.target.value); range.current = applyColor(range.current, event.target.value, command); }} onBlur={() => onBusy?.(false)} /></label>;
}
