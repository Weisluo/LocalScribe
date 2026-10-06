/**
 * 事件 / 时代卡片的关联计数（Phase 2 P2-T10）
 *
 * history_ui_design §14.3：关联计数在列表加载时批量获取，避免逐卡请求；
 * `GET /worlds/{id}/links/counts` 只按模块聚合，无法给出实体级出链/入链，
 * 因此这里复用 `useWorldLinks`：queryKey 固定为 ['worldbuilding','links',worldId,'all']，
 * 同一世界下所有卡片共享同一条查询（React Query 去重），各卡片在本地按实体 id 归并。
 */

import { useMemo } from 'react';

import type { EntityRef } from '@/services/worldbuildingApi';
import { useWorldLinks } from '../hooks';
import { splitLinks } from '../types';

export interface EntityLinkCounts {
  outgoing: number;
  incoming: number;
}

export const useEntityLinkCounts = (
  worldId: string | undefined,
  entity: EntityRef | undefined
): EntityLinkCounts => {
  const { data: links } = useWorldLinks(worldId);

  return useMemo(() => {
    if (!worldId || !entity) {
      return { outgoing: 0, incoming: 0 };
    }
    // 与 LinkPanel 共用 splitLinks，保证徽章与关联面板口径一致（module+kind+id）
    const { outgoing, incoming } = splitLinks(links ?? [], entity);
    return { outgoing: outgoing.length, incoming: incoming.length };
  }, [links, worldId, entity]);
};
