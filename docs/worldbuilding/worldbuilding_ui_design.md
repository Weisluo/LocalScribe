# 世界观设定功能文档

## 1. 功能概述

世界观设定是 LocalScribe 的核心功能之一，用于帮助作者构建和管理小说/故事的世界观。它提供了一个结构化的方式来组织世界设定，包括地图、历史、政治、经济、种族、体系和特殊设定等七大模块。

### 1.1 核心特性

- **模板化管理**：支持创建、导入、导出世界模板
- **模块化结构**：七大模块类型，支持子模块和条目层级
- **历史时间线**：可视化的时间线展示，支持时代-事件层级
- **JSON 导入导出**：支持模板数据的备份和分享

## 2. UI 设计

### 2.1 整体布局

```
┌─────────────────────────────────────────────────────────────┐
│  [Globe2] 世界观设定          当前世界名称           [操作] │
├─────────────────────────────────────────────────────────────┤
│  [地图] [历史] [政治] [经济] [种族] [体系] [特殊]           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                      模块内容区域                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 头部区域

- **左侧**：功能标题（Globe2 图标 + "世界观设定"）
- **中间**：当前世界名称（可编辑，hover 显示编辑/删除按钮）
- **右侧**：世界切换下拉框（未实现完整功能）

#### 世界名称编辑交互

```typescript
// 编辑状态切换
const [isEditingTemplateName, setIsEditingTemplateName] = useState(false);
const [editingTemplateName, setEditingTemplateName] = useState('');

// 保存编辑
const handleSaveTemplateName = () => {
  if (currentTemplate && editingTemplateName.trim()) {
    updateTemplateMutation.mutate({
      templateId: currentTemplate.id,
      data: { name: editingTemplateName.trim() },
    });
  }
};
```

### 2.3 标签栏

七个固定模块标签，使用图标 + 文字的组合：

| 模块 | 图标 | 标签 |
|------|------|------|
| map | Map | 地图 |
| history | History | 历史 |
| politics | Landmark | 政治 |
| economy | Coins | 经济 |
| races | Users | 种族 |
| systems | Cpu | 体系 |
| special | Sparkles | 特殊 |

```typescript
type TabType = 'map' | 'history' | 'politics' | 'economy' | 'races' | 'systems' | 'special';

