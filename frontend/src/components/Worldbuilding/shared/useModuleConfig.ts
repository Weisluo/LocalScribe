/**
 * ModuleConfig 读写（Phase 3 P3-T8；契约 §2.7）
 *
 * - 读取复用世界详情的 module.config（与 WorldbuildingView 同一 queryKey，不额外请求）
 * - 保存走 P1 通用 PUT /modules/{id}（config 整体替换），合并时保留未知键
 * - 术语：模块级 terminology 覆盖世界级 settings.terminology（契约 §2.7）
 * - 复杂度为 sketch 时不提供编辑入口（配置属于结构档能力，降档只隐藏不删数据）
 */

import { useCallback, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { worldbuildingApi } from '@/services/worldbuildingApi';
import { useComplexity } from '@/components/common/ComplexitySwitcher';
import { worldbuildingKeys } from '../hooks/worldQueryKeys';
import { useWorld } from '../hooks/useWorldData';
import {
  mergeModuleConfig,
  parseModuleConfig,
  termOf,
  type ModuleConfig,
} from './moduleConfig';

export interface UseModuleConfigResult {
  config: ModuleConfig;
  /** 原始 config（含未知键），保存时作为合并基底 */
  raw: ModuleConfig | null;
  /** 保存补丁（浅合并后整体 PUT） */
  save: (patch: ModuleConfig) => Promise<void>;
  isSaving: boolean;
  /** 非 sketch 档才允许改配置 */
  canEdit: boolean;
}

export const useModuleConfig = (
  worldId?: string,
  moduleId?: string
): UseModuleConfigResult => {
  const queryClient = useQueryClient();
  const { level } = useComplexity();
  const worldQuery = useWorld(worldId);

  const raw = useMemo<ModuleConfig | null>(() => {
    const module = worldQuery.data?.modules?.find((item) => item.id === moduleId);
    if (!module) return null;
    return parseModuleConfig(module.config);
  }, [worldQuery.data, moduleId]);

  const config = useMemo(() => raw ?? {}, [raw]);

  const mutation = useMutation({
    mutationFn: (next: ModuleConfig) =>
      worldbuildingApi.updateModule(moduleId!, { config: next }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: worldbuildingKeys.worldRoot });
      toast.success('模块配置已保存');
    },
    onError: (error: Error) => toast.error(error.message || '保存模块配置失败'),
  });

  const save = useCallback(
    async (patch: ModuleConfig) => {
      if (!moduleId) return;
      await mutation.mutateAsync(mergeModuleConfig(config, patch));
    },
    [config, moduleId, mutation]
  );

  return {
    config,
    raw,
    save,
    isSaving: mutation.isPending,
    canEdit: level !== 'sketch',
  };
};

/** 世界级术语表（settings.terminology） */
export const useWorldTerminology = (
  worldId?: string
): Record<string, string> => {
  const worldQuery = useWorld(worldId);
  return useMemo(() => {
    const terminology = worldQuery.data?.settings?.terminology;
    if (!terminology || typeof terminology !== 'object') return {};
    return terminology as Record<string, string>;
  }, [worldQuery.data]);
};

export interface ModuleTerms {
  /** 术语查询：模块级覆盖世界级 */
  term: (key: string, fallback: string) => string;
  worldTerminology: Record<string, string>;
}

export const useModuleTerms = (
  config: ModuleConfig,
  worldId?: string
): ModuleTerms => {
  const worldTerminology = useWorldTerminology(worldId);
  const term = useCallback(
    (key: string, fallback: string) =>
      termOf(config, key, fallback, worldTerminology),
    [config, worldTerminology]
  );
  return { term, worldTerminology };
};
