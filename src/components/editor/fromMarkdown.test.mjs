import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { markdownToTiptap } from './fromMarkdown.js';
import { tiptapDocToMarkdown } from './toMarkdown.js';

const docs = path.join(import.meta.dirname, '../../../docs');
const files = [];
(function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.mdx?$/.test(entry.name)) files.push(file);
  }
})(docs);

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const first = markdownToTiptap(source);
  const markdown = tiptapDocToMarkdown(first.content, first.frontmatter);
  const second = markdownToTiptap(markdown);
  const stable = tiptapDocToMarkdown(second.content, second.frontmatter);
  assert.equal(stable, markdown, `${path.basename(file)}: Markdown → Tiptap 往返不稳定`);
  assert.equal(first.format, 'tiptap-v1');
  assert.equal(first.content.type, 'doc');
}

const source = `---
title: 直接导入
---

###### 六级标题

- [ ] 收集碎片
- [x] 找到入口

<Callout color="purple" emoji="🗺️">地图提示</Callout>

:::tip 技巧
提示正文
:::

行内公式 $E = mc^2$ 会跟随正文排列。

$$
\\sum_{i=1}^{n} x_i
$$

![地图](/img/maps/demo.PNG)

<span id="精确文字">可跳转文字</span>

<DataTable id="精确表格" rowIds={[null,"精确表格行"]} data={[["表头"],["内容"]]}/>
`;
const parsed = markdownToTiptap(source);
const output = tiptapDocToMarkdown(parsed.content, parsed.frontmatter);
assert.ok(output.includes('###### 六级标题'), 'H6 导入失败');
assert.ok(output.includes('- [ ] 收集碎片\n- [x] 找到入口'), '检查清单导入失败');
assert.ok(output.includes('<Callout color="purple" emoji="🗺️">地图提示</Callout>'), '提示条导入失败');
assert.ok(output.includes(':::tip 技巧\n提示正文\n:::'), '提示框导入失败');
assert.ok(output.includes('行内公式 $E = mc^2$ 会跟随正文排列。'), '行内公式导入失败');
assert.ok(output.includes('$$\n\\sum_{i=1}^{n} x_i\n$$'), '公式块导入失败');
assert.ok(output.includes('![地图](/img/maps/demo.PNG)'), '图片导入失败');
assert.ok(output.includes('<span id="精确文字">可跳转文字</span>'), '文字跳转点导入失败');
assert.ok(output.includes('id="精确表格"'), '表格跳转点导入失败');
assert.ok(output.includes('rowIds={[null,"精确表格行"]}'), '表格行跳转点导入失败');
const importedTable = parsed.content.content.find((node) => node.type === 'table');
assert.equal(importedTable?.content[1]?.attrs?.anchorId, '精确表格行', '表格行锚点没有写回 Tiptap 文档');

const strongRoundTrip = `- <strong>即时表现分：</strong>实时在聊天栏发送自身行为所获得的表现分\n- <strong>回响提示：</strong>周期性在聊天栏内发送回响效果\n`;
const strongParsed = markdownToTiptap(strongRoundTrip);
assert.equal(strongParsed.content.content[0].content[0].content[0].content[0].marks?.[0]?.type, 'bold', '<strong> 导入后未还原为 bold mark');
assert.equal(tiptapDocToMarkdown(strongParsed.content), strongRoundTrip, '<strong> 往返不稳定');

console.log(`markdownToTiptap: ${files.length} 篇真实文档 + 构造用例全部通过`);