const TAB_CONFIG: Record<TabType, { label: string; icon: LucideIcon }> = {
  map: { label: '地图', icon: Map },
  history: { label: '历史', icon: History },
  politics: { label: '政治', icon: Landmark },
  economy: { label: '经济', icon: Coins },
  races: { label: '种族', icon: Users },
  systems: { label: '体系', icon: Cpu },
  special: { label: '特殊', icon: Sparkles },
};
```

#### 标签样式

- **激活状态**：`bg-primary/20 text-primary shadow-sm`
- **默认状态**：`text-muted-foreground hover:bg-accent/30 hover:text-foreground`
- **过渡动画**：`transition-all duration-200`

### 2.4 空状态引导

当项目没有世界模板时，显示引导界面：

```
┌─────────────────────────────────────┐
│           [Globe2 图标]             │
│      还没有创建世界模板             │
│                                     │
│  [+ 创建世界模板]  [导入模板]       │
└─────────────────────────────────────┘
```

### 2.5 弹窗系统

#### 2.5.1 初始选择弹窗 (InitialChoiceModal)

首次进入世界观设定时的引导弹窗：

```
┌─────────────────────────────────────┐
│  欢迎使用世界观设定              [X] │
├─────────────────────────────────────┤
│  您还没有创建任何世界模板，请选择： │
│                                     │
│  ┌─────────────┐ ┌─────────────┐   │
│  │  [FilePlus] │ │   [FileUp]  │   │
│  │   命名新建  │ │   导入模板  │   │
│  │ 创建全新世界│ │从JSON导入  │   │
│  └─────────────┘ └─────────────┘   │
└─────────────────────────────────────┘
```

#### 2.5.2 创建世界弹窗 (CreateTemplateModal)

- 输入世界名称
- 创建后自动创建七大默认模块

#### 2.5.3 导入模板弹窗 (ImportTemplateModal)

- 支持拖拽上传 JSON 文件
- 自动解析 JSON 中的名称
- 文件验证（检查 modules 字段）

```typescript
const validateJson = (content: string): boolean => {
  try {
    const data = JSON.parse(content);
    if (!data.modules || !Array.isArray(data.modules)) {
      setError('无效的模板文件：缺少modules字段');
      return false;
    }
    return true;
  } catch (e) {
    setError('无效的JSON文件');
    return false;
  }
};
```

#### 2.5.4 删除确认弹窗 (DeleteConfirmModal)

- 警告样式（琥珀色背景）
- 显示要删除的世界名称
- 确认后执行级联删除

## 3. 历史模块 (HistoryView)

历史模块是世界观设定中最复杂的模块，采用可视化时间线设计。

### 3.1 整体布局

```
┌────────────────────────────────────────────────────────────────┐
│ [Clock]添加时代    [搜索框]                      [+]添加事件   │
├────────────────────────────────────────────────────────────────┤
│ ┌────┐                                                         │
│ │    │  ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 时代1  │
│ │时间│  ○ 事件1.1    ○ 事件1.2    ○ 事件1.3                    │
│ │线  │  ┌──────────────────────────────────────────────┐       │
│ │    │  │ 事件详情卡片                                 │       │
│ │    │  │ - 描述                                       │       │
│ │    │  │ - 条目列表                                   │       │
│ └────┘  └──────────────────────────────────────────────┘       │
│                                                                │
│  ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 独立事件      │
│  ○ 事件2.1    ○ 事件2.2                                        │
└────────────────────────────────────────────────────────────────┘
```

### 3.2 顶部工具栏

```
┌────────────────────────────────────────────────────────────────┐
│ [Clock]添加时代    [🔍 搜索时代、事件或条目...]    [+]添加事件 │
└────────────────────────────────────────────────────────────────┘
```

- **添加时代按钮**：打开添加时代弹窗
- **搜索框**：实时过滤时代、事件和条目
- **添加事件按钮**：打开添加事件弹窗

### 3.3 时间线设计

#### 3.3.1 视觉元素

- **时间线主轴**：左侧垂直渐变线
  - 渐变：`from-primary/60 via-accent/40 to-muted/20`
  - 宽度：`w-1.5`
  - 圆角：`rounded-full`

- **时代节点**：
  - 大圆点（`w-4 h-4`）
  - 渐变背景
  - 发光效果

- **事件节点**：
  - 小圆点（根据级别不同大小）
  - 悬停显示 Tooltip

#### 3.3.2 事件级别样式

| 级别 | 大小 | 颜色 | 用途 |
|------|------|------|------|
| critical | 16px/6px | primary | 关键事件 |
| major | 12px/5px | accent | 重要事件 |
| normal | 10px/4px | muted-foreground | 普通事件 |
| minor | 8px/3px | muted-foreground/50 | 次要事件 |

```typescript
const getEventDotSize = (level: EventLevel): { size: number; innerSize: number } => {
  switch (level) {
    case 'critical': return { size: 16, innerSize: 6 };
    case 'major': return { size: 12, innerSize: 5 };
    case 'normal': return { size: 10, innerSize: 4 };
    case 'minor': return { size: 8, innerSize: 3 };
  }
};
```

### 3.4 时代卡片

```
┌────────────────────────────────────────────────────────────────┐
│ ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 时代名称   │
│ 起: 阳阙历元年 ~ 止: 阳阙历1633年                              │
│                                                                │
│ 时代描述文字...                                                │
│                                                                │
│ [展开/折叠]                                                    │
├────────────────────────────────────────────────────────────────┤
│ ○ 事件1  ○ 事件2  ○ 事件3                                      │
│                                                                │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ [事件卡片]                                                  │ │
│ └────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

#### 时代主题配置

```typescript
const ERA_THEME_CONFIG: Record<EraTheme, EraThemeConfig> = {
  ochre: {
    label: 'Ochre Era',
    labelCn: '赭石纪元',
    description: '古老而神秘的年代，充满原始力量',
    gradient: 'from-stone-100 to-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-900',
    accent: 'bg-amber-500',
  },
  // ... 其他主题
};
```

### 3.5 事件卡片 (EventCard)

#### 3.5.1 Critical 级别卡片

```
┌────────────────────────────────────────────────────────────────┐
│ [光晕效果]                                                     │
│                                                                │
│  ⚔️  事件名称                            [编辑] [删除]         │
│      关键事件                                                  │
│                                                                │
│  📅  阳阙历元年                                                │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 事件描述...                                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                │
│  相关条目:                                                     │
│  • 条目1: 内容1                                                │
│  • 条目2: 内容2                                                │
│                                                                │
│  [+ 添加条目]                                                  │
└────────────────────────────────────────────────────────────────┘
```

#### 3.5.2 卡片样式配置

