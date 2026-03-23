# 经济界面 UI 设计方案

> LocalScribe 世界观设定 - 经济模块设计文档（增强版）

---

## 一、概述

### 1.1 设计目标

经济界面作为世界观设定的**资源流通核心模块**，需要实现：

1. **实体管理**：管理货币、商品、资源、贸易路线、经济区、产业等经济实体
2. **跨模块关联**：支持与地图（产地）、政治（政策）、历史（事件）、种族（劳动力）、体系（修仙/魔法/科技）的**双向强关联**
3. **流通可视化**：展示经济实体间的流转关系（贸易路线、资源流向、资金流动）
4. **经济层次**：展现不同层级的经济体（宏观经济、区域经济、行业经济）
5. **世界观适配**：适配仙侠、历史、西幻、现代、科幻、末世等世界观类型
6. **影响分析**：分析经济实体对政治、历史、社会的影响程度

### 1.2 模块关系图（增强版）

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           世界观设定系统                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐          │
│  │  地图   │────▶│  经济   │◀────│  政治   │     │  种族   │          │
│  │ (地区)  │     │ (资源)  │     │ (势力)  │     │ (种族)  │          │
│  └─────────┘     └────┬────┘     └─────────┘     └─────────┘          │
│       │               │               ▲               │                │
│       │               │               │               │                │
│       ▼               ▼               │               ▼                │
│  ┌─────────┐     ┌─────────┐          │          ┌─────────┐          │
│  │  历史   │────▶│  体系   │──────────┘          │  特殊   │          │
│  │ (纪年)  │     │ (修炼)  │                     │ (设定)  │          │
│  └─────────┘     └─────────┘                     └─────────┘          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

双向关联关系：
• 经济实体 → 历史事件（因果关系、时间关系）
• 经济实体 → 政治实体（功能关系、依赖关系）
• 历史事件 → 经济实体（反向查询、发展脉络）
• 政治实体 → 经济实体（反向查询、政策影响）
```

---

## 二、数据结构设计（增强版）

### 2.1 类型定义

```typescript
// 经济实体类型（基础类型，支持世界观适配）
export type EconomicEntityType =
  | 'currency'      // 货币
  | 'commodity'     // 商品/货物
  | 'resource'      // 资源
  | 'trade_route'    // 贸易路线
  | 'economic_zone'  // 经济区/圈
  | 'industry';     // 产业/行业

// 世界观适配的经济实体类型
export type WorldviewEconomicEntityType = EconomicEntityType & {
  worldview: WorldviewType;
  adaptedLabel: string;
  adaptedIcon: string;
  adaptedColor: string;
};

// 经济等级
export type EconomicLevel =
  | 'global'    // 全球级
  | 'national'  // 国家级
  | 'regional'  // 区域级
  | 'local';    // 地方级

// 资源类型（支持世界观适配）
export type ResourceType =
  | 'agricultural'  // 农产品
  | 'mineral'       // 矿产资源
  | 'luxury'        // 奢侈品
  | 'strategic'     // 战略物资
  | 'manufactured'  // 工业制品
  | 'labor';        // 劳动力

// 货币类型（支持世界观适配）
export type CurrencyType =
  | 'coin'       // 金属币
  | 'paper'      // 纸币
  | 'electronic' // 电子货币
  | 'barter';    // 物物交换

// 贸易路线类型（支持世界观适配）
export type TradeRouteType =
  | 'land'      // 陆路
  | 'sea'       // 海路
  | 'river'     // 河运
  | 'silk_road' // 丝绸之路
  | 'maritime'; // 海上丝路

// 经济关系类型
export type EconomicRelationType =
  | 'trade_partner'    // 贸易伙伴
  | 'supplier'         // 供应商
  | 'consumer'         // 消费者
  | 'competitor'       // 竞争者
  | 'colony'           // 殖民地经济
  | 'tribute'          // 朝贡体系
  | 'tariff_barrier'   // 关税壁垒
  | 'free_trade';      // 自由贸易

// 世界观类型
export type WorldviewType = 
  | 'xianxia'     // 仙侠
  | 'historical'  // 历史
  | 'western'     // 西幻
  | 'modern'      // 现代
  | 'scifi'       // 科幻
  | 'apocalypse'; // 末世

