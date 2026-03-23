# 政治界面 UI 设计方案

> LocalScribe 世界观设定 - 政治模块设计文档

---

## 一、概述

### 1.1 设计目标

政治界面作为世界观设定的**核心枢纽模块**，需要实现：

1. **实体管理**：管理国家/政权、组织/势力、人物/领袖、条约/协议四类政治实体
2. **跨模块关联**：支持与地图、历史、经济、种族、体系等模块的数据关联
3. **关系网络**：可视化展示政治实体间的关系（同盟、敌对、附庸等）
4. **立场体系**：九宫格政治立场展示与筛选

### 1.2 模块关系图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           世界观设定系统                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐          │
│  │  地图   │────▶│  政治   │◀────│  历史   │     │  种族   │          │
│  │ (地区)  │     │ (核心)  │     │ (时间)  │     │ (人口)  │          │
│  └─────────┘     └────┬────┘     └─────────┘     └─────────┘          │
│       │               │               ▲               │                │
│       │               │               │               │                │
│       ▼               ▼               │               ▼                │
│  ┌─────────┐     ┌─────────┐          │          ┌─────────┐          │
│  │  经济   │────▶│  体系   │──────────┘          │  特殊   │          │
│  │ (资源)  │     │ (修炼)  │                     │ (设定)  │          │
│  └─────────┘     └─────────┘                     └─────────┘          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 二、数据结构设计

### 2.1 类型定义

```typescript
// 政治实体类型
export type PoliticalEntityType = 
  | 'nation'       // 国家/政权
  | 'organization' // 组织/势力
  | 'leader'       // 人物/领袖
  | 'treaty';      // 条约/协议

// 实力等级
export type EntityLevel = 
  | 'superpower'   // 超级大国
  | 'major'        // 主要势力
  | 'regional'     // 地区势力
  | 'local';       // 地方势力

// 政治立场（九宫格）
export type PoliticalAlignment = 
  | 'lawful-good'     // 守序善良
  | 'neutral-good'    // 中立善良
  | 'chaotic-good'    // 混乱善良
  | 'lawful-neutral'  // 守序中立
  | 'true-neutral'    // 绝对中立
  | 'chaotic-neutral' // 混乱中立
  | 'lawful-evil'     // 守序邪恶
  | 'neutral-evil'    // 中立邪恶
  | 'chaotic-evil';   // 混乱邪恶

// 政治体制类型
export type GovernmentType = 
  | 'monarchy'      // 君主制
  | 'republic'      // 共和制
  | 'theocracy'     // 神权制
  | 'oligarchy'     // 寡头制
  | 'democracy'     // 民主制
  | 'dictatorship'  // 独裁制
  | 'feudal'        // 封建制
  | 'tribal';       // 部落制

// 关系类型
export type RelationType = 
  | 'alliance'   // 同盟
  | 'vassal'     // 附庸
  | 'enemy'      // 敌对
  | 'neutral'    // 中立
  | 'trade'      // 贸易伙伴
  | 'cultural'   // 文化交流
  | 'religious'; // 宗教关联
```

### 2.2 核心接口