```typescript
const LEVEL_CONFIG: Record<EventLevel, LevelConfig> = {
  critical: {
    label: 'Critical',
    labelCn: '关键',
    flexBasis: 'basis-full',
    minHeight: 'min-h-[200px]',
    padding: 'p-6',
    bgClass: 'bg-gradient-to-br from-indigo-50 via-purple-50 to-amber-50',
    borderClass: 'border-2 border-indigo-200',
    textClass: 'text-indigo-900',
    titleSize: 'text-xl font-bold',
    glowColor: 'rgba(99, 102, 241, 0.3)',
  },
  // ... 其他级别
};
```

#### 3.5.3 动画效果

使用 Framer Motion 实现流畅动画：

```typescript
const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }
  },
  exit: { 
    opacity: 0, 
    y: -10, 
    scale: 0.98,
    transition: { duration: 0.2 }
  },
};

// 悬停效果
whileHover={{ y: -4, scale: 1.005 }}
transition={{ type: 'spring', stiffness: 300, damping: 25 }}
```

### 3.6 弹窗组件

#### 3.6.1 添加时代弹窗 (AddEraModal)

```
┌─────────────────────────────────────────────┐
│ 添加时代                                 [X] │
├─────────────────────────────────────────────┤
│ 时代名称 *                                  │
│ [________________________]                  │
│                                             │
│ 时代基调                                    │
│ ┌────┬────┬────┬────┐                       │
│ │🟤  │🔴  │🔵  │🟢  │                       │
│ │赭石│赤红│靛蓝│翠绿│                       │
│ └────┴────┴────┴────┘                       │
│ 古老而神秘的年代，充满原始力量              │
│                                             │
│ 起始时间              结束时间              │
│ [________]            [________]            │
│ 支持：元年、阿拉伯数字、中文数字            │
│                                             │
│ 时代描述                                    │
│ [                            ]              │
│ [                            ]              │
│                                             │
│                    [取消]  [创建]           │
└─────────────────────────────────────────────┘
```

#### 3.6.2 添加事件弹窗 (AddEventModal)

```
┌─────────────────────────────────────────────┐
│ 添加历史事件                             [X] │
├─────────────────────────────────────────────┤
│ 所属时代                                    │
│ [无（独立事件）▼]                           │
│                                             │
│ 事件名称 *                                  │
│ [________________________]                  │
│                                             │
│ 事件类型                                    │
│ [默认] [⚔️战争] [🏛️政治] [✨发现] [...]      │
│                                             │
│ 事件级别                                    │
│ [关键] [重要] [普通] [次要]                 │
│                                             │
│ 发生时间              图标                  │
│ [________]            [____]                │
│                                             │
│ 事件描述                                    │
│ [                            ]              │
│                                             │
│                    [取消]  [创建]           │
└─────────────────────────────────────────────┘
```

### 3.7 搜索功能

搜索逻辑：

```typescript
// 搜索过滤
const normalizedSearchQuery = searchQuery.trim().toLowerCase();

// 过滤时代
const filteredEras = eras.filter((era) =>
  era.name.toLowerCase().includes(normalizedSearchQuery) ||
  (era.description?.toLowerCase().includes(normalizedSearchQuery))
);

// 过滤事件（包括事件内的条目）
const filteredEvents = events.filter((event) => {
  const matchesEvent =
    event.name.toLowerCase().includes(normalizedSearchQuery) ||
    (event.description?.toLowerCase().includes(normalizedSearchQuery));
  const matchesItems = event.items.some(
    (item) =>
      item.name.toLowerCase().includes(normalizedSearchQuery) ||
      Object.values(item.content).some((v) => v.toLowerCase().includes(normalizedSearchQuery))
  );
  return matchesEvent || matchesItems;
});

// 自动展开包含匹配事件的时代
useEffect(() => {
  if (normalizedSearchQuery && filteredEvents.length > 0) {
    const matchingEraIds = new Set(
      filteredEvents
        .filter((e) => e.eraId)
        .map((e) => e.eraId as string)
    );
    setExpandedEras(matchingEraIds);
  }
}, [normalizedSearchQuery, filteredEvents]);
```

## 4. 前端实现

### 4.1 组件结构

