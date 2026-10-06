/**
 * EntityRef 解析（Phase 2 P2-T2，契约 §2.4/§2.5）
 *
 * 显示名按 id 实时解析（契约 §2.5），因此前端维护一份「世界内实体索引」：
 * - submodule（含 kind）来自 GET /worlds/{id}?include_modules=true&include_items=true
 * - item 无 kind 字段，按契约退化约定索引为 kind='item'
 * - 全局角色来自 characterApi（module='character'，契约 §2.5）
 *
 * 索引未命中即视为失效引用：渲染警示 chip 并提供清理动作（契约 §5.2 口径，勿在写入侧加存在性校验）。
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { characterApi } from '@/services/characterApi';
import type { EntityRef, WorldModuleV2 } from '@/services/worldbuildingApi';
import { refKey, submoduleToRef } from '../types';
import { useWorld } from './useWorldData';

export interface EntityIndexEntry {
  ref: EntityRef;
  name: string;
  module: string;
  kind: string;
  /** 所属模块展示名，用于分组与次要文案 */
  moduleName: string;
  parentId?: string;
}

export interface EntityRefsResult {
  /** ref -> 实体；未命中表示失效引用 */
  lookup: (ref?: EntityRef | null) => EntityIndexEntry | undefined;
  /** 解析显示名，未命中时回退到 kind:id 短号 */
  resolveName: (ref?: EntityRef | null) => string;
  /** 是否失效引用 */
  isInvalid: (ref?: EntityRef | null) => boolean;
  /** 按模块分组的实体列表（EntityPicker 用） */
  byModule: Map<string, EntityIndexEntry[]>;
  /** 全部实体（预置搜索用） */
  entries: EntityIndexEntry[];
  isLoading: boolean;
}

const entriesOfModule = (module: WorldModuleV2): EntityIndexEntry[] => {
  const entries: EntityIndexEntry[] = [];
  for (const submodule of module.submodules ?? []) {
    entries.push({
      ref: submoduleToRef(module.module_type, submodule),
      name: submodule.name,
      module: module.module_type,
      kind: submodule.kind || (module.module_type === 'history' ? 'event' : 'custom'),
      moduleName: module.name,
      parentId: submodule.parent_id ?? undefined,
    });
  }
  for (const item of module.items ?? []) {
    entries.push({
      ref: { module: module.module_type, kind: 'item', id: item.id },
      name: item.name,
      module: module.module_type,
      kind: 'item',
      moduleName: module.name,
      parentId: item.submodule_id ?? undefined,
    });
  }
  return entries;
};

export const shortRefId = (id: string): string =>
  id.length > 8 ? `${id.slice(0, 8)}…` : id;

export const useEntityRefs = (
  worldId?: string,
  projectId?: string
): EntityRefsResult => {
  const worldQuery = useWorld(worldId, { includeItems: true });

  const charactersQuery = useQuery({
    queryKey: ['characters-simple', projectId],
    queryFn: () => characterApi.getCharactersSimple(projectId!),
    enabled: !!projectId,
  });

  const entries = useMemo<EntityIndexEntry[]>(() => {
    const collected: EntityIndexEntry[] = [];
    for (const module of worldQuery.data?.modules ?? []) {
      collected.push(...entriesOfModule(module));
    }
    for (const character of charactersQuery.data ?? []) {
      collected.push({
        ref: { module: 'character', kind: 'character', id: character.id },
        name: character.name,
        module: 'character',
        kind: 'character',
        moduleName: '角色',
      });
    }
    return collected;
  }, [worldQuery.data, charactersQuery.data]);

  const byKey = useMemo(() => {
    const map = new Map<string, EntityIndexEntry>();
    for (const entry of entries) {
      map.set(refKey(entry.ref), entry);
    }
    return map;
  }, [entries]);

  const byModule = useMemo(() => {
    const map = new Map<string, EntityIndexEntry[]>();
    for (const entry of entries) {
      const bucket = map.get(entry.module);
      if (bucket) {
        bucket.push(entry);
      } else {
        map.set(entry.module, [entry]);
      }
    }
    return map;
  }, [entries]);

  const lookup = (ref?: EntityRef | null) =>
    ref ? byKey.get(refKey(ref)) : undefined;

  const isLoading = worldQuery.isLoading || charactersQuery.isLoading;

  return {
    lookup,
    resolveName: (ref) => lookup(ref)?.name ?? shortRefId(ref?.id ?? ''),
    // 索引尚未就绪时不能判失效：否则冷缓存下会把有效对端渲染成「已失效」并给出清理/删除入口
    isInvalid: (ref) => !!ref && !isLoading && !byKey.has(refKey(ref)),
    byModule,
    entries,
    isLoading,
  };
};

/** 兼容别名：索引视角命名 */
export const useEntityIndex = useEntityRefs;
