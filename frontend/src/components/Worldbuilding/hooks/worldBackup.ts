/**
 * 世界备份文件与恢复报告的纯函数（Phase 6 P6-T2）
 *
 * 设计依据：worldbuilding_ui_design §3.4（备份与恢复）、worldview_configuration_system §7（存档与 schema_version）。
 * 口径：
 * - 备份是本应用导出的完整 JSON（world / modules / links 三段），只是个人数据的迁移与分享手段；
 * - 恢复前先校验结构与版本：schema_version 高于本应用一律拒绝，缺 `world` 段一律拒绝；
 * - 恢复模式只有两种：恢复为新世界（默认）与覆盖当前世界（非空世界必须显式确认）。
 * 本文件不依赖 React，便于 SSR harness 直测。
 */

import type { WorldImportPayload, WorldImportReport } from '@/services/worldbuildingApi';

/** 本应用支持的最高备份格式版本（后端 WORLD_SCHEMA_VERSION 同步） */
export const WORLD_SCHEMA_VERSION = 1;

export type WorldImportMode = 'new' | 'overwrite';

export interface BackupDocument {
  schema_version: number;
  world: Record<string, unknown>;
  modules: unknown[];
  links: unknown[];
  /** 顶层未知键原样保留（恢复时一并回传，§7「未知字段保留」） */
  extra: Record<string, unknown>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export class BackupValidationError extends Error {}

/**
 * 解析备份文件文本：JSON 语法、顶层对象、`world` 段三者任一不满足即抛错（不静默吞）。
 */
export const parseBackupText = (text: string): BackupDocument => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BackupValidationError('不是有效的 JSON 文件，无法作为世界备份恢复');
  }
  if (!isRecord(parsed)) {
    throw new BackupValidationError('备份文件顶层必须是对象（应含 world / modules / links）');
  }
  if (!isRecord(parsed.world)) {
    throw new BackupValidationError('备份文件缺少 world 段，无法恢复');
  }
  for (const key of ['modules', 'links'] as const) {
    if (key in parsed && !Array.isArray(parsed[key])) {
      throw new BackupValidationError(`备份文件的 ${key} 段必须是数组，无法恢复`);
    }
  }
  const modules = Array.isArray(parsed.modules) ? parsed.modules : [];
  const links = Array.isArray(parsed.links) ? parsed.links : [];
  const schemaVersion =
    typeof parsed.schema_version === 'number' && Number.isFinite(parsed.schema_version)
      ? parsed.schema_version
      : WORLD_SCHEMA_VERSION;
  // 顶层未知键单独留出，恢复时原样回传（§7「未知字段保留不丢弃」）
  const extra: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(parsed)) {
    if (key === 'world' || key === 'modules' || key === 'links' || key === 'schema_version') continue;
    extra[key] = val;
  }
  return { schema_version: schemaVersion, world: parsed.world, modules, links, extra };
};

/** 版本守卫：备份格式高于本应用时拒绝恢复（不尝试降级解析） */
export const assertBackupVersion = (
  document: Pick<BackupDocument, 'schema_version'>,
  supported: number = WORLD_SCHEMA_VERSION
): void => {
  if (document.schema_version > supported) {
    throw new BackupValidationError(
      `备份格式版本 ${document.schema_version} 高于本应用支持的 ${supported}，请先升级应用再恢复`
    );
  }
};

export interface RestoreOptions {
  mode?: WorldImportMode;
  targetWorldId?: string | null;
  projectId?: string | null;
  confirmOverwrite?: boolean;
  keepDangling?: boolean;
  /** 覆盖当前世界时是否覆盖非空世界（非空 + 未确认 -> 后端 409） */
  overwriteNonEmpty?: boolean;
}

/**
 * 组装 POST /worlds/import 请求体：补齐默认模式与显式确认位，
 * 顶层未知键一并回传，保证「未知字段保留不丢弃」。
 */
export const buildImportPayload = (
  document: BackupDocument,
  options: RestoreOptions = {}
): WorldImportPayload => {
  const mode: WorldImportMode = options.mode === 'overwrite' ? 'overwrite' : 'new';
  return {
    ...document.extra,
    world: document.world as unknown as WorldImportPayload['world'],
    modules: document.modules as unknown as WorldImportPayload['modules'],
    links: document.links as unknown as WorldImportPayload['links'],
    schema_version: document.schema_version,
    project_id: options.projectId ?? null,
    mode,
    target_world_id: mode === 'overwrite' ? options.targetWorldId ?? null : null,
    confirm_overwrite: mode === 'overwrite' ? options.confirmOverwrite === true : false,
    keep_dangling: options.keepDangling !== false,
  } as WorldImportPayload;
};