```
frontend/src/components/Worldbuilding/
├── WorldbuildingView.tsx          # 主视图组件
├── HistoryView.tsx                # 历史模块视图
└── HistoryView/
    ├── EventCard.tsx              # 事件卡片
    ├── HistorySkeleton.tsx        # 加载骨架屏
    ├── TimelineTooltip.tsx        # 时间线提示
    ├── types.ts                   # TypeScript 类型定义
    ├── config.ts                  # 配置常量
    └── modals/
        ├── AddEraModal.tsx        # 添加时代
        ├── EditEraModal.tsx       # 编辑时代
        ├── AddEventModal.tsx      # 添加事件
        ├── EditEventModal.tsx     # 编辑事件
        ├── AddItemModal.tsx       # 添加条目
        └── EditItemModal.tsx      # 编辑条目
```

### 4.2 状态管理

使用 React Query 进行服务端状态管理：

```typescript
// 获取模板列表
const { data: templates = [], isLoading: templatesLoading } = useQuery({
  queryKey: ['worldbuilding', 'templates', currentProjectId],
  queryFn: () => worldbuildingApi.getTemplates({ project_id: currentProjectId ?? undefined }),
  enabled: !!currentProjectId,
  staleTime: 300,
});

// 获取当前模板详情
const { data: currentTemplate, isLoading: templateLoading } = useQuery({
  queryKey: ['worldbuilding', 'template', selectedTemplateId],
  queryFn: () => worldbuildingApi.getTemplate(selectedTemplateId!, { include_modules: true }),
  enabled: !!selectedTemplateId,
});
```

### 4.3 API 服务

```typescript
// frontend/src/services/worldbuildingApi.ts

export const worldbuildingApi = {
  // 模板操作
  getTemplates: (params?: { skip?: number; limit?: number; project_id?: string }) =>
    api.get<WorldTemplate[]>('/worldbuilding/templates', { params }),
  
  createTemplate: (data: { name: string; description?: string; project_id?: string }) =>
    api.post<WorldTemplate>('/worldbuilding/templates', data),
  
  updateTemplate: (templateId: string, data: Partial<...>) =>
    api.put<WorldTemplate>(`/worldbuilding/templates/${templateId}`, data),
  
  deleteTemplate: (templateId: string) =>
    api.delete(`/worldbuilding/templates/${templateId}`),
  
  // 模块操作
  getModules: (templateId: string) =>
    api.get<WorldModule[]>(`/worldbuilding/templates/${templateId}/modules`),
  
  createModule: (templateId: string, data: {...}) =>
    api.post<WorldModule>(`/worldbuilding/templates/${templateId}/modules`, data),
  
  // 子模块操作
  getSubmodules: (moduleId: string) =>
    api.get<WorldSubmodule[]>(`/worldbuilding/modules/${moduleId}/submodules`),
  
  createSubmodule: (moduleId: string, data: {...}) =>
    api.post<WorldSubmodule>(`/worldbuilding/modules/${moduleId}/submodules`, data),
  
  updateSubmodule: (submoduleId: string, data: Partial<...>) =>
    api.put<WorldSubmodule>(`/worldbuilding/submodules/${submoduleId}`, data),
  
  deleteSubmodule: (submoduleId: string) =>
    api.delete(`/worldbuilding/submodules/${submoduleId}`),
  
  // 条目操作
  getItems: (moduleId: string, params?: { submodule_id?: string; include_all?: boolean }) =>
    api.get<WorldModuleItem[]>(`/worldbuilding/modules/${moduleId}/items`, { params }),
  
  createItem: (moduleId: string, data: {...}) =>
    api.post<WorldModuleItem>(`/worldbuilding/modules/${moduleId}/items`, data),
  
  updateItem: (itemId: string, data: Partial<...>) =>
    api.put<WorldModuleItem>(`/worldbuilding/items/${itemId}`, data),
  
  deleteItem: (itemId: string) =>
    api.delete(`/worldbuilding/items/${itemId}`),
  
  // 导入导出
  importTemplate: (data: { name: string; template_data: Record<string, unknown>; project_id?: string }) =>
    api.post<WorldTemplate>('/worldbuilding/templates/import', data),
  
  exportTemplate: (templateId: string) =>
    api.get<Record<string, unknown>>(`/worldbuilding/templates/${templateId}/export`),
  
  // 文件下载
  downloadTemplateAsFile: async (templateId: string, filename?: string) => {
    const data = await api.get<Record<string, unknown>>(`/worldbuilding/templates/${templateId}/export`);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    // ... 创建下载链接
  },
};
```

### 4.4 数据类型定义

```typescript
// 世界模板
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

// 世界模块
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

// 子模块
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

// 模块条目
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
```

## 5. 后端实现

### 5.1 数据模型