```typescript
// 跨模块引用
export interface CrossModuleReference {
  module_type: 'map' | 'history' | 'economy' | 'races' | 'systems' | 'special';
  item_id: string;
  item_name: string;
  relation_description?: string;
}

// 政治实体完整接口
export interface PoliticalEntity {
  id: string;
  name: string;
  description?: string;
  entityType: PoliticalEntityType;
  level: EntityLevel;
  alignment?: PoliticalAlignment;
  governmentType?: GovernmentType;
  color?: string;
  icon?: string;
  order_index: number;
  parent_id?: string;
  
  // 跨模块关联
  territories?: CrossModuleReference[];       // 领土（地图模块）
  historicalEvents?: CrossModuleReference[];  // 历史事件（历史模块）
  economicTies?: CrossModuleReference[];      // 经济关联（经济模块）
  racialComposition?: CrossModuleReference[]; // 种族构成（种族模块）
  cultivationSystems?: CrossModuleReference[]; // 修炼体系（体系模块：仙侠/魔法/科技等）
  
  // 政治关系
  relations?: PoliticalRelation[];
  
  // 详细条目
  items: PoliticalItem[];
}

// 政治关系
export interface PoliticalRelation {
  target_id: string;
  target_name: string;
  relationType: RelationType;
  description?: string;
  startDate?: string;
  endDate?: string;
}

// 政治条目
export interface PoliticalItem {
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
│  [国家] [组织] [领袖] [条约]    [🔍 搜索政治实体...]    [+ 添加实体]         │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ 🏛️ 大汉帝国                                          [编辑] [删除]     │ │
│  │ ══════════════════════════════════════════════════════════════════════ │ │
│  │ 等级: ★★★ 超级大国  |  体制: 君主制  |  立场: 守序中立                  │ │
│  │                                                                        │ │
│  │ ┌──────────────────────────────────────────────────────────────────┐  │ │
│  │ │ 📍 领土关联                                                      │  │ │
│  │ │   中原地区 · 江南地区 · 西域都护府 · 辽东郡  [+ 添加地区]         │  │ │
│  │ └──────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                        │ │
│  │ ┌──────────────────────────────────────────────────────────────────┐  │ │
│  │ │ 📜 历史事件                                                      │  │ │
│  │ │   楚汉争霸(前206) → 汉武帝北伐(前119) → 王莽篡汉(8年)            │  │ │
│  │ │   [+ 添加历史事件]                                                │  │ │
│  │ └──────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                        │ │
│  │ ┌──────────────────────────────────────────────────────────────────┐  │ │
│  │ │ 🤝 政治关系                                                      │  │ │
│  │ │   ┌─────────┐  同盟   ┌─────────┐                               │  │ │
│  │ │   │ 大汉帝国│────────▶│ 南越国  │                               │  │ │
│  │ │   └─────────┘         └─────────┘                               │  │ │
│  │ │   ┌─────────┐  敌对   ┌─────────┐                               │  │ │
│  │ │   │ 大汉帝国│════════▶│ 匈奴汗国│                               │  │ │
│  │ │   └─────────┘         └─────────┘                               │  │ │
│  │ │   [+ 添加关系]                                                    │  │ │
│  │ └──────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                        │ │
│  │ ┌──────────────────────────────────────────────────────────────────┐  │ │
│  │ │ 📊 详细信息                                                      │  │ │
│  │ │   [政治体制] [军事力量] [经济状况] [种族构成] [+ 添加]            │  │ │
│  │ └──────────────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌──────────────────────────────┐  ┌──────────────────────────────┐        │
│  │ ⚔️ 北方联盟                  │  │ 👤 刘邦                      │        │
│  │ 等级: ★★ 主要势力           │  │ 等级: ★★ 重要人物            │        │
│  │ ...                          │  │ ...                          │        │
│  └──────────────────────────────┘  └──────────────────────────────┘        │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 卡片设计规格

| 实体类型 | 图标 | 主色调 | 卡片样式 |
|---------|------|--------|---------|
| 国家/政权 | 🏛️ | 金色 `#c9a227` | 大卡片，渐变背景，强调边框 |
| 组织/势力 | ⚔️ | 红色 `#b91c1c` | 中卡片，强调边框 |
| 人物/领袖 | 👤 | 蓝色 `#2563eb` | 中卡片，头像区域 |
| 条约/协议 | 📜 | 绿色 `#059669` | 小卡片，简洁布局 |

### 3.3 等级卡片样式

| 等级 | 标识 | 卡片尺寸 | 视觉效果 |
|------|------|---------|---------|
| 超级大国 | ★★★ | 100% 宽度，min-h-[240px] | 金色渐变，强阴影，发光效果 |
| 主要势力 | ★★ | 50% 宽度，min-h-[180px] | 银色渐变，中等阴影 |
| 地区势力 | ★ | 33% 宽度，min-h-[140px] | 灰色背景，轻阴影 |
| 地方势力 | ○ | 25% 宽度，min-h-[100px] | 虚线边框，简洁样式 |

---

## 四、配色方案

### 4.1 实体类型配色

