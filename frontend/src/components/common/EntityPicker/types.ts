/**
 * EntityPicker 类型（Phase 2 P2-T3，接口冻结见 phase2_interface_freeze.md §3.3）
 *
 * 冻结签名不得改名改形；如需变更先改冻结记录并同步 Lead。
 */

import type { EntityRef } from '@/services/worldbuildingApi';

/** 选择结果：targets 为对端实体（多选批量创建同一 link_type） */
export interface EntityPickerSelection {
  targets: EntityRef[];
  /** 只允许契约 §4 已登记的 link_type id */
  linkType: string;
  label?: string;
  note?: string;
  time?: { start?: string; end?: string };
  meta?: Record<string, unknown>;
}

export interface EntityPickerProps {
  open: boolean;
  worldId: string;
  /** 关联源；用于排除自身与过滤合法 link_type */
  source: EntityRef;
  /** 步骤一默认模块 */
  presetModule?: string;
  /** 步骤二 kind 过滤 */
  kindFilter?: string[];
  /** 多选批量创建同类型关联 */
  multi?: boolean;
  /** 已存在的对端，避免重复 */
  excludeRefs?: EntityRef[];
  /** sketch 简化流程：跳过类型选择，默认 SKETCH_DEFAULT_LINK_TYPE */
  simpleMode?: boolean;
  onClose: () => void;
  onConfirm: (selection: EntityPickerSelection) => void;
  isSubmitting?: boolean;
}
