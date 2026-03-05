import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import styles from './index.module.css';

const WIKI_CARDS = [
  { glyph: '◈', label: '整体介绍', sub: '游戏概述 · 模式 · 地图', href: '/wiki/午夜灵魂/整体介绍' },
  { glyph: '⚙', label: '机制说明', sub: '游戏内外全部机制', href: '/wiki/午夜灵魂/机制说明' },
  { glyph: '⚡', label: '能力一览', sub: '天赋 · 技能 · 宝物', href: '/wiki/午夜灵魂/能力一览' },
  { glyph: '☽', label: '回响记录', sub: '全局概率随机效果', href: '/wiki/午夜灵魂/回响记录' },
  { glyph: '✦', label: '进度碑刻', sub: '成就进度 · 装饰解锁', href: '/wiki/午夜灵魂/进度碑刻' },
  { glyph: '✧', label: '饰品集册', sub: '粒子 · 特效 · 文本套组', href: '/wiki/午夜灵魂/饰品集册' },
];

export default function Home(): ReactNode {
  return (
    <Layout title="午夜灵魂 Wiki" description="灵魂与守卫者的对决">
      <div className={styles.root}>

        {/* ── HERO ── */}
        <section className={styles.hero}>
          <div className={styles.heroBg}>
            <div className={styles.orb1} />
            <div className={styles.orb2} />
            <div className={styles.orb3} />
            <div className={styles.grid} />
          </div>

          <div className={styles.heroContent}>
            <h1 className={styles.heroTitle}>
              <span className={styles.titleZh}>午夜灵魂</span>
              <span className={styles.titleEn}>M I D S O U L</span>
            </h1>

            <p className={styles.heroTagline}>
              灵魂，在弥漫的灵气中谋求逃脱。<br />
              守卫者，在黑暗深处伺机猎杀。
            </p>

            <div className={styles.heroActions}>
              <Link className={styles.ctaPrimary} to="/wiki">进入百科</Link>
              <Link className={styles.ctaSecondary} to="/wiki/午夜灵魂/整体介绍">游戏简介 →</Link>
            </div>
          </div>

          <div className={styles.heroScroll}>↓</div>
        </section>

        {/* ── FACTIONS ── */}
        <section className={styles.factions}>
          <div className={styles.factionSoul}>
            <div className={styles.factionInner}>
              <span className={styles.factionGlyph}>☽</span>
              <h2 className={styles.factionName}>灵　魂</h2>
              <p className={styles.factionEn}>S O U L</p>
              <p className={styles.factionDesc}>
                弱小却不孤单。收集飘散的灵气碎片，
                为传送门注能，借助队友的灵魂之灯，
                在追逐与绝境中完成复活。
              </p>
              <ul className={styles.factionTraits}>
                <li><span>◦</span>碎片收集 · 传送门充能</li>
                <li><span>◦</span>灵魂宝物 · 同伴救助</li>
                <li><span>◦</span>垂死挣扎 · 最终复活</li>
              </ul>
            </div>
          </div>

          <div className={styles.factionDivider}>
            <div className={styles.dividerLine} />
            <span className={styles.dividerText}>对决</span>
            <div className={styles.dividerLine} />
          </div>

          <div className={styles.factionGuard}>
            <div className={styles.factionInner}>
              <span className={styles.factionGlyph}>⚔</span>
              <h2 className={styles.factionName}>守卫者</h2>
              <p className={styles.factionEn}>G U A R D I A N</p>
              <p className={styles.factionDesc}>
                速度与力量的化身。追踪每一个灵魂的气息，
                阻止传送门开启，在收集与充能的间隙
                将灵魂逐一消亡。
              </p>
              <ul className={styles.factionTraits}>
                <li><span>◦</span>速度优势 · 气息探测</li>
                <li><span>◦</span>攻击击倒 · 垂死守候</li>
                <li><span>◦</span>宝盒打开 · 阵营胜利</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ── MODES ── */}
        <section className={styles.modes}>
          <h2 className={styles.sectionTitle}><span>游戏模式</span></h2>
          <div className={styles.modesGrid}>

            <div className={styles.modeCard}>
              <div className={styles.modeTop}>
                <span className={styles.modeIcon}>◈</span>
                <div>
                  <h3 className={styles.modeName}>灵气碎片</h3>
                  <p className={styles.modeTag}>标准竞技模式</p>
                </div>
              </div>
              <p className={styles.modeDesc}>
                灵魂收集场上的灵气碎片，达成目标后为传送门充能，
                最终经由传送门复活。守卫者则需追踪阻止。
                三阶段递进，策略与对抗并重。
              </p>
              <div className={styles.modeTags}>
                <span>5 ~ 10 人</span>
                <span>随机阵营</span>
                <span>计入统计</span>
                <span>灵能反噬保底</span>
              </div>
            </div>

            <div className={styles.modeCard}>
              <div className={styles.modeTop}>
                <span className={styles.modeIcon}>⚡</span>
                <div>
                  <h3 className={styles.modeName}>针锋奔逃</h3>
                  <p className={styles.modeTag}>娱乐快节奏模式</p>
                </div>
              </div>
              <p className={styles.modeDesc}>
                跳过收集阶段，传送门直接出现，更多守卫者严阵以待。
                节奏更快、对抗更直接。
                不计经验值与统计数据。
              </p>
              <div className={styles.modeTags}>
                <span>2 ~ 10 人</span>
                <span>无保底</span>
                <span>不计统计</span>
                <span>适合娱乐局</span>
              </div>
            </div>

          </div>
        </section>

        {/* ── WIKI NAV ── */}
        <section className={styles.wikiNav}>
          <h2 className={styles.sectionTitle}><span>百科导览</span></h2>
          <div className={styles.wikiGrid}>
            {WIKI_CARDS.map((card) => (
              <Link key={card.label} className={styles.wikiCard} to={card.href}>
                <span className={styles.wikiGlyph}>{card.glyph}</span>
                <span className={styles.wikiLabel}>{card.label}</span>
                <span className={styles.wikiSub}>{card.sub}</span>
                <span className={styles.wikiArrow}>→</span>
              </Link>
            ))}
          </div>
        </section>

      </div>
    </Layout>
  );
}
