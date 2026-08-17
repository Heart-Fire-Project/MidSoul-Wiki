import { themes as prismThemes } from "prism-react-renderer";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Config, LoadContext, Plugin } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

type ImageLibraryContent = { images: string[] };
const IMAGE_FILE = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i;
// 编辑器通过本机 File System Access API 直接读写仓库文件，属于作者工具而
// 非公开 Wiki 功能。生产构建必须不生成此路由；仅 docusaurus start 的开发
// 环境会加载 src/pages/editor.tsx。
const isDevelopment = process.env.NODE_ENV === 'development';
const defaultPageExcludes = [
  '**/_*.{js,jsx,ts,tsx,md,mdx}',
  '**/_*/**',
  '**/*.test.{js,jsx,ts,tsx}',
  '**/__tests__/**',
];

async function readImageLibrary(directory: string, relative = ''): Promise<string[]> {
  let entries;
  try { entries = await fs.readdir(directory, { withFileTypes: true }); } catch { return []; }
  const images: string[] = [];
  for (const entry of entries) {
    const nextRelative = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) images.push(...await readImageLibrary(path.join(directory, entry.name), nextRelative));
    else if (IMAGE_FILE.test(entry.name)) images.push(`/img/${nextRelative}`);
  }
  return images.sort((left, right) => left.localeCompare(right, 'zh'));
}

/** Make static/img browsable from the editor without bundling the image files into JavaScript. */
function imageLibraryPlugin(context: LoadContext): Plugin {
  const imageDirectory = path.join(context.siteDir, 'static', 'img');
  return {
    name: 'midsoul-image-library',
    loadContent: async () => ({ images: await readImageLibrary(imageDirectory) }),
    contentLoaded: async ({ content, actions }) => { actions.setGlobalData(content as ImageLibraryContent); },
    getPathsToWatch: () => [path.join(imageDirectory, '**', '*')],
  };
}

const config: Config = {
  title: "MidSoul Wiki",
  tagline: "探索午夜灵魂的世界",
  favicon: "img/favicon.svg",

  // 浏览器中的可视化编辑器在调整复杂表格时偶尔触发 ResizeObserver 警告。
  // 这不是应用异常；只让开发服务器不为这一条警告显示全屏错误遮罩，真正的
  // 编译错误和其他运行时错误仍保持可见。
  plugins: [
    imageLibraryPlugin,
    function suppressResizeObserverOverlay() {
      return {
        name: 'suppress-resize-observer-overlay',
        // Docusaurus's plugin type omits webpack-dev-server options, although the
        // development server accepts this setting at runtime.
        configureWebpack(): any {
          return {
            devServer: {
              client: {
                overlay: {
                  runtimeErrors: (error: Error) => !error.message.includes('ResizeObserver loop completed with undelivered notifications'),
                },
              },
            },
          };
        },
      };
    },
  ],

  future: {
    v4: true,
    faster: true,
  },

  url: "https://wiki.hfpro.dev",
  baseUrl: "/midsoul/",

  organizationName: "Heart Fire Project",
  projectName: "MidSoul-Wiki",
  trailingSlash: false,

  onBrokenLinks: "throw",

  markdown: {
    hooks: {
      onBrokenMarkdownLinks: "warn",
    },
  },

  i18n: {
    defaultLocale: "zh-Hans",
    locales: ["zh-Hans"],
  },

  themes: [
    [
      require.resolve("@easyops-cn/docusaurus-search-local"),
      {
        hashed: true,
        language: ["zh"],
        indexBlog: false,
        docsRouteBasePath: "/wiki",
      },
    ],
  ],

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          routeBasePath: "wiki",
          remarkPlugins: [remarkMath],
          rehypePlugins: [rehypeKatex],
        },
        blog: {
          blogTitle: "更新日志",
          blogDescription: "MidSoul 版本更新记录",
          blogSidebarTitle: "历史版本",
          blogSidebarCount: "ALL",
          postsPerPage: 5,
          showReadingTime: false,
          feedOptions: {
            type: ["rss"],
            title: "MidSoul Wiki 更新日志",
            xslt: true,
          },
          onInlineTags: "warn",
          onInlineAuthors: "warn",
          onUntruncatedBlogPosts: "warn",
          remarkPlugins: [remarkMath],
          rehypePlugins: [rehypeKatex],
        },
        pages: {
          // 显式保留 Docusaurus 默认排除规则，再在生产环境额外排除编辑器页面。
          exclude: isDevelopment ? defaultPageExcludes : [...defaultPageExcludes, '**/editor*.{js,jsx,ts,tsx}'],
        },
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    tableOfContents: {
      minHeadingLevel: 2,
      maxHeadingLevel: 4,
    },
    // 分享卡片按 1.91:1 裁切，直接用 3.24:1 的 logo 会被裁掉两头。
    image: "img/og-cover.jpg",
    colorMode: {
      defaultMode: "dark",
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: "",
      hideOnScroll: true,
      logo: {
        alt: "MidSoul Wiki",
        src: "img/MidSoul-Logo-Dark.webp",
        srcDark: "img/MidSoul-Logo.webp",
        href: "/",
        // 原图 2400×741（3.24:1），导航栏按 2rem 高显示；写成 120×36（3.33:1）
        // 会让浏览器按错误比例预留占位。这里按真实比例给 104×32。
        width: 104,
        height: 32,
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "tutorialSidebar",
          position: "left",
          label: "百科",
          className: "nav-wiki",
        },
        {
          to: "/blog",
          label: "更新日志",
          position: "left",
          className: "nav-blog",
        },
        {
          href: "https://github.com/heart-fire-project",
          position: "right",
          className: "navbar-github-link",
          "aria-label": "心火计划",
          label: "心火计划",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "核心玩法",
          items: [
            { label: "模式介绍", to: "/wiki/午夜灵魂/模式介绍" },
            { label: "能力一览", to: "/wiki/午夜灵魂/能力一览" },
            { label: "全局机制", to: "/wiki/午夜灵魂/全局机制" },
          ],
        },
        {
          title: "系统资料",
          items: [
            { label: "地图导览", to: "/wiki/午夜灵魂/地图导览" },
            { label: "回响记录", to: "/wiki/午夜灵魂/回响记录" },
            { label: "进度碑刻", to: "/wiki/午夜灵魂/进度碑刻" },
          ],
        },
        {
          title: "收藏与动态",
          items: [
            { label: "饰品集册", to: "/wiki/午夜灵魂/饰品集册" },
            { label: "文本套组详览", to: "/wiki/午夜灵魂/饰品集册-文本套组详览" },
            { label: "更新日志", to: "/blog" },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} 心火计划 · MidSoul Wiki`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
