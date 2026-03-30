# 经济界面 UI 设计方案

> LocalScribe 世界观设定 - 经济模块设计文档

---

## 一、概述

### 1.1 设计目标

经济界面作为世界观设定的**资源流通核心模块**，需要实现：

1. **实体管理**：管理用户自定义的经济实体类型（货币、商品、资源、贸易路线等）
2. **流通可视化**：展示经济实体间的流转关系（贸易路线、资源流向、资金流动）
3. **经济层次**：展现不同层级的经济体（宏观、区域、行业等）
4. **完全自定义**：用户可自由定义实体类型、关系类型、属性字段等

### 1.2 核心特性

- **类型自定义**：用户可创建任意经济实体类型，不限制预设类型
- **关系自定义**：用户可定义任意经济关系类型及其视觉样式
- **属性自定义**：用户可为每个实体添加自定义属性字段
- **等级自定义**：用户可自定义经济层次等级体系
- **配色自定义**：用户可自定义各类型、等级的配色方案

---

## 二、数据结构设计

### 2.1 类型定义

```typescript
// 经济实体类型（用户自定义）
export type EconomicEntityType = string;

// 经济等级（用户自定义）
export type EconomicLevel = string;

// 经济关系类型（用户自定义）
export type EconomicRelationType = string;

// 连线样式
export type LineStyle = 'solid' | 'dashed' | 'dotted' | 'wavy';

// 箭头类型
export type ArrowType = '→' | '←' | '⟷' | '⇌' | 'none';
```

### 2.2 配置接口

```typescript
// 实体类型配置
export interface EntityTypeConfig {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  gradient?: string;
  border?: string;
  description?: string;
  customFields?: CustomFieldConfig[];
}

// 关系类型配置
export interface RelationTypeConfig {
  id: string;
  name: string;
  lineStyle: LineStyle;
  arrow: ArrowType;
  color?: string;
  icon?: string;
  description?: string;
}

// 经济等级配置
export interface LevelConfig {
  id: string;
  name: string;
  label?: string;
  flexBasis?: string;
  minHeight?: string;
  padding?: string;
  bgClass?: string;
  borderClass?: string;
  textClass?: string;
  titleSize?: string;
  icon?: string;
  glowColor?: string;
}

// 自定义字段配置
export interface CustomFieldConfig {
  id: string;
  name: string;
  type: 'text' | 'number' | 'select' | 'multiselect' | 'date' | 'textarea';
  required?: boolean;
  options?: { label: string; value: string }[];
  defaultValue?: string;
  placeholder?: string;
}

// 模块配置
export interface EconomyModuleConfig {
  entityTypes: EntityTypeConfig[];
  relationTypes: RelationTypeConfig[];
  levels: LevelConfig[];
  defaultEntityType?: string;
  defaultLevel?: string;
}
```

### 2.3 核心接口

```typescript
// 经济实体接口
export interface EconomicEntity {
  id: string;
  name: string;
  description?: string;
  entityType: EconomicEntityType;
  level: EconomicLevel;
  color?: string;
  icon?: string;
  order_index: number;
  unit?: string;
  specification?: Record<string, string>;
  customFields?: Record<string, string | string[] | number>;
  relations?: EconomicRelation[];
  items: EconomicItem[];
}

// 经济关系
export interface EconomicRelation {
  id: string;
  target_id: string;
  target_name: string;
  relationType: EconomicRelationType;
  description?: string;
  volume?: string;
  startDate?: string;
  endDate?: string;
  customFields?: Record<string, string | string[] | number>;
}

// 经济条目
export interface EconomicItem {
  id: string;
  name: string;
  content: Record<string, string>;
  order_index: number;
}
```

---

## 三、UI 布局设计

