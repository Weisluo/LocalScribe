/**
 * WorldLink 读写 hooks（Phase 2 P2-T1/T4）
 *
 * - 查询统一走 GET /worlds/{id}/links（module+entity_id 成对、link_type、target_module 过滤）
 * - 单实体的出/入链分组在客户端完成（契约 §5.1），避免为每个实体单独请求
 * - 计数走 GET /worlds/{id}/links/counts，整批刷新，禁止逐卡请求
 * - mutation 只失效相关 key
 */

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  worldbuildingApi,
  type EntityRef,
  type WorldLink,
  type WorldLinkCreate,
  type WorldLinkUpdate,
} from '@/services/worldbuildingApi';
import { splitLinks } from '../types';
import { worldbuildingKeys, type LinkQueryScope } from './worldQueryKeys';

/** 前端 camelCase 作用域 -> 后端 snake_case 查询参数（不映射会被 FastAPI 静默忽略，过滤失效） */
const toLinkQuery = (scope?: LinkQueryScope) => ({
  module: scope?.module,
  entity_id: scope?.entityId,
  link_type: scope?.linkType,
  target_module: scope?.targetModule,
  skip: scope?.skip,
  limit: scope?.limit,
});

export const useWorldLinks = (worldId?: string, scope?: LinkQueryScope) =>
  useQuery({
    queryKey: worldbuildingKeys.links(worldId, scope),
    queryFn: () => worldbuildingApi.getWorldLinks(worldId!, toLinkQuery(scope)),
    enabled: !!worldId,
  });

export interface EntityLinksResult {
  links: WorldLink[];
  outgoing: WorldLink[];
  incoming: WorldLink[];
  isLoading: boolean;
  isError: boolean;
}

/** 单实体相关关联（出链 + 入链），一次请求取出后本地分组 */
export const useEntityLinks = (
  worldId: string | undefined,
  entity: EntityRef | undefined,
  options: { enabled?: boolean; linkType?: string } = {}
): EntityLinksResult => {
  const { enabled = true, linkType } = options;
  const entityModule = entity?.module;
  const entityKind = entity?.kind;
  const entityId = entity?.id;

  const scope = useMemo<LinkQueryScope | undefined>(
    () =>
      entityModule && entityId
        ? { module: entityModule, entityId, linkType }
        : undefined,
    [entityModule, entityId, linkType]
  );

  const query = useQuery({
    queryKey: worldbuildingKeys.links(worldId, scope),
    queryFn: () =>
      worldbuildingApi.getWorldLinks(worldId!, {
        module: entityModule!,
        entity_id: entityId!,
        link_type: linkType,
      }),
    enabled: !!worldId && !!entityModule && !!entityId && enabled,
  });

  const links = useMemo(() => query.data ?? [], [query.data]);
  const grouped = useMemo(
    () =>
      entityModule && entityKind && entityId
        ? splitLinks(links, { module: entityModule, kind: entityKind, id: entityId })
        : { outgoing: [], incoming: [] },
    [links, entityModule, entityKind, entityId]
  );

  return {
    links,
    outgoing: grouped.outgoing,
    incoming: grouped.incoming,
    isLoading: query.isLoading,
    isError: query.isError,
  };
};

export const useLinkCounts = (worldId?: string) =>
  useQuery({
    queryKey: worldbuildingKeys.linkCounts(worldId),
    queryFn: () => worldbuildingApi.getWorldLinkCounts(worldId!),
    enabled: !!worldId,
  });

/** 关联增删改后统一失效：全部 links（所有 scope）+ counts + 世界列表/详情（link_count 徽章） */
export const invalidateLinkData = (
  queryClient: ReturnType<typeof useQueryClient>,
  worldId?: string
) => {
  queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'links'] });
  // 头部「N 模块 · M 关联」与容器「待归位 N」都读世界列表/详情里的 link_count
  queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'worlds'] });
  queryClient.invalidateQueries({ queryKey: worldbuildingKeys.worldRoot });
  if (worldId) {
    queryClient.invalidateQueries({ queryKey: worldbuildingKeys.linkCounts(worldId) });
  }
};

export const useCreateWorldLink = (worldId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: WorldLinkCreate) => worldbuildingApi.createWorldLink(worldId!, data),
    onSuccess: () => invalidateLinkData(queryClient, worldId),
    onError: (error: Error) => toast.error(error.message || '创建关联失败'),
  });
};

export interface BatchCreateLinksResult {
  created: WorldLink[];
  /** 409：对称边/等价边已存在，按跳过处理 */
  skipped: string[];
  /** 其余失败：只累计不抛出，保证已成功的部分也会刷新缓存 */
  failed: { link_type: string; message: string }[];
}

/** 批量创建：一次请求一条，沿用后端的对称边去重（409 视为已存在并跳过） */
export const useCreateWorldLinks = (worldId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (items: WorldLinkCreate[]): Promise<BatchCreateLinksResult> => {
      const created: WorldLink[] = [];
      const skipped: string[] = [];
      const failed: { link_type: string; message: string }[] = [];
      for (const item of items) {
        try {
          created.push(await worldbuildingApi.createWorldLink(worldId!, item));
        } catch (error) {
          const status = (error as { status?: number } | null)?.status;
          if (status === 409) {
            skipped.push(item.link_type);
            continue;
          }
          failed.push({
            link_type: item.link_type,
            message: (error as { message?: string } | null)?.message ?? '创建失败',
          });
        }
      }
      return { created, skipped, failed };
    },
    onSuccess: ({ created, failed }) => {
      if (created.length > 0) invalidateLinkData(queryClient, worldId);
      if (failed.length > 0) {
        toast.error(`${failed.length} 条关联创建失败：${failed[0].message}`);
      }
    },
  });
};

export const useUpdateWorldLink = (worldId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ linkId, data }: { linkId: string; data: WorldLinkUpdate }) =>
      worldbuildingApi.updateWorldLink(linkId, data),
    onSuccess: () => invalidateLinkData(queryClient, worldId),
    onError: (error: Error) => toast.error(error.message || '更新关联失败'),
  });
};

export const useDeleteWorldLink = (worldId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (linkId: string) => worldbuildingApi.deleteWorldLink(linkId),
    onSuccess: () => invalidateLinkData(queryClient, worldId),
    onError: (error: Error) => toast.error(error.message || '删除关联失败'),
  });
};
