/**
 * InlineReference 类型（Phase 2 P2-T8，接口冻结见 phase2_interface_freeze.md §3.5）
 *
 * 冻结签名不得改名改形；如需变更先改冻结记录并同步 Lead。
 */

import type { EntityRef } from '@/services/worldbuildingApi';

export interface InlineReferenceProps {
  /** 正文，token 形态 [[module:kind:id|显示名]] */
  value: string;
  onChange?: (value: string) => void;
  worldId?: string;
  projectId?: string;
  /** 渲染模式：chip 只读 */
  readOnly?: boolean;
  /** 默认 true（textarea） */
  multiline?: boolean;
  onNavigate?: (ref: EntityRef) => void;
  placeholder?: string;
  className?: string;
}