### 3.1 主界面布局

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  [类型1] [类型2] [类型3] ...  [+ 添加类型]       [🔍 搜索经济实体...]         │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ 💰 实体名称                                                  [编辑]  │ │
│  │ ══════════════════════════════════════════════════════════════════════ │ │
│  │ 类型: 货币  |  等级: ★★★ 国家级  |  单位: 枚                          │ │
│  │ 描述: 实体描述内容...                                                  │ │
│  │                                                                        │ │
│  │ ┌──────────────────────────────────────────────────────────────────┐  │ │
│  │ │ 🔄 经济关系                                                      │  │ │
│  │ │   供应 ──────────▶ 目标实体                                       │  │ │
│  │ │   竞争 ─ ─ ─ ─ ─ ▶ 目标实体                                       │  │ │
│  │ │   [+ 添加关系]                                                    │  │ │
│  │ └──────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                        │ │
│  │ ┌──────────────────────────────────────────────────────────────────┐  │ │
│  │ │ 📊 详细信息                                                      │  │ │
│  │ │   [属性1] [属性2] [属性3] [+ 添加]                                │  │ │
│  │ └──────────────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌──────────────────────────────┐  ┌──────────────────────────────┐        │
│  │ ⚒️ 实体2                     │  │ 🌾 实体3                     │        │
│  │ 类型: 商品  |  等级: ★ 区域级 │  │ 类型: 资源  |  等级: ○ 地方级│        │
│  └──────────────────────────────┘  └──────────────────────────────┘        │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 实体类型标签页设计

```
┌─────────────────────────────────────────────────────────────────┐
│  [💰 类型1] [📦 类型2] [⚒️ 类型3] ...  [+ 添加类型]  [⚙️ 配置]    │
└─────────────────────────────────────────────────────────────────┘
```

标签页动态生成，基于用户配置的 `EntityTypeConfig[]`。

### 3.3 卡片设计规格

卡片尺寸和样式基于用户配置的 `LevelConfig`：

| 配置项 | 说明 |
|-------|------|
| `flexBasis` | 卡片宽度（如 `flex-[1_1_100%]`） |
| `minHeight` | 最小高度（如 `min-h-[240px]`） |
| `padding` | 内边距 |
| `bgClass` | 背景样式类 |
| `borderClass` | 边框样式类 |
| `textClass` | 文本样式类 |
| `titleSize` | 标题字号 |
| `glowColor` | 发光效果颜色 |

### 3.4 经济关系连接线样式

基于 `RelationTypeConfig` 中的 `lineStyle` 和 `arrow`：

```
  实线 + 单向箭头 (solid, →)
  ──────────▶

  虚线 + 双向箭头 (dashed, ⟷)
  - - - - - ⟷

  点线 + 单向箭头 (dotted, →)
  ········▶

  波浪线 + 单向箭头 (wavy, →)
  ∿∿∿∿∿∿∿▶
```

---

## 四、配色方案

### 4.1 默认实体类型配色

提供默认配色作为参考，用户可完全自定义：

```typescript
export const DEFAULT_ENTITY_TYPE_CONFIGS: EntityTypeConfig[] = [
  {
    id: 'currency',
    name: '货币',
    icon: '💰',
    color: '#c9a227',
    gradient: 'from-yellow-600/15 via-amber-500/10 to-orange-500/8',
    border: 'border-yellow-500/40',
    description: '货币、通货、交换媒介',
  },
  {
    id: 'commodity',
    name: '商品',
    icon: '📦',
    color: '#92400e',
    gradient: 'from-amber-700/15 via-orange-600/10 to-yellow-700/8',
    border: 'border-amber-600/40',
    description: '货物、商品成品',
  },
  {
    id: 'resource',
    name: '资源',
    icon: '⚒️',
    color: '#57534e',
    gradient: 'from-stone-600/15 via-zinc-500/10 to-stone-600/8',
    border: 'border-stone-500/40',
    description: '原材料、自然资源',
  },
  {
    id: 'trade_route',
    name: '贸易路线',
    icon: '🛤️',
    color: '#15803d',
    gradient: 'from-emerald-600/15 via-green-500/10 to-teal-600/8',
    border: 'border-emerald-500/40',
    description: '贸易通道、运输路线',
  },
  {
    id: 'economic_zone',
    name: '经济区',
    icon: '🏘️',
    color: '#1d4ed8',
    gradient: 'from-blue-600/15 via-indigo-500/10 to-blue-600/8',
    border: 'border-blue-500/40',
    description: '经济圈、贸易区、市场',
  },
  {
    id: 'industry',
    name: '产业',
    icon: '🏭',
    color: '#c2410c',
    gradient: 'from-orange-600/15 via-red-500/10 to-orange-600/8',
    border: 'border-orange-500/40',
    description: '行业、生产部门',
  },
];
```

