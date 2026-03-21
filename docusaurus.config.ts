import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: "MidSoul Wiki",
  tagline: "探索午夜灵魂的世界",
  favicon: "img/favicon.svg",

  future: {
    v4: true,
  },

  url: "https://wiki.hfpro.dev",
  baseUrl: "/MidSoul/",

  organizationName: "HeimNad",
  projectName: "MidSoul-Wiki",
  deploymentBranch: "gh-pages",
  trailingSlash: false,

  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",

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
        searchBarShortcutHint: false,
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
    image: "img/MidSoul-Logo.png",
    colorMode: {
      defaultMode: "dark",
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: "",
      hideOnScroll: true,
      logo: {
        alt: "MidSoul Wiki",
        src: "img/MidSoul-Logo-Dark.png",
        srcDark: "img/MidSoul-Logo.png",
        href: "/",
        width: 120,
        height: 36,
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
          title: "百科",
          items: [
            { label: "整体介绍", to: "/wiki/午夜灵魂/整体介绍" },
            { label: "机制说明", to: "/wiki/午夜灵魂/机制说明" },
            { label: "能力一览", to: "/wiki/午夜灵魂/能力一览" },
          ],
        },
        {
          title: "更多",
          items: [
            { label: "回响记录", to: "/wiki/午夜灵魂/回响记录" },
            { label: "进度碑刻", to: "/wiki/午夜灵魂/进度碑刻" },
            { label: "饰品集册", to: "/wiki/午夜灵魂/饰品集册" },
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
