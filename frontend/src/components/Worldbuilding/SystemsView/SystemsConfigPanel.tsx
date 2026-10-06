/**
 * SystemsConfigPanel（Phase 3 P3-T8；systems_ui_design §3.4/§7/§8）
 *
 * 薄封装：把体系模块的解析后配置、内置 kind、层级上限与模块专属区交给共用的
 * ModuleConfigPanel（由 P3-T8 提供），本文件不重复实现配置 UI。
 * 模块专属键（tierTerm / rankStep / nodeStyles / costFields）由 moduleType='systems' 覆盖，
 * 需要额外自定义区时通过 extra 透传。
 */

import { useMemo, type ReactNode } from 'react';

import type { EntityTypeDef, ModuleConfig } from '../shared/moduleConfig';
import { ModuleConfigPanel } from '../shared/ModuleConfigPanel';
import { SYSTEM_KINDS, SYSTEMS_MAX_DEPTH } from './types';

export interface SystemsConfigPanelProps {
  open: boolean;
  onClose: () => void;
  /** 解析后的配置（默认值 + 后端 config），作为草稿初值 */
  config: ModuleConfig;
  /** 后端原始 config：仅用于保证未知键在合并后仍然存在 */
  rawConfig?: ModuleConfig;
  onSave: (patch: ModuleConfig) => Promise<void>;
  builtins?: EntityTypeDef[];
  maxDepth?: number;
  /** 额外自定义区（tierTerm / rankStep / nodeStyles / costFields 已由 moduleType='systems' 覆盖） */
  extra?: ReactNode;
  title?: string;
}

export const SystemsConfigPanel = ({
  open,
  onClose,
  config,
  rawConfig,
  onSave,
  builtins = SYSTEM_KINDS,
  maxDepth = SYSTEMS_MAX_DEPTH,
  extra,
  title = '模块配置',
}: SystemsConfigPanelProps) => {
  // 后端未知键保留在 raw 中；解析后的 config 覆盖同名键，草稿因此不会丢字段
  const draftBase = useMemo<ModuleConfig>(
    () => ({ ...(rawConfig ?? {}), ...config }),
    [config, rawConfig]
  );

  return (
    <ModuleConfigPanel
      open={open}
      onClose={onClose}
      config={draftBase}
      onSave={onSave}
      builtins={builtins}
      maxDepth={maxDepth}
      moduleType="systems"
      extra={extra}
      title={title}
    />
  );
};

export default SystemsConfigPanel;
