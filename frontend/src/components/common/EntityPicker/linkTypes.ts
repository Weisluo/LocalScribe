/**
 * link_type 合法性过滤（契约 §4，遗留问题 L3 口径）
 *
 * registry 的 source/target 是 EntityRef[]，其 id 恒为 "*"，只读 module/kind：
 * kind === '*' 表示该模块下任意 kind；source/target 为 null 表示任意端点。
 * 不匹配时只允许三种通用类型（core.references / core.related_to / custom.link），
 * 这三条在后端注册表里正是 source/target 为 null 的记录，因此本函数天然覆盖该约束。
 */

import type { EntityRef, LinkTypeDef } from '@/services/worldbuildingApi';

const matchesKindRef = (
  refs: LinkTypeDef['source'],
  target: EntityRef
): boolean =>
  !refs || refs.length === 0
    ? true
    : refs.some(
        (ref) =>
          ref.module === target.module &&
          (ref.kind === '*' || ref.kind === target.kind)
      );

/** 按源/目标 (module, kind) 过滤出合法关联类型，保持 registry 原顺序 */
export const filterLinkTypes = (
  definitions: LinkTypeDef[],
  source: EntityRef,
  targets: EntityRef[]
): LinkTypeDef[] =>
  definitions.filter(
    (definition) =>
      matchesKindRef(definition.source, source) &&
      targets.every((target) => matchesKindRef(definition.target, target))
  );
