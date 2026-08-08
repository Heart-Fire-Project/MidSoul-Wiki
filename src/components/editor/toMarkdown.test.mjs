import assert from 'node:assert/strict';
import { tiptapDocToMarkdown } from './toMarkdown.js';
import { findTables } from './tableIO.js';

const document = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2, textAlign: 'center' }, content: [{ type: 'text', text: '居中标题', marks: [{ type: 'bold' }] }] },
    { type: 'heading', attrs: { level: 6 }, content: [{ type: 'text', text: '六级标题' }] },
    { type: 'taskList', content: [
      { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: '待完成' }] }] },
      { type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [{ type: 'text', text: '已完成' }] }] },
    ] },
    { type: 'paragraph', content: [
      { type: 'text', text: '链接', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }, { type: 'anchor', attrs: { id: '精确文字' } }] },
      { type: 'text', text: ' 高亮', marks: [{ type: 'underline' }, { type: 'ink', attrs: { fg: '#245bdb', bg: '#eef', fgDark: '#9d94f5', bgDark: null } }] },
      { type: 'text', text: ' 标签', marks: [{ type: 'label', attrs: { color: 'purple' } }] },
      { type: 'text', text: ' 能量为 ' },
      { type: 'inlineMath', attrs: { latex: 'E = mc^2' } },
    ] },
    { type: 'blockMath', attrs: { latex: '\\sum_{i=1}^{n} x_i' } },
    { type: 'table', attrs: { hideHeader: true, noFirstCol: true, anchorId: '精确表格' }, content: [
      { type: 'tableRow', attrs: { anchorId: '左格定位' }, content: [
        { type: 'tableHeader', attrs: { colspan: 2, rowspan: 1, colwidth: [140, 180], layoutMode: 'equal' }, content: [{ type: 'paragraph', attrs: { textAlign: 'center' }, content: [{ type: 'text', text: '表头' }] }] },
      ] },
      { type: 'tableRow', content: [
        { type: 'tableCell', attrs: { colspan: 1, rowspan: 1, backgroundColor: '#fff3a3', backgroundOpacity: 0.45, textColor: '#123456', layoutMode: 'equal' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: '左格' }] }] },
        { type: 'tableCell', attrs: { colspan: 1, rowspan: 1, backgroundColor: null, backgroundOpacity: 1, textColor: null, layoutMode: 'equal' }, content: [{ type: 'paragraph', attrs: { textAlign: 'right' }, content: [{ type: 'text', text: '右格' }] }] },
      ] },
    ] },
    { type: 'callout', attrs: { color: 'purple', emoji: '🗺️' }, content: [{ type: 'text', text: '地图提示' }] },
    { type: 'admonition', attrs: { kind: 'tip', title: '技巧' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: '提示正文' }] }] },
    { type: 'image', attrs: { src: '/img/maps/demo.PNG', alt: '地图' } },
    { type: 'rawMdx', attrs: { source: '<Tabs>原样内容</Tabs>' } },
  ],
};

const markdown = tiptapDocToMarkdown(document, '---\ntitle: 自动导出\n---\n');

assert.ok(markdown.startsWith('---\ntitle: 自动导出\n---\n\n'), 'frontmatter 丢失或间距不正确');
assert.ok(markdown.includes("## <span style={{display:'block',textAlign:'center'}}>**居中标题**</span>"), '标题对齐丢失');
assert.ok(markdown.includes('###### 六级标题'), 'H5/H6 标题支持不完整');
assert.ok(markdown.includes('- [ ] 待完成\n- [x] 已完成'), '检查清单状态丢失');
assert.ok(markdown.includes('[链接](https://example.com)'), '链接丢失');
assert.ok(markdown.includes('<span id="精确文字">[链接](https://example.com)</span>'), '文字跳转点丢失');
assert.ok(markdown.includes("'--fg':'#245bdb'"), '亮色文字颜色丢失');
assert.ok(markdown.includes("'--fg-d':'#9d94f5'"), '暗色文字颜色丢失');
assert.ok(markdown.includes("textDecoration:'underline'"), '下划线丢失');
assert.ok(markdown.includes('<Label color="purple"> 标签</Label>'), '标签丢失');
assert.ok(markdown.includes('能量为 $E = mc^2$'), '行内公式丢失');
assert.ok(markdown.includes('$$\n\\sum_{i=1}^{n} x_i\n$$'), '公式块丢失');
assert.ok(markdown.includes('<DataTable layout="equal" widths={["140px","180px"]}'), '表格布局或列宽丢失');
assert.ok(markdown.includes('hideHeader noFirstCol'), '表格显示开关丢失');
assert.ok(markdown.includes('id="精确表格"'), '表格跳转点丢失');
assert.ok(markdown.includes('rowIds={["左格定位",null]}'), '表格行跳转点丢失');
assert.ok(markdown.includes("bg:'#fff3a3',op:0.45,fg:'#123456'"), '单元格颜色或透明度丢失');
assert.ok(markdown.includes("al:'r'"), '单元格对齐丢失');
assert.ok(markdown.includes('<Callout color="purple" emoji="🗺️">地图提示</Callout>'), '提示条丢失');
assert.ok(markdown.includes(':::tip 技巧\n提示正文\n:::'), '提示框丢失');
assert.ok(markdown.includes('![地图](/img/maps/demo.PNG)'), '图片路径丢失');
assert.ok(markdown.includes('<Tabs>原样内容</Tabs>'), '未知 MDX 丢失');

