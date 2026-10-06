/**
 * 种族模块配置面板 RaceConfigPanel（Phase 3 P3-T3；races_ui_design §7/§12）
 *
 * 薄包装：通用部分（类型 / 字段 / 状态与等级 / 术语与视图）与模块专属部分
 * （relationKinds 血缘语义分色、emblemPalette 纹章色板）都由共用件 ModuleConfigPanel 承担，
 * 通过 moduleType='races' 打开对应编辑段，避免同一份配置出现两套编辑器。
 * 不预置任何种族内容：这里只编辑骨架配置，空值即空（§12.2）。
 */

import type { ModuleConfig } from '../shared/moduleConfig';
import { ModuleConfigPanel } from '../shared/ModuleConfigPanel';
import { RACES_MAX_DEPTH, RACE_KINDS } from './types';

export interface RaceConfigPanelProps {
  open: boolean;
  onClose: () => void;
  /** 解析后的配置（默认值 + 后端 config），作为草稿初值 */
  config: ModuleConfig;
  /** 保存补丁（useModuleConfig().save 负责与原始 config 浅合并后 PUT） */
  onSave: (patch: ModuleConfig) => Promise<void>;
}

export const RaceConfigPanel = ({ open, onClose, config, onSave }: RaceConfigPanelProps) => (
  <ModuleConfigPanel
    open={open}
    onClose={onClose}
    config={config}
    onSave={onSave}
    builtins={RACE_KINDS}
    maxDepth={RACES_MAX_DEPTH}
    moduleType="races"
    title="种族模块配置"
  />
);