```typescript
export const ENTITY_TYPE_CONFIG = {
  nation: {
    label: 'Nation',
    labelCn: '国家/政权',
    color: '#c9a227',
    gradient: 'from-yellow-600/15 via-amber-500/10 to-orange-500/8',
    border: 'border-yellow-500/40',
    accent: 'bg-yellow-500',
    text: 'text-yellow-700 dark:text-yellow-300',
    icon: '🏛️',
    description: '国家、帝国、王国等政治实体',
  },
  organization: {
    label: 'Organization',
    labelCn: '组织/势力',
    color: '#b91c1c',
    gradient: 'from-red-700/15 via-rose-600/10 to-orange-700/8',
    border: 'border-red-500/40',
    accent: 'bg-red-600',
    text: 'text-red-700 dark:text-red-300',
    icon: '⚔️',
    description: '门派、联盟、秘密组织等',
  },
  leader: {
    label: 'Leader',
    labelCn: '人物/领袖',
    color: '#2563eb',
    gradient: 'from-blue-600/15 via-indigo-500/10 to-violet-600/8',
    border: 'border-blue-400/40',
    accent: 'bg-blue-500',
    text: 'text-blue-700 dark:text-blue-300',
    icon: '👤',
    description: '帝王、将军、政治家等人物',
  },
  treaty: {
    label: 'Treaty',
    labelCn: '条约/协议',
    color: '#059669',
    gradient: 'from-emerald-600/15 via-teal-500/10 to-cyan-600/8',
    border: 'border-emerald-400/40',
    accent: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-300',
    icon: '📜',
    description: '盟约、条约、协议等',
  },
};
```

### 4.2 政治立场配色（九宫格）

```typescript
export const ALIGNMENT_CONFIG = {
  'lawful-good': { 
    label: '守序善良', 
    color: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
    description: '正义、秩序、仁慈'
  },
  'neutral-good': { 
    label: '中立善良', 
    color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
    description: '善良但不盲从秩序'
  },
  'chaotic-good': { 
    label: '混乱善良', 
    color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    description: '善良但反抗压迫秩序'
  },
  'lawful-neutral': { 
    label: '守序中立', 
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    description: '遵循秩序，不问善恶'
  },
  'true-neutral': { 
    label: '绝对中立', 
    color: 'bg-slate-100 text-slate-800 dark:bg-slate-800/50 dark:text-slate-300',
    description: '平衡、中立'
  },
  'chaotic-neutral': { 
    label: '混乱中立', 
    color: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
    description: '自由、不可预测'
  },
  'lawful-evil': { 
    label: '守序邪恶', 
    color: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
    description: '利用秩序作恶'
  },
  'neutral-evil': { 
    label: '中立邪恶', 
    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    description: '纯粹邪恶，不择手段'
  },
  'chaotic-evil': { 
    label: '混乱邪恶', 
    color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    description: '混乱、毁灭、残忍'
  },
};
```

### 4.3 关系类型配色

```typescript
export const RELATION_TYPE_CONFIG = {
  alliance: { 
    label: '同盟', 
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-500/15',
    line: 'solid',
    icon: '🤝'
  },
  vassal: { 
    label: '附庸', 
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-500/15',
    line: 'dashed',
    icon: '👑'
  },
  enemy: { 
    label: '敌对', 
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-500/15',
    line: 'double',
    icon: '⚔️'
  },
  neutral: { 
    label: '中立', 
    color: 'text-slate-500 dark:text-slate-400',
    bgColor: 'bg-slate-500/15',
    line: 'dotted',
    icon: '⚪'
  },
  trade: { 
    label: '贸易', 
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-500/15',
    line: 'solid',
    icon: '💰'
  },
  cultural: { 
    label: '文化', 
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-500/15',
    line: 'solid',
    icon: '🎭'
  },
  religious: { 
    label: '宗教', 
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-500/15',
    line: 'solid',
    icon: '⛪'
  },
};
```

---

## 五、后端数据存储方案

### 5.1 数据映射关系

利用现有 `WorldSubmodule` 和 `WorldModuleItem` 结构存储政治数据：

| 字段 | 存储内容 | 格式示例 |
|------|---------|---------|
| `color` | 实体类型 + 等级 | `type:nation:superpower` |
| `icon` | 立场 + 体制 | `alignment:lawful-neutral:government:monarchy` |
| `parent_id` | 从属关系 | 父级实体ID |
| `WorldModuleItem` | 详细信息、关联、关系 | 见下方详细说明 |