### 4.2 默认关系类型配色

```typescript
export const DEFAULT_RELATION_TYPE_CONFIGS: RelationTypeConfig[] = [
  {
    id: 'trade_partner',
    name: '贸易伙伴',
    lineStyle: 'solid',
    arrow: '⟷',
    color: '#10b981',
    icon: '🤝',
  },
  {
    id: 'supplier',
    name: '供应商',
    lineStyle: 'solid',
    arrow: '→',
    color: '#f59e0b',
    icon: '📤',
  },
  {
    id: 'consumer',
    name: '消费者',
    lineStyle: 'solid',
    arrow: '←',
    color: '#3b82f6',
    icon: '📥',
  },
  {
    id: 'competitor',
    name: '竞争者',
    lineStyle: 'dashed',
    arrow: '⇌',
    color: '#ef4444',
    icon: '⚔️',
  },
  {
    id: 'dependency',
    name: '依赖',
    lineStyle: 'dotted',
    arrow: '→',
    color: '#8b5cf6',
    icon: '🔗',
  },
  {
    id: 'barrier',
    name: '壁垒',
    lineStyle: 'dashed',
    arrow: 'none',
    color: '#f43f5e',
    icon: '🚫',
  },
];
```

### 4.3 默认经济等级配置

```typescript
export const DEFAULT_LEVEL_CONFIGS: LevelConfig[] = [
  {
    id: 'global',
    name: '全球级',
    label: '★★★',
    flexBasis: 'flex-[1_1_100%]',
    minHeight: 'min-h-[220px]',
    padding: 'p-6',
    bgClass: 'bg-gradient-to-br from-yellow-500/15 via-amber-500/10 to-orange-500/15',
    borderClass: 'border-2 border-yellow-500/50 shadow-xl shadow-yellow-500/20',
    textClass: 'text-foreground',
    titleSize: 'text-xl font-bold',
    icon: '🌍',
    glowColor: 'rgba(202, 162, 39, 0.4)',
  },
  {
    id: 'national',
    name: '国家级',
    label: '★★',
    flexBasis: 'flex-[1_1_calc(50%-12px)]',
    minHeight: 'min-h-[170px]',
    padding: 'p-5',
    bgClass: 'bg-gradient-to-br from-slate-400/10 via-zinc-400/8 to-slate-400/10',
    borderClass: 'border-2 border-slate-400/40 shadow-lg shadow-slate-500/15',
    textClass: 'text-foreground',
    titleSize: 'text-lg font-semibold',
    icon: '🏛️',
    glowColor: 'rgba(148, 163, 184, 0.3)',
  },
  {
    id: 'regional',
    name: '区域级',
    label: '★',
    flexBasis: 'flex-[1_1_calc(33.333%-12px)]',
    minHeight: 'min-h-[130px]',
    padding: 'p-4',
    bgClass: 'bg-gradient-to-br from-stone-300/8 via-zinc-200/5 to-stone-300/8',
    borderClass: 'border border-stone-400/30 shadow-md shadow-stone-500/10',
    textClass: 'text-foreground',
    titleSize: 'text-base font-medium',
    icon: '🏘️',
    glowColor: 'rgba(168, 162, 158, 0.2)',
  },
  {
    id: 'local',
    name: '地方级',
    label: '○',
    flexBasis: 'flex-[1_1_calc(25%-12px)]',
    minHeight: 'min-h-[100px]',
    padding: 'p-3',
    bgClass: 'bg-muted/40',
    borderClass: 'border border-dashed border-border/70',
    textClass: 'text-muted-foreground',
    titleSize: 'text-sm font-medium',
    icon: '🏠',
    glowColor: 'transparent',
  },
];
```

---

## 五、后端数据存储方案

### 5.1 数据映射关系

利用现有 `WorldSubmodule` 和 `WorldModuleItem` 结构存储经济数据：

| 字段 | 存储内容 | 格式示例 |
|------|---------|---------|
| `color` | 实体类型 + 等级 | `type:currency:global` |
| `icon` | 自定义图标 | `💰` 或 emoji |
| `parent_id` | 从属关系 | 父级实体ID |

### 5.2 模块配置存储