```python
# backend/app/models/worldbuilding.py

class WorldTemplate(Base):
    """世界模板 - 可重用的世界观模板"""
    __tablename__ = "world_templates"

    id = Column(String(36), primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text)
    cover_image = Column(String(500))
    tags = Column(JSON)
    is_public = Column(Boolean, default=False)
    is_system_template = Column(Boolean, default=False)
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(String(36), nullable=True)

    # 关系
    modules = relationship("WorldModule", back_populates="template", cascade="all, delete-orphan")
    instances = relationship("WorldInstance", back_populates="template", cascade="all, delete-orphan")
    project = relationship("Project", back_populates="world_templates")


class WorldModule(Base):
    """世界模块 - 地图、历史、政治、经济、种族、体系、特殊"""
    __tablename__ = "world_modules"

    id = Column(String(36), primary_key=True, index=True)
    template_id = Column(String(36), ForeignKey("world_templates.id"), nullable=False)
    module_type = Column(String(50), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    icon = Column(String(100))
    order_index = Column(Integer, default=0)
    is_collapsible = Column(Boolean, default=True)
    is_required = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # 关系
    template = relationship("WorldTemplate", back_populates="modules")
    submodules = relationship("WorldSubmodule", back_populates="module", cascade="all, delete-orphan")
    items = relationship("WorldModuleItem", back_populates="module", cascade="all, delete-orphan")


class WorldSubmodule(Base):
    """子模块 - 模块下的分类（如种族下的不同种族）
    
    对于历史模块：
    - 时代：parent_id 为 null
    - 事件：parent_id 指向时代
    """
    __tablename__ = "world_submodules"

    id = Column(String(36), primary_key=True, index=True)
    module_id = Column(String(36), ForeignKey("world_modules.id"), nullable=False)
    parent_id = Column(String(36), ForeignKey("world_submodules.id"), nullable=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    order_index = Column(Integer, default=0)
    color = Column(String(20))
    icon = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # 关系
    module = relationship("WorldModule", back_populates="submodules")
    items = relationship("WorldModuleItem", back_populates="submodule", cascade="all, delete-orphan")
    children = relationship("WorldSubmodule", backref="parent", remote_side=[id], cascade="all, delete-orphan")


class WorldModuleItem(Base):
    """模块项 - 具体的世界设定内容"""
    __tablename__ = "world_module_items"

    id = Column(String(36), primary_key=True, index=True)
    module_id = Column(String(36), ForeignKey("world_modules.id"), nullable=False)
    submodule_id = Column(String(36), ForeignKey("world_submodules.id"), nullable=True)
    name = Column(String(255), nullable=False)
    content = Column(JSON)
    order_index = Column(Integer, default=0)
    is_published = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # 关系
    module = relationship("WorldModule", back_populates="items")
    submodule = relationship("WorldSubmodule", back_populates="items")
```

### 5.2 API 路由

