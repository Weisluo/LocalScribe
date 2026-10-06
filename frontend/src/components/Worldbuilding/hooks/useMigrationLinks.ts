/**
 * 迁移容器入口与归位（Phase 2 P2-T13，接口冻结见 phase2_interface_freeze.md §5）
 *
 * 容器识别不新增 GET：复用 GET /worlds?project_id= 过滤 settings.migrationContainer，
 * 容器内列表复用 GET /worlds/{id}/links（phase2 §6）。
 * queryKey 固定 ['worldbuilding','migration-container', projectId]，容器世界与容器 links
 * 由该 key 派生；归位后整批失效该 key 与 links/counts 前缀，禁止逐卡请求。
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  worldbuildingApi,
  type World,
  type WorldLink,
} from '@/services/worldbuildingApi';
import { isMigrationContainer } from '../types';
import { worldbuildingKeys } from './worldQueryKeys';
import { useWorldLinks } from './useLinks';

export interface MigrationLinksResult {
  /** 项目下带 settings.migrationContainer 的世界 */
  container?: World;
  containerLinks: WorldLink[];
  /** 待归位条数：列表里的 link_count 与容器内 links 取较大者，避免过期计数让入口与数字不一致 */
  linkCount: number;
  /** 入口条件：容器存在且 linkCount > 0 */
  hasEntryPoint: boolean;
  isLoading: boolean;
}

export const useMigrationLinks = (projectId?: string): MigrationLinksResult => {
  const containerQuery = useQuery({
    queryKey: worldbuildingKeys.migrationContainer(projectId),
    queryFn: async () => {
      const worlds = await worldbuildingApi.getWorlds({ project_id: projectId });
      return worlds.find((world) => isMigrationContainer(world)) ?? null;
    },
    enabled: !!projectId,
  });

  const container = containerQuery.data ?? undefined;
  const linksQuery = useWorldLinks(container?.id);
  const containerLinks = container ? linksQuery.data ?? [] : [];
  const linkCount = container
    ? Math.max(container.link_count ?? 0, containerLinks.length)
    : 0;

  return {
    container,
    containerLinks,
    linkCount,
    hasEntryPoint: !!container && linkCount > 0,
    isLoading: containerQuery.isLoading || (!!container && linksQuery.isLoading),
  };
};

/** 归位后统一失效：容器入口 + 全部 links/counts + 世界列表 */
const invalidateMigrationData = (
  queryClient: ReturnType<typeof useQueryClient>,
  containerWorldId?: string
): void => {
  queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'migration-container'] });
  queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'links'] });
  queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'worlds'] });
  if (containerWorldId) {
    queryClient.invalidateQueries({ queryKey: worldbuildingKeys.world(containerWorldId) });
  }
};

export interface MoveWorldLinkInput {
  linkId: string;
  /** 省略时按端点自动归位（phase2 §6） */
  targetWorldId?: string;
  /** 打开面板时所在的容器世界：归位后一并失效它的详情缓存 */
  containerWorldId?: string;
}

export interface MoveErrorInfo {
  status?: number;
  /** 后端结构化 detail 里的判别码：duplicate_link / endpoint_world_conflict */
  code?: string;
  /** duplicate_link 时后端给出的既有 link id */
  existingId?: string;
  message: string;
}

/** 取出 move 接口的结构化错误（detail = {code, message, existing_id?}），避免只靠 409 猜原因 */
export const moveErrorInfo = (error: unknown): MoveErrorInfo => {
  const apiError = error as
    | { status?: number; message?: string; details?: unknown }
    | null;
  const body = apiError?.details as { detail?: unknown } | null | undefined;
  const detail = body?.detail as
    | { code?: unknown; message?: unknown; existing_id?: unknown }
    | undefined;
  return {
    status: apiError?.status,
    code: typeof detail?.code === 'string' ? detail.code : undefined,
    existingId:
      typeof detail?.existing_id === 'string' ? detail.existing_id : undefined,
    message: apiError?.message ?? '',
  };
};

/** 单条归位：POST /links/{id}/move */
export const useMoveWorldLink = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ linkId, targetWorldId }: MoveWorldLinkInput) =>
      worldbuildingApi.moveWorldLink(
        linkId,
        targetWorldId ? { world_id: targetWorldId } : undefined
      ),
    onSuccess: (_result, variables) =>
      invalidateMigrationData(queryClient, variables.containerWorldId),
    onError: (error: Error) => {
      // 409 由面板按 code 分流提示（两种 409 处置方式不同），这里只处理其余错误
      if (moveErrorInfo(error).status === 409) return;
      toast.error(error.message || '归位失败');
    },
  });
};

export interface MoveWorldLinksInput {
  /** 容器世界 id */
  worldId: string;
  linkIds: string[];
  /** 省略时按端点自动归位（phase2 §6） */
  targetWorldId?: string;
}

/** 批量归位：POST /worlds/{id}/links/move，冲突项不阻塞其余项 */
export const useMoveWorldLinks = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ worldId, linkIds, targetWorldId }: MoveWorldLinksInput) =>
      worldbuildingApi.moveWorldLinks(worldId, {
        link_ids: linkIds,
        ...(targetWorldId ? { target_world_id: targetWorldId } : {}),
      }),
    onSuccess: (_result, variables) =>
      invalidateMigrationData(queryClient, variables.worldId),
    onError: (error: Error) => toast.error(error.message || '批量归位失败'),
  });
};