```typescript
// WorldModuleItem - 模块配置
{
  id: "config-001",
  module_id: "economy_module_id",
  name: "moduleConfig",
  content: {
    entityTypes: JSON.stringify(entityTypeConfigs),
    relationTypes: JSON.stringify(relationTypeConfigs),
    levels: JSON.stringify(levelConfigs),
    defaultEntityType: "currency",
    defaultLevel: "regional"
  }
}
```

### 5.3 经济实体存储

```typescript
// WorldSubmodule - 经济实体
{
  id: "uuid-001",
  module_id: "economy_module_id",
  name: "实体名称",
  description: "实体描述...",
  color: "type:currency:national",
  icon: "💰",
  parent_id: null,
  order_index: 0
}
```

### 5.4 自定义字段存储

```typescript
// WorldModuleItem - 自定义字段
{
  id: "item-001",
  module_id: "economy_module_id",
  submodule_id: "uuid-001",
  name: "customFields",
  content: {
    "材质": "青铜",
    "重量": "3.5克",
    "发行年代": "公元前118年"
  }
}
```

### 5.5 经济关系存储

```typescript
// WorldModuleItem - 经济关系
{
  id: "item-002",
  module_id: "economy_module_id",
  submodule_id: "uuid-001",
  name: "relations",
  content: {
    "目标实体名": "supplier:submodule_002:大量:前200年:"
  }
}
// 格式: "目标名称": "关系类型:目标ID:贸易量:开始时间:结束时间"
```

### 5.6 详细信息存储

```typescript
// WorldModuleItem - 详细信息
{
  id: "item-003",
  module_id: "economy_module_id",
  submodule_id: "uuid-001",
  name: "铸造工艺",
  content: {
    "工艺": "铸造",
    "材质": "青铜",
    "特点": "圆形方孔"
  }
}
```

---

## 六、交互设计

### 6.1 创建经济实体流程

```
1. 选择实体类型标签页（或点击 [+ 添加类型] 创建新类型）
         ↓
2. 点击 [+ 添加实体] 按钮
         ↓
3. 填写实体信息表单:
   - 名称 (必填)
   - 描述 (可选)
   - 等级 (从配置中选择)
   - 单位 (可选)
   - 自定义字段 (根据类型配置动态生成)
         ↓
4. 提交后自动展开详情编辑
         ↓
5. 添加经济关系
         ↓
6. 添加详细信息条目
```

### 6.2 配置管理流程

```
1. 点击 [⚙️ 配置] 按钮
         ↓
2. 打开配置面板:
   ├─ 实体类型管理
   │   ├─ 添加/编辑/删除实体类型
   │   ├─ 配置图标、颜色、渐变
   │   └─ 配置自定义字段
   ├─ 关系类型管理
   │   ├─ 添加/编辑/删除关系类型
   │   └─ 配置连线样式、箭头、颜色
   └─ 等级管理
       ├─ 添加/编辑/删除等级
       └─ 配置卡片样式
         ↓
3. 保存配置
```

### 6.3 关系可视化

```
┌─────────────────────────────────────────────────────┐
│  经济关系图谱                                        │
│                                                     │
│      [实体A] ───供应───▶ [实体B]                    │
│        │                                              │
│       竞争                                            │
│        │                                              │
│        ▼                                              │
│      [实体C] ◀──贸易── [实体D]                       │
│                                                     │
│  [+ 添加关系]                                        │
└─────────────────────────────────────────────────────┘
```

### 6.4 筛选与搜索

```
┌─────────────────────────────────────────────────────┐
│  🔍 搜索: [________________]                         │
│                                                     │
│  筛选:                                              │
│  ├─ 实体类型: [类型1▼] [类型2▼] [类型3▼]           │
│  └─ 等级: [●] 全球  [○] 国家  [○] 区域  [○] 地方   │
└─────────────────────────────────────────────────────┘
```

---

## 七、可访问性考虑

### 7.1 键盘导航

- `Tab` - 在标签页、表单控件间切换
- `Enter/Space` - 激活按钮、展开/收起卡片
- `Escape` - 关闭弹窗、取消编辑
- 方向键 - 在标签页间快速切换

### 7.2 ARIA 属性

```tsx
<button
  role="tab"
  aria-selected={isSelected}
  aria-controls={`panel-${entityType}`}
  id={`tab-${entityType}`}
>
  {icon} {label}
</button>

<div
  role="tabpanel"
  id={`panel-${entityType}`}
  aria-labelledby={`tab-${entityType}`}
>
  {/* 卡片列表 */}
</div>
```

