/**
 * 全局搜索索引与限定符的纯函数（Phase 6 P6-T6）
 *
 * 设计依据：worldbuilding_ui_design §2.4（全局搜索）、§2.5（跨模块导航）。
 * 口径：
 * - 索引在客户端一次建好（MVP：phase6 §6「搜索 MVP 客户端过滤，超 5000 实体再评估后端搜索」）；
 * - 范围：全部模块的子模块与条目 —— 名称、描述、标签、自定义字段文本、行内引用显示名；
 * - 限定符：模块:政治 / kind:polity / 关联:历史 / 标签:古老，同时接受 ASCII module:/kind:/link:/tag:；
 * - 速写档同样可用：关联数据缺失时只放弃「关联:」限定符，其余照常（不依赖 link 数据）；
 * - 最近记录按 项目+世界 分键，切世界不读回上一个世界的记录（P5 曾在此处跨世界泄漏）。
 */

import type { EntityRef, ModuleItemV2, SubmoduleV2, WorldLink, WorldModuleV2 } from '@/services/worldbuildingApi';
import { parseInlineTokens } from '../types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** 命中字段的展示名（保持稳定，不需要 i18n） */
export type SearchFieldName = '名称' | '描述' | '标签' | '行内引用' | string;

export interface SearchEntity {
  module: string;
  moduleLabel: string;
  kind: string;
  kindLabel: string;
  id: string;
  name: string;
  description: string;
  tags: string[];
  /** [字段名, 文本]；字段名来自 meta / content 的键 */
  fields: [string, string][];
  /** 行内引用显示名（只存 id，显示名实时解析） */
  inlineNames: string[];
  /** 关联总数；没有关联数据时为 0 */
  linkCount: number;
  /** 关联对端模块；「关联:」限定符用，没有关联数据时为空 */
  linkedModules: string[];
  isItem: boolean;
}

export interface SearchIndex {
  entities: SearchEntity[];
  /** 是否带上了关联数据（速写档 / 未加载 links 时为 false） */
  linkData: boolean;
}

export interface SearchIndexOptions {
  /** module_type -> 术语化展示名（世界术语替换只影响显示） */
  moduleLabels?: Record<string, string>;
  /** kind -> 术语化展示名 */
  kindLabels?: Record<string, string>;
  /** 关联计数（refKey -> 次数） */
  linkCounts?: Map<string, number> | null;
  /** 世界关联（用于「关联:」限定符与关联数回退计算） */
  links?: WorldLink[] | null;
}

export const refKeyOf = (ref: EntityRef): string => `${ref.module}:${ref.kind}:${ref.id}`;

/** 把任意 JSON 展平成 [路径, 文本]，只收非空字符串/数字，便于字段级命中摘要 */
const flattenText = (value: unknown, prefix = '', into: [string, string][] = []): [string, string][] => {
  if (value === null || value === undefined) return into;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed) into.push([prefix || '内容', trimmed]);
    return into;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    into.push([prefix || '内容', String(value)]);
    return into;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => flattenText(item, `${prefix}[${index}]`, into));
    return into;
  }
  if (isRecord(value)) {
    for (const [key, item] of Object.entries(value)) {
      flattenText(item, prefix ? `${prefix}.${key}` : key, into);
    }
  }
  return into;
};

/** 只取「用户看得懂」的字段：扁平字符串与一层对象键，数组展开为多值 */
const textFieldsOf = (source: unknown): [string, string][] =>
  flattenText(source).map(([key, text]) => [key.replace(/\[\d+\]/g, ''), text] as [string, string]);

const tagsOf = (source: unknown): string[] => {
  if (!isRecord(source)) return [];
  const tags = source.tags;
  if (Array.isArray(tags)) return tags.filter((tag): tag is string => typeof tag === 'string' && !!tag.trim());
  if (typeof tags === 'string' && tags.trim()) return [tags.trim()];
  return [];
};

const inlineNamesOf = (texts: string[]): string[] => {
  const names: string[] = [];
  for (const text of texts) {
    for (const token of parseInlineTokens(text)) {
      if (token.displayName?.trim()) names.push(token.displayName.trim());
    }
  }
  return [...new Set(names)];
};