```python
# backend/app/api/v1/worldbuilding.py

router = APIRouter()

# ========== 世界模板 API ==========

@router.post("/templates", response_model=WorldTemplateResponse)
def create_world_template(template_data: WorldTemplateCreate, db: Session = Depends(get_db)):
    """创建新的世界模板"""
    template = WorldTemplate(id=str(uuid.uuid4()), **template_data.model_dump())
    db.add(template)
    db.commit()
    db.refresh(template)
    return template

@router.get("/templates", response_model=List[WorldTemplateResponse])
def get_world_templates(
    skip: int = 0,
    limit: int = 100,
    name: Optional[str] = None,
    is_public: Optional[bool] = None,
    project_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """获取世界模板列表"""
    query = db.query(WorldTemplate)
    if name:
        query = query.filter(WorldTemplate.name.ilike(f"%{name}%"))
    if is_public is not None:
        query = query.filter(WorldTemplate.is_public == is_public)
    if project_id is not None:
        query = query.filter(WorldTemplate.project_id == project_id)
    
    templates = query.offset(skip).limit(limit).all()
    
    # 计算模块和实例数量
    for template in templates:
        template.module_count = db.query(WorldModule).filter(
            WorldModule.template_id == template.id
        ).count()
        template.instance_count = db.query(WorldInstance).filter(
            WorldInstance.template_id == template.id
        ).count()
    
    return templates

@router.get("/templates/{template_id}", response_model=WorldTemplateWithModules)
def get_world_template(
    template_id: str, 
    include_modules: bool = True, 
    db: Session = Depends(get_db)
):
    """获取特定世界模板的详细信息"""
    template = db.query(WorldTemplate).filter(WorldTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="世界模板不存在")
    
    if include_modules:
        modules = load_template_modules_with_selectinload(template_id, db)
        # ... 构建嵌套响应
    
    return template

@router.put("/templates/{template_id}", response_model=WorldTemplateResponse)
def update_world_template(
    template_id: str, 
    template_data: WorldTemplateUpdate, 
    db: Session = Depends(get_db)
):
    """更新世界模板"""
    template = db.query(WorldTemplate).filter(WorldTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="世界模板不存在")
    
    update_data = template_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(template, field, value)
    
    db.commit()
    db.refresh(template)
    return template

@router.delete("/templates/{template_id}")
def delete_world_template(template_id: str, db: Session = Depends(get_db)):
    """删除世界模板（级联删除模块、子模块、条目）"""
    template = db.query(WorldTemplate).filter(WorldTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="世界模板不存在")
    
    # 检查是否有实例在使用
    instance_count = db.query(WorldInstance).filter(
        WorldInstance.template_id == template_id
    ).count()
    if instance_count > 0:
        raise HTTPException(status_code=400, detail="无法删除正在使用的世界模板")
    
    db.delete(template)
    db.commit()
    return {"message": "世界模板删除成功"}


# ========== 模块 API ==========

@router.post("/templates/{template_id}/modules", response_model=WorldModuleResponse)
def create_world_module(
    template_id: str, 
    module_data: WorldModuleCreate, 
    db: Session = Depends(get_db)
):
    """为世界模板创建模块"""
    # 检查模板是否存在
    template = db.query(WorldTemplate).filter(WorldTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="世界模板不存在")
    
    # 检查模块类型是否重复
    existing = db.query(WorldModule).filter(
        WorldModule.template_id == template_id,
        WorldModule.module_type == module_data.module_type,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="该模块类型已存在")
    
    module = WorldModule(
        id=str(uuid.uuid4()), 
        template_id=template_id, 
        **module_data.model_dump()
    )
    db.add(module)
    db.commit()
    db.refresh(module)
    return module


# ========== 子模块 API ==========

@router.post("/modules/{module_id}/submodules", response_model=WorldSubmoduleResponse)
def create_world_submodule(
    module_id: str, 
    submodule_data: WorldSubmoduleCreate, 
    db: Session = Depends(get_db)
):
    """为世界模块创建子模块"""
    module = db.query(WorldModule).filter(WorldModule.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="世界模块不存在")
    
    submodule = WorldSubmodule(
        id=str(uuid.uuid4()), 
        module_id=module_id, 
        **submodule_data.model_dump()
    )
    db.add(submodule)
    db.commit()
    db.refresh(submodule)
    return submodule


# ========== 模块项 API ==========

@router.post("/modules/{module_id}/items", response_model=WorldModuleItemResponse)
def create_world_module_item(
    module_id: str, 
    item_data: WorldModuleItemCreate, 
    db: Session = Depends(get_db)
):
    """为世界模块创建项"""
    module = db.query(WorldModule).filter(WorldModule.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="世界模块不存在")
    
    if item_data.submodule_id:
        submodule = db.query(WorldSubmodule).filter(
            WorldSubmodule.id == item_data.submodule_id
        ).first()
        if not submodule:
            raise HTTPException(status_code=404, detail="子模块不存在")
    
    item = WorldModuleItem(
        id=str(uuid.uuid4()), 
        module_id=module_id, 
        **item_data.model_dump()
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


# ========== 导入导出 API ==========

@router.post("/templates/import", response_model=WorldTemplateResponse)
def import_world_template(
    import_data: WorldTemplateImport, 
    db: Session = Depends(get_db)
):
    """从JSON数据导入世界模板"""
    # 创建新模板
    template = WorldTemplate(
        id=str(uuid.uuid4()),
        name=import_data.name,
        description=import_data.description,
        project_id=import_data.project_id,
    )
    db.add(template)
    
    # 导入模块
    for module_data in import_data.modules:
        module = WorldModule(
            id=str(uuid.uuid4()),
            template_id=template.id,
            **module_data.model_dump(exclude={'submodules', 'items'})
        )
        db.add(module)
        
        # 导入子模块和条目...
    
    db.commit()
    return template

@router.get("/templates/{template_id}/export")
def export_world_template(template_id: str, db: Session = Depends(get_db)):
    """导出世界模板为JSON"""
    template = db.query(WorldTemplate).filter(WorldTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="世界模板不存在")
    
    # 加载完整数据
    modules = load_template_modules_with_selectinload(template_id, db)
    
    # 构建导出数据
    export_data = {
        "template": WorldTemplateResponse.model_validate(template).model_dump(),
        "modules": [WorldModuleWithItems.model_validate(m).model_dump() for m in modules],
    }
    
    return export_data
```

