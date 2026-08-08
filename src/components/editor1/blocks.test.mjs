// 自检：node src/components/editor1/blocks.test.mjs
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { parseDoc, serializeDoc, classify, admonitionParts, listItems, domToMd } from './blocks.js';

const DOC = `---
sidebar_position: 6
---

# 标题

一段正文，带 <Label color="purple">标签</Label> 和 <span style={{color:'rgb(36, 91, 219)'}}>彩字</span>。

- 项目一
- 项目二

<ColorTable hideHeader cols={['#eee', null]}>

| a | b |
| :--- | :--- |
| 1 | 2 |

</ColorTable>

:::caution 剧透警告

正文里有空行也不该被切开。

:::

\`\`\`js
// 围栏里的空行

const x = 1;
\`\`\`

| c | d |
| :--- | :--- |
| 3 | 4 |
`;

const doc = parseDoc(DOC);

// 分块正确
{
  assert.equal(doc.frontmatter.trim(), '---\nsidebar_position: 6\n---');
  assert.deepEqual(doc.blocks.map((b) => b.type), [
    'heading', 'para', 'list', 'table', 'admonition', 'code', 'table',
  ]);
}

// 没动过任何块 → 序列化必须与原文逐字节相同
{
  const out = serializeDoc(doc);
  assert.equal(out, DOC, '未编辑的文档往返后必须一字不差');
  assert.ok(out.includes('<Label color="purple">标签</Label>'), 'MDX 组件原样保留');
}

// 仓库里所有真实文档都要能原样往返（打开不改再保存 = 空 diff）
{
  const docs = path.join(import.meta.dirname, '../../../docs');
  const files = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.md')) files.push(p);
    }
  })(docs);
  assert.ok(files.length >= 8, '应该扫到全部文档');
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    assert.equal(serializeDoc(parseDoc(src)), src, `${path.basename(f)} 往返后被改动了`);
  }
}

// 只改一个块，其它块逐字不变
{
  const edited = { ...doc, blocks: doc.blocks.map((b) => (b.type === 'heading' ? { ...b, src: '# 新标题' } : b)) };
  const out = serializeDoc(edited);
  assert.ok(out.includes('# 新标题'));
  assert.ok(out.includes('<ColorTable hideHeader cols={[\'#eee\', null]}>'), '没碰的 ColorTable 一个字符都不该变');
  assert.ok(out.includes('// 围栏里的空行'), '代码块内的空行不该被切块');
}

// 围栏与提示框内部的空行不切块
{
  const admon = doc.blocks.find((b) => b.type === 'admonition');
  assert.equal(admonitionParts(admon.src).type, 'caution');
  assert.equal(admonitionParts(admon.src).title, '剧透警告');
  assert.ok(admonitionParts(admon.src).body.includes('\n'), '提示框正文保留内部空行');
}

// 零散判定
{
  assert.equal(classify('## x'), 'heading');
  assert.equal(classify('1. x'), 'list');
  assert.equal(classify('> x'), 'quote');
  assert.equal(classify('<Label color="red">x</Label>'), 'para', '行内标签开头仍是段落');
  assert.equal(classify('<Tabs>'), 'raw', '块级 MDX 走 raw 兜底');
  assert.equal(classify('| a | b |\n| --- | --- |\n| 1 | 2 |'), 'table', '新插入的表格要认成表格块');
  assert.equal(classify("<DataTable data={[['a']]}/>"), 'table');
  assert.deepEqual(listItems('- a\n- b'), ['a', 'b']);
}

// domToMd：工具栏用 execCommand 改出来的 DOM，要能原样读回 Markdown
{
  const text = (v) => ({ nodeType: 3, nodeValue: v, childNodes: [] });
  const el = (tagName, attrs = {}, kids = []) => ({
    nodeType: 1,
    tagName,
    childNodes: kids,
    dataset: attrs.dataset ?? {},
    classList: { contains: (c) => (attrs.class ?? '').split(' ').includes(c) },
    style: attrs.style ?? {},
    getAttribute: (k) => attrs[k] ?? null,
  });

  const md = (kids) => domToMd({ childNodes: kids });

  assert.equal(md([el('B', {}, [text('粗')])]), '**粗**');
  assert.equal(md([el('I', {}, [text('斜')])]), '*斜*');
  assert.equal(md([el('STRIKE', {}, [text('删')])]), '~~删~~');
  assert.equal(md([el('A', { href: './进度碑刻' }, [text('链接')])]), '[链接](./进度碑刻)');

  // 字色：Chrome 的 foreColor 生成 <font color>
  assert.equal(
    md([el('FONT', { color: '#16a34a' }, [text('绿字')])]),
    "<span style={{color:'#16a34a'}}>绿字</span>"
  );

  // 背景色：hiliteColor 生成行内 background-color，可能和字色叠在同一个节点上
  assert.equal(
    md([el('FONT', { color: '#16a34a', style: { backgroundColor: 'rgb(253, 224, 71)' } }, [text('高亮')])]),
    "<span style={{color:'#16a34a',backgroundColor:'rgb(253, 224, 71)'}}>高亮</span>"
  );
  assert.equal(
    md([el('SPAN', { style: { backgroundColor: '#fde047' } }, [text('只有底色')])]),
    "<span style={{backgroundColor:'#fde047'}}>只有底色</span>"
  );

  assert.equal(md([el('SPAN', { class: 'muted' }, [text('灰')])]), '<span className="muted">灰</span>');
  // 没有样式的 span 不该留下空壳
  assert.equal(md([el('SPAN', {}, [text('普通')])]), '普通');
  // Label 这类原子按 data-md 原样吐回
  assert.equal(
    md([el('SPAN', { dataset: { md: '<Label color="red">危</Label>' } }, [text('危')])]),
    '<Label color="red">危</Label>'
  );
}

console.log('blocks: 全部通过');