const submoduleEntity = (
  module: WorldModuleV2,
  submodule: SubmoduleV2,
  options: SearchIndexOptions,
  linkIndex: LinkIndex
): SearchEntity => {
  const meta = isRecord(submodule.meta) ? submodule.meta : {};
  const fields = textFieldsOf(meta);
  const texts = [submodule.name, submodule.description ?? '', ...fields.map(([, text]) => text)];
  const ref: EntityRef = { module: module.module_type, kind: submodule.kind || 'custom', id: submodule.id };
  return {
    module: module.module_type,
    moduleLabel: options.moduleLabels?.[module.module_type] ?? module.name,
    kind: ref.kind,
    kindLabel: options.kindLabels?.[ref.kind] ?? ref.kind,
    id: submodule.id,
    name: submodule.name,
    description: (submodule.description ?? '').trim(),
    tags: tagsOf(meta),
    fields,
    inlineNames: inlineNamesOf(texts),
    linkCount: linkIndex.countOf(ref, options.linkCounts),
    linkedModules: linkIndex.modulesOf(ref, options.links),
    isItem: false,
  };
};

const itemEntity = (
  module: WorldModuleV2,
  item: ModuleItemV2,
  kindOfItem: string,
  options: SearchIndexOptions,
  linkIndex: LinkIndex
): SearchEntity => {
  const content = isRecord(item.content) ? item.content : {};
  const fields = textFieldsOf(content);
  const texts = [item.name, ...fields.map(([, text]) => text)];
  const ref: EntityRef = { module: module.module_type, kind: kindOfItem, id: item.id };
  return {
    module: module.module_type,
    moduleLabel: options.moduleLabels?.[module.module_type] ?? module.name,
    kind: kindOfItem,
    kindLabel: options.kindLabels?.[kindOfItem] ?? kindOfItem,
    id: item.id,
    name: item.name,
    description: '',
    tags: tagsOf(content),
    fields,
    inlineNames: inlineNamesOf(texts),
    linkCount: linkIndex.countOf(ref, options.linkCounts),
    linkedModules: linkIndex.modulesOf(ref, options.links),
    isItem: true,
  };
};

interface LinkIndex {
  countOf: (ref: EntityRef, counts?: Map<string, number> | null) => number;
  modulesOf: (ref: EntityRef, links?: WorldLink[] | null) => string[];
}

const createLinkIndex = (links?: WorldLink[] | null): LinkIndex => {
  const byRef = new Map<string, { count: number; modules: Set<string> }>();
  for (const link of links ?? []) {
    const sourceKey = refKeyOf(link.source);
    const targetKey = refKeyOf(link.target);
    const source = byRef.get(sourceKey) ?? { count: 0, modules: new Set<string>() };
    source.count += 1;
    source.modules.add(link.target.module);
    byRef.set(sourceKey, source);
    if (targetKey !== sourceKey) {
      const target = byRef.get(targetKey) ?? { count: 0, modules: new Set<string>() };
      target.count += 1;
      target.modules.add(link.source.module);
      byRef.set(targetKey, target);
    }
  }
  return {
    countOf: (ref, counts) => counts?.get(refKeyOf(ref)) ?? byRef.get(refKeyOf(ref))?.count ?? 0,
    modulesOf: (ref) => [...(byRef.get(refKeyOf(ref))?.modules ?? [])].sort(),
  };
};

/**
 * 建索引：一次遍历 world 详情（submodules + items）。
 * `linkData` 表示是否真的拿到了关联数据 —— 速写档 / 未加载时「关联:」限定符会主动给出提示。
 */
export const buildSearchIndex = (
  modules: WorldModuleV2[] | null | undefined,
  options: SearchIndexOptions = {}
): SearchIndex => {
  const linkIndex = createLinkIndex(options.links);
  const entities: SearchEntity[] = [];
  for (const module of modules ?? []) {
    for (const submodule of module.submodules ?? []) {
      entities.push(submoduleEntity(module, submodule, options, linkIndex));
    }
    for (const item of module.items ?? []) {
      // 条目挂不到 kind（契约 §4.1：item 不参与全局寻址），统一按 item 展示
      entities.push(itemEntity(module, item, 'item', options, linkIndex));
    }
  }
  return { entities, linkData: (options.links?.length ?? 0) > 0 };
};

// ---------- 限定符 ----------

export interface SearchQualifiers {
  module?: string;
  kind?: string;
  link?: string;
  tag?: string;
  /** 去掉限定符后的自由文本 */
  text: string;
}

