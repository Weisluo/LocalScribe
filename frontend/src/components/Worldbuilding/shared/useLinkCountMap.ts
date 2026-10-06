/**
 * 世界级关联计数映射（Phase 3 P3-T7）
 *
 * 契约 §5.1 要求「列表卡片 / 画布节点右上角显示关联计数徽章」且批量聚合：
 * 复用 useWorldLinks(worldId) 单次请求（同一 queryKey 已由 LinkPanel / 卡片共享），
 * 在客户端按 refKey 归并出链/入链，禁止逐卡请求。
 */

import { useMemo } from 'react';

import type { EntityRef } from '@/services/worldbuildingApi';
import { useWorldLinks } from '../hooks';
import { refKey } from '../types';

export interface LinkCountEntry {
  outgoing: number;
  incoming: number;
  total: number;
}

export interface WorldLinkCountMap {
  counts: Map<string, LinkCountEntry>;
  countOf: (ref?: EntityRef | null) => number;
  isLoading: boolean;
}

const EMPTY: LinkCountEntry = { outgoing: 0, incoming: 0, total: 0 };

export const useWorldLinkCountMap = (worldId?: string): WorldLinkCountMap => {
  const { data: links, isLoading } = useWorldLinks(worldId);

  const counts = useMemo(() => {
    const map = new Map<string, LinkCountEntry>();
    for (const link of links ?? []) {
      const sourceKey = refKey(link.source);
      const targetKey = refKey(link.target);
      const source = map.get(sourceKey) ?? { ...EMPTY };
      source.outgoing += 1;
      source.total += 1;
      map.set(sourceKey, source);
      if (targetKey === sourceKey) continue;
      const target = map.get(targetKey) ?? { ...EMPTY };
      target.incoming += 1;
      target.total += 1;
      map.set(targetKey, target);
    }
    return map;
  }, [links]);

  const countOf = (ref?: EntityRef | null) =>
    ref ? counts.get(refKey(ref))?.total ?? 0 : 0;

  return { counts, countOf, isLoading };
};
