/**
 * Worldbuilding/config 导出面（Phase 6 P6-T3/T4）
 *
 * 只导出本 workstream 的两个配置组件及其纯函数；
 * GlobalSearch / WorldWeb 由各自文件直接导入，不经这里，避免互相耦合。
 */

export {
  DeleteImpactPanel,
  SubmoduleManager,
  SubmoduleManagerPanel,
  SUBMODULE_ICON_CHOICES,
  SUBMODULE_PALETTE,
  canReparentSubmodule,
  moveChildrenPlan,
  reparentSubmodule,
  reorderSubmodules,
  submoduleDeleteImpact,
  submoduleDepth,
  submoduleDescendantIds,
  submoduleItemCount,
  submoduleRows,
  submoduleSiblings,
  type DeleteImpactPanelProps,
  type SubmoduleDeleteImpact,
  type SubmoduleManagerProps,
  type SubmoduleRow,
} from './SubmoduleManager';

export {
  FieldSchemaEditor,
  FieldSchemaEditorPanel,
  FIELD_TYPE_IDS,
  FIELD_TYPE_LABELS,
  fieldsForKind,
  type FieldSchemaEditorProps,
} from './FieldSchemaEditor';