/** 中文与 ASCII 限定符键（大小写不敏感） */
export const QUALIFIER_ALIASES: Record<string, keyof Omit<SearchQualifiers, 'text'>> = {
  模块: 'module',
  module: 'module',
  kind: 'kind',
  类型: 'kind',
  关联: 'link',
  link: 'link',
  标签: 'tag',
  tag: 'tag',
  tags: 'tag',
};

const qualifierPattern = new RegExp(
  `(?:^|\\s)(${Object.keys(QUALIFIER_ALIASES).join('|')})[:：]("([^"]*)"|'([^']*)'|(\\S+))`,
  'gi'
);

/** 解析查询串：限定符任意顺序、可重复（后者覆盖前者），其余为自由文本 */
export const parseSearchQuery = (query: string): SearchQualifiers => {
  const result: SearchQualifiers = { text: '' };
  if (!query) return result;
  const stripped = query.replace(qualifierPattern, (_match, key: string, _raw, dq, sq, plain) => {
    const field = QUALIFIER_ALIASES[key.toLowerCase()] ?? QUALIFIER_ALIASES[key];
    const value = (dq ?? sq ?? plain ?? '').trim();
    if (field && value) result[field] = value;
    return ' ';
  });
  result.text = stripped.replace(/\s+/g, ' ').trim();
  return result;
};

/** 纯限定符（没有自由文本）也算一次有效查询 */
export const isSearchQueryEmpty = (qualifiers: SearchQualifiers): boolean =>
  !qualifiers.text && !qualifiers.module && !qualifiers.kind && !qualifiers.link && !qualifiers.tag;

export const hasQualifier = (qualifiers: SearchQualifiers): boolean =>
  !!(qualifiers.module || qualifiers.kind || qualifiers.link || qualifiers.tag);

// ---------- 匹配与分组 ----------

export interface SearchHit {
  entity: SearchEntity;
  /** 命中的字段名 */
  field: SearchFieldName;
  snippet: string;
  /** 命中字段的排序权重（越小越靠前） */
  score: number;
}

export interface SearchGroup {
  module: string;
  label: string;
  hits: SearchHit[];
}

export const SEARCH_SNIPPET_LENGTH = 48;

const normalize = (value: string): string => value.trim().toLowerCase();

const snippetOf = (text: string, query: string): string => {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (!query) return trimmed.slice(0, SEARCH_SNIPPET_LENGTH);
  const index = trimmed.toLowerCase().indexOf(query.toLowerCase());
  if (index < 0) return trimmed.slice(0, SEARCH_SNIPPET_LENGTH);
  const start = Math.max(0, index - 12);
  const slice = trimmed.slice(start, start + SEARCH_SNIPPET_LENGTH);
  return `${start > 0 ? '…' : ''}${slice}${start + SEARCH_SNIPPET_LENGTH < trimmed.length ? '…' : ''}`;
};

const matchField = (entity: SearchEntity, text: string): { field: SearchFieldName; text: string; score: number } | null => {
  const needle = normalize(text);
  if (!needle) return null;
  if (normalize(entity.name).includes(needle)) return { field: '名称', text: entity.name, score: 0 };
  const tag = entity.tags.find((item) => normalize(item).includes(needle));
  if (tag) return { field: '标签', text: tag, score: 1 };
  if (normalize(entity.description).includes(needle)) {
    return { field: '描述', text: entity.description, score: 2 };
  }
  const inline = entity.inlineNames.find((item) => normalize(item).includes(needle));
  if (inline) return { field: '行内引用', text: inline, score: 3 };
  for (const [key, value] of entity.fields) {
    if (normalize(value).includes(needle)) return { field: key, text: value, score: 4 };
  }
  return null;
};

const matchesModuleQualifier = (entity: SearchEntity, value: string): boolean => {
  const needle = normalize(value);
  return normalize(entity.module) === needle || normalize(entity.moduleLabel) === needle;
};

const matchesKindQualifier = (entity: SearchEntity, value: string): boolean => {
  const needle = normalize(value);
  return normalize(entity.kind) === needle || normalize(entity.kindLabel) === needle;
};

const matchesLinkQualifier = (
  entity: SearchEntity,
  value: string,
  moduleLabels: Record<string, string>
): boolean => {
  const needle = normalize(value);
  return entity.linkedModules.some((module) => {
    const label = moduleLabels[module] ?? module;
    return normalize(module) === needle || normalize(label) === needle;
  });
};

const matchesTagQualifier = (entity: SearchEntity, value: string): boolean => {
  const needle = normalize(value);
  return entity.tags.some((tag) => normalize(tag).includes(needle));
};

