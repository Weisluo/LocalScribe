/**
 * 容器关联端点的跨世界索引（Phase 2 P2-T13）
 *
 * 容器关联的 source/target 属于真实世界（不是容器本身：P1 回填把端点标到
 * 具体世界的 world_submodules / world_module_items，只把无法归属的边放进容器）。
 * 因此索引必须覆盖项目下的候选世界：
 * - 世界详情按 worldbuildingKeys.world(id) 取，与 useWorld/useEntityRefs 共用缓存；
 * - 角色是项目级全局数据，复用 useEntityRefs（不传 worldId 即可，避免多取容器世界）。
 */

import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';

import { worldbuildingApi, type EntityRef } from '@/services/worldbuildingApi';
import { refKey, submoduleToRef } from '../types';
import { useEntityRefs } from '../hooks/useEntityRefs';
import { worldbuildingKeys } from '../hooks/worldQueryKeys';

export interface IndexedEntity {
  name: string;
  module: string;
  kind: string;
  /** 端点所属世界；角色为全局数据，无世界归属 */
  worldId?: string;
  worldName?: string;
}

export interface ProjectEntityIndex {
  /** 索引未命中即失效引用（契约 §2.5：只读展示 + 清理，不在写入侧校验） */
  lookup: (ref?: EntityRef | null) => IndexedEntity | undefined;
  isLoading: boolean;
}

export const useProjectEntityIndex = (
  worldIds: string[],
  projectId?: string
): ProjectEntityIndex => {
  const worldQueries = useQueries({
    queries: worldIds.map((worldId) => ({
      queryKey: worldbuildingKeys.world(worldId),
      queryFn: () =>
        worldbuildingApi.getWorld(worldId, {
          include_modules: true,
          include_items: true,
        }),
    })),
  });

  const characterRefs = useEntityRefs(undefined, projectId);

  const index = useMemo(() => {
    const map = new Map<string, IndexedEntity>();
    worldQueries.forEach((query, position) => {
      const worldId = worldIds[position];
      const worldName = query.data?.name ?? '';
      for (const module of query.data?.modules ?? []) {
        for (const submodule of module.submodules ?? []) {
          const ref = submoduleToRef(module.module_type, submodule);
          map.set(refKey(ref), {
            name: submodule.name,
            module: ref.module,
            kind: ref.kind,
            worldId,
            worldName,
          });
        }
        for (const item of module.items ?? []) {
          map.set(refKey({ module: module.module_type, kind: 'item', id: item.id }), {
            name: item.name,
            module: module.module_type,
            kind: 'item',
            worldId,
            worldName,
          });
        }
      }
    });
    for (const entry of characterRefs.entries) {
      if (entry.module !== 'character') continue;
      map.set(refKey(entry.ref), {
        name: entry.name,
        module: entry.module,
        kind: entry.kind,
      });
    }
    return map;
  }, [worldQueries, worldIds, characterRefs.entries]);

  return {
    lookup: (ref) => (ref ? index.get(refKey(ref)) : undefined),
    isLoading:
      worldQueries.some((query) => query.isLoading) || characterRefs.isLoading,
  };
};
