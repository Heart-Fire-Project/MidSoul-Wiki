# MidSoul-Wiki

![Logo](./static/img/MidSoul-Logo.png)

MidSoul-Wiki 是 [Heart Fire Project](https://github.com/Heart-Fire-Project) 旗下项目**《午夜灵魂》**的官方文档与维基站点。

本项目使用 [Docusaurus 3](https://docusaurus.io/) 构建，旨在为玩家提供关于《午夜灵魂》内各个系统与物件的详细信息。

## 📖 核心板块

- **整体介绍**: 主要玩法、地图与系统总览
- **机制说明**: 全机制详细信息
- **能力一览**: 技能、天赋、灵魂宝物全集
- **饰品集册**: 饰品详情与获取方式
- **进度碑刻**: 全进度达成条件
- **回响记录**: 回响机制完整说明

## 🛠️ 本地开发

确保你已安装 [Node.js](https://nodejs.org/)（建议 v20 或更高版本）。

1. **克隆仓库**
   ```bash
   git clone https://github.com/Heart-Fire-Project/MidSoul-Wiki.git
   cd MidSoul-Wiki
   ```

2. **安装依赖**（本项目使用 pnpm）
   ```bash
   pnpm install
   ```

3. **启动开发服务器**
   ```bash
   pnpm start
   ```

4. **构建静态站点**
   ```bash
   pnpm build
   ```

## 🧩 内置 MDX 组件

所有组件在 `.md` 文档中无需 import，直接使用。

---

### ColorTable

对表格的表头、列、行、单元格单独设置背景色或文字色。

```mdx
<ColorTable
  header={[...]}
  cols={[...]}
  rows={[...]}
  cells={[[行, 列, 颜色], ...]}
  hideHeader
  noFirstCol
>

| 列1 | 列2 | 列3 |
| --- | --- | --- |
| ... | ... | ... |

</ColorTable>
```

> 注意：开始标签 `>` 与表格之间必须留一个空行，MDX 才能正确解析 Markdown。

**属性说明**

| 属性 | 类型 | 说明 |
| :--- | :--- | :--- |
| `header` | `ColorValue[]` | 按列顺序设置**表头**背景/文字色 |
| `cols` | `ColorValue[]` | 按列顺序设置**所有内容行**该列的背景/文字色 |
| `rows` | `ColorValue[]` | 按行顺序设置**整行**背景/文字色 |
| `cells` | `[行, 列, ColorValue][]` | 精确设置**单个单元格**，行列从 `1` 开始 |
| `hideHeader` | `boolean` | 隐藏表头行 |
| `noFirstCol` | `boolean` | 取消首列灰色高亮（全局样式） |

`ColorValue` 可以是：
- `null` — 跳过
- `'rgba(...)'` / `'#hex'` — 只改背景色
- `{ bg: '...', text: '...' }` — 同时改背景和文字色

**优先级**：`cols` → `rows` → `cells`（后者覆盖前者）

**示例**

```mdx
// 按列上色
<ColorTable cols={['rgba(240,251,239)', 'rgba(254,242,241)']}>

// 按行上色，同时改文字色
<ColorTable rows={[null, { bg: 'rgba(219,234,254)', text: '#1d4ed8' }]}>

// 精确单元格
<ColorTable cells={[[1, 3, { bg: 'rgba(255,255,204)', text: '#92400e' }]]}>

// 隐藏表头 + 取消首列灰色
<ColorTable hideHeader noFirstCol rows={[...]}>

// 组合使用
<ColorTable
  header={['#7367F0', null]}
  rows={[null, 'rgba(254,242,241)']}
  cells={[[3, 2, 'rgba(240,251,239)']]}
>
```

---

### Label

行内小标签，支持预设颜色与自定义色值。

```mdx
<Label color="预设名">文字</Label>
<Label bg="rgba(...)" text="#hex" border="rgba(...)">文字</Label>
```

**预设颜色**：`purple` · `blue` · `green` · `red` · `yellow` · `gray`

```mdx
<Label color="green">灵魂</Label>
<Label color="red">守卫者</Label>
这是一个 <Label color="purple">专属</Label> 技能。
```

---

### 注释文字

使用 `.muted` class 插入灰色小字：

```mdx
<small className="muted">这是注释内容</small>
```

## 🚀 部署

本项目由 GitHub Pages 自动托管。

## 📄 许可证

除非另有说明，本项目内容遵循 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) 协议，代码部分遵循 [MIT License](./LICENSE)（若有）。

---

*由 [Heart Fire Project](https://github.com/Heart-Fire-Project) 倾力呈现*