### 5.2 政治实体存储

```typescript
// WorldSubmodule - 政治实体
{
  id: "uuid-001",
  module_id: "politics_module_id",
  name: "大汉帝国",
  description: "统一六国后建立的中央集权帝国...",
  color: "type:nation:superpower",
  icon: "alignment:lawful-neutral:government:monarchy",
  parent_id: null,
  order_index: 0
}
```

### 5.3 跨模块关联存储

```typescript
// WorldModuleItem - 领土关联
{
  id: "item-001",
  module_id: "politics_module_id",
  submodule_id: "uuid-001",
  name: "territories",
  content: {
    "中原地区": "map:region_001",
    "江南地区": "map:region_002",
    "西域都护府": "map:region_003"
  }
}

// WorldModuleItem - 历史事件关联
{
  id: "item-002",
  module_id: "politics_module_id",
  submodule_id: "uuid-001",
  name: "historicalEvents",
  content: {
    "楚汉争霸": "history:event_001",
    "汉武帝北伐": "history:event_002",
    "王莽篡汉": "history:event_003"
  }
}

// WorldModuleItem - 经济关联
{
  id: "item-003",
  module_id: "politics_module_id",
  submodule_id: "uuid-001",
  name: "economicTies",
  content: {
    "丝绸之路": "economy:trade_001",
    "盐铁专卖": "economy:policy_001"
  }
}

// WorldModuleItem - 修炼体系关联（仙侠/魔法/科技等）
{
  id: "item-003b",
  module_id: "politics_module_id",
  submodule_id: "uuid-001",
  name: "cultivationSystems",
  content: {
    "儒家思想": "systems:confucianism_001",
    "道家修炼": "systems:taoism_001",
    "官方武学": "systems:martial_arts_001"
  }
}
```

### 5.4 政治关系存储

```typescript
// WorldModuleItem - 政治关系
{
  id: "item-004",
  module_id: "politics_module_id",
  submodule_id: "uuid-001",
  name: "relations",
  content: {
    "南越国": "alliance:submodule_002:前196年:",
    "匈奴汗国": "enemy:submodule_003:前200年:前100年",
    "朝鲜半岛": "neutral:submodule_004::"
  }
}
// 格式: "目标名称": "关系类型:目标ID:开始时间:结束时间"
```

### 5.5 详细信息存储

```typescript
// WorldModuleItem - 政治体制
{
  id: "item-005",
  module_id: "politics_module_id",
  submodule_id: "uuid-001",
  name: "政治体制",
  content: {
    "政体": "中央集权君主制",
    "继承制度": "嫡长子继承制",
    "官僚体系": "三公九卿制",
    "行政区划": "郡县制"
  }
}

// WorldModuleItem - 军事力量
{
  id: "item-006",
  module_id: "politics_module_id",
  submodule_id: "uuid-001",
  name: "军事力量",
  content: {
    "常备军": "约60万",
    "主力兵种": "步兵、骑兵、车兵",
    "著名将领": "韩信、卫青、霍去病",
    "军事制度": "征兵制、募兵制"
  }
}
```

---

## 六、组件结构

### 6.1 文件结构

```
PoliticsView/
├── index.ts                    # 导出入口
├── types.ts                    # 类型定义
├── config.ts                   # 配置（颜色、图标、样式）
├── PoliticsView.tsx            # 主组件
├── EntityCard.tsx              # 实体卡片组件
├── EntityLevelBadge.tsx        # 等级徽章组件
├── AlignmentBadge.tsx          # 立场徽章组件
├── CrossModuleSection.tsx      # 跨模块关联区块
├── RelationSection.tsx         # 政治关系区块
├── RelationNetwork.tsx         # 关系网络可视化（高级功能）
├── AlignmentGrid.tsx           # 立场九宫格（高级功能）
├── PoliticsSkeleton.tsx        # 加载骨架屏
└── modals/
    ├── index.ts
    ├── AddEntityModal.tsx      # 添加实体弹窗
    ├── EditEntityModal.tsx     # 编辑实体弹窗
    ├── AddRelationModal.tsx    # 添加关系弹窗
    ├── AddCrossModuleRefModal.tsx # 添加跨模块关联弹窗
    └── AddItemModal.tsx        # 添加详细信息弹窗
```