// 跨模块引用类型
export type CrossModuleReferenceType = 
  | 'history'    // 历史模块引用
  | 'politics'   // 政治模块引用
  | 'map'        // 地图模块引用
  | 'races'      // 种族模块引用
  | 'systems';   // 体系模块引用
```

### 2.2 核心接口（增强版）

```typescript
// 跨模块引用接口（增强版）
export interface CrossModuleReference {
  module: CrossModuleReferenceType;
  entityId: string;
  entityName: string;
  entityType: string;
  relationType: 'causal' | 'temporal' | 'functional' | 'hierarchical' | 'dependency';
  relationStrength: 'strong' | 'medium' | 'weak';
  timestamp?: string; // 关联时间点
  description?: string; // 关联描述
  bidirectional: boolean; // 是否双向关联
}

// 经济实体完整接口（增强版）
export interface EconomicEntity {
  id: string;
  name: string;
  description?: string;
  entityType: EconomicEntityType;
  level: EconomicLevel;
  color?: string;
  icon?: string;
  order_index: number;
  worldview?: WorldviewType; // 世界观类型

  // 类型特定属性
  resourceType?: ResourceType;       // 资源类型（仅对resource有效）
  currencyType?: CurrencyType;      // 货币类型（仅对currency有效）
  tradeRouteType?: TradeRouteType;   // 路线类型（仅对trade_route有效）

  // 单位与规格
  unit?: string;                     // 计量单位
  specification?: Record<string, string>; // 规格参数

  // 跨模块双向关联
  crossModuleReferences: {
    history: CrossModuleReference[];   // 历史事件关联
    politics: CrossModuleReference[];  // 政治实体关联
    map: CrossModuleReference[];      // 地图关联
    races: CrossModuleReference[];     // 种族关联
    systems: CrossModuleReference[];   // 体系关联
  };

  // 关联网络数据
  relationNetwork?: {
    incoming: CrossModuleReference[]; // 入向关联
    outgoing: CrossModuleReference[]; // 出向关联
    bidirectional: CrossModuleReference[]; // 双向关联
  };

  // 经济关系
  relations?: EconomicRelation[];

  // 详细条目
  items: EconomicItem[];

  // 世界观适配属性
  adaptedEntityType?: WorldviewEconomicEntityType; // 世界观适配后的实体类型
  impactAnalysis?: { // 影响分析
    politicalImpact: number; // 政治影响度 (0-100)
    historicalImpact: number; // 历史影响度 (0-100)
    socialImpact: number; // 社会影响度 (0-100)
    technologicalImpact: number; // 科技影响度 (0-100)
  };
}

// 经济关系（增强版）
export interface EconomicRelation {
  target_id: string;
  target_name: string;
  relationType: EconomicRelationType;
  description?: string;
  tradeVolume?: string;    // 贸易量
  startDate?: string;
  endDate?: string;
  
  // 跨模块关联
  crossModuleRefs?: CrossModuleReference[]; // 关系级关联
  
  // 世界观适配
  adaptedRelationType?: string; // 世界观适配后的关系类型
}

// 经济条目（增强版）
export interface EconomicItem {
  id: string;
  name: string;
  content: Record<string, string>;
  order_index: number;
  
  // 跨模块关联
  crossModuleRefs?: CrossModuleReference[]; // 条目级关联
  
