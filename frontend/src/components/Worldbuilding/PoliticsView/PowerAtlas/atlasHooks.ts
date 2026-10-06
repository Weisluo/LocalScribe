/**
 * 版图局部 hook（Phase 4 P4-T3..T7；politics_ui_design §4.9）
 *
 * 只处理版本内小状态，不发请求：
 * - usePrefersReducedMotion：动效预算开关（缎带首页绘制 / 聚焦过渡）；
 * - useMediaQuery：中屏断点（头像条 5 -> 3、独立势力带折叠）；
 * - useDismissOnEscape：浮层 Esc 收起（与上层 index.tsx 的逐级返回不冲突）。
 */

import { useEffect, useState } from 'react';

export const usePrefersReducedMotion = (): boolean => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener?.('change', sync);
    return () => query.removeEventListener?.('change', sync);
  }, []);
  return reduced;
};

export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const list = window.matchMedia(query);
    const sync = () => setMatches(list.matches);
    sync();
    list.addEventListener?.('change', sync);
    return () => list.removeEventListener?.('change', sync);
  }, [query]);
  return matches;
};

export const useDismissOnEscape = (open: boolean, onClose: () => void): void => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);
};
