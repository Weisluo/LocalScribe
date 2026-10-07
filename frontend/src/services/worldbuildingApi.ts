import { api } from '@/utils/request';
import type { components } from '@/types/api';

// 新契约类型来自 OpenAPI 生成（npm run gen:types），不手写重复定义。
// P6-T10：旧分发与实例时代的接口与手写 interface 已全部删除，
// 兼容窗口内的旧模板 / 实例 / 世界观接口不再由前端调用。
export type World = components['schemas']['WorldResponse'];
export type WorldWithModules = components['schemas']['WorldWithModules'];
export type WorldCreatePayload = components['schemas']['WorldCreate'];
export type WorldUpdatePayload = components['schemas']['WorldUpdate'];
export type WorldExportPayload = components['schemas']['WorldExport'];
export type WorldImportPayload = components['schemas']['WorldImport'];
export type WorldImportReport = components['schemas']['WorldImportReport'];
export type WorldImportMode = components['schemas']['WorldImportMode'];
export type WorldModuleDetail = components['schemas']['WorldModuleWithItemsV2'];
export type WorldLink = components['schemas']['WorldLinkResponse'];
export type WorldLinkCreate = components['schemas']['WorldLinkCreate'];
export type WorldLinkUpdate = components['schemas']['WorldLinkUpdate'];
export type WorldLinkCounts = components['schemas']['WorldLinkCounts'];
export type LinkTypeDef = components['schemas']['LinkTypeDefResponse'];
export type EntityRef = components['schemas']['EntityRef'];

// 契约 §2.6 的复杂度三档。后端以 WorldSettings.complexity 自由字符串存储，
// OpenAPI 里同名 schema 是旧模板时代的三档枚举（simple/complex/highly_complex），
// 与契约无关，故此处按契约定义而不复用生成类型。
export type ComplexityLevel = 'sketch' | 'structure' | 'sandbox';

// 契约 v2 实体类型：由后端 /worlds、/modules/{id}/submodules、/modules/{id}/items 返回，
// 含 kind / meta / parent_id（history 的前缀编码废弃后必须读这些字段）。
export type WorldModuleV2 = components['schemas']['WorldModuleWithItemsV2'];
export type SubmoduleV2 = components['schemas']['WorldSubmoduleResponse'];
export type ModuleItemV2 = components['schemas']['WorldModuleItemResponse'];

/** 通用模块增删改的返回类型（P6-T10：取代手写 WorldModule / WorldSubmodule / WorldModuleItem） */
export type WorldModuleResponse = components['schemas']['WorldModuleResponse'];
export type WorldModuleUpdatePayload = components['schemas']['WorldModuleUpdate'];
export type WorldSubmoduleCreatePayload = components['schemas']['WorldSubmoduleCreate'];
export type WorldSubmoduleUpdatePayload = components['schemas']['WorldSubmoduleUpdate'];
export type WorldModuleItemCreatePayload = components['schemas']['WorldModuleItemCreate'];
export type WorldModuleItemUpdatePayload = components['schemas']['WorldModuleItemUpdate'];

/** POST /worlds/{id}/links/move 批量归位结果（P2-T12，取自 OpenAPI 生成类型） */
export type WorldLinkMoveResult = components['schemas']['LinksMoveResponse'];

/** POST /links/{id}/move 单条归位 body（P2-T12，取自 OpenAPI 生成类型） */
export type WorldLinkMovePayload = components['schemas']['LinkMoveRequest'];

// 经济模块只读视图（Phase 5 P5-T7；economy_ui_design §11.1 分档加载）。
// 三档共用一套数据：sketch 只请求 summary，structure 加 graph，sandbox 再加 timeline / metrics。
export type EconomyConfig = components['schemas']['EconomyConfig'];
export type EconomyGraph = components['schemas']['EconomyGraph'];
export type EconomySummary = components['schemas']['EconomySummary'];
export type EconomyTimeline = components['schemas']['EconomyTimeline'];
export type EconomyMetrics = components['schemas']['EconomyMetrics'];