  // 世界观适配
  adaptedContent?: Record<string, string>; // 世界观适配后的内容
}
```

---

## 三、UI 布局设计

### 3.1 主界面布局

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  [货币] [商品] [资源] [贸易路线] [经济区] [产业]   [🔍 搜索经济实体...]       │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ 💰 大汉铜钱                                                    [编辑]  │ │
│  │ ══════════════════════════════════════════════════════════════════════ │ │
│  │ 类型: 货币  |  等级: ★★★ 国家级  |  单位: 枚                          │ │
│  │ 描述: 以铜为主的金属货币，汉代主要流通货币...                          │ │
│  │                                                                        │ │
│  │ ┌──────────────────────────────────────────────────────────────────┐  │ │
│  │ │ 🏭 产地关联                                                      │  │ │
│  │ │   豫章郡铜矿 · 会稽郡铜矿 · 蜀郡铜矿  [+ 添加产地]                │  │ │
│  │ └──────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                        │ │
│  │ ┌──────────────────────────────────────────────────────────────────┐  │ │
│  │ │ 📜 政策法规                                                      │  │ │
│  │ │   盐铁官营 · 货币铸造许可制度  [+ 添加政策]                       │  │ │
│  │ └──────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                        │ │
│  │ ┌──────────────────────────────────────────────────────────────────┐  │ │
│  │ │ 🔄 经济关系                                                      │  │ │
│  │ │   供应 ──────────▶ 匈奴皮毛                                       │  │ │
│  │ │   竞争 ─ ─ ─ ─ ─ ▶ 罗马银币                                       │  │ │
│  │ │   贸易 ──────────▶ 丝绸                                             │  │ │
│  │ │   [+ 添加关系]                                                    │  │ │
│  │ └──────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                        │ │
│  │ ┌──────────────────────────────────────────────────────────────────┐  │ │
│  │ │ 📊 详细信息                                                      │  │ │
│  │ │   [铸造工艺] [面值规格] [流通区域] [+ 添加]                        │  │ │
│  │ └──────────────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ 🐑 丝绸                                              [编辑] [删除]     │ │
│  │ 类型: 商品  |  等级: ★★ 国家级  |  单位: 匹                           │ │
│  │ ...                                                                    │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌──────────────────────────────┐  ┌──────────────────────────────┐        │
│  │ ⚒️ 铁器                      │  │ 🌾 稻米                      │        │
│  │ 类型: 商品  |  等级: ★ 区域级 │  │ 类型: 商品  |  等级: ○ 地方级│        │
│  └──────────────────────────────┘  └──────────────────────────────┘        │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 实体类型标签页设计

```
┌─────────────────────────────────────────────────────────────────┐
│  [💰 货币] [📦 商品] [⚒️ 资源] [🛤️ 贸易路线] [🏘️ 经济区] [🏭 产业]  │
└─────────────────────────────────────────────────────────────────┘
```

| 实体类型 | 图标 | 主色调 | 描述 |
|---------|------|--------|------|
| 货币 | 💰 | 金色 `#c9a227` | 硬币、纸币、电子货币等 |
| 商品 | 📦 | 棕色 `#92400e` | 各类货物、商品 |
| 资源 | ⚒️ | 灰色 `#57534e` | 原材料、矿产资源 |
| 贸易路线 | 🛤️ | 绿色 `#15803d` | 陆路、海路、河运路线 |
| 经济区 | 🏘️ | 蓝色 `#1d4ed8` | 经济圈、自贸区 |
| 产业 | 🏭 | 橙色 `#c2410c` | 农业、工业、服务业 |

### 3.3 卡片设计规格

| 等级 | 标识 | 卡片尺寸 | 视觉效果 |
|------|------|---------|---------|
| 全球级 | ★★★ | 100% 宽度，min-h-[240px] | 金色渐变，强阴影，发光效果 |
| 国家级 | ★★ | 50% 宽度，min-h-[180px] | 银色渐变，中等阴影 |
| 区域级 | ★ | 33% 宽度，min-h-[140px] | 灰色背景，轻阴影 |
| 地方级 | ○ | 25% 宽度，min-h-[100px] | 虚线边框，简洁样式 |

### 3.4 经济关系连接线样式

```
  供应关系 (实线 + 箭头)
  ──────────▶

  竞争关系 (虚线 + 双向箭头)
  - - - - - ⇌

  朝贡关系 (波浪线 + 箭头)
  ∿∿∿∿∿∿∿▶

  贸易伙伴 (实线 + 双向箭头)
  ────────── ⇌

  关税壁垒 (红色虚线 + 交叉)
  - - - - - ✕
```

---

## 四、配色方案

### 4.1 实体类型配色

