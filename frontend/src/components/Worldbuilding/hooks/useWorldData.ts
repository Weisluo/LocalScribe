/**
 * 世界与模块数据 hooks（Phase 2 P2-T1，契约 §2.1/§2.2）
 *
 * 只走 P1 的 /worlds 系列接口；旧 /templates 调用留给兼容层，本文件不新增旧路径。
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
  type WorldImportPayload,
  type WorldLinkMoveResult,
  type WorldUpdatePayload,
  type WorldWithModules,
} from '@/services/worldbuildingApi';
import { worldbuildingKeys } from './worldQueryKeys';

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

export const useImportWorld = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: WorldImportPayload) => worldbuildingApi.importWorld(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'worlds'] });
      toast.success('世界备份已导入');
    },
    onError: (error: Error) => toast.error(error.message || '导入世界失败'),
  });
};

/**
 * 世界备份导出/导入的前端口径（phase2 §11.1 L4）：
 * WorldImport.world 复用响应模型，裁剪过的备份会 422；因此只回传完整导出文件。
 */
export const useWorldBackup = () => {
  const importWorld = useImportWorld();

  const downloadBackup = async (worldId: string, filename?: string) => {
    const data = await worldbuildingApi.exportWorld(worldId);
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download =
      filename ||
      `world_${worldId}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    return data;
  };

  /** 只接受本应用导出的完整备份文件（含 world/modules/links 三段） */
  const restoreBackup = async (file: File, projectId?: string) => {
    const payload = JSON.parse(await file.text()) as WorldImportPayload;
    if (!payload?.world) {
      throw new Error('备份文件缺少 world 段，无法恢复');
    }
    return importWorld.mutateAsync({ ...payload, project_id: projectId });
  };

  return { downloadBackup, restoreBackup, isImporting: importWorld.isPending };
};

export type { WorldLinkMoveResult, WorldWithModules, World };
