/**
 * 迁移容器归位面板的纯函数（Phase 2 P2-T13）
 *
 * 容器关联在 meta 里保留旧关系记账键（phase2 §1「迁移容器口径」）：
 * legacyRelationType / strength / legacySourceName / legacyTargetName。
 */

import type { WorldLink } from '@/services/worldbuildingApi';

export interface MigrationLinkInfo {
  legacyRelationType?: string;
  strength?: string;
  legacySourceName?: string;
  legacyTargetName?: string;
}

const metaString = (
  meta: Record<string, unknown> | null | undefined,
  key: string
): string | undefined => {
  const value = meta?.[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
};

export const readMigrationMeta = (link: WorldLink): MigrationLinkInfo => ({
  legacyRelationType: metaString(link.meta, 'legacyRelationType'),
  strength: metaString(link.meta, 'strength'),
  legacySourceName: metaString(link.meta, 'legacySourceName'),
  legacyTargetName: metaString(link.meta, 'legacyTargetName'),
});

/** 分组键：按 legacyRelationType 与 strength 两段（缺失时给出可读占位） */
export const migrationGroupKey = (link: WorldLink): string => {
  const info = readMigrationMeta(link);
  return `${info.legacyRelationType ?? '未标注类型'}｜${info.strength ?? '未标注强度'}`;
};

export interface MigrationLinkGroup {
  key: string;
  legacyRelationType?: string;
  strength?: string;
  links: WorldLink[];
}

/** 归位面板的展示分组，保持容器返回的原始顺序 */
export const groupMigrationLinks = (links: WorldLink[]): MigrationLinkGroup[] => {
  const groups = new Map<string, MigrationLinkGroup>();
  for (const link of links) {
    const key = migrationGroupKey(link);
    const existing = groups.get(key);
    if (existing) {
      existing.links.push(link);
      continue;
    }
    const info = readMigrationMeta(link);
    groups.set(key, {
      key,
      legacyRelationType: info.legacyRelationType,
      strength: info.strength,
      links: [link],
    });
  }
  return [...groups.values()];
};
