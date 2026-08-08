import React, { useEffect, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import s from './TiptapEditor.module.css';

export type CommandMenuItem = {
  id: string;
  title: string;
  detail: string;
  group: string;
  aliases: string[];
  icon: LucideIcon;
};

type Props = {
  items: CommandMenuItem[];
  selected: number;
  onSelected: (index: number) => void;
  onChoose: (item: CommandMenuItem) => void;
};

export default function SlashCommandMenu({ items, selected, onSelected, onChoose }: Props) {
  const active = useRef<HTMLButtonElement>(null);
  useEffect(() => { active.current?.scrollIntoView({ block: 'nearest' }); }, [selected]);

  if (!items.length) return <div className={s.commandEmpty}>没有匹配的内容块</div>;
  let previousGroup = '';
  return <div className={s.commandMenu} role="listbox" aria-label="插入内容块">
    {items.map((item, index) => {
      const Icon = item.icon;
      const showGroup = item.group !== previousGroup;
      previousGroup = item.group;
      return <React.Fragment key={item.id}>
        {showGroup && <div className={s.commandGroup}>{item.group}</div>}
        <button ref={index === selected ? active : undefined} type="button" role="option" aria-selected={index === selected}
          className={`${s.commandItem} ${index === selected ? s.commandSelected : ''}`}
          onMouseEnter={() => onSelected(index)} onMouseDown={(event) => { event.preventDefault(); onChoose(item); }}>
          <span className={s.commandIcon}><Icon size={17} strokeWidth={1.8} /></span>
          <span className={s.commandCopy}><b>{item.title}</b><small>{item.detail}</small></span>
        </button>
      </React.Fragment>;
    })}
  </div>;
}