```typescript
export const ENTITY_TYPE_CONFIG = {
  currency: {
    label: 'Currency',
    labelCn: '货币',
    color: '#c9a227',
    gradient: 'from-yellow-600/15 via-amber-500/10 to-orange-500/8',
    border: 'border-yellow-500/40',
    accent: 'bg-yellow-500',
    text: 'text-yellow-700 dark:text-yellow-300',
    icon: '💰',
    description: '金属币、纸币、电子货币等',
  },
  commodity: {
    label: 'Commodity',
    labelCn: '商品',
    color: '#92400e',
    gradient: 'from-amber-700/15 via-orange-600/10 to-yellow-700/8',
    border: 'border-amber-600/40',
    accent: 'bg-amber-600',
    text: 'text-amber-700 dark:text-amber-300',
    icon: '📦',
    description: '各类货物、商品成品',
  },
  resource: {
    label: 'Resource',
    labelCn: '资源',
    color: '#57534e',
    gradient: 'from-stone-600/15 via-zinc-500/10 to-stone-600/8',
    border: 'border-stone-500/40',
    accent: 'bg-stone-500',
    text: 'text-stone-700 dark:text-stone-300',
    icon: '⚒️',
    description: '原材料、矿产资源',
  },
  trade_route: {
    label: 'Trade Route',
    labelCn: '贸易路线',
    color: '#15803d',
    gradient: 'from-emerald-600/15 via-green-500/10 to-teal-600/8',
    border: 'border-emerald-500/40',
    accent: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-300',
    icon: '🛤️',
    description: '陆路、海路、河运路线',
  },
  economic_zone: {
    label: 'Economic Zone',
    labelCn: '经济区',
    color: '#1d4ed8',
    gradient: 'from-blue-600/15 via-indigo-500/10 to-blue-600/8',
    border: 'border-blue-500/40',
    accent: 'bg-blue-500',
    text: 'text-blue-700 dark:text-blue-300',
    icon: '🏘️',
    description: '经济圈、自贸区、关税区',
  },
  industry: {
    label: 'Industry',
    labelCn: '产业',
    color: '#c2410c',
    gradient: 'from-orange-600/15 via-red-500/10 to-orange-600/8',
    border: 'border-orange-500/40',
    accent: 'bg-orange-500',
    text: 'text-orange-700 dark:text-orange-300',
    icon: '🏭',
    description: '农业、工业、服务业、手工业',
  },
};
```

### 4.2 资源类型配色

```typescript
export const RESOURCE_TYPE_CONFIG = {
  agricultural: {
    label: 'Agricultural',
    labelCn: '农产品',
    color: '#16a34a',
    gradient: 'from-green-600/15 via-emerald-500/10 to-green-600/8',
    icon: '🌾',
    description: '粮食、经济作物、畜牧产品',
  },
  mineral: {
    label: 'Mineral',
    labelCn: '矿产资源',
    color: '#64748b',
    gradient: 'from-slate-500/15 via-zinc-500/10 to-slate-500/8',
    icon: '💎',
    description: '金属矿、非金属矿、能源矿产',
  },
  luxury: {
    label: 'Luxury',
    labelCn: '奢侈品',
    color: '#9333ea',
    gradient: 'from-purple-600/15 via-violet-500/10 to-purple-600/8',
    icon: '👑',
    description: '丝绸、珠宝、香料、工艺品',
  },
  strategic: {
    label: 'Strategic',
    labelCn: '战略物资',
    color: '#dc2626',
    gradient: 'from-red-600/15 via-rose-500/10 to-red-600/8',
    icon: '⚔️',
    description: '马匹、盐铁、武器、战略金属',
  },
  manufactured: {
    label: 'Manufactured',
    labelCn: '工业制品',
    color: '#0891b2',
    gradient: 'from-cyan-600/15 via-teal-500/10 to-cyan-600/8',
    icon: '🔧',
    description: '铁器、瓷器、纺织品、武器',
  },
  labor: {
    label: 'Labor',
    labelCn: '劳动力',
    color: '#ea580c',
    gradient: 'from-orange-600/15 via-amber-500/10 to-orange-600/8',
    icon: '👷',
    description: '人力、技术工人、奴隶',
  },
};
```

### 4.3 货币类型配色

