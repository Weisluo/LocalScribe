import { api } from '@/utils/request';
import type { components } from '@/types/api';

// 新契约类型来自 OpenAPI 生成（npm run gen:types），不手写重复定义
export type World = components['schemas']['WorldResponse'];
export type WorldWithModules = components['schemas']['WorldWithModules'];
export type WorldCreatePayload = components['schemas']['WorldCreate'];
export type WorldUpdatePayload = components['schemas']['WorldUpdate'];
export type WorldExportPayload = components['schemas']['WorldExport'];
export type WorldImportPayload = components['schemas']['WorldImport'];
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

export interface WorldTemplate {
  id: string;
  name: string;
  description?: string;
  cover_image?: string;
  tags: string[];
  is_public: boolean;
  is_system_template: boolean;
  project_id?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  module_count: number;
  instance_count: number;
}

export interface WorldModule {
  id: string;
  template_id: string;
  module_type: 'map' | 'history' | 'politics' | 'economy' | 'races' | 'systems' | 'special';
  name: string;
  description?: string;
  icon?: string;
  order_index: number;
  is_collapsible: boolean;
  is_required: boolean;
  created_at: string;
  updated_at: string;
  submodule_count: number;
  item_count: number;
  submodules?: WorldSubmodule[];
  items?: WorldModuleItem[];
}

export interface WorldSubmodule {
  id: string;
  module_id: string;
  name: string;
  description?: string;
  order_index: number;
  color?: string;
  icon?: string;
  parent_id?: string;
  created_at: string;
  updated_at: string;
  item_count: number;
  items?: WorldModuleItem[];
}

