# MidSoul-Wiki

<p align="center">
  <img src="./static/img/MidSoul-Wiki-Logo.webp" width="360" />
</p>

MidSoul-Wiki 是 [Heart Fire Project](https://github.com/Heart-Fire-Project) 旗下项目 **午夜灵魂** 的官方文档与维基站点。

本项目使用 [Docusaurus 3](https://docusaurus.io/) 构建，旨在为玩家提供关于《午夜灵魂》内各系统、机制及物件的详细信息。

## 📖 核心板块

- **全局机制**: 本游戏的基础系统与机制
- **模式介绍**: 各模式的流程、玩法及其中的机制
- **地图导览**: 各地图的数据与机制
- **能力一览**: 游戏内的所有天赋、技能与灵魂宝物
- **回响记录**: 所有回响的详细信息
- **进度碑刻**: 所有进度的详细信息、触发条件与奖励
- **饰品集册**: 所有装饰品的详细信息与获取方法

## 🛠️ 本地开发

请确保你已安装 [Node.js](https://nodejs.org/)（建议 v20 或更高版本）。

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

## ✍️ 内容编辑（可视化编辑器）

文档内容**不手写 Markdown / MDX**，统一通过站点内置的可视化编辑器完成。

### 使用方式

1. 启动开发服务器后访问 **http://localhost:3000/midsoul/editor** （该页面仅在开发环境可用）
2. 点击左侧文件树打开要编辑的文档
3. 编辑完成后按 **`Cmd/Ctrl + S`** 保存

### 双轨存储

每篇文档在 `docs/` 下成对存在两个文件：

| 文件 | 作用 |
| :--- | :--- |
| `xxx.tiptap.json` | **编辑源**：编辑器读取/写入的无损格式，包含全部排版细节 |
| `xxx.md` | **渲染源**：Docusaurus 构建使用的 Markdown，由编辑器保存时自动导出 |

> 保存时编辑器会**先写 `.tiptap.json`、再导出 `.md`**，两者始终同步。  
> 请只通过编辑器修改内容，不要手工改动这两个文件，否则会导致格式丢失或双轨不一致。

编辑器支持会话恢复：意外关闭页面后重新打开，会提示恢复未保存的草稿（浏览器 `sessionStorage`）。

### 特殊符号写法

在编辑器里**直接输入字符**即可，保存时会自动处理转义，不需要（也不应该）手写反斜杠：

- 比较符号：直接输入 `K<1.6`、`K≥2.5`（保存后导出为 `K\<1.6` 是正常现象，发布页会正确显示为 `<`）
- 乘法符号：直接输入 `10*(10-灵魂数)%`
- 数学公式：编辑器支持 `$...$` 行内公式（如 `$E=mc^2$`），由 KaTeX 渲染

> **再次提醒**，手写 `.md` 时**不要**手动加反斜杠转义（如 `\<`、`\*`）  
> —— 表格单元格的自定义渲染器不会还原这些转义，发布页会直接显示反斜杠。

### 排版与格式

- **加粗**：编辑器正常选中文字加粗即可。即使加粗内容以标点结尾（如「即时表现分：」），导出时也会自动使用安全写法，发布页正常渲染
- **表格**：支持表头上色、单元格染色、合并单元格、行内换行与列表；长表格发布后自动获得 sticky 表头
- **行内标签/上色/锚点**：编辑器工具栏提供对应按钮，生成的格式全部为发布页所支持

## 🔤 字体

标题使用自托管的 **Noto Serif SC 子集**（`src/css/fonts/`），正文使用系统字体栈。不走 Google Fonts —— 那个域名对国内读者基本不可达，且 `@import` 会阻塞渲染。

子集按**全站出现过的汉字**裁剪（当前约 1176 字，两个字重合计约 470KB）。**新增文档若用到了子集之外的字，标题里那几个字会回落系统宋体**，需要重新生成：

```bash
pnpm fonts
```

需要 [uv](https://docs.astral.sh/uv/)（用来跑 fonttools）。源字体会自动下载并缓存到 `.cache-fonts/`（已 gitignore）。CI 会在仓库用字超出 `scripts/font-charset.txt` 时报错提醒。

## 🚀 部署

本项目由 Cloudflare Pages 自动托管，推送到 `main` 分支后自动构建部署。

## 📄 许可证

除非另有说明，本项目内容遵循 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) 协议，代码部分遵循 [MIT License](./LICENSE)（若有）。

---

*由 [Heart Fire Project](https://github.com/Heart-Fire-Project) 倾力呈现*
