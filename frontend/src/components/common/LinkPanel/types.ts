/**
 * LinkPanel 类型（Phase 2 P2-T4，接口冻结见 phase2_interface_freeze.md §3.4）
 *
 * 冻结签名不得改名改形；如需变更先改冻结记录并同步 Lead。
 */

import type { EntityRef } from '@/services/worldbuildingApi';
import type { ComplexityLevel } from '@/components/common/ComplexitySwitcher';

export interface LinkPanelProps {
  worldId: string;
  entity: EntityRef;
  /** 缺省读 useComplexity() */
  complexity?: ComplexityLevel;
  onNavigate?: (ref: EntityRef) => void;
  /** 默认「关联」 */
  title?: string;
  defaultCollapsed?: boolean;
  className?: string;
}
