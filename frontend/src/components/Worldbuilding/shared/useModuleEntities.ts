/**
 * 模块内实体（submodule + item）读写（Phase 3 P3-T2/P3-T5 数据层）
 *
 * 复用 P1 通用 API：
 * - 读取：世界详情竞态内已包含 modules/submodules/items（GET /worlds/{id}?include_items=true），
 *   与 WorldbuildingView / useEntityRefs 共用同一 queryKey，不额外发请求。
 * - 写入：submodules / items 的通用 CRUD；写入后整批失效 worldRoot（详情与列表都从它派生）。
 * - 层级只用 parent_id；kind/meta 走 schema 字段，不落 WorldLink。
 */

import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  worldbuildingApi,
  type ModuleItemV2,
  type SubmoduleV2,
  type WorldModuleV2,
} from '@/services/worldbuildingApi';
import { worldbuildingKeys } from '../hooks/worldQueryKeys';
import { useWorld } from '../hooks/useWorldData';

export interface SubmoduleInput {
  name: string;
  kind: string;
  parentId?: string | null;
  description?: string | null;
  meta?: Record<string, unknown>;
  icon?: string | null;
  color?: string | null;
  orderIndex?: number;
}

export interface SubmodulePatch {
  name?: string;
  kind?: string;
  parentId?: string | null;
  description?: string | null;
  meta?: Record<string, unknown>;
  icon?: string | null;
  color?: string | null;
  orderIndex?: number;
}

/** 只提交显式给出的键，避免把未改字段写回旧值 */
const toSubmodulePayload = (patch: SubmodulePatch) => {
  const payload: Record<string, unknown> = {};
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.kind !== undefined) payload.kind = patch.kind;
  if (patch.parentId !== undefined) payload.parent_id = patch.parentId;
  if (patch.description !== undefined) payload.description = patch.description;
  if (patch.meta !== undefined) payload.meta = patch.meta;
  if (patch.icon !== undefined) payload.icon = patch.icon;
  if (patch.color !== undefined) payload.color = patch.color;
  if (patch.orderIndex !== undefined) payload.order_index = patch.orderIndex;
  return payload;
};

export interface ModuleEntitiesResult {
  module?: WorldModuleV2;
  submodules: SubmoduleV2[];
  items: ModuleItemV2[];
  /** 顶层实体（parent_id 为空），按 order_index 排序 */
  rootSubmodules: SubmoduleV2[];
  childrenOf: (parentId?: string | null) => SubmoduleV2[];
  itemsOf: (submoduleId?: string | null) => ModuleItemV2[];
  itemByName: (submoduleId: string | null | undefined, name: string) => ModuleItemV2 | undefined;
  /** 同级下一个 order_index */
  nextOrderIndex: (parentId?: string | null) => number;
  createSubmodule: (input: SubmoduleInput) => Promise<SubmoduleV2>;
  updateSubmodule: (submoduleId: string, patch: SubmodulePatch) => Promise<SubmoduleV2>;
  deleteSubmodule: (submoduleId: string) => Promise<void>;
  /** 按 (submodule_id, name) 幂等保存 item：存在则更新，不存在则创建 */
  saveItem: (input: {
    submoduleId?: string | null;
    name: string;
    content: Record<string, unknown>;
    orderIndex?: number;
  }) => Promise<ModuleItemV2>;
  deleteItem: (itemId: string) => Promise<void>;
  isSaving: boolean;
  isLoading: boolean;
  isError: boolean;
}