### 6.2 组件职责

| 组件 | 职责 |
|------|------|
| `PoliticsView` | 主容器，管理状态、数据获取、筛选逻辑 |
| `EntityCard` | 单个政治实体卡片，展示实体信息和关联 |
| `EntityLevelBadge` | 显示实体等级（★★★） |
| `AlignmentBadge` | 显示政治立场标签 |
| `CrossModuleSection` | 展示和管理跨模块关联（领土、历史等） |
| `RelationSection` | 展示和管理政治关系 |
| `RelationNetwork` | 可视化关系网络图（可选） |
| `AlignmentGrid` | 九宫格立场筛选器（可选） |

---

## 七、交互设计

### 7.1 核心交互

| 功能 | 描述 | 实现方式 |
|------|------|---------|
| **类型筛选** | 顶部标签页切换实体类型 | Tab 组件 |
| **搜索过滤** | 按名称、等级、立场搜索 | 搜索框 + 过滤逻辑 |
| **快速编辑** | 点击描述区域直接编辑 | 内联编辑器 |
| **关联管理** | 弹窗选择其他模块条目 | Modal + 选择器 |
| **关系管理** | 添加/编辑/删除政治关系 | Modal + 表单 |
| **跳转功能** | 点击关联跳转到对应模块 | 路由导航 |

### 7.2 交互流程

#### 添加政治实体

```
点击"添加实体" → 选择实体类型 → 填写基本信息 
→ 选择等级 → 选择立场 → 选择体制 → 保存
```

#### 添加跨模块关联

```
点击"添加地区/事件" → 选择模块类型 → 从列表选择条目 
→ 确认关联 → 保存
```

#### 添加政治关系

```
点击"添加关系" → 选择目标实体 → 选择关系类型 
→ 填写时间范围 → 填写描述 → 保存
```

---

## 八、API 调用

### 8.1 数据获取

```typescript
// 获取政治模块的子模块（政治实体）
const { data: submodules } = useQuery({
  queryKey: ['worldbuilding', 'submodules', moduleId],
  queryFn: () => worldbuildingApi.getSubmodules(moduleId),
});

// 获取政治模块的所有条目（关联、关系、详细信息）
const { data: items } = useQuery({
  queryKey: ['worldbuilding', 'items', moduleId],
  queryFn: () => worldbuildingApi.getItems(moduleId, { include_all: true }),
});
```

### 8.2 数据操作

```typescript
// 创建政治实体
const createEntityMutation = useMutation({
  mutationFn: (data) => worldbuildingApi.createSubmodule(moduleId, {
    name: data.name,
    description: data.description,
    color: `type:${data.entityType}:${data.level}`,
    icon: `alignment:${data.alignment}:government:${data.governmentType}`,
  }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'submodules', moduleId] });
  },
});

// 添加跨模块关联
const addCrossRefMutation = useMutation({
  mutationFn: (data) => worldbuildingApi.createItem(moduleId, {
    name: data.refType, // 'territories' | 'historicalEvents' | etc.
    content: { [data.itemName]: `${data.moduleType}:${data.itemId}` },
    submodule_id: data.entityId,
  }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'items', moduleId] });
  },
});

// 添加政治关系
const addRelationMutation = useMutation({
  mutationFn: (data) => worldbuildingApi.createItem(moduleId, {
    name: 'relations',
    content: {
      [data.targetName]: `${data.relationType}:${data.targetId}:${data.startDate}:${data.endDate}`
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
- 类型定义：`frontend/src/components/Worldbuilding/HistoryView/types.ts`
- 配置文件：`frontend/src/components/Worldbuilding/HistoryView/config.ts`
- 后端API：`frontend/src/services/worldbuildingApi.ts`
- 后端Schema：`backend/app/schemas/worldbuilding.py`

### 9.2 实现顺序建议

1. **基础阶段**
   - 创建 `types.ts` 类型定义
   - 创建 `config.ts` 配置文件
   - 实现 `PoliticsView.tsx` 主组件骨架
   - 实现 `EntityCard.tsx` 基础卡片

2. **完善阶段**
   - 实现各种 Modal 组件
   - 实现跨模块关联功能
   - 实现政治关系管理

3. **增强阶段**（可选）
   - 实现关系网络可视化
   - 实现立场九宫格筛选
   - 实现拖拽排序

---

## 十、设计原则

### 10.1 视觉设计

- **层次分明**：通过卡片大小、颜色深浅区分实体等级
- **信息密度**：合理控制信息展示密度，避免视觉疲劳
- **一致性**：与历史界面保持视觉风格一致
- **可扩展**：支持未来添加新的实体类型和关联类型

### 10.2 交互设计

- **直观易用**：操作流程简洁明了
- **即时反馈**：操作后立即更新界面
- **容错设计**：提供确认机制防止误操作
- **快捷操作**：支持快捷键和批量操作

### 10.3 技术设计

- **复用现有架构**：基于 `WorldSubmodule` 和 `WorldModuleItem` 结构
- **类型安全**：完整的 TypeScript 类型定义
- **性能优化**：合理使用 React Query 缓存
- **可维护性**：模块化组件设计

---

## 附录：完整类型定义文件

```typescript
// types.ts

