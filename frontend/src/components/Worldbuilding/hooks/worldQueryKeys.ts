/**
 * React Query key 统一约定（Phase 2 P2-T1）
 *
 * 形状固定为 ['worldbuilding', 资源, 作用域]：
 * - 资源：worlds / world / entities / links / link-registry / migration-container
 * - 作用域：项目 id、世界 id 或实体/模块签名
 *
 * 计数与关联必须整批失效，禁止逐卡请求；因此 counts 与 links 共用 'links' 资源前缀。
 */

export interface LinkQueryScope {
  module?: string;
  entityId?: string;
  linkType?: string;
  targetModule?: string;
  skip?: number;
  limit?: number;
}

/** 把 scope 归一化成稳定字符串，保证同一查询参数得到同一 key */
export const linkScopeKey = (scope?: LinkQueryScope): string => {
  if (!scope) return 'all';
  return [
    scope.module ?? '-',
    scope.entityId ?? '-',
    scope.linkType ?? '-',
    scope.targetModule ?? '-',
    scope.skip ?? 0,
    scope.limit ?? '-',
  ].join('|');
};

export const worldbuildingKeys = {
  all: ['worldbuilding'] as const,

  worlds: (projectId?: string) =>
    ['worldbuilding', 'worlds', projectId ?? 'all'] as const,

  /** 世界详情；includeItems 参与 key，避免「含条目 / 不含条目」两种形状互相命中缓存 */
  world: (worldId?: string, includeItems = true) =>
    ['worldbuilding', 'world', worldId ?? 'none', includeItems] as const,

  /** world 资源的失效前缀（不关心 includeItems），统一用于 invalidateQueries */
  worldRoot: ['worldbuilding', 'world'] as const,

  /** 世界内实体索引（submodule + item + character） */
  entities: (worldId?: string) =>
    ['worldbuilding', 'entities', worldId ?? 'none'] as const,

  linkRegistry: () => ['worldbuilding', 'link-registry'] as const,

  links: (worldId?: string, scope?: LinkQueryScope) =>
    ['worldbuilding', 'links', worldId ?? 'none', linkScopeKey(scope)] as const,

  linkCounts: (worldId?: string) =>
    ['worldbuilding', 'links', 'counts', worldId ?? 'none'] as const,

  /** 迁移容器：容器世界列表与容器 links 由同一 key 派生（P2-T13） */
  migrationContainer: (projectId?: string) =>
    ['worldbuilding', 'migration-container', projectId ?? 'all'] as const,

  /** 历史/经济等旧接口仍在用的模块作用域 key（保持原状，避免回归） */
  submodules: (moduleId?: string) =>
    ['worldbuilding', 'submodules', moduleId ?? 'none'] as const,

  /** 旧形状固定为三段 ['worldbuilding','items',moduleId]；只有显式给 submoduleId 时才加第四段 */
  items: (moduleId?: string, submoduleId?: string) =>
    submoduleId === undefined
      ? (['worldbuilding', 'items', moduleId ?? 'none'] as const)
      : (['worldbuilding', 'items', moduleId ?? 'none', submoduleId] as const),
};