export interface SearchOptions {
  /** module_type -> 展示名（与建索引时一致） */
  moduleLabels?: Record<string, string>;
  /** 每个模块最多返回多少条（默认不截断） */
  limitPerGroup?: number;
  /** 总数上限（默认 200，避免大世界一次渲染过多行） */
  limit?: number;
}

export const SEARCH_RESULT_LIMIT = 200;

/**
 * 搜索：限定符先过滤，再按字段权重排序；结果按模块分组（模块顺序 === 标签栏顺序由调用方传入）。
 */
export const searchIndex = (
  index: SearchIndex,
  query: string | SearchQualifiers,
  options: SearchOptions = {}
): SearchGroup[] => {
  const qualifiers = typeof query === 'string' ? parseSearchQuery(query) : query;
  if (isSearchQueryEmpty(qualifiers)) return [];
  const moduleLabels = options.moduleLabels ?? {};
  const groups = new Map<string, SearchGroup>();
  const ordered: string[] = [];
  let total = 0;
  const limit = options.limit ?? SEARCH_RESULT_LIMIT;
  const perGroup = options.limitPerGroup ?? Number.POSITIVE_INFINITY;

  for (const entity of index.entities) {
    if (total >= limit) break;
    if (qualifiers.module && !matchesModuleQualifier(entity, qualifiers.module)) continue;
    if (qualifiers.kind && !matchesKindQualifier(entity, qualifiers.kind)) continue;
    if (qualifiers.tag && !matchesTagQualifier(entity, qualifiers.tag)) continue;
    if (qualifiers.link && !matchesLinkQualifier(entity, qualifiers.link, moduleLabels)) continue;

    let hit: SearchHit | null = null;
    if (qualifiers.text) {
      const matched = matchField(entity, qualifiers.text);
      if (!matched) continue;
      hit = {
        entity,
        field: matched.field,
        snippet: snippetOf(matched.text, qualifiers.text),
        score: matched.score,
      };
    } else {
      hit = {
        entity,
        field: '名称',
        snippet: entity.description || snippetOf(entity.name, ''),
        score: 0,
      };
    }

    const group = groups.get(entity.module) ?? {
      module: entity.module,
      label: moduleLabels[entity.module] ?? entity.moduleLabel,
      hits: [],
    };
    if (group.hits.length >= perGroup) continue;
    if (!groups.has(entity.module)) {
      groups.set(entity.module, group);
      ordered.push(entity.module);
    }
    group.hits.push(hit);
    total += 1;
  }

  return ordered.map((module) => {
    const group = groups.get(module)!;
    return {
      ...group,
      hits: [...group.hits].sort((a, b) => a.score - b.score || a.entity.name.localeCompare(b.entity.name)),
    };
  });
};

export const countHits = (groups: SearchGroup[]): number =>
  groups.reduce((total, group) => total + group.hits.length, 0);

// ---------- 最近记录（作用域按项目 + 世界隔离） ----------

export const RECENT_SEARCH_LIMIT = 8;

export const recentSearchKey = (projectId?: string | null, worldId?: string | null): string =>
  `localscribe.worldSearch.recent.${projectId ?? 'default'}::${worldId ?? 'none'}`;

interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

const defaultStorage = (): StorageLike | null => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
};

export const loadRecentSearches = (
  projectId?: string | null,
  worldId?: string | null,
  storage: StorageLike | null = defaultStorage()
): string[] => {
  try {
    const raw = storage?.getItem(recentSearchKey(projectId, worldId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string' && !!item.trim()).slice(0, RECENT_SEARCH_LIMIT);
  } catch {
    return [];
  }
};

/** 新查询置顶、去重（按原文）、超限丢弃最旧 */
export const pushRecentSearch = (
  query: string,
  list: string[],
  limit: number = RECENT_SEARCH_LIMIT
): string[] => {
  const trimmed = query.trim();
  if (!trimmed) return list;
  return [trimmed, ...list.filter((item) => item !== trimmed)].slice(0, limit);
};

export const saveRecentSearches = (
  projectId: string | null | undefined,
  worldId: string | null | undefined,
  queries: string[],
  storage: StorageLike | null = defaultStorage()
): void => {
  try {
    storage?.setItem(recentSearchKey(projectId, worldId), JSON.stringify(queries.slice(0, RECENT_SEARCH_LIMIT)));
  } catch {
    // 隐私模式 / SSR：不写不抛
  }
};