export type PoliticalEntityType = 'nation' | 'organization' | 'leader' | 'treaty';

export type EntityLevel = 'superpower' | 'major' | 'regional' | 'local';

export type PoliticalAlignment = 
  | 'lawful-good' | 'neutral-good' | 'chaotic-good'
  | 'lawful-neutral' | 'true-neutral' | 'chaotic-neutral'
  | 'lawful-evil' | 'neutral-evil' | 'chaotic-evil';

export type GovernmentType = 
  | 'monarchy' | 'republic' | 'theocracy' | 'oligarchy'
  | 'democracy' | 'dictatorship' | 'feudal' | 'tribal';

export type RelationType = 
  | 'alliance' | 'vassal' | 'enemy' | 'neutral'
  | 'trade' | 'cultural' | 'religious';

export type CrossModuleType = 'map' | 'history' | 'economy' | 'races' | 'systems' | 'special';

export interface CrossModuleReference {
  module_type: CrossModuleType;
  item_id: string;
  item_name: string;
  relation_description?: string;
}

export interface PoliticalEntity {
  id: string;
  name: string;
  description?: string;
  entityType: PoliticalEntityType;
  level: EntityLevel;
  alignment?: PoliticalAlignment;
  governmentType?: GovernmentType;
  color?: string;
  icon?: string;
  order_index: number;
  parent_id?: string;
  territories?: CrossModuleReference[];
  historicalEvents?: CrossModuleReference[];
  economicTies?: CrossModuleReference[];
  racialComposition?: CrossModuleReference[];
  cultivationSystems?: CrossModuleReference[];  // 修炼体系（仙侠/魔法/科技等）
  relations?: PoliticalRelation[];
  items: PoliticalItem[];
}

export interface PoliticalRelation {
  target_id: string;
  target_name: string;
  relationType: RelationType;
  description?: string;
  startDate?: string;
  endDate?: string;
}

export interface PoliticalItem {
  id: string;
  name: string;
  content: Record<string, string>;
  order_index: number;
}

export interface EntityTypeConfig {
  label: string;
  labelCn: string;
  color: string;
  gradient: string;
  border: string;
  accent: string;
  text: string;
  icon: string;
  description: string;
}

export interface EntityLevelConfig {
  label: string;
  labelCn: string;
  flexBasis: string;
  minHeight: string;
  padding: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  titleSize: string;
  glowColor: string;
}

export interface AlignmentConfig {
  label: string;
  color: string;
  description: string;
}

export interface RelationTypeConfig {
  label: string;
  color: string;
  bgColor: string;
  line: 'solid' | 'dashed' | 'dotted' | 'double';
  icon: string;
}

export interface PoliticsViewProps {
  moduleId: string;
}

export interface EntityCardProps {
  entity: PoliticalEntity;
  onEdit: () => void;
  onDelete: () => void;
  onAddItem: () => void;
  onEditItem: (item: PoliticalItem) => void;
  onDeleteItem: (itemId: string) => void;
  onAddRelation: () => void;
  onAddCrossRef: (refType: string) => void;
  onUpdateDescription: (description: string) => void;
}
```

---

*文档版本: 1.0*  
*创建日期: 2024*  
*适用于: LocalScribe 世界观设定系统*