export const useModuleEntities = (
  worldId?: string,
  moduleId?: string
): ModuleEntitiesResult => {
  const queryClient = useQueryClient();
  const worldQuery = useWorld(worldId, { includeItems: true });

  const module = useMemo(
    () => worldQuery.data?.modules?.find((item) => item.id === moduleId),
    [worldQuery.data, moduleId]
  );

  const submodules = useMemo<SubmoduleV2[]>(
    () =>
      [...(module?.submodules ?? [])].sort(
        (a, b) => a.order_index - b.order_index || a.id.localeCompare(b.id)
      ),
    [module]
  );

  const items = useMemo<ModuleItemV2[]>(
    () =>
      [...(module?.items ?? [])].sort(
        (a, b) => a.order_index - b.order_index || a.id.localeCompare(b.id)
      ),
    [module]
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: worldbuildingKeys.worldRoot });
    queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'worlds'] });
  };

  const onError = (error: Error, fallback: string) => {
    toast.error(error.message || fallback);
  };

  const createMutation = useMutation({
    mutationFn: (input: SubmoduleInput) =>
      worldbuildingApi.createSubmodule(moduleId!, {
        name: input.name,
        kind: input.kind,
        parent_id: input.parentId ?? undefined,
        description: input.description ?? undefined,
        meta: input.meta,
        icon: input.icon ?? undefined,
        color: input.color ?? undefined,
        order_index: input.orderIndex,
      }),
    onSuccess: invalidate,
    onError: (error: Error) => onError(error, '创建失败'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ submoduleId, patch }: { submoduleId: string; patch: SubmodulePatch }) =>
      worldbuildingApi.updateSubmodule(submoduleId, toSubmodulePayload(patch)),
    onSuccess: invalidate,
    onError: (error: Error) => onError(error, '保存失败'),
  });

  const deleteMutation = useMutation({
    mutationFn: (submoduleId: string) =>
      worldbuildingApi.deleteSubmodule(submoduleId).then(() => undefined),
    onSuccess: invalidate,
    onError: (error: Error) => onError(error, '删除失败'),
  });

  const saveItemMutation = useMutation({
    mutationFn: async (input: {
      submoduleId?: string | null;
      name: string;
      content: Record<string, unknown>;
      orderIndex?: number;
    }) => {
      const existing = items.find(
        (item) =>
          item.name === input.name &&
          (item.submodule_id ?? null) === (input.submoduleId ?? null)
      );
      if (existing) {
        return worldbuildingApi.updateItem(existing.id, {
          content: input.content,
        });
      }
      return worldbuildingApi.createItem(moduleId!, {
        name: input.name,
        content: input.content,
        submodule_id: input.submoduleId ?? undefined,
        order_index: input.orderIndex ?? items.length,
      });
    },
    onSuccess: invalidate,
    onError: (error: Error) => onError(error, '保存失败'),
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) =>
      worldbuildingApi.deleteItem(itemId).then(() => undefined),
    onSuccess: invalidate,
    onError: (error: Error) => onError(error, '删除失败'),
  });

  const childrenOf = (parentId?: string | null) =>
    submodules.filter((item) => (item.parent_id ?? null) === (parentId ?? null));

  const itemsOf = (submoduleId?: string | null) =>
    items.filter((item) => (item.submodule_id ?? null) === (submoduleId ?? null));

  const itemByName = (submoduleId: string | null | undefined, name: string) =>
    itemsOf(submoduleId).find((item) => item.name === name);

  const nextOrderIndex = (parentId?: string | null) => {
    const siblings = childrenOf(parentId);
    return siblings.length === 0
      ? 0
      : Math.max(...siblings.map((item) => item.order_index)) + 1;
  };

  return {
    module,
    submodules,
    items,
    rootSubmodules: childrenOf(null),
    childrenOf,
    itemsOf,
    itemByName,
    nextOrderIndex,
    createSubmodule: (input) => createMutation.mutateAsync(input),
    updateSubmodule: (submoduleId, patch) =>
      updateMutation.mutateAsync({ submoduleId, patch }),
    deleteSubmodule: (submoduleId) => deleteMutation.mutateAsync(submoduleId),
    saveItem: (input) => saveItemMutation.mutateAsync(input),
    deleteItem: (itemId) => deleteItemMutation.mutateAsync(itemId),
    isSaving:
      createMutation.isPending ||
      updateMutation.isPending ||
      deleteMutation.isPending ||
      saveItemMutation.isPending ||
      deleteItemMutation.isPending,
    isLoading: worldQuery.isLoading,
    isError: worldQuery.isError,
  };
};
