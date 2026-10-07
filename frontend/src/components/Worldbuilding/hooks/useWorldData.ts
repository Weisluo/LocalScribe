/**
 * 世界与模块数据 hooks（Phase 2 P2-T1，契约 §2.1/§2.2；Phase 6 P6-T2 备份恢复）
 *
 * 只走 P1 的 worlds 系列接口；旧的兼容转发调用已随 P6-T10 删除，本文件不再有兼容分支。
 * 世界列表按 project_id 收敛，模块数量直接复用响应里的 module_count/link_count，
 * 不逐世界补请求（phase2 §11.1 L6）。
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  worldbuildingApi,
  type LinkTypeDef,
  type World,
  type WorldCreatePayload,
  type WorldImportReport,
  type WorldLinkMoveResult,
  type WorldUpdatePayload,
  type WorldWithModules,
} from '@/services/worldbuildingApi';
import { worldbuildingKeys } from './worldQueryKeys';
import {
  assertBackupVersion,
  backupFileName,
  buildImportPayload,
  parseBackupText,
  type RestoreOptions,
} from './worldBackup';

export const useWorlds = (projectId?: string) =>
  useQuery({
    queryKey: worldbuildingKeys.worlds(projectId),
    queryFn: () => worldbuildingApi.getWorlds({ project_id: projectId }),
    enabled: !!projectId,
  });

export interface UseWorldOptions {
  includeItems?: boolean;
  enabled?: boolean;
}

export const useWorld = (worldId?: string, options: UseWorldOptions = {}) => {
  const { includeItems = true, enabled = true } = options;
  return useQuery({
    queryKey: worldbuildingKeys.world(worldId, includeItems),
    queryFn: () =>
      worldbuildingApi.getWorld(worldId!, {
        include_modules: true,
        include_items: includeItems,
      }),
    enabled: enabled && !!worldId,
  });
};

/** 只读的 link_type 注册表（契约 §4），供筛选与校验使用 */
export const useLinkRegistry = () =>
  useQuery({
    queryKey: worldbuildingKeys.linkRegistry(),
    queryFn: () => worldbuildingApi.getLinkRegistry(),
    staleTime: 5 * 60 * 1000,
  });

/** registry 数组 -> Map，便于按 id 取 label/reverseLabel/icon/color */
export const toRegistryMap = (
  definitions?: LinkTypeDef[]
): Map<string, LinkTypeDef> =>
  new Map((definitions ?? []).map((definition) => [definition.id, definition]));

export const useCreateWorld = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: WorldCreatePayload) => worldbuildingApi.createWorld(data),
    onSuccess: () => {
      // 服务端在建世界时已补齐七个模块（phase2 §11.1 L1），前端不再手工建模块
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'worlds'] });
      toast.success('世界已创建');
    },
    onError: (error: Error) => toast.error(error.message || '创建世界失败'),
  });
};

export const useUpdateWorld = (worldId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: WorldUpdatePayload) =>
      worldbuildingApi.updateWorld(worldId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'worlds'] });
      queryClient.invalidateQueries({ queryKey: worldbuildingKeys.worldRoot });
    },
    onError: (error: Error) => toast.error(error.message || '更新世界失败'),
  });
};

export const useDeleteWorld = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (worldId: string) => worldbuildingApi.deleteWorld(worldId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'worlds'] });
      queryClient.invalidateQueries({ queryKey: worldbuildingKeys.worldRoot });
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'migration-container'] });
      toast.success('世界已删除');
    },
    onError: (error: Error) => toast.error(error.message || '删除世界失败'),
  });
};

/** 失效一次恢复会被影响的全部缓存（世界列表 / 详情 / 关联 / 容器入口） */
export const invalidateWorldData = (
  queryClient: ReturnType<typeof useQueryClient>,
  projectId?: string | null,
  worldId?: string
): void => {
  queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'worlds'] });
  queryClient.invalidateQueries({ queryKey: worldbuildingKeys.worldRoot });
  queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'links'] });
  queryClient.invalidateQueries({ queryKey: worldbuildingKeys.migrationContainer(projectId ?? undefined) });
  if (worldId) {
    queryClient.invalidateQueries({ queryKey: worldbuildingKeys.linkCounts(worldId) });
  }
};

/**
 * 世界备份导入（P6-T2）：返回 WorldImportReport。
 * 失败（409 覆盖未确认 / 400 版本过高 / 422 结构不合法）由调用方读取 error.message 呈现，
 * 这里只做 toast，不吞掉异常。
 */
export const useImportWorld = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof worldbuildingApi.importWorld>[0]) =>
      worldbuildingApi.importWorld(data),
    onSuccess: (report: WorldImportReport) => {
      invalidateWorldData(queryClient, report.world.project_id, report.world.id);
      toast.success(
        `世界「${report.world.name}」已恢复：实体 ${report.entity_count} · 关联 ${report.link_count}`
      );
    },
    onError: (error: Error) => toast.error(error.message || '恢复世界备份失败'),
  });
};

export interface WorldBackupApi {
  /** 导出并下载：文件名 世界名-日期.world.json（ui_design §3.4） */
  downloadBackup: (worldId: string, worldName?: string) => Promise<unknown>;
  /**
   * 从文件恢复：校验 JSON 结构与本应用支持的 schema_version，
   * 再按 { mode, targetWorldId, confirmOverwrite, keepDangling, projectId } 提交。
   */
  restoreBackup: (file: File, options?: RestoreOptions) => Promise<WorldImportReport>;
  isImporting: boolean;
}

/**
 * 世界备份导出/导入的前端口径（phase2 §11.1 L4 / phase6 §5 P6-T2）：
 * 只接受本应用导出的完整备份（含 world 段），裁剪过的文件在本地就报错，不发无意义的请求。
 */
export const useWorldBackup = (): WorldBackupApi => {
  const importWorld = useImportWorld();

  const downloadBackup = async (worldId: string, worldName?: string) => {
    const data = await worldbuildingApi.exportWorld(worldId);
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = backupFileName(worldName || data.world?.name || `world_${worldId}`);
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    return data;
  };

  const restoreBackup = async (file: File, options: RestoreOptions = {}) => {
    const document = parseBackupText(await file.text());
    assertBackupVersion(document);
    return importWorld.mutateAsync(buildImportPayload(document, options));
  };

  return { downloadBackup, restoreBackup, isImporting: importWorld.isPending };
};

export type { WorldLinkMoveResult, WorldWithModules, World };
