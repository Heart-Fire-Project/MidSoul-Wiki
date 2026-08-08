import React, { useState, useRef } from 'react';
import { cmd, hold, wrapCode, wrapMuted, insertLabel, insertMd, selectedText, currentRange } from './format';
import { serialize, emptyGrid } from './tableIO';
import { Icon, Menu, MenuItem, MenuAction, MenuGroup, ColorButton } from './ui';
import { PRESETS } from '../Label';
import s from './editor.module.css';

/*
  编辑栏只管"这段内容"。

  30 个平铺按钮 → 4 组：段落样式（一个下拉，按真实排版预览）、
  行内格式（图标，人人认识的那几个）、插入、站点组件。
  中文标签两个字就是一个方块，六个并排就成了噪音 —— 所以通用格式用图标，
  只有站点自己的东西（提示框 / 标签 / 灰字）才用词。
*/

// 转换当前块：拿到块内纯文本，套上新的 Markdown 前缀
export const CONVERT = [
  { label: '正文', icon: 'text', make: (t) => t },
  { label: '标题 1', preview: 'previewH1', make: (t) => `# ${t}` },
  { label: '标题 2', preview: 'previewH2', make: (t) => `## ${t}` },
  { label: '标题 3', preview: 'previewH3', make: (t) => `### ${t}` },
  { label: '标题 4', preview: 'previewH4', make: (t) => `#### ${t}` },
  { label: '引用', icon: 'quote', preview: 'previewQuote', make: (t) => `> ${t}` },
  { label: '无序列表', icon: 'list', make: (t) => `- ${t}` },
  { label: '有序列表', icon: 'listOrdered', make: (t) => `1. ${t}` },
];

// 插入新块
export const INSERT = [
  { label: '表格', icon: 'table', make: () => serialize(emptyGrid(3, 3)) },
  { label: '代码块', icon: 'code', preview: 'previewCode', make: (t) => '```\n' + (t || '') + '\n```' },
  { label: '提示框', icon: 'admonition', make: (t) => `:::note\n${t || '内容'}\n:::` },
  { label: '分割线', icon: 'divider', make: () => '---' },
];

const LABEL_COLORS = [['purple', '紫色'], ['blue', '蓝色'], ['green', '绿色'], ['red', '红色'], ['yellow', '黄色'], ['gray', '灰色']];

const INLINE = [
  ['bold', 'bold', '粗体'],
  ['italic', 'italic', '斜体'],
  ['strikeThrough', 'strike', '删除线'],
  ['underline', 'underline', '下划线'],
];

export default function Toolbar({ isDark, onConvert, onInsert, currentLabel }) {
  const [ask, setAsk] = useState(null); // { placeholder, run }
  const saved = useRef(null);

  const restore = () => {
    if (!saved.current) return;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(saved.current);
  };

  const startAsk = (config) => { saved.current = currentRange(); setAsk(config); };

  return (
    <div className={s.editbar} data-chrome>
      <Menu label={currentLabel} title="段落样式">
        {CONVERT.map((item) => (
          <MenuItem
            key={item.label}
            icon={item.icon}
            preview={item.preview && s[item.preview]}
            onClick={() => onConvert(item.make)}
          >
            {item.label}
          </MenuItem>
        ))}
      </Menu>

      <span className={s.sep} />

      {INLINE.map(([command, icon, title]) => (
        <button key={command} className={s.tool} title={title} {...hold(() => cmd(command))}>
          <Icon name={icon} />
        </button>
      ))}
      <button className={s.tool} title="行内代码" {...hold(wrapCode)}>
        <Icon name="inlineCode" />
      </button>
      <ColorButton command="foreColor" icon="palette" title="文字颜色" />
      <ColorButton command="hiliteColor" icon="highlight" title="背景颜色" initial="#fef9c3" />
      <button className={s.tool} title="清除格式" {...hold(() => cmd('removeFormat'))}>清除</button>

      <span className={s.sep} />

      <Menu label="插入" icon="plus" title="插入块与素材">
        <MenuGroup>块</MenuGroup>
        {INSERT.map((item) => (
          <MenuItem key={item.label} icon={item.icon} onClick={() => onInsert(item.make)}>
            {item.label}
          </MenuItem>
        ))}
        <MenuGroup>素材</MenuGroup>
        <MenuItem icon="link" onClick={() => startAsk({
          placeholder: '链接地址，回车确认（如 ./进度碑刻）',
          run: (v) => cmd('createLink', v),
        })}>链接</MenuItem>
        <MenuItem icon="image" onClick={() => startAsk({
          placeholder: '图片地址，回车确认（如 /img/maps/心火特区.png）',
          run: (v) => insertMd(`![${selectedText() || '图片'}](${v})`, isDark),
        })}>图片</MenuItem>
      </Menu>

      <Menu label="站点组件" icon="tag" title="MidSoul Wiki 专属组件">
        <MenuGroup>标签</MenuGroup>
        {LABEL_COLORS.map(([color, name]) => (
          <MenuAction
            key={color}
            run={() => insertLabel(color, isDark)}
            swatch={<span className={s.swatch}
              style={{ background: PRESETS[color].bg, borderColor: PRESETS[color].border }} />}
          >
            {name}标签
          </MenuAction>
        ))}
        <MenuGroup>文本</MenuGroup>
        <MenuAction icon="text" run={() => wrapMuted(isDark)}>灰色说明文字</MenuAction>
      </Menu>

      {ask && (
        <input
          autoFocus
          className={s.linkInput}
          placeholder={ask.placeholder}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.target.value) { restore(); ask.run(e.target.value); setAsk(null); }
            if (e.key === 'Escape') setAsk(null);
          }}
          onBlur={() => setAsk(null)}
        />
      )}

      <span className={s.spacer} />
      <span className={s.hint}>选中文字出格式条 · 空行敲 / 插入</span>
    </div>
  );
}