```typescript
export const CURRENCY_TYPE_CONFIG = {
  coin: {
    label: 'Coin',
    labelCn: '金属币',
    color: '#c9a227',
    gradient: 'from-yellow-500/20 via-amber-400/15 to-yellow-500/10',
    icon: '🪙',
    description: '铜钱、银两、金锭',
  },
  paper: {
    label: 'Paper',
    labelCn: '纸币',
    color: '#78716c',
    gradient: 'from-stone-400/20 via-zinc-300/15 to-stone-400/10',
    icon: '📜',
    description: '交子、会子、银票',
  },
  electronic: {
    label: 'Electronic',
    labelCn: '电子货币',
    color: '#0ea5e9',
    gradient: 'from-sky-500/20 via-blue-400/15 to-sky-500/10',
    icon: '💳',
    description: '虚拟货币、记账单位',
  },
  barter: {
    label: 'Barter',
    labelCn: '物物交换',
    color: '#84cc16',
    gradient: 'from-lime-500/20 via-green-400/15 to-lime-500/10',
    icon: '🧇',
    description: '以物易物、实物交换',
  },
};
```

### 4.4 贸易路线类型配色

```typescript
export const TRADE_ROUTE_TYPE_CONFIG = {
  land: {
    label: 'Land',
    labelCn: '陆路',
    color: '#92400e',
    gradient: 'from-amber-700/15 via-orange-600/10 to-amber-700/8',
    icon: '🐫',
    description: '草原丝绸之路、沙漠商道',
  },
  sea: {
    label: 'Sea',
    labelCn: '海路',
    color: '#0369a1',
    gradient: 'from-sky-600/15 via-blue-500/10 to-sky-600/8',
    icon: '⛵',
    description: '海上贸易航线、沿海商路',
  },
  river: {
    label: 'River',
    labelCn: '河运',
    color: '#0d9488',
    gradient: 'from-teal-600/15 via-cyan-500/10 to-teal-600/8',
    icon: '⛵',
    description: '大运河、长江水运、河流运输',
  },
  silk_road: {
    label: 'Silk Road',
    labelCn: '丝绸之路',
    color: '#c9a227',
    gradient: 'from-yellow-600/15 via-amber-500/10 to-orange-600/8',
    icon: '🏺',
    description: '传统丝绸之路贸易网络',
  },
  maritime: {
    label: 'Maritime Silk Road',
    labelCn: '海上丝路',
    color: '#1d4ed8',
    gradient: 'from-blue-600/15 via-indigo-500/10 to-blue-600/8',
    icon: '⚓',
    description: '海上丝绸之路航线',
  },
};
```

### 4.5 经济关系类型配色

```typescript
export const RELATION_TYPE_CONFIG = {
  trade_partner: {
    label: '贸易伙伴',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-500/15',
    lineStyle: 'solid',
    arrow: '⟷',
    icon: '🤝',
  },
  supplier: {
    label: '供应商',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-500/15',
    lineStyle: 'solid',
    arrow: '→',
    icon: '📤',
  },
  consumer: {
    label: '消费者',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-500/15',
    lineStyle: 'solid',
    arrow: '←',
    icon: '📥',
  },
  competitor: {
    label: '竞争者',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-500/15',
    lineStyle: 'dashed',
    arrow: '⇌',
    icon: '⚔️',
  },
  colony: {
    label: '殖民地',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-500/15',
    lineStyle: 'wavy',
    arrow: '→',
    icon: '🏴',
  },
  tribute: {
    label: '朝贡',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-500/15',
    lineStyle: 'wavy',
    arrow: '→',
    icon: '🎁',
  },
  tariff_barrier: {
    label: '关税壁垒',
    color: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-500/15',
    lineStyle: 'dotted',
    arrow: '✕',
    icon: '🚫',
  },
  free_trade: {
    label: '自由贸易',
    color: 'text-cyan-600 dark:text-cyan-400',
    bgColor: 'bg-cyan-500/15',
    lineStyle: 'solid',
    arrow: '⟷',
    icon: '🆓',
  },
};
```

### 4.6 经济等级配色

```typescript
export const LEVEL_CONFIG = {
  global: {
    label: '全球级',
    labelCn: '★★★',
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
  national: {
    label: '国家级',
    labelCn: '★★',
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
  regional: {
    label: '区域级',
    labelCn: '★',
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
  local: {
    label: '地方级',
    labelCn: '○',
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
};
```

---

## 五、后端数据存储方案

### 5.1 数据映射关系

利用现有 `WorldSubmodule` 和 `WorldModuleItem` 结构存储经济数据：