### 5.3 数据加载优化

使用 `selectinload` 避免 N+1 查询问题：

```python
def load_template_modules_with_selectinload(template_id: str, db: Session):
    """使用selectinload优化加载模板的模块、子模块和项"""
    # 第一步：加载所有模块及其子模块
    modules = (
        db.query(WorldModule)
        .filter(WorldModule.template_id == template_id)
        .options(selectinload(WorldModule.submodules))
        .order_by(WorldModule.order_index)
        .all()
    )

    if not modules:
        return []

    # 第二步：批量加载所有模块的项
    module_ids = [module.id for module in modules]
    module_items = (
        db.query(WorldModuleItem)
        .filter(
            WorldModuleItem.module_id.in_(module_ids),
            WorldModuleItem.submodule_id.is_(None),
        )
        .all()
    )

    # 将模块项分配到对应的模块
    module_items_map = {}
    for item in module_items:
        if item.module_id not in module_items_map:
            module_items_map[item.module_id] = []
        module_items_map[item.module_id].append(item)

    # 第三步：批量加载所有子模块的项
    all_submodule_ids = []
    for module in modules:
        if module.submodules:
            all_submodule_ids.extend([submodule.id for submodule in module.submodules])

    if all_submodule_ids:
        submodule_items = (
            db.query(WorldModuleItem)
            .filter(WorldModuleItem.submodule_id.in_(all_submodule_ids))
            .all()
        )

        # 将子模块项分配到对应的子模块
        submodule_items_map = {}
        for item in submodule_items:
            if item.submodule_id not in submodule_items_map:
                submodule_items_map[item.submodule_id] = []
            submodule_items_map[item.submodule_id].append(item)

        # 为每个子模块设置items
        for module in modules:
            if module.submodules:
                for submodule in module.submodules:
                    submodule.items = submodule_items_map.get(submodule.id, [])

    # 为每个模块设置items
    for module in modules:
        module.items = module_items_map.get(module.id, [])

    return modules
```

## 6. 业务逻辑

### 6.1 创建世界流程

```
1. 用户点击"创建世界模板"或首次进入时显示 InitialChoiceModal
2. 用户选择"命名新建"
3. 打开 CreateTemplateModal，输入世界名称
4. 调用 POST /worldbuilding/templates 创建模板
5. 自动调用 POST /worldbuilding/templates/{id}/modules 创建七大默认模块
6. 切换到新创建的世界
```

### 6.2 导入模板流程

```
1. 用户选择"导入模板"
2. 打开 ImportTemplateModal
3. 用户拖拽或选择 JSON 文件
4. 前端验证 JSON 格式（检查 modules 字段）
5. 用户输入/确认世界名称
6. 调用 POST /worldbuilding/templates/import
7. 后端解析并创建模板、模块、子模块、条目
8. 切换到导入的世界
```

### 6.3 历史模块数据结构

历史模块使用特殊的层级结构：

```
WorldModule (module_type='history')
├── WorldSubmodule (parent_id=null) -> 时代 (Era)
│   ├── icon: "era:{startDate}:{endDate}"
│   ├── color: "era:{theme}"
│   └── children (WorldSubmodule) -> 事件 (Event)
│       ├── icon: "date:{eventDate}" 或自定义 emoji
│       ├── color: "event:{type}:{level}" 或 "level:{level}"
│       └── items (WorldModuleItem) -> 事件条目
└── WorldSubmodule (parent_id=null) -> 独立事件
```

#### 时代数据结构

```typescript
interface Era {
  id: string;
  name: string;
  description?: string;
  startDate: string;  // 从 icon 字段解析: era:start:end
  endDate: string;
  order_index: number;
  theme: EraTheme;    // 从 color 字段解析: era:theme
}
```

#### 事件数据结构

```typescript
interface Event {
  id: string;
  name: string;
  description?: string;
  level: EventLevel;      // 从 color 字段解析
  eventDate?: string;     // 从 icon 字段解析: date:eventDate
  icon?: string;          // 自定义 emoji
  order_index: number;
  eraId?: string;         // parent_id
  items: EventItem[];
  eventType?: EventType;  // 从 color 字段解析
}
```

### 6.4 时间解析逻辑

