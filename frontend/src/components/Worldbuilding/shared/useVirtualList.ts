/**
 * 视口裁剪与懒加载（Phase 3 P3-T9；races_ui_design §11、systems_ui_design §11）
 *
 * - useVirtualGrid：卡片网格超过阈值（races 200 / systems 300）时只渲染视口内的行，
 *   用 padding 占位保持滚动高度；容器不可测量时（无布局/无 CSS）退化为全量渲染，避免空列表。
 * - useInView：头像等资源的懒加载判据；无 IntersectionObserver 时视为可见（不阻塞渲染）。
 */

import { useEffect, useMemo, useState } from 'react';

export interface VirtualGridOptions {
  /** 单行高度（像素，含内容与间距） */
  itemHeight: number;
  columns?: number;
  gap?: number;
  /** 视口外多渲染几行 */
  overscan?: number;
  /** 超过该数量才启用窗口化 */
  threshold?: number;
}

export interface VirtualGridResult<T> {
  /** 挂到滚动容器（自身即滚动元素）上 */
  containerRef: (node: HTMLElement | null) => void;
  enabled: boolean;
  items: T[];
  startIndex: number;
  endIndex: number;
  paddingTop: number;
  paddingBottom: number;
}

export const useVirtualGrid = <T,>(
  items: T[],
  options: VirtualGridOptions
): VirtualGridResult<T> => {
  const { itemHeight, columns = 1, gap = 0, overscan = 2, threshold = 200 } = options;
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(0);

  useEffect(() => {
    if (!node) return;
    const onScroll = () => setScrollTop(node.scrollTop);
    const measure = () => {
      setViewport(node.clientHeight);
      setScrollTop(node.scrollTop);
    };
    node.addEventListener('scroll', onScroll, { passive: true });
    measure();
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure);
      observer.observe(node);
    }
    return () => {
      node.removeEventListener('scroll', onScroll);
      observer?.disconnect();
    };
  }, [node]);

  const rowHeight = Math.max(1, itemHeight + gap);
  const rowCount = Math.ceil(items.length / Math.max(1, columns));
  // 视口高度为 0 说明当前环境没有可用布局（如无 CSS 的测试容器）：全量渲染，不裁空
  const measurable = viewport > 0;
  const enabled = measurable && items.length > threshold;

  return useMemo(() => {
    if (!enabled) {
      return {
        containerRef: setNode,
        enabled: false,
        items,
        startIndex: 0,
        endIndex: items.length,
        paddingTop: 0,
        paddingBottom: 0,
      };
    }
    const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const endRow = Math.min(
      rowCount,
      Math.ceil((scrollTop + viewport) / rowHeight) + overscan
    );
    const startIndex = Math.min(items.length, startRow * columns);
    const endIndex = Math.min(items.length, endRow * columns);
    return {
      containerRef: setNode,
      enabled: true,
      items: items.slice(startIndex, endIndex),
      startIndex,
      endIndex,
      paddingTop: startRow * rowHeight,
      paddingBottom: Math.max(0, (rowCount - endRow) * rowHeight),
    };
  }, [
    columns,
    enabled,
    items,
    overscan,
    rowCount,
    rowHeight,
    scrollTop,
    viewport,
  ]);
};

export interface InViewResult<T extends Element> {
  ref: (node: T | null) => void;
  inView: boolean;
}

/** 元素进入视口后才置 inView；用于头像/图片懒加载 */
export const useInView = <T extends Element>(
  options?: IntersectionObserverInit
): InViewResult<T> => {
  const [node, setNode] = useState<T | null>(null);
  const [inView, setInView] = useState(false);
  const rootMargin = options?.rootMargin;

  useEffect(() => {
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setInView(true);
      },
      { rootMargin: rootMargin ?? '120px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, rootMargin]);

  return { ref: setNode, inView };
};