// ---- 通用模块 / 子模块 / 条目 CRUD（P1 通用路由；写入仍被各模块视图使用） ----

/** 模块类型（契约 §2.2 的七个固定值） */
export type ModuleType = components['schemas']['app__schemas__worldbuilding__ModuleType'];

export interface WorldModuleCreateInput {
  module_type: ModuleType;
  name: string;
  description?: string | null;
  icon?: string | null;
  order_index?: number;
  is_collapsible?: boolean;
  is_required?: boolean;
  config?: Record<string, unknown> | null;
}

export interface WorldSubmoduleCreateInput {
  name: string;
  description?: string | null;
  order_index?: number;
  kind?: string | null;
  meta?: Record<string, unknown> | null;
  color?: string | null;
  icon?: string | null;
  parent_id?: string | null;
}

export type WorldSubmoduleUpdateInput = Partial<WorldSubmoduleUpdatePayload>;

export interface WorldModuleItemCreateInput {
  name: string;
  content: Record<string, unknown>;
  order_index?: number;
  is_published?: boolean;
  submodule_id?: string | null;
}

export type WorldModuleItemUpdateInput = Partial<WorldModuleItemUpdatePayload>;

export const worldbuildingApi = {
  /** 更新模块（P5 起 module_type 可部分提交；config 整体替换） */
  updateModule: (moduleId: string, data: Partial<WorldModuleUpdatePayload>) => {
    return api.put<WorldModuleResponse>(`/worldbuilding/modules/${moduleId}`, data);
  },

  /**
   * 为世界补齐缺失模块（Phase 3 P3-T1；P6 起走正式路由 POST /worlds/{id}/modules）。
   * 返回含 submodules / items 的模块详情；模块类型已存在时后端回 400。
   */
  createWorldModule: (worldId: string, data: WorldModuleCreateInput) => {
    return api.post<WorldModuleV2>(`/worldbuilding/worlds/${worldId}/modules`, data);
  },

  getSubmodules: (moduleId: string) => {
    return api.get<SubmoduleV2[]>(`/worldbuilding/modules/${moduleId}/submodules`);
  },

  createSubmodule: (moduleId: string, data: WorldSubmoduleCreateInput) => {
    return api.post<SubmoduleV2>(`/worldbuilding/modules/${moduleId}/submodules`, data);
  },

  updateSubmodule: (submoduleId: string, data: WorldSubmoduleUpdateInput) => {
    return api.put<SubmoduleV2>(`/worldbuilding/submodules/${submoduleId}`, data);
  },

  deleteSubmodule: (submoduleId: string) => {
    return api.delete(`/worldbuilding/submodules/${submoduleId}`);
  },

  getItems: (moduleId: string, params?: { submodule_id?: string; include_all?: boolean }) => {
    return api.get<ModuleItemV2[]>(`/worldbuilding/modules/${moduleId}/items`, { params });
  },

  createItem: (moduleId: string, data: WorldModuleItemCreateInput) => {
    return api.post<ModuleItemV2>(`/worldbuilding/modules/${moduleId}/items`, data);
  },

  updateItem: (itemId: string, data: WorldModuleItemUpdateInput) => {
    return api.put<ModuleItemV2>(`/worldbuilding/items/${itemId}`, data);
  },

  deleteItem: (itemId: string) => {
    return api.delete(`/worldbuilding/items/${itemId}`);
  },

  // ---- 新契约接口：Worlds / WorldLinks（Phase 1，契约 §3.2） ----

  getWorlds: (params?: { project_id?: string; name?: string; skip?: number; limit?: number }) => {
    return api.get<World[]>('/worldbuilding/worlds', { params });
  },

  createWorld: (data: WorldCreatePayload) => {
    return api.post<World>('/worldbuilding/worlds', data);
  },

  getWorld: (worldId: string, params?: { include_modules?: boolean; include_items?: boolean }) => {
    return api.get<WorldWithModules>(`/worldbuilding/worlds/${worldId}`, { params });
  },

  updateWorld: (worldId: string, data: WorldUpdatePayload) => {
    return api.put<World>(`/worldbuilding/worlds/${worldId}`, data);
  },

  deleteWorld: (worldId: string) => {
    return api.delete(`/worldbuilding/worlds/${worldId}`);
  },

  exportWorld: (worldId: string) => {
    return api.get<WorldExportPayload>(`/worldbuilding/worlds/${worldId}/export`);
  },

  /** 恢复世界备份（P6-T2）：返回 WorldImportReport（id 映射 / 失效引用 / 降级项） */
  importWorld: (data: WorldImportPayload) => {
    return api.post<WorldImportReport>('/worldbuilding/worlds/import', data);
  },

  /**
   * 清空世界内的实体与关联（P6-T2 危险操作）：模块与 module.config 保留。
   * 走过一次原子请求，避免前端逐条删子模块/条目时漏掉 WorldLink（残留即失效引用）。
   */
  clearWorldContent: (worldId: string) => {
    return api.delete(`/worldbuilding/worlds/${worldId}/content`);
  },

  getLinkRegistry: () => {
    return api.get<LinkTypeDef[]>('/worldbuilding/link-registry');
  },

  getWorldLinks: (
    worldId: string,
    params?: { module?: string; entity_id?: string; link_type?: string; target_module?: string; skip?: number; limit?: number }
  ) => {
    return api.get<WorldLink[]>(`/worldbuilding/worlds/${worldId}/links`, { params });
  },

  createWorldLink: (worldId: string, data: WorldLinkCreate) => {
    return api.post<WorldLink>(`/worldbuilding/worlds/${worldId}/links`, data);
  },

  getWorldLinkCounts: (worldId: string) => {
    return api.get<WorldLinkCounts[]>(`/worldbuilding/worlds/${worldId}/links/counts`);
  },

  getWorldLink: (linkId: string) => {
    return api.get<WorldLink>(`/worldbuilding/links/${linkId}`);
  },

  updateWorldLink: (linkId: string, data: WorldLinkUpdate) => {
    return api.patch<WorldLink>(`/worldbuilding/links/${linkId}`, data);
  },

  deleteWorldLink: (linkId: string) => {
    return api.delete(`/worldbuilding/links/${linkId}`);
  },

  // ---- 迁移容器归位（Phase 2 P2-T12/T13） ----

  moveWorldLink: (linkId: string, data?: WorldLinkMovePayload) => {
    return api.post<WorldLink>(`/worldbuilding/links/${linkId}/move`, data ?? {});
  },

  moveWorldLinks: (
    worldId: string,
    data: { link_ids: string[]; target_world_id?: string }
  ) => {
    return api.post<WorldLinkMoveResult>(
      `/worldbuilding/worlds/${worldId}/links/move`,
      data
    );
  },

  // ---- 经济模块只读视图（Phase 5 P5-T3/P5-T7）：写入复用上面的通用接口 ----

  getEconomySummary: (moduleId: string, params?: { complexity?: ComplexityLevel }) => {
    return api.get<EconomySummary>(`/worldbuilding/modules/${moduleId}/economy/summary`, {
      params,
    });
  },

  getEconomyGraph: (
    moduleId: string,
    params?: {
      complexity?: ComplexityLevel;
      kinds?: string;
      stages?: string;
      windowStart?: string;
      windowEnd?: string;
    }
  ) => {
    return api.get<EconomyGraph>(`/worldbuilding/modules/${moduleId}/economy/graph`, { params });
  },

  getEconomyTimeline: (moduleId: string, params?: { windowStart?: string; windowEnd?: string }) => {
    return api.get<EconomyTimeline>(`/worldbuilding/modules/${moduleId}/economy/timeline`, {
      params,
    });
  },

  getEconomyMetrics: (
    moduleId: string,
    params?: { windowStart?: string; windowEnd?: string; metricIds?: string }
  ) => {
    return api.get<EconomyMetrics>(`/worldbuilding/modules/${moduleId}/economy/metrics`, { params });
  },
};