| 字段 | 存储内容 | 格式示例 |
|------|---------|---------|
| `color` | 实体类型 + 等级 | `type:currency:global` |
| `icon` | 资源类型/货币类型 | `resource:mineral:currency:coin` |
| `parent_id` | 从属关系 | 父级实体ID |
| `WorldModuleItem` | 产地关联、关系、详细信息 | 见下方详细说明 |

### 5.2 经济实体存储

```typescript
// WorldSubmodule - 经济实体
{
  id: "uuid-001",
  module_id: "economy_module_id",
  name: "大汉铜钱",
  description: "以铜为主的金属货币，汉代主要流通货币...",
  color: "type:currency:national",
  icon: "currency:coin",
  parent_id: null,
  order_index: 0
}
```

### 5.3 跨模块关联存储

```typescript
// WorldModuleItem - 产地关联
{
  id: "item-001",
  module_id: "economy_module_id",
  submodule_id: "uuid-001",
  name: "productionSites",
  content: {
    "豫章郡铜矿": "map:region_001",
    "会稽郡铜矿": "map:region_002",
    "蜀郡铜矿": "map:region_003"
  }
}

// WorldModuleItem - 政策法规关联
{
  id: "item-002",
  module_id: "economy_module_id",
  submodule_id: "uuid-001",
  name: "politicalPolicies",
  content: {
    "盐铁官营": "politics:policy_001",
    "货币铸造许可": "politics:policy_002"
  }
}

// WorldModuleItem - 种族劳动力关联
{
  id: "item-003",
  module_id: "economy_module_id",
  submodule_id: "uuid-001",
  name: "racialLabor",
  content: {
    "汉族农民": "races:race_001",
    "工匠": "races:race_001"
  }
}
```

### 5.4 经济关系存储

```typescript
// WorldModuleItem - 经济关系
{
  id: "item-004",
  module_id: "economy_module_id",
  submodule_id: "uuid-001",
  name: "relations",
  content: {
    "匈奴皮毛": "supplier:submodule_002:大量:前200年:",
    "罗马银币": "competitor:submodule_003::前100年:",
    "丝绸": "trade_partner:submodule_004:中等:前150年:"
  }
}
// 格式: "目标名称": "关系类型:目标ID:贸易量:开始时间:结束时间"
```

### 5.5 详细信息存储

```typescript
// WorldModuleItem - 铸造工艺
{
  id: "item-005",
  module_id: "economy_module_id",
  submodule_id: "uuid-001",
  name: "铸造工艺",
  content: {
    "材质": "青铜",
    "重量": "3.5克",
    "直径": "25毫米",
    "年号": "五铢钱"
  }
}

// WorldModuleItem - 面值规格
{
  id: "item-006",
  module_id: "economy_module_id",
  submodule_id: "uuid-001",
  name: "面值规格",
  content: {
    "小钱": "一铢",
    "中钱": "五铢",
    "大钱": "十铢"
  }
}
```

### 5.6 贸易路线存储

```typescript
// WorldModuleItem - 贸易路线详情
{
  id: "item-007",
  module_id: "economy_module_id",
  submodule_id: "uuid-trade-001",
  name: "routeDetails",
  content: {
    "起点": "长安",
    "终点": "罗马",
    "主要商品": "丝绸、茶叶、香料",
    "途经国家": "安息、贵霜、大秦"
  }
}

// WorldModuleItem - 贸易量统计
{
  id: "item-008",
  module_id: "economy_module_id",
  submodule_id: "uuid-trade-001",
  name: "tradeVolume",
  content: {
    "年均贸易额": "10000单位",
    "主要商品": "丝绸(60%)、茶叶(25%)、香料(15%)",
    "商队数量": "200支/年"
  }
}
```

---

## 六、交互设计

### 6.1 创建经济实体流程

```
1. 选择实体类型标签页 (货币/商品/资源/贸易路线/经济区/产业)
         ↓
2. 点击 [+ 添加实体] 按钮
         ↓
3. 填写实体信息表单:
   - 名称 (必填)
   - 描述 (可选)
   - 等级 (全球级/国家级/区域级/地方级)
   - 类型特定属性 (如货币类型、资源类型等)
   - 单位 (如枚、匹、吨)
         ↓
4. 提交后自动展开详情编辑
         ↓
5. 添加跨模块关联 (产地、政策法规等)
         ↓
6. 添加经济关系 (供应、贸易伙伴等)
         ↓
7. 添加详细信息条目
```