/** 覆盖模式的本地前置校验：非空世界必须显式确认（后端会回 409，前端先拦一次） */
export const canOverwriteWorld = (
  mode: WorldImportMode,
  targetNonEmpty: boolean,
  confirmOverwrite: boolean
): boolean => mode !== 'overwrite' || !targetNonEmpty || confirmOverwrite;

/** 备份文件名：世界名-日期.world.json（非法文件名字符替换为 _） */
export const backupFileName = (worldName: string, date: Date = new Date()): string => {
  const pad = (value: number) => String(value).padStart(2, '0');
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const safe = (worldName || '世界').trim().replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 60) || '世界';
  return `${safe}-${stamp}.world.json`;
};

export interface ImportReportSummary {
  /** 逐行文案（面板直接渲染） */
  lines: string[];
  entityCount: number;
  linkCount: number;
  mergedDuplicates: number;
  skippedLinks: number;
  idMapCount: number;
  danglingCount: number;
  unknownKinds: string[];
  unknownLinkTypes: string[];
  warnings: string[];
  /** 保留了失效引用（渲染为警示 chip，可后续清理） */
  keptDangling: boolean;
}

/**
 * 恢复报告 -> 面板文案（id 映射数、关联、失效引用、未知 kind/link_type、告警）。
 *
 * `keepDangling` 必须传真实选择：后端在 `keep_dangling=false` 时**仍然**把解析不到的端点
 * 列进 `dangling_refs`（只是不建这条关联），不传就会把「已丢弃」误报成「已保留」。
 */
export const summarizeImportReport = (
  report: Pick<
    WorldImportReport,
    | 'entity_count'
    | 'link_count'
    | 'merged_duplicates'
    | 'skipped_links'
    | 'id_map'
    | 'dangling_refs'
    | 'unknown_kinds'
    | 'unknown_link_types'
    | 'warnings'
  >,
  options: { keepDangling?: boolean } = {}
): ImportReportSummary => {
  const danglingCount = report.dangling_refs?.length ?? 0;
  const unknownKinds = [...(report.unknown_kinds ?? [])];
  const unknownLinkTypes = [...(report.unknown_link_types ?? [])];
  const warnings = [...(report.warnings ?? [])];
  const idMapCount = Object.keys(report.id_map ?? {}).length;
  const keepDangling = options.keepDangling !== false;

  const lines = [
    `实体 ${report.entity_count ?? 0} 个，关联 ${report.link_count ?? 0} 条`,
    `id 映射 ${idMapCount} 条，合并重复 ${report.merged_duplicates ?? 0} 条，跳过关联 ${report.skipped_links ?? 0} 条`,
  ];
  if (danglingCount > 0) {
    const modules = new Set((report.dangling_refs ?? []).map((ref) => ref.module)).size;
    lines.push(
      keepDangling
        ? `失效引用 ${danglingCount} 条已保留为警示引用（可逐条清理），涉及 ${modules} 个模块`
        : `失效引用 ${danglingCount} 条已按设置丢弃（未保留为警示引用），涉及 ${modules} 个模块`
    );
  }
  for (const item of report.dangling_refs ?? []) {
    lines.push(`失效引用：${item.link_type} 的 ${item.role} 端 ${item.module}/${item.kind}/${item.id}`);
  }
  if (unknownKinds.length) {
    lines.push(`未知 kind ${unknownKinds.length} 个未做降级（按原值保留）：${unknownKinds.join('、')}`);
  }
  if (unknownLinkTypes.length) {
    lines.push(`未知关联类型 ${unknownLinkTypes.length} 个已回落为 core.related_to：${unknownLinkTypes.join('、')}`);
  }
  for (const warning of warnings) lines.push(`提示：${warning}`);

  return {
    lines,
    entityCount: report.entity_count ?? 0,
    linkCount: report.link_count ?? 0,
    mergedDuplicates: report.merged_duplicates ?? 0,
    skippedLinks: report.skipped_links ?? 0,
    idMapCount,
    danglingCount,
    unknownKinds,
    unknownLinkTypes,
    warnings,
    keptDangling: keepDangling && danglingCount > 0,
  };
};

/** 失效引用行的展示标签（警示 chip 的 title） */
export const danglingRefLabel = (ref: {
  role: string;
  module: string;
  kind: string;
  id: string;
  link_type: string;
}): string => `${ref.role} · ${ref.module}/${ref.kind} · ${ref.link_type} · ${ref.id.slice(0, 8)}`;
