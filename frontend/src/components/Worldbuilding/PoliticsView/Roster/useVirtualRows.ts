/**
 * 名录虚拟滚动（Phase 4 P4 fix；politics_ui_design §11.1.5）
 *
 * shared/useVirtualList 的 useVirtualGrid 只接受固定 itemHeight，而名录是异质行
 * （政权 56 / 组织 40 / 人物 32 / 区块头 28），用算术平均会让偏移量随滚动累积漂移，
 * 表现为空白带与跳行。这里改为：
 * - 由每行真实高度构建前缀和偏移表（offsets[i] 是第 i 行顶部的位置）；
 * - 用二分查找定位可视窗口，滚动高度与渲染窗口都以真实高度为准；
 * - 只渲染窗口 + overscan 行，用 transform 平移对齐偏移。
 *
 * 与 shared 的钩子保持同一降级口径：容器不可测量（无布局 / 无 CSS）或行数未超阈值时
 * 全量渲染，绝不裁成空列表。
 */

import { useEffect, useMemo, useState } from 'react';

export interface VirtualRowsResult<T> {
  /** 挂到滚动容器（自身即滚动元素）上 */
  containerRef: (node: HTMLElement | null) => void;
  enabled: boolean;
  /** 当前窗口内的行（未启用虚拟滚动时为全部） */
  items: T[];
  startIndex: number;
  endIndex: number;
  /** 可视窗口顶部偏移（px），用作 translateY */
  paddingTop: number;
  /** 剩余高度（px），用作尾部占位 */
  paddingBottom: number;
}

/** 行高 -> 前缀和偏移表：offsets[i] = 前 i 行总高，offsets[n] = 总高 */
export const buildOffsetTable = (heights: number[]): number[] => {
  const offsets = new Array<number>(heights.length + 1);
  offsets[0] = 0;
  for (let index = 0; index < heights.length; index += 1) {
    offsets[index + 1] = offsets[index] + Math.max(0, heights[index] ?? 0);
  }
  return offsets;
};

/**
 * 二分查找：最大的 index 使 offsets[index] <= target（即 target 所在行）。
 * target 小于 0 时返回 0；target 超过总高时返回最后一行下标。
 */
export const findRowAtOffset = (offsets: number[], target: number): number => {
  const rowCount = Math.max(0, offsets.length - 1);
  if (rowCount === 0) return 0;
  if (target <= 0) return 0;
  let low = 0;
  let high = rowCount - 1;
  let result = 0;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (offsets[mid] <= target) {
      result = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return result;
};

export interface VirtualRowsOptions {
  /** 视口外多渲染几行 */
  overscan?: number;
  /** 超过该行数才启用窗口化（§11.1.5：200 行） */
  threshold?: number;
}

export const useVirtualRows = <T extends { height: number }>(
  items: T[],
  options: VirtualRowsOptions = {}
): VirtualRowsResult<T> => {
  const { overscan = 6, threshold = 200 } = options;
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(0);

  useEffect(() => {
    if (!node) return undefined;
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

  const offsets = useMemo(
    () => buildOffsetTable(items.map((item) => item.height)),
    [items]
  );
  // 视口高度为 0 说明当前环境没有可用布局（如无 CSS 的测试容器）：全量渲染，不裁空
  const enabled = viewport > 0 && items.length > threshold;

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
    const total = offsets[items.length];
    const first = Math.max(0, findRowAtOffset(offsets, scrollTop) - overscan);
    const lastVisible = findRowAtOffset(offsets, scrollTop + viewport);
    const last = Math.min(items.length, lastVisible + 1 + overscan);
    const top = offsets[first];
    return {
      containerRef: setNode,
      enabled: true,
      items: items.slice(first, last),
      startIndex: first,
      endIndex: last,
      paddingTop: top,
      paddingBottom: Math.max(0, total - offsets[last]),
    };
  }, [enabled, items, offsets, overscan, scrollTop, viewport]);
};

export default useVirtualRows;