### 6.2 关系可视化

```
┌─────────────────────────────────────────────────────┐
│  经济关系图谱                                        │
│                                                     │
│      [铁器] ───供应───▶ [武器制造]                  │
│        │                                              │
│       竞争                                            │
│        │                                              │
│        ▼                                              │
│      [铜器] ◀──贸易── [丝绸]                         │
│        │                                              │
│       朝贡                                            │
│        │                                              │
│        ▼                                              │
│   [中央帝国]                                         │
│                                                     │
│  [+ 添加关系]                                        │
└─────────────────────────────────────────────────────┘
```

### 6.3 筛选与搜索

```
┌─────────────────────────────────────────────────────┐
│  🔍 搜索: [________________]                         │
│                                                     │
│  筛选:                                              │
│  ├─ 实体类型: [货币▼] [商品▼] [资源▼]              │
│  ├─ 等级: [●] 全球  [○] 国家  [○] 区域  [○] 地方   │
│  └─ 关联模块: [地图▼] [政治▼] [历史▼] [种族▼]      │
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
│   ├── CrossRefManager.tsx    # 跨模块关联管理
│   ├── EntityForm.tsx         # 实体创建/编辑表单
│   └── FilterPanel.tsx        # 筛选面板
└── hooks/
    ├── useEconomicEntities.ts # 经济实体数据hook
    └── useEconomicRelations.ts# 经济关系hook
```

### 8.2 状态管理

使用 Zustand store 管理经济模块状态：

```typescript
interface EconomyStore {
  activeType: EconomicEntityType;
  setActiveType: (type: EconomicEntityType) => void;

  selectedEntityId: string | null;
  setSelectedEntityId: (id: string | null) => void;

  filters: {
    level?: EconomicLevel;
    resourceType?: ResourceType;
    searchQuery?: string;
  };
  setFilters: (filters: EconomyStore['filters']) => void;
}
```

### 8.3 API 调用

```typescript
// 获取经济模块数据
const { data: module } = useQuery({
  queryKey: ['worldbuilding', 'module', moduleId],
  queryFn: () => worldbuildingApi.getModule(moduleId),
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
    icon: data.entityType === 'currency' ? `currency:${data.currencyType}` :
          data.entityType === 'resource' ? `resource:${data.resourceType}` : undefined,
  }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'submodules', moduleId] });
  },
});

// 添加跨模块关联
const addCrossRefMutation = useMutation({
  mutationFn: (data) => worldbuildingApi.createItem(moduleId, {
    name: data.refType, // 'productionSites' | 'politicalPolicies' | etc.
    content: { [data.itemName]: `${data.moduleType}:${data.itemId}` },
    submodule_id: data.entityId,
  }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'items', moduleId] });
  },
});

// 添加经济关系
const addRelationMutation = useMutation({
  mutationFn: (data) => worldbuildingApi.createItem(moduleId, {
    name: 'relations',
    content: {
      [data.targetName]: `${data.relationType}:${data.targetId}:${data.tradeVolume}:${data.startDate}:${data.endDate}`
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

- 政治界面实现：`frontend/src/components/Worldbuilding/PoliticsView.tsx`（待创建）
- 历史界面实现：`frontend/src/components/Worldbuilding/HistoryView.tsx`
- 世界观主视图：`frontend/src/components/Worldbuilding/WorldbuildingView.tsx`
- 经济模块 API：`frontend/src/services/worldbuildingApi.ts`
- 类型定义：`docs/politics_ui_design.md`

### 9.2 设计风格一致性

经济界面设计遵循以下与政治、历史界面一致的设计原则：

1. **卡片层级**：通过等级（★★★/★★/★/○）区分卡片尺寸和视觉权重
2. **标签页导航**：顶部类型标签页切换不同经济实体类型
3. **展开式详情**：卡片点击展开显示详细信息和关联管理
4. **关系可视化**：使用连线图展示经济实体间的关系
5. **配色体系**：基于实体类型定义主色调，保持视觉一致性