### 7.3 颜色对比

所有文本与背景的颜色对比度符合 WCAG 2.1 AA 标准（至少 4.5:1）。

---

## 八、实现建议

### 8.1 组件结构

```
EconomyView/
├── EconomyView.tsx           # 主视图组件
├── components/
│   ├── EntityTypeTabs.tsx     # 实体类型标签页
│   ├── EconomicCard.tsx       # 经济实体卡片
│   ├── RelationGraph.tsx      # 关系可视化图谱
│   ├── EntityForm.tsx         # 实体创建/编辑表单
│   ├── ConfigPanel.tsx        # 配置管理面板
│   ├── FilterPanel.tsx        # 筛选面板
│   └── CustomFieldRenderer.tsx# 自定义字段渲染器
└── hooks/
    ├── useEconomicEntities.ts # 经济实体数据hook
    ├── useEconomicRelations.ts# 经济关系hook
    └── useModuleConfig.ts     # 模块配置hook
```

### 8.2 状态管理

使用 Zustand store 管理经济模块状态：

```typescript
interface EconomyStore {
  // 配置
  config: EconomyModuleConfig;
  setConfig: (config: EconomyModuleConfig) => void;
  
  // 当前状态
  activeType: EconomicEntityType;
  setActiveType: (type: EconomicEntityType) => void;

  selectedEntityId: string | null;
  setSelectedEntityId: (id: string | null) => void;

  // 筛选
  filters: {
    level?: EconomicLevel;
    searchQuery?: string;
  };
  setFilters: (filters: EconomyStore['filters']) => void;
}
```

### 8.3 API 调用

```typescript
// 获取模块配置
const { data: config } = useQuery({
  queryKey: ['worldbuilding', 'economy', 'config', moduleId],
  queryFn: () => worldbuildingApi.getItem(moduleId, 'moduleConfig'),
});

// 获取经济实体列表
const { data: submodules } = useQuery({
  queryKey: ['worldbuilding', 'submodules', moduleId],
  queryFn: () => worldbuildingApi.getSubmodules(moduleId),
  select: (data) => data.filter(s =>
    s.color?.startsWith(`type:${activeType}`)
  ),
});

// 创建经济实体
const createEntityMutation = useMutation({
  mutationFn: (data) => worldbuildingApi.createSubmodule(moduleId, {
    name: data.name,
    description: data.description,
    color: `type:${data.entityType}:${data.level}`,
    icon: data.icon,
  }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'submodules', moduleId] });
  },
});

// 保存模块配置
const saveConfigMutation = useMutation({
  mutationFn: (config: EconomyModuleConfig) => 
    worldbuildingApi.createOrUpdateItem(moduleId, {
      name: 'moduleConfig',
      content: {
        entityTypes: JSON.stringify(config.entityTypes),
        relationTypes: JSON.stringify(config.relationTypes),
        levels: JSON.stringify(config.levels),
      },
    }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'economy', 'config', moduleId] });
  },
});

// 添加经济关系
const addRelationMutation = useMutation({
  mutationFn: (data) => worldbuildingApi.createItem(moduleId, {
    name: 'relations',
    content: {
      [data.targetName]: `${data.relationType}:${data.targetId}:${data.volume}:${data.startDate}:${data.endDate}`
    },
    submodule_id: data.entityId,
  }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'items', moduleId] });
  },
});
```

---

## 九、参考实现

### 9.1 参考文件

- 历史界面实现：`frontend/src/components/Worldbuilding/HistoryView.tsx`
- 世界观主视图：`frontend/src/components/Worldbuilding/WorldbuildingView.tsx`
- 经济模块 API：`frontend/src/services/worldbuildingApi.ts`

### 9.2 设计风格一致性

经济界面设计遵循以下设计原则：

1. **卡片层级**：通过等级区分卡片尺寸和视觉权重
2. **标签页导航**：顶部类型标签页切换不同经济实体类型
3. **展开式详情**：卡片点击展开显示详细信息和关联管理
4. **关系可视化**：使用连线图展示经济实体间的关系
5. **配色体系**：基于实体类型定义主色调，支持完全自定义
