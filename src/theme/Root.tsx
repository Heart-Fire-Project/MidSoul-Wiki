import React, { useEffect } from 'react';
import { useLocation } from '@docusaurus/router';

/**
 * 文档页由客户端异步加载。浏览器第一次处理 URL hash 时，目标 DataTable
 * 还未挂进 DOM，因而会停在页面顶部。路由稳定后重试定位一小段时间，既支持
 * 标题，也支持编辑器写入的表格 / 文字精确跳转点。
 */
function HashAnchorScroller() {
  const location = useLocation();
  useEffect(() => {
    const rawHash = location.hash.slice(1);
    if (!rawHash) return undefined;
    let frame = 0;
    let clearFlash = 0;
    let attempts = 0;
    const targetId = decodeURIComponent(rawHash);
    const flashTarget = (target: HTMLElement) => {
      // 同一页连续点多个链接时也要重新播放动画，而不是保留上一个目标的状态。
      document.querySelectorAll('.ms-anchor-flash').forEach((element) => element.classList.remove('ms-anchor-flash'));
      target.classList.remove('ms-anchor-flash');
      void target.offsetWidth;
      target.classList.add('ms-anchor-flash');
      clearFlash = window.setTimeout(() => target.classList.remove('ms-anchor-flash'), 3100);
    };
    const scrollToAnchor = () => {
      const target = document.getElementById(targetId);
      if (target) {
        target.scrollIntoView({ block: 'start' });
        flashTarget(target);
        return;
      }
      attempts += 1;
      if (attempts < 36) frame = requestAnimationFrame(scrollToAnchor);
    };
    frame = requestAnimationFrame(scrollToAnchor);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(clearFlash);
    };
  }, [location.hash, location.pathname]);
  return null;
}

export default function Root({ children }: { children: React.ReactNode }) {
  return <><HashAnchorScroller />{children}</>;
}