export interface WorldModuleItem {
  id: string;
  module_id: string;
  submodule_id?: string;
  name: string;
  content: Record<string, string>;
  order_index: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorldInstance {
  id: string;
  template_id: string;
  project_id: string;
  name: string;
  description?: string;
  custom_data?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export const worldbuildingApi = {
  getTemplates: (params?: { skip?: number; limit?: number; name?: string; is_public?: boolean; project_id?: string }) => {
    return api.get<WorldTemplate[]>('/worldbuilding/templates', { params });
  },

  getTemplate: (templateId: string, params?: { include_modules?: boolean }) => {
    return api.get<WorldTemplate & { modules?: WorldModule[] }>(`/worldbuilding/templates/${templateId}`, { params });
  },

  createTemplate: (data: {
    name: string;
    description?: string;
    cover_image?: string;
    tags?: string[];
    is_public?: boolean;
    project_id?: string;
  }) => {
    return api.post<WorldTemplate>('/worldbuilding/templates', data);
  },

  updateTemplate: (templateId: string, data: Partial<{
    name?: string;
    description?: string;
    cover_image?: string;
    tags?: string[];
    is_public?: boolean;
  }>) => {
    return api.put<WorldTemplate>(`/worldbuilding/templates/${templateId}`, data);
  },

  deleteTemplate: (templateId: string) => {
    return api.delete(`/worldbuilding/templates/${templateId}`);
  },

  getModules: (templateId: string) => {
    return api.get<WorldModule[]>(`/worldbuilding/templates/${templateId}/modules`);
  },

  createModule: (templateId: string, data: {
    module_type: WorldModule['module_type'];
    name: string;
    description?: string;
    icon?: string;
    order_index?: number;
    is_collapsible?: boolean;
    is_required?: boolean;
  }) => {
    return api.post<WorldModule>(`/worldbuilding/templates/${templateId}/modules`, data);
  },

  updateModule: (moduleId: string, data: Partial<{
    name: string;
    description: string;
    icon: string;
    order_index: number;
    config: Record<string, unknown> | null;
  }>) => {
    return api.put<WorldModule>(`/worldbuilding/modules/${moduleId}`, data);
  },

  /**
   * 为世界补齐缺失模块（Phase 3 P3-T1）。
   * P1 未新增 POST /worlds/{id}/modules，改用兼容转发路由；WorldModule.world_id 与
   * template_id 是同一列的 synonym，因此传入 world id 即可。
   */
  createWorldModule: (worldId: string, data: {
    module_type: WorldModule['module_type'];
    name: string;
    description?: string;
    icon?: string;
    order_index?: number;
  }) => {
    return api.post<WorldModule>(`/worldbuilding/templates/${worldId}/modules`, data);
  },

  deleteModule: (moduleId: string) => {
    return api.delete(`/worldbuilding/modules/${moduleId}`);
  },

  getSubmodules: (moduleId: string) => {
    return api.get<WorldSubmodule[]>(`/worldbuilding/modules/${moduleId}/submodules`);
  },

  createSubmodule: (moduleId: string, data: {
    name: string;
    description?: string;
    order_index?: number;
    color?: string;
    icon?: string;
    parent_id?: string;
    kind?: string;
    meta?: Record<string, unknown>;
  }) => {
    return api.post<WorldSubmodule>(`/worldbuilding/modules/${moduleId}/submodules`, data);
  },

  updateSubmodule: (submoduleId: string, data: Partial<{
    name: string;
    description: string;
    order_index: number;
    color?: string | null;
    icon?: string | null;
    parent_id?: string | null;
    kind?: string;
    meta?: Record<string, unknown>;
  }>) => {
    return api.put<WorldSubmodule>(`/worldbuilding/submodules/${submoduleId}`, data);
  },

  deleteSubmodule: (submoduleId: string) => {
    return api.delete(`/worldbuilding/submodules/${submoduleId}`);
  },

  getItems: (moduleId: string, params?: { submodule_id?: string; include_all?: boolean }) => {
    return api.get<WorldModuleItem[]>(`/worldbuilding/modules/${moduleId}/items`, { params });
  },

  createItem: (moduleId: string, data: {
    name: string;
    content: Record<string, unknown>;
    order_index?: number;
    is_published?: boolean;
    submodule_id?: string;
  }) => {
    return api.post<WorldModuleItem>(`/worldbuilding/modules/${moduleId}/items`, data);
  },

  updateItem: (itemId: string, data: Partial<{
    name: string;
    content: Record<string, unknown>;
    order_index: number;
    is_published: boolean;
  }>) => {
    return api.put<WorldModuleItem>(`/worldbuilding/items/${itemId}`, data);
  },

  deleteItem: (itemId: string) => {
    return api.delete(`/worldbuilding/items/${itemId}`);
  },

  getInstances: (projectId: string) => {
    return api.get<WorldInstance[]>(`/worldbuilding/projects/${projectId}/instances`);
  },

  createInstance: (data: {
    template_id: string;
    project_id: string;
    name: string;
    description?: string;
    custom_data?: Record<string, unknown>;
  }) => {
    return api.post<WorldInstance>('/worldbuilding/instances', data);
  },

  importTemplate: (data: {
    name: string;
    template_data: Record<string, unknown>;
    project_id?: string;
  }) => {
    return api.post<WorldTemplate>('/worldbuilding/templates/import', data);
  },

  exportTemplate: (templateId: string) => {
    return api.get<Record<string, unknown>>(`/worldbuilding/templates/${templateId}/export`);
  },

  // 文件导入导出相关功能
  downloadTemplateAsFile: async (templateId: string, filename?: string) => {
    const data = await api.get<Record<string, unknown>>(`/worldbuilding/templates/${templateId}/export`);
    
    // 创建下载链接
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `template_${templateId}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    return data;
  },

  uploadTemplateFromFile: async (file: File, project_id?: string) => {
    const fileContent = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
    
    const templateData = JSON.parse(fileContent);
    
    return api.post<WorldTemplate>('/worldbuilding/templates/import', {
      name: templateData.template?.name || `导入模板_${new Date().toISOString()}`,
      template_data: templateData,
      project_id,
    });
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

  importWorld: (data: WorldImportPayload) => {
    return api.post<World>('/worldbuilding/worlds/import', data);
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