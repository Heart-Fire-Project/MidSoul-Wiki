import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import { Moon, Swords, Map, Dices, Trophy, Gamepad2, Zap, Settings, Gem, FileText, type LucideIcon } from 'lucide-react';
import styles from './index.module.css';

const WIKI_CARDS: Array<{ icon: LucideIcon; label: string; sub: string; href: string }> = [
  { icon: Settings, label: '全局机制', sub: '本游戏的基础系统与机制', href: '/wiki/午夜灵魂/全局机制' },
  { icon: Gamepad2, label: '模式介绍', sub: '各模式的流程、玩法及其中的机制', href: '/wiki/午夜灵魂/模式介绍' },
  { icon: Map, label: '地图导览', sub: '各地图的数据与机制', href: '/wiki/午夜灵魂/地图导览' },
  { icon: Zap, label: '能力一览', sub: '游戏内的所有天赋、技能与灵魂宝物', href: '/wiki/午夜灵魂/能力一览' },
  { icon: Dices, label: '回响记录', sub: '所有回响的详细信息', href: '/wiki/午夜灵魂/回响记录' },
  { icon: Trophy, label: '进度碑刻', sub: '所有进度的详细信息、触发条件与奖励', href: '/wiki/午夜灵魂/进度碑刻' },
  { icon: Gem, label: '饰品集册', sub: '所有装饰品的详细信息与获取方法', href: '/wiki/午夜灵魂/饰品集册' },
  { icon: FileText, label: '更新日志', sub: '版本更新记录', href: '/blog' },
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
              <span className={styles.titleEn}>Midnight Soul</span>
            </h1>

            <p className={styles.heroTagline}>
              在灵气充盈的午夜<br />
              来一场灵魂与守卫间的追逃之旅
            </p>

            <div className={styles.heroActions}>
              <Link className={styles.ctaPrimary} to="/wiki">进入百科</Link>
              <Link className={styles.ctaSecondary} to="/wiki/午夜灵魂/能力一览">能力一览 →</Link>
            </div>
          </div>

          <div className={styles.heroScroll}>↓</div>
        </section>

        {/* ── FACTIONS ── */}
        <section className={styles.factions}>
          <div className={styles.factionSoul}>
            <div className={styles.factionInner}>
              {/* ⚔/☽ 等 Unicode 字形在部分系统上按 emoji 渲染、度量不一致，改用 lucide 图标 */}
              <span className={styles.factionGlyph}><Moon size={44} strokeWidth={1.5} /></span>
              <h2 className={styles.factionName}>灵魂</h2>
              <p className={styles.factionEn}>SOUL</p>
              <p className={styles.factionDesc}>
                齐心协力，收集地图上的灵魂碎片以打开传送门，最终在奔逃与躲避中回到现世，取得复活。
              </p>
              <ul className={styles.factionTraits}>
                <li><span>◦</span>收集 · 汲取灵气，召唤传送门</li>
                <li><span>◦</span>点灯 · 救助队友，一同奔向目标</li>
                <li><span>◦</span>充能 · 一同合作，打开往复活之门</li>
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
              <span className={styles.factionGlyph}><Swords size={44} strokeWidth={1.5} /></span>
              <h2 className={styles.factionName}>灵魂守卫者</h2>
              <p className={styles.factionEn}>SOUL GUARDIAN</p>
              <p className={styles.factionDesc}>
                利用速度优势，在追逐中阻遏灵魂的复活，抑或拦住去路静待灵气消散，让灵魂尽数消亡以维持世间平衡。
              </p>
              <ul className={styles.factionTraits}>
                <li><span>◦</span>骁勇出击，令灵魂垂死 · 击倒</li>
                <li><span>◦</span>抢占先机，夺取含宝之盒 · 破坏</li>
                <li><span>◦</span>布下埋伏，静待灵魂入网来 · 静候</li>
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
                  <p className={styles.modeTag}>标准游戏模式</p>
                </div>
              </div>
              <p className={styles.modeDesc}>
                灵魂需要在守卫者的不断追捕下收集碎片以生成传送门，再对传送门充能后经由其复活；守卫者则需尽力阻遏灵魂并令其消亡。
              </p>
              <div className={styles.modeTags}>
                <span>5 ~ 10 玩家</span>
                <span>6 ~ 12 分钟</span>
                <span>基础游戏</span>
                <span>计入数据</span>
              </div>
            </div>

            <div className={styles.modeCard}>
              <div className={styles.modeTop}>
                <span className={styles.modeIcon}>⚡</span>
                <div>
                  <h3 className={styles.modeName}>针锋奔逃</h3>
                  <p className={styles.modeTag}>娱乐游戏模式</p>
                </div>
              </div>
              <p className={styles.modeDesc}>
                跳过收集阶段，传送门将直接出现，但同时有更多守卫者严阵以待；在更直接的对抗下尝试搭配不同的能力来取得胜利吧！
              </p>
              <div className={styles.modeTags}>
                <span>2 ~ 10 玩家</span>
                <span>2 ~ 5 分钟</span>
                <span>快节奏游戏</span>
                <span>不计入数据</span>
              </div>
            </div>

          </div>
        </section>

        {/* ── WIKI NAV ── */}
        <section className={styles.wikiNav}>
          <h2 className={styles.sectionTitle}><span>百科导览</span></h2>
          <div className={styles.wikiGrid}>
            {WIKI_CARDS.map((card) => {
              const Icon = card.icon;
              return (
                <Link key={card.label} className={styles.wikiCard} to={card.href}>
                  <span className={styles.wikiGlyph}><Icon size={26} strokeWidth={1.5} /></span>
                  <span className={styles.wikiLabel}>{card.label}</span>
                  <span className={styles.wikiSub}>{card.sub}</span>
                  <span className={styles.wikiArrow}>→</span>
                </Link>
              );
            })}
          </div>
        </section>

      </div>
    </Layout>
  );
}