const [table] = findTables(markdown);
assert.equal(table.grid.layout, 'equal');
assert.deepEqual(table.grid.widths, ['140px', '180px']);
assert.equal(table.grid.hideHeader, true);
assert.equal(table.grid.noFirstCol, true);
assert.equal(table.grid.id, '精确表格');
assert.deepEqual(table.grid.rowIds, ['左格定位', null]);
assert.equal(table.grid.cells[1][0].op, 0.45);
assert.equal(table.grid.cells[1][1].al, 'r');

const boldWithTrailingColon = tiptapDocToMarkdown({
  type: 'doc',
  content: [{
    type: 'paragraph',
    content: [
      { type: 'text', text: '即时表现分：', marks: [{ type: 'bold' }] },
      { type: 'text', text: '实时在聊天栏发送' },
    ],
  }],
});
assert.equal(boldWithTrailingColon.trim(), '<strong>即时表现分：</strong>实时在聊天栏发送', '加粗以标点结尾且后接非标点文字时，CommonMark 无法闭合 **，应输出 <strong> 保留冒号加粗');

const boldTrailingColonAtEnd = tiptapDocToMarkdown({
  type: 'doc',
  content: [{
    type: 'paragraph',
    content: [{ type: 'text', text: '回响提示：', marks: [{ type: 'bold' }] }],
  }],
});
assert.equal(boldTrailingColonAtEnd.trim(), '**回响提示：**', '加粗以标点结尾但无后继文字时，** 可正常闭合，保持星号语法');

const boldTrailingColonInTable = tiptapDocToMarkdown({
  type: 'doc',
  content: [{
    type: 'table',
    attrs: {},
    content: [{
      type: 'tableRow',
      content: [{
        type: 'tableCell',
        attrs: { colspan: 1, rowspan: 1, layoutMode: 'equal' },
        content: [{ type: 'paragraph', content: [
          { type: 'text', text: '即时表现分：', marks: [{ type: 'bold' }] },
          { type: 'text', text: '实时在聊天栏发送' },
        ] }],
      }],
    }],
  }],
});
assert.ok(boldTrailingColonInTable.includes('**即时表现分：**实时在聊天栏发送'), '表格单元格由 DataTable.inlineMd 渲染，只识别 **，不能改写为 <strong>');

const boldTrailingColonInTableList = tiptapDocToMarkdown({
  type: 'doc',
  content: [{
    type: 'table',
    attrs: {},
    content: [{
      type: 'tableRow',
      content: [{
        type: 'tableCell',
        attrs: { colspan: 1, rowspan: 1, layoutMode: 'equal' },
        content: [{
          type: 'bulletList',
          content: [{
            type: 'listItem',
            content: [{ type: 'paragraph', content: [
              { type: 'text', text: '即时表现分：', marks: [{ type: 'bold' }] },
              { type: 'text', text: '实时在聊天栏发送' },
            ] }],
          }],
        }],
      }],
    }],
  }],
});
assert.ok(boldTrailingColonInTableList.includes('- **即时表现分：**实时在聊天栏发送'), '单元格内嵌列表仍由 DataTable.inlineMd 渲染，mode 必须贯穿到嵌套块');

const inkBoldNoColon = tiptapDocToMarkdown({
  type: 'doc',
  content: [{ type: 'paragraph', content: [
    { type: 'text', text: '灵魂', marks: [{ type: 'bold' }, { type: 'ink', attrs: { fg: '#245bdb' } }] },
    { type: 'text', text: '碎片' },
  ] }],
});
assert.ok(inkBoldNoColon.includes("<strong>灵魂</strong></span>碎片"), 'ink 的 span 是 JSX，内部 ** 不解析，上色+加粗必须输出 <strong>');

const inkBoldAtLineEnd = tiptapDocToMarkdown({
  type: 'doc',
  content: [{ type: 'paragraph', content: [
    { type: 'text', text: '回响提示：', marks: [{ type: 'bold' }, { type: 'ink', attrs: { fg: '#245bdb' } }] },
  ] }],
});
assert.ok(inkBoldAtLineEnd.includes("<strong>回响提示：</strong></span>"), '上色+加粗即使无后继文字，span 内也必须用 <strong>');

const boldInsideCallout = tiptapDocToMarkdown({
  type: 'doc',
  content: [{ type: 'callout', attrs: { color: 'green', emoji: '🗺️' }, content: [
    { type: 'text', text: '灵魂', marks: [{ type: 'bold' }] },
    { type: 'text', text: '碎片' },
  ] }],
});
assert.ok(boldInsideCallout.includes('<Callout color="green" emoji="🗺️"><strong>灵魂</strong>碎片</Callout>'), 'Callout 内容是 JSX 文本，内部加粗必须用 <strong>');

const mdxSafeText = tiptapDocToMarkdown({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: '剩余灵魂 <3 人' }] }],
});
assert.equal(mdxSafeText.trim(), '剩余灵魂 \\<3 人', '小于号没有转义，MDX 会把 <数字 误判为 JSX 标签');

const coloredParagraphs = tiptapDocToMarkdown({
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: '第一段', marks: [{ type: 'ink', attrs: { fg: '#777' } }] }] },
    { type: 'paragraph', content: [{ type: 'text', text: '第二段', marks: [{ type: 'ink', attrs: { bg: '#eee' } }] }] },
  ],
});
assert.ok(coloredParagraphs.includes("<p><span style={{color:'#777'}}>第一段</span></p>\n\n<p><span style={{backgroundColor:'#eee'}}>第二段</span></p>"), '纯样式段落丢失了块级边界');

console.log('tiptapToMarkdown: 全部通过');