```typescript
// utils/timeParser.ts

export function compareTimes(timeA: string, timeB: string): number {
  // 解析时间字符串，支持：
  // - 元年、一年、1年
  // - 阳阙历元年、阳阙历一年
  // - 公元前/后
  // - 阿拉伯数字、中文数字
  
  const parsedA = parseTime(timeA);
  const parsedB = parseTime(timeB);
  
  return parsedA - parsedB;
}

export function calculateEraBasedPositions(
  events: TimelineEvent[],
  eras: EraTimeInfo[],
  options: { padding: number; minSpacing: number }
): Map<string, number> {
  // 根据时代信息计算事件在时间轴上的位置
  // 返回事件ID到位置百分比的映射
}
```

## 7. 样式系统

### 7.1 颜色变量

```css
/* Tailwind CSS 自定义配置 */
:root {
  --primary: 238 83% 67%;        /* Indigo-500 */
  --accent: 262 83% 58%;         /* Purple-600 */
  --muted-foreground: 215 16% 47%; /* Slate-500 */
}
```

### 7.2 动画配置

```typescript
// HistoryView/config.ts

export const animationConfig = {
  spring: { type: 'spring', stiffness: 300, damping: 25 },
  ease: [0.25, 0.46, 0.45, 0.94],
  duration: { fast: 0.2, normal: 0.3, slow: 0.4 },
};

export const eraVariants = {
  hidden: { opacity: 0, x: -30 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.5, ease: animationConfig.ease }
  },
};

export const contentVariants = {
  hidden: { opacity: 0, height: 0 },
  visible: { 
    opacity: 1, 
    height: 'auto',
    transition: { duration: 0.3 }
  },
  exit: { 
    opacity: 0, 
    height: 0,
    transition: { duration: 0.2 }
  },
};
```

## 8. 扩展性设计

### 8.1 添加新模块类型

1. 在 `TabType` 中添加新类型
2. 在 `TAB_CONFIG` 中配置图标和标签
3. 在 `TAB_ORDER` 中添加排序
4. 创建对应的视图组件
5. 后端 `ModuleType` 枚举添加新类型

### 8.2 自定义事件类型

事件类型配置在 `EVENT_TYPE_CONFIG` 中：

```typescript
export const EVENT_TYPE_CONFIG: Record<EventType, EventTypeConfig> = {
  war: {
    type: 'war',
    label: 'War',
    labelCn: '战争',
    description: '涉及武装冲突的重大事件，影响政治格局和民众生活',
    icon: '⚔️',
    color: '#dc2626',
    gradient: 'from-red-50 to-orange-50',
    border: 'border-red-200',
    text: 'text-red-900',
    accent: 'bg-red-500',
  },
  // ... 其他类型
};
```

## 9. 文件清单

### 9.1 前端文件

| 文件路径 | 说明 |
|---------|------|
| `frontend/src/components/Worldbuilding/WorldbuildingView.tsx` | 世界观设定主视图 |
| `frontend/src/components/Worldbuilding/HistoryView.tsx` | 历史模块视图 |
| `frontend/src/components/Worldbuilding/HistoryView/EventCard.tsx` | 事件卡片组件 |
| `frontend/src/components/Worldbuilding/HistoryView/HistorySkeleton.tsx` | 加载骨架屏 |
| `frontend/src/components/Worldbuilding/HistoryView/TimelineTooltip.tsx` | 时间线提示 |
| `frontend/src/components/Worldbuilding/HistoryView/types.ts` | 类型定义 |
| `frontend/src/components/Worldbuilding/HistoryView/config.ts` | 配置常量 |
| `frontend/src/components/Worldbuilding/HistoryView/modals/*.tsx` | 各种弹窗组件 |
| `frontend/src/services/worldbuildingApi.ts` | API 服务 |

### 9.2 后端文件

| 文件路径 | 说明 |
|---------|------|
| `backend/app/models/worldbuilding.py` | 数据模型定义 |
| `backend/app/schemas/worldbuilding.py` | Pydantic Schema |
| `backend/app/api/v1/worldbuilding.py` | API 路由处理 |

## 10. 注意事项

1. **级联删除**：删除模板会级联删除所有模块、子模块和条目
2. **模块类型唯一**：一个模板中每种模块类型只能有一个
3. **历史模块特殊处理**：使用 icon 和 color 字段存储额外元数据
4. **时间解析**：支持多种时间格式，但建议使用统一的纪元格式
5. **性能优化**：使用 `selectinload` 避免 N+1 查询
