# 政治界面 UI 设计方案

> LocalScribe 世界观设定 - 政治模块设计文档（v2.0）

---

## 一、概述

### 1.1 设计目标

政治界面作为世界观设定的**核心枢纽模块**，需要实现：

1. **实体管理**：管理国家/政权、组织/势力、人物/领袖、条约/协议四类政治实体
2. **差异化设计**：针对不同实体类型的特性设计专属字段和交互
3. **跨模块关联**：支持与地图、历史、经济、种族、体系等模块的数据关联
4. **关系网络**：可视化展示政治实体间的关系（同盟、敌对、附庸等）
5. **世界观适配**：支持不同世界观（仙侠、科幻、奇幻、现代等）的自定义字段
6. **时间维度**：支持时间线管理，追踪实体和关系的生命周期

### 1.2 核心改进点（v2.0）

| 改进项 | v1.0 问题 | v2.0 解决方案 |
|-------|----------|--------------|
| **实体差异化** | 所有实体使用同一结构 | 四种实体类型各自拥有专属字段 |
| **人物归属** | 人物无"所属"概念 | 人物可归属多个实体，支持角色/职位 |
| **条约参与方** | 条约无"参与者"概念 | 条约支持多方参与，区分角色类型 |
| **世界观适配** | 字段固定，不适应不同世界观 | 引入自定义字段模板系统 |
| **时间维度** | 无时间概念 | 添加成立/消亡时间和关系有效期 |
| **关系方向性** | 关系默认为双向 | 支持对称/非对称关系 |

### 1.3 模块关系图

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
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        政治实体关系                               │   │
│  │  ┌─────────┐    所属    ┌─────────┐    参与    ┌─────────┐      │   │
│  │  │  人物   │───────────▶│国家/组织│◀───────────│  条约   │      │   │
│  │  └─────────┘            └─────────┘            └─────────┘      │   │
│  │       │                     │                      │            │   │
│  │       └─────────────────────┴──────────────────────┘            │   │
│  │                         关系网络                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 二、数据结构设计

### 2.1 基础类型定义

```typescript
// 政治实体类型
export type PoliticalEntityType = 
  | 'nation'       // 国家/政权
  | 'organization' // 组织/势力
  | 'leader'       // 人物/领袖
  | 'treaty';      // 条约/协议

// 实力等级
export type EntityLevel = 
  | 'superpower'   // 超级大国/顶级势力
  | 'major'        // 主要势力/重要人物
  | 'regional'     // 地区势力/知名人物
  | 'local';       // 地方势力/普通人物

// 实体状态
export type EntityStatus = 
  | 'active'       // 活跃/存续
  | 'dissolved'    // 已消亡/解散
  | 'suspended';   // 暂停/潜伏

// 政治立场（九宫格）
export type PoliticalAlignment = 
  | 'lawful-good' | 'neutral-good' | 'chaotic-good'
  | 'lawful-neutral' | 'true-neutral' | 'chaotic-neutral'
  | 'lawful-evil' | 'neutral-evil' | 'chaotic-evil';

// 政治体制类型
export type GovernmentType = 
  | 'monarchy' | 'republic' | 'theocracy' | 'oligarchy'
  | 'democracy' | 'dictatorship' | 'feudal' | 'tribal';

// 关系类型
export type RelationType = 
  | 'alliance'   // 同盟
  | 'vassal'     // 附庸（非对称：A是B的附庸）
  | 'suzerain'   // 宗主（非对称：A是B的宗主）
  | 'enemy'      // 敌对
  | 'neutral'    // 中立
  | 'trade'      // 贸易伙伴
  | 'cultural'   // 文化交流
  | 'religious'  // 宗教关联
  | 'personal';  // 个人关系（师徒、亲属等）

// 条约参与方角色
export type ParticipantRole = 
  | 'signatory'   // 签署方
  | 'beneficiary' // 受益方
  | 'guarantor'   // 担保方
  | 'mediator';   // 调解方

// 跨模块引用
export type CrossModuleType = 'map' | 'history' | 'economy' | 'races' | 'systems' | 'special';

export interface CrossModuleReference {
  module_type: CrossModuleType;
  item_id: string;
  item_name: string;
  relation_description?: string;
}
```

### 2.2 自定义字段系统

```typescript
// 自定义字段类型
export type CustomFieldType = 
  | 'text'        // 单行文本
  | 'textarea'    // 多行文本
  | 'number'      // 数字
  | 'select'      // 单选
  | 'multiselect' // 多选
  | 'date'        // 日期
  | 'datetime'    // 日期时间
  | 'color'       // 颜色选择
  | 'relation';   // 关联其他实体

// 自定义字段定义
export interface CustomFieldDefinition {
  id: string;
  name: string;           // 字段名称（如"修炼境界"）
  key: string;            // 字段键名（如"cultivation_level"）
  type: CustomFieldType;
  options?: string[];     // 对于select/multiselect的选项
  required?: boolean;
  defaultValue?: any;
  description?: string;
  order_index: number;
}

// 世界观模板
export interface WorldviewTemplate {
  id: string;
  name: string;           // 如"仙侠修真"、"星际科幻"、"中世纪奇幻"
  description: string;
  fields: {
    nation: CustomFieldDefinition[];
    organization: CustomFieldDefinition[];
    leader: CustomFieldDefinition[];
    treaty: CustomFieldDefinition[];
  };
  relationTypes: {
    id: string;
    name: string;
    symmetric: boolean;   // 是否对称关系
    reverseName?: string; // 反向关系名称（如"附庸"的反向是"宗主"）
  }[];
}

// 预置世界观模板示例
export const PRESET_TEMPLATES: WorldviewTemplate[] = [
  {
    id: 'xianxia',
    name: '仙侠修真',
    description: '修仙、门派、境界体系',
    fields: {
      nation: [
        { id: 'f1', name: '修真等级', key: 'cultivation_level', type: 'select', 
          options: ['凡人', '炼气', '筑基', '金丹', '元婴', '化神', '合体', '大乘'], order_index: 0 },
        { id: 'f2', name: '灵气浓度', key: 'spirit_density', type: 'select',
          options: ['稀薄', '一般', '浓郁', '洞天福地'], order_index: 1 },
      ],
      organization: [
        { id: 'f3', name: '门派类型', key: 'sect_type', type: 'select',
          options: ['正道', '魔道', '中立', '散修联盟'], order_index: 0 },
        { id: 'f4', name: '镇派功法', key: 'signature_method', type: 'text', order_index: 1 },
        { id: 'f5', name: '护山大阵', key: 'guardian_formation', type: 'text', order_index: 2 },
      ],
      leader: [
        { id: 'f6', name: '修为境界', key: 'realm', type: 'select',
          options: ['炼气期', '筑基期', '金丹期', '元婴期', '化神期', '合体期', '大乘期', '渡劫期'], order_index: 0 },
        { id: 'f7', name: '灵根属性', key: 'spirit_root', type: 'multiselect',
          options: ['金', '木', '水', '火', '土', '雷', '冰', '风', '光', '暗'], order_index: 1 },
        { id: 'f8', name: '寿元', key: 'lifespan', type: 'number', order_index: 2 },
      ],
      treaty: [
        { id: 'f9', name: '契约类型', key: 'contract_type', type: 'select',
          options: ['血誓', '天道契约', '普通盟约', '主仆契约'], order_index: 0 },
        { id: 'f10', name: '违约惩罚', key: 'penalty', type: 'textarea', order_index: 1 },
      ],
    },
    relationTypes: [
      { id: 'master_disciple', name: '师徒', symmetric: false, reverseName: '弟子' },
      { id: 'dao_companion', name: '道侣', symmetric: true },
    ],
  },
  {
    id: 'scifi',
    name: '星际科幻',
    description: '星际文明、科技等级、外星种族',
    fields: {
      nation: [
        { id: 'f11', name: '科技等级', key: 'tech_level', type: 'select',
          options: ['I型文明', 'II型文明', 'III型文明', 'IV型文明'], order_index: 0 },
        { id: 'f12', name: '统治星系', key: 'controlled_systems', type: 'number', order_index: 1 },
        { id: 'f13', name: '主要种族', key: 'dominant_species', type: 'text', order_index: 2 },
      ],
      organization: [
        { id: 'f14', name: '组织性质', key: 'org_nature', type: 'select',
          options: ['军事', '商业', '科研', '海盗', '宗教', '情报'], order_index: 0 },
        { id: 'f15', name: '势力范围（光年）', key: 'influence_range', type: 'number', order_index: 1 },
      ],
      leader: [
        { id: 'f16', name: '种族', key: 'species', type: 'text', order_index: 0 },
        { id: 'f17', name: '基因改造等级', key: 'genetic_level', type: 'select',
          options: ['无', '基础', '进阶', '完美'], order_index: 1 },
        { id: 'f18', name: '义体化程度', key: 'cybernetic_percent', type: 'number', order_index: 2 },
      ],
      treaty: [
        { id: 'f19', name: '条约范围', key: 'treaty_scope', type: 'select',
          options: ['星系级', '星区级', '文明级', '星际联盟级'], order_index: 0 },
        { id: 'f20', name: 'AI仲裁', key: 'ai_arbitration', type: 'select',
          options: ['无', '辅助', '主导'], order_index: 1 },
      ],
    },
    relationTypes: [
      { id: 'trade_route', name: '贸易航线', symmetric: true },
      { id: 'tech_sharing', name: '技术共享', symmetric: true },
    ],
  },
];
```

### 2.3 实体接口定义

```typescript
// 政治实体基础接口（所有类型共有）
export interface PoliticalEntityBase {
  id: string;
  name: string;
  description?: string;
  level: EntityLevel;
  color?: string;
  icon?: string;
  order_index: number;
  
  // 时间维度
  foundedAt?: string;       // 成立/出生/签署时间
  dissolvedAt?: string;     // 消亡/死亡/失效时间
  status: EntityStatus;
  
  // 通用扩展
  tags: string[];           // 自定义标签
  customFields: Record<string, any>;  // 自定义字段值
  
  // 跨模块关联
  territories?: CrossModuleReference[];       // 领土（地图）
  historicalEvents?: CrossModuleReference[];  // 历史事件
  economicTies?: CrossModuleReference[];      // 经济关联
  racialComposition?: CrossModuleReference[]; // 种族构成
  systemTies?: CrossModuleReference[];        // 体系关联（修炼/魔法/科技）
}

// ==================== 国家/政权 ====================
export interface NationEntity extends PoliticalEntityBase {
  entityType: 'nation';
  
  // 政治属性
  alignment?: PoliticalAlignment;
  governmentType?: GovernmentType;
  
  // 地理与行政
  capital?: string;                     // 首都/首府
  territorySize?: string;               // 领土面积/范围
  
  // 关联（反向查询）
  memberOrganizations?: string[];       // 境内组织ID列表
  memberLeaders?: string[];             // 所属人物ID列表
  relatedTreaties?: string[];           // 相关条约ID列表
}

// ==================== 组织/势力 ====================
export interface OrganizationEntity extends PoliticalEntityBase {
  entityType: 'organization';
  
  // 政治属性
  alignment?: PoliticalAlignment;
  organizationType?: string;            // 组织类型（门派/公会/公司/家族等）
  
  // 层级关系
  parentOrganizationId?: string;        // 上级组织
  subOrganizationIds?: string[];        // 下属组织
  
  // 所属
  affiliatedNationId?: string;          // 所属国家（如果有）
  headquarters?: string;                // 总部位置
  
  // 关联（反向查询）
  memberLeaders?: string[];             // 成员人物ID列表
  relatedTreaties?: string[];           // 相关条约ID列表
}

// ==================== 人物/领袖 ====================
export interface Affiliation {
  entityId: string;
  entityType: 'nation' | 'organization';
  entityName: string;
  role?: string;                        // 职位/角色（如"皇帝"、"长老"、"将军"）
  startDate?: string;                   // 任职开始时间
  endDate?: string;                     // 任职结束时间
  isPrimary: boolean;                   // 是否为主要归属
  description?: string;                 // 额外说明
}

export interface LeaderEntity extends PoliticalEntityBase {
  entityType: 'leader';
  
  // 核心：所属关系（可多个）
  affiliations: Affiliation[];
  
  // 个人属性
  personalAlignment?: PoliticalAlignment;
  birthPlace?: string;                  // 出生地
  
  // 统计（反向查询）
  relatedTreaties?: string[];           // 签署/参与的条约
  personalRelations?: PoliticalRelation[]; // 个人关系（师徒、亲属等）
}

// ==================== 条约/协议 ====================
export interface TreatyParticipant {
  entityId: string;
  entityType: PoliticalEntityType;
  entityName: string;
  role: ParticipantRole;                // 参与角色
  signatureDate?: string;               // 签署时间
  withdrawalDate?: string;              // 退出时间
}

export interface TreatyTerm {
  id: string;
  order_index: number;
  title: string;
  content: string;
}

export interface TreatyEntity extends PoliticalEntityBase {
  entityType: 'treaty';
  
  // 核心：多方参与者
  participants: TreatyParticipant[];
  
  // 条约属性
  treatyType: string;                   // 条约类型（和平/贸易/军事同盟等）
  
  // 条款
  terms: TreatyTerm[];
  
  // 有效期
  effectiveDate?: string;               // 生效日期
  expiryDate?: string;                  // 到期日期
  
  // 状态
  isExpired: boolean;
  isBroken: boolean;                    // 是否已被违约
}

// 联合类型
export type PoliticalEntity = NationEntity | OrganizationEntity | LeaderEntity | TreatyEntity;
```

### 2.4 关系定义

```typescript
// 政治关系
export interface PoliticalRelation {
  id: string;
  sourceId: string;                     // 源实体ID
  sourceName: string;
  sourceType: PoliticalEntityType;
  targetId: string;                     // 目标实体ID
  targetName: string;
  targetType: PoliticalEntityType;
  
  relationType: RelationType;
  isSymmetric: boolean;                 // 是否对称关系
  
  // 时间维度
  startDate?: string;
  endDate?: string;
  
  // 强度/等级
  strength?: number;                    // 关系强度 1-10
  
  // 描述
  description?: string;
}

// 关系配置
export interface RelationTypeConfig {
  id: RelationType;
  label: string;
  symmetric: boolean;
  reverseLabel?: string;                // 非对称关系的反向标签
  color: string;
  bgColor: string;
  line: 'solid' | 'dashed' | 'dotted' | 'double';
  icon: string;
  allowBetween: PoliticalEntityType[][]; // 允许建立关系的实体类型组合
}

export const RELATION_TYPE_CONFIG: Record<RelationType, RelationTypeConfig> = {
  alliance: {
    id: 'alliance',
    label: '同盟',
    symmetric: true,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-500/15',
    line: 'solid',
    icon: '🤝',
    allowBetween: [['nation', 'nation'], ['organization', 'organization'], 
                   ['nation', 'organization'], ['leader', 'leader']],
  },
  vassal: {
    id: 'vassal',
    label: '附庸',
    symmetric: false,
    reverseLabel: '宗主',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-500/15',
    line: 'dashed',
    icon: '🏳️',
    allowBetween: [['nation', 'nation'], ['organization', 'organization'],
                   ['organization', 'nation']],
  },
  suzerain: {
    id: 'suzerain',
    label: '宗主',
    symmetric: false,
    reverseLabel: '附庸',
    color: 'text-amber-700 dark:text-amber-300',
    bgColor: 'bg-amber-600/15',
    line: 'dashed',
    icon: '👑',
    allowBetween: [['nation', 'nation'], ['organization', 'organization'],
                   ['nation', 'organization']],
  },
  enemy: {
    id: 'enemy',
    label: '敌对',
    symmetric: true,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-500/15',
    line: 'double',
    icon: '⚔️',
    allowBetween: [['nation', 'nation'], ['organization', 'organization'],
                   ['leader', 'leader'], ['nation', 'organization']],
  },
  neutral: {
    id: 'neutral',
    label: '中立',
    symmetric: true,
    color: 'text-slate-500 dark:text-slate-400',
    bgColor: 'bg-slate-500/15',
    line: 'dotted',
    icon: '⚪',
    allowBetween: [['nation', 'nation'], ['organization', 'organization'],
                   ['nation', 'organization']],
  },
  trade: {
    id: 'trade',
    label: '贸易伙伴',
    symmetric: true,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-500/15',
    line: 'solid',
    icon: '💰',
    allowBetween: [['nation', 'nation'], ['organization', 'organization'],
                   ['nation', 'organization']],
  },
  cultural: {
    id: 'cultural',
    label: '文化交流',
    symmetric: true,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-500/15',
    line: 'solid',
    icon: '🎭',
    allowBetween: [['nation', 'nation'], ['organization', 'organization']],
  },
  religious: {
    id: 'religious',
    label: '宗教关联',
    symmetric: true,
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-500/15',
    line: 'solid',
    icon: '⛪',
    allowBetween: [['nation', 'organization'], ['organization', 'organization']],
  },
  personal: {
    id: 'personal',
    label: '个人关系',
    symmetric: false,
    color: 'text-pink-600 dark:text-pink-400',
    bgColor: 'bg-pink-500/15',
    line: 'solid',
    icon: '💕',
    allowBetween: [['leader', 'leader']],
  },
};
```

---

## 三、UI 布局设计

### 3.1 主界面布局

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  [国家] [组织] [领袖] [条约]    [🔍 搜索...] [筛选▼] [模板▼]    [+ 添加实体]    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────┐ │
│  │ 🏛️ 大汉帝国                                          [编辑] [删除]        │ │
│  │ ════════════════════════════════════════════════════════════════════════  │ │
│  │ 等级: ★★★ 超级大国  |  体制: 君主制  |  立场: 守序中立  |  状态: 存续      │ │
│  │ 时间: 前202年 - 220年                                                      │ │
│  │                                                                            │ │
│  │ ┌──────────────────────────────────────────────────────────────────────┐  │ │
│  │ │ 📍 领土关联                                                          │  │ │
│  │ │   中原地区 · 江南地区 · 西域都护府 · 辽东郡  [+ 添加地区]             │  │ │
│  │ └──────────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                            │ │
│  │ ┌──────────────────────────────────────────────────────────────────────┐  │ │
│  │ │ 👤 所属人物 (12)                                                     │  │ │
│  │ │   刘邦(皇帝) · 韩信(大将军) · 萧何(丞相) ... [查看全部]               │  │ │
│  │ └──────────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                            │ │
│  │ ┌──────────────────────────────────────────────────────────────────────┐  │ │
│  │ │ 🤝 政治关系                                                          │  │ │
│  │ │   大汉帝国 ──同盟──▶ 南越国                                          │  │ │
│  │ │   大汉帝国 ══敌对══▶ 匈奴汗国                                        │  │ │
│  │ │   [+ 添加关系]                                                        │  │ │
│  │ └──────────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                            │ │
│  │ ┌──────────────────────────────────────────────────────────────────────┐  │ │
│  │ │ 📊 详细信息                                                          │  │ │
│  │ │   [政治体制] [军事力量] [经济状况] [种族构成] [+ 添加]                │  │ │
│  │ └──────────────────────────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────┐ │
│  │ 👤 刘邦 - 大汉帝国皇帝                                                  │ │
│  │ ════════════════════════════════════════════════════════════════════════  │ │
│  │ 等级: ★★★ 重要人物  |  立场: 守序善良  |  状态: 已逝世                  │ │
│  │ 时间: 前256年 - 前195年                                                    │ │
│  │                                                                            │ │
│  │ ┌──────────────────────────────────────────────────────────────────────┐  │ │
│  │ │ 🏛️ 所属关系                                                          │  │ │
│  │ │   大汉帝国 · 皇帝 · 前202年-前195年 [主要]                            │  │ │
│  │ │   沛县集团 · 领袖 · 前209年-前202年                                   │  │ │
│  │ │   [+ 添加所属]                                                        │  │ │
│  │ └──────────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                            │ │
│  │ ┌──────────────────────────────────────────────────────────────────────┐  │ │
│  │ │ 📜 自定义字段                                                        │  │ │
│  │ │   修为境界: 凡人                                                      │  │ │
│  │ │   灵根属性: 无                                                        │  │ │
│  │ └──────────────────────────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────┐ │
│  │ 📜 汉匈和亲条约                                                         │ │
│  │ ════════════════════════════════════════════════════════════════════════  │ │
│  │ 类型: 和平条约  |  状态: 已失效                                          │ │
│  │ 时间: 前200年 - 前133年                                                    │ │
│  │                                                                            │ │
│  │ ┌──────────────────────────────────────────────────────────────────────┐  │ │
│  │ │ 🏛️ 参与方                                                            │  │ │
│  │ │   大汉帝国 · 签署方                                                   │  │ │
│  │ │   匈奴汗国 · 签署方                                                   │  │ │
│  │ └──────────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                            │ │
│  │ ┌──────────────────────────────────────────────────────────────────────┐  │ │
│  │ │ 📋 条约条款                                                          │  │ │
│  │ │   1. 汉朝每年向匈奴进贡丝绸、粮食...                                  │  │ │
│  │ │   2. 双方开放边境贸易...                                              │  │ │
│  │ │   [展开全部 5 条]                                                     │  │ │
│  │ └──────────────────────────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 卡片设计规格

| 实体类型 | 图标 | 主色调 | 专属区域 | 卡片样式 |
|---------|------|--------|---------|---------|
| 国家/政权 | 🏛️ | 金色 `#c9a227` | 所属人物列表、境内组织 | 大卡片，渐变背景 |
| 组织/势力 | ⚔️ | 红色 `#b91c1c` | 成员列表、上级/下属组织 | 中卡片，强调边框 |
| 人物/领袖 | 👤 | 蓝色 `#2563eb` | 所属关系（可多个）、个人关系 | 中卡片，头像区域 |
| 条约/协议 | 📜 | 绿色 `#059669` | 参与方列表、条款内容 | 小卡片，简洁布局 |

### 3.3 等级与状态标识

```typescript
// 等级配置
export const ENTITY_LEVEL_CONFIG: Record<EntityLevel, {
  label: string;
  stars: string;
  cardWidth: string;
  priority: number;
}> = {
  superpower: { label: '超级大国', stars: '★★★', cardWidth: '100%', priority: 4 },
  major: { label: '主要势力', stars: '★★', cardWidth: '50%', priority: 3 },
  regional: { label: '地区势力', stars: '★', cardWidth: '33%', priority: 2 },
  local: { label: '地方势力', stars: '○', cardWidth: '25%', priority: 1 },
};

// 状态标识
export const ENTITY_STATUS_CONFIG: Record<EntityStatus, {
  label: string;
  color: string;
  badge: string;
}> = {
  active: { label: '存续', color: 'text-green-600', badge: '🟢' },
  dissolved: { label: '已消亡', color: 'text-gray-500', badge: '⚫' },
  suspended: { label: '暂停', color: 'text-yellow-600', badge: '🟡' },
};
```

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

---

## 五、后端数据存储方案

### 5.1 数据映射关系

利用现有 `WorldSubmodule` 和 `WorldModuleItem` 结构存储政治数据：

| 字段 | 存储内容 | 格式示例 |
|------|---------|---------|
| `WorldSubmodule.color` | 实体类型 + 等级 + 状态 | `type:nation:superpower:active` |
| `WorldSubmodule.icon` | 立场 + 体制/类型 | `alignment:lawful-neutral:government:monarchy` |
| `WorldSubmodule.parent_id` | 层级关系（组织上级） | 父组织ID |
| `WorldSubmodule.description` | 基础描述 + 时间信息 | JSON格式存储 |

### 5.2 政治实体存储

```typescript
// WorldSubmodule - 国家/政权
{
  id: "nation-001",
  module_id: "politics_module_id",
  name: "大汉帝国",
  description: JSON.stringify({
    text: "统一六国后建立的中央集权帝国...",
    foundedAt: "-202-01-01",
    dissolvedAt: "220-01-01",
    capital: "长安",
    territorySize: "约600万平方公里"
  }),
  color: "type:nation:superpower:active",
  icon: "alignment:lawful-neutral:government:monarchy",
  parent_id: null,
  order_index: 0
}

// WorldSubmodule - 人物/领袖
{
  id: "leader-001",
  module_id: "politics_module_id",
  name: "刘邦",
  description: JSON.stringify({
    text: "汉朝开国皇帝...",
    foundedAt: "-256-01-01",
    dissolvedAt: "-195-06-01",
    birthPlace: "沛县"
  }),
  color: "type:leader:major:dissolved",
  icon: "alignment:lawful-good",
  parent_id: null,
  order_index: 0
}

// WorldSubmodule - 条约/协议
{
  id: "treaty-001",
  module_id: "politics_module_id",
  name: "汉匈和亲条约",
  description: JSON.stringify({
    text: "汉朝与匈奴之间的和平条约...",
    foundedAt: "-200-01-01",
    dissolvedAt: "-133-01-01",
    treatyType: "和平条约",
    isExpired: true,
    isBroken: true
  }),
  color: "type:treaty:regional:dissolved",
  icon: "treatyType:peace",
  parent_id: null,
  order_index: 0
}
```

### 5.3 所属关系存储（人物）

```typescript
// WorldModuleItem - 人物所属关系
{
  id: "item-aff-001",
  module_id: "politics_module_id",
  submodule_id: "leader-001",  // 刘邦
  name: "affiliations",
  content: {
    "affiliation_0": JSON.stringify({
      entityId: "nation-001",
      entityType: "nation",
      entityName: "大汉帝国",
      role: "皇帝",
      startDate: "-202-01-01",
      endDate: "-195-06-01",
      isPrimary: true
    }),
    "affiliation_1": JSON.stringify({
      entityId: "org-001",
      entityType: "organization",
      entityName: "沛县集团",
      role: "领袖",
      startDate: "-209-01-01",
      endDate: "-202-01-01",
      isPrimary: false
    })
  }
}
```

### 5.4 参与方存储（条约）

```typescript
// WorldModuleItem - 条约参与方
{
  id: "item-part-001",
  module_id: "politics_module_id",
  submodule_id: "treaty-001",  // 汉匈和亲条约
  name: "participants",
  content: {
    "participant_0": JSON.stringify({
      entityId: "nation-001",
      entityType: "nation",
      entityName: "大汉帝国",
      role: "signatory",
      signatureDate: "-200-01-01"
    }),
    "participant_1": JSON.stringify({
      entityId: "nation-002",
      entityType: "nation",
      entityName: "匈奴汗国",
      role: "signatory",
      signatureDate: "-200-01-01"
    })
  }
}
```

### 5.5 条约条款存储

```typescript
// WorldModuleItem - 条约条款
{
  id: "item-terms-001",
  module_id: "politics_module_id",
  submodule_id: "treaty-001",
  name: "terms",
  content: {
    "term_0": JSON.stringify({
      id: "term-0",
      order_index: 0,
      title: "进贡条款",
      content: "汉朝每年向匈奴进贡丝绸、粮食..."
    }),
    "term_1": JSON.stringify({
      id: "term-1",
      order_index: 1,
      title: "贸易条款",
      content: "双方开放边境贸易..."
    })
  }
}
```

### 5.6 自定义字段存储

```typescript
// WorldModuleItem - 自定义字段值
{
  id: "item-custom-001",
  module_id: "politics_module_id",
  submodule_id: "leader-001",
  name: "custom_fields",
  content: {
    "realm": "凡人",
    "spirit_root": "无",
    "lifespan": "62"
  }
}
```

### 5.7 政治关系存储

```typescript
// WorldModuleItem - 政治关系
{
  id: "item-rel-001",
  module_id: "politics_module_id",
  submodule_id: "nation-001",  // 大汉帝国
  name: "relations",
  content: {
    "relation_0": JSON.stringify({
      id: "rel-0",
      sourceId: "nation-001",
      sourceName: "大汉帝国",
      sourceType: "nation",
      targetId: "nation-003",
      targetName: "南越国",
      targetType: "nation",
      relationType: "alliance",
      isSymmetric: true,
      startDate: "-196-01-01",
      strength: 7,
      description: "政治同盟关系"
    }),
    "relation_1": JSON.stringify({
      id: "rel-1",
      sourceId: "nation-001",
      sourceName: "大汉帝国",
      sourceType: "nation",
      targetId: "nation-004",
      targetName: "匈奴汗国",
      targetType: "nation",
      relationType: "enemy",
      isSymmetric: true,
      startDate: "-200-01-01",
      endDate: "-100-01-01",
      strength: 9,
      description: "长期军事对抗"
    })
  }
}
```

### 5.8 跨模块关联存储

```typescript
// WorldModuleItem - 领土关联
{
  id: "item-terr-001",
  module_id: "politics_module_id",
  submodule_id: "nation-001",
  name: "territories",
  content: {
    "中原地区": "map:region_001",
    "江南地区": "map:region_002",
    "西域都护府": "map:region_003"
  }
}

// WorldModuleItem - 历史事件关联
{
  id: "item-hist-001",
  module_id: "politics_module_id",
  submodule_id: "nation-001",
  name: "historicalEvents",
  content: {
    "楚汉争霸": "history:event_001",
    "汉武帝北伐": "history:event_002"
  }
}
```

---

## 六、组件结构

### 6.1 文件结构

```
PoliticsView/
├── index.ts                           # 导出入口
├── types.ts                           # 类型定义
├── config.ts                          # 配置（颜色、图标、样式）
├── templates.ts                       # 世界观模板定义
├── PoliticsView.tsx                   # 主组件
├── EntityCard.tsx                     # 实体卡片组件
├── NationCard.tsx                     # 国家/政权卡片
├── OrganizationCard.tsx               # 组织/势力卡片
├── LeaderCard.tsx                     # 人物/领袖卡片
├── TreatyCard.tsx                     # 条约/协议卡片
├── EntityLevelBadge.tsx               # 等级徽章组件
├── StatusBadge.tsx                    # 状态徽章组件
├── AlignmentBadge.tsx                 # 立场徽章组件
├── AffiliationSection.tsx             # 所属关系区块（人物）
├── ParticipantSection.tsx             # 参与方区块（条约）
├── MemberSection.tsx                  # 成员区块（国家/组织）
├── CrossModuleSection.tsx             # 跨模块关联区块
├── RelationSection.tsx                # 政治关系区块
├── CustomFieldsSection.tsx            # 自定义字段区块
├── TreatyTermsSection.tsx             # 条约条款区块
├── PoliticsSkeleton.tsx               # 加载骨架屏
└── modals/
    ├── index.ts
    ├── AddEntityModal.tsx             # 添加实体弹窗
    ├── EditEntityModal.tsx            # 编辑实体弹窗
    ├── AddAffiliationModal.tsx        # 添加所属关系弹窗
    ├── AddParticipantModal.tsx        # 添加参与方弹窗
    ├── AddRelationModal.tsx           # 添加关系弹窗
    ├── AddCrossModuleRefModal.tsx     # 添加跨模块关联弹窗
    ├── AddTreatyTermModal.tsx         # 添加条约条款弹窗
    ├── TemplateSelectorModal.tsx      # 世界观模板选择弹窗
    └── CustomFieldEditorModal.tsx     # 自定义字段编辑器
```

### 6.2 组件职责

| 组件 | 职责 |
|------|------|
| `PoliticsView` | 主容器，管理状态、数据获取、筛选逻辑、模板切换 |
| `EntityCard` | 实体卡片基类，处理通用展示逻辑 |
| `NationCard` | 国家卡片，展示领土、所属人物、境内组织 |
| `OrganizationCard` | 组织卡片，展示成员、上级/下属组织 |
| `LeaderCard` | 人物卡片，展示所属关系（可多个）、个人关系 |
| `TreatyCard` | 条约卡片，展示参与方、条款、有效期 |
| `AffiliationSection` | 管理人物的所属关系（添加/编辑/删除） |
| `ParticipantSection` | 管理条约的参与方（添加/编辑/删除） |
| `MemberSection` | 展示国家/组织的成员（反向查询） |
| `CustomFieldsSection` | 展示和编辑自定义字段值 |
| `TreatyTermsSection` | 展示和管理条约条款 |

---

## 七、交互设计

### 7.1 核心交互

| 功能 | 描述 | 实现方式 |
|------|------|---------|
| **类型筛选** | 顶部标签页切换实体类型 | Tab 组件 |
| **模板切换** | 切换世界观模板（仙侠/科幻等） | Dropdown |
| **搜索过滤** | 按名称、等级、立场、时间搜索 | 搜索框 + 过滤逻辑 |
| **所属管理** | 为人物添加/编辑/删除所属 | Modal + 实体选择器 |
| **参与方管理** | 为条约添加/编辑/删除参与方 | Modal + 实体选择器 |
| **关系管理** | 添加/编辑/删除政治关系 | Modal + 表单 |
| **条款管理** | 添加/编辑/删除条约条款 | 内联编辑 + Modal |
| **自定义字段** | 编辑世界观特定的字段 | 动态表单 |
| **跳转功能** | 点击关联跳转到对应模块 | 路由导航 |

### 7.2 交互流程

#### 添加政治实体

```
点击"添加实体" → 选择实体类型 → 选择世界观模板 
→ 填写基础信息（名称、时间、等级）
→ 填写模板特定字段
→ 保存
```

#### 为人物添加所属

```
在人物卡片点击"添加所属" → 选择实体类型（国家/组织）
→ 从列表选择实体 → 填写角色/职位
→ 填写任职时间范围 → 标记是否为主要归属
→ 保存
```

#### 创建条约

```
点击"添加实体" → 选择"条约/协议"类型
→ 填写条约名称、类型、有效期
→ 添加参与方（选择实体 + 角色）
→ 添加条款
→ 保存
```

#### 添加政治关系

```
点击"添加关系" → 选择目标实体
→ 选择关系类型（自动判断是否允许）
→ 填写时间范围、强度、描述
→ 保存（如果是非对称关系，询问是否创建反向关系）
```

---

## 八、API 调用

### 8.1 数据获取

```typescript
// 获取政治模块的子模块（政治实体）
const { data: submodules } = useQuery({
  queryKey: ['worldbuilding', 'submodules', moduleId, { type: selectedType }],
  queryFn: () => worldbuildingApi.getSubmodules(moduleId, { 
    filters: { entityType: selectedType }
  }),
});

// 获取政治模块的所有条目（关联、关系、详细信息）
const { data: items } = useQuery({
  queryKey: ['worldbuilding', 'items', moduleId],
  queryFn: () => worldbuildingApi.getItems(moduleId, { include_all: true }),
});

// 获取人物所属关系
const { data: affiliations } = useQuery({
  queryKey: ['worldbuilding', 'affiliations', leaderId],
  queryFn: () => worldbuildingApi.getItems(moduleId, { 
    submodule_id: leaderId,
    name: 'affiliations'
  }),
});

// 获取条约参与方
const { data: participants } = useQuery({
  queryKey: ['worldbuilding', 'participants', treatyId],
  queryFn: () => worldbuildingApi.getItems(moduleId, {
    submodule_id: treatyId,
    name: 'participants'
  }),
});
```

### 8.2 数据操作

```typescript
// 创建政治实体
const createEntityMutation = useMutation({
  mutationFn: (data: CreateEntityData) => worldbuildingApi.createSubmodule(moduleId, {
    name: data.name,
    description: JSON.stringify({
      text: data.description,
      foundedAt: data.foundedAt,
      dissolvedAt: data.dissolvedAt,
      ...data.typeSpecificFields
    }),
    color: `type:${data.entityType}:${data.level}:${data.status}`,
    icon: `alignment:${data.alignment}:${data.entityType === 'nation' ? 'government:' + data.governmentType : 'type:' + data.organizationType}`,
  }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'submodules', moduleId] });
  },
});

// 添加人物所属关系
const addAffiliationMutation = useMutation({
  mutationFn: (data: AddAffiliationData) => worldbuildingApi.createItem(moduleId, {
    name: 'affiliations',
    content: {
      [generateId()]: JSON.stringify({
        entityId: data.entityId,
        entityType: data.entityType,
        entityName: data.entityName,
        role: data.role,
        startDate: data.startDate,
        endDate: data.endDate,
        isPrimary: data.isPrimary
      })
    },
    submodule_id: data.leaderId,
  }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'affiliations'] });
  },
});

// 添加条约参与方
const addParticipantMutation = useMutation({
  mutationFn: (data: AddParticipantData) => worldbuildingApi.createItem(moduleId, {
    name: 'participants',
    content: {
      [generateId()]: JSON.stringify({
        entityId: data.entityId,
        entityType: data.entityType,
        entityName: data.entityName,
        role: data.role,
        signatureDate: data.signatureDate
      })
    },
    submodule_id: data.treatyId,
  }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'participants'] });
  },
});

// 添加条约条款
const addTreatyTermMutation = useMutation({
  mutationFn: (data: AddTreatyTermData) => worldbuildingApi.createItem(moduleId, {
    name: 'terms',
    content: {
      [generateId()]: JSON.stringify({
        id: generateId(),
        order_index: data.orderIndex,
        title: data.title,
        content: data.content
      })
    },
    submodule_id: data.treatyId,
  }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'terms'] });
  },
});

// 添加政治关系
const addRelationMutation = useMutation({
  mutationFn: (data: AddRelationData) => worldbuildingApi.createItem(moduleId, {
    name: 'relations',
    content: {
      [generateId()]: JSON.stringify({
        id: generateId(),
        sourceId: data.sourceId,
        sourceName: data.sourceName,
        sourceType: data.sourceType,
        targetId: data.targetId,
        targetName: data.targetName,
        targetType: data.targetType,
        relationType: data.relationType,
        isSymmetric: data.isSymmetric,
        startDate: data.startDate,
        endDate: data.endDate,
        strength: data.strength,
        description: data.description
      })
    },
    submodule_id: data.sourceId,
  }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'relations'] });
  },
});
```

---

## 九、其他注意事项

### 9.1 关系方向性处理

```typescript
// 非对称关系处理示例
// 当A是B的附庸时：
// - A的关系列表显示：A ──附庸──▶ B
// - B的关系列表显示：B ──宗主──▶ A

// 创建非对称关系时，需要：
// 1. 在源实体创建关系记录
// 2. 在目标实体创建反向关系记录（如果关系配置有reverseLabel）
// 3. 确保删除时同时删除双向记录
```

### 9.2 循环归属检测

```typescript
// 防止循环归属（A属于B，B属于C，C属于A）
function detectCircularAffiliation(
  leaderId: string, 
  targetEntityId: string,
  allAffiliations: Map<string, string[]>
): boolean {
  const visited = new Set<string>();
  const queue = [targetEntityId];
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === leaderId) return true; // 发现循环
    if (visited.has(current)) continue;
    visited.add(current);
    
    const members = allAffiliations.get(current) || [];
    queue.push(...members);
  }
  return false;
}
```

### 9.3 时间线一致性

```typescript
// 验证时间线一致性
// - 人物任职时间不能早于人物出生时间
// - 人物任职时间不能晚于人物死亡时间
// - 条约有效期不能早于签署日期
// - 关系有效期应在双方存续期间

interface TimeValidation {
  isValid: boolean;
  errors: string[];
}

function validateTimeline(entity: PoliticalEntity): TimeValidation {
  const errors: string[] = [];
  
  if (entity.entityType === 'leader') {
    const leader = entity as LeaderEntity;
    for (const aff of leader.affiliations) {
      if (aff.startDate && entity.foundedAt && aff.startDate < entity.foundedAt) {
        errors.push(`任职开始时间不能早于出生时间`);
      }
      if (aff.endDate && entity.dissolvedAt && aff.endDate > entity.dissolvedAt) {
        errors.push(`任职结束时间不能晚于死亡时间`);
      }
    }
  }
  
  return { isValid: errors.length === 0, errors };
}
```

### 9.4 搜索与过滤增强

```typescript
// 支持按所属搜索人物
// "查找大汉帝国的所有成员"
function filterLeadersByAffiliation(
  leaders: LeaderEntity[],
  entityId: string
): LeaderEntity[] {
  return leaders.filter(leader => 
    leader.affiliations.some(aff => aff.entityId === entityId)
  );
}

// 支持按参与方搜索条约
// "查找大汉帝国参与的所有条约"
function filterTreatiesByParticipant(
  treaties: TreatyEntity[],
  entityId: string
): TreatyEntity[] {
  return treaties.filter(treaty =>
    treaty.participants.some(p => p.entityId === entityId)
  );
}

// 支持按时间范围搜索
// "查找前200年到前100年间存续的所有国家"
function filterEntitiesByTimeRange(
  entities: PoliticalEntity[],
  startDate: string,
  endDate: string
): PoliticalEntity[] {
  return entities.filter(entity => {
    const entityStart = entity.foundedAt || '-9999-01-01';
    const entityEnd = entity.dissolvedAt || '9999-12-31';
    return entityStart <= endDate && entityEnd >= startDate;
  });
}
```

### 9.5 性能优化建议

```typescript
// 1. 使用虚拟列表渲染大量实体
// 2. 关系数据懒加载（点击展开时加载）
// 3. 成员列表分页加载
// 4. 缓存计算结果（如成员数量）

// 示例：虚拟列表
import { useVirtualizer } from '@tanstack/react-virtual';

function EntityList({ entities }: { entities: PoliticalEntity[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: entities.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200,
  });
  
  // ...
}
```

### 9.6 数据导入/导出

```typescript
// 支持批量导入政治实体
interface ImportData {
  template: string;           // 世界观模板ID
  entities: PoliticalEntity[];
  relations: PoliticalRelation[];
}

// 导出格式支持 JSON / CSV / Markdown
interface ExportOptions {
  format: 'json' | 'csv' | 'markdown';
  includeRelations: boolean;
  includeCustomFields: boolean;
  entityTypes: PoliticalEntityType[];
  dateRange?: { start: string; end: string };
}
```

### 9.7 冲突与合并

```typescript
// 当两个实体实际上是同一个时的合并功能
interface MergeEntitiesOptions {
  sourceId: string;           // 被合并的实体
  targetId: string;           // 合并到的实体
  mergeRelations: boolean;    // 是否合并关系
  mergeAffiliations: boolean; // 是否合并所属关系（人物）
  mergeParticipants: boolean; // 是否合并参与方（条约）
}
```

---

## 十、参考实现

### 10.1 参考文件

- 历史界面实现：`frontend/src/components/Worldbuilding/HistoryView.tsx`
- 类型定义：`frontend/src/components/Worldbuilding/HistoryView/types.ts`
- 配置文件：`frontend/src/components/Worldbuilding/HistoryView/config.ts`
- 后端API：`frontend/src/services/worldbuildingApi.ts`
- 后端Schema：`backend/app/schemas/worldbuilding.py`

### 10.2 实现顺序建议

1. **基础阶段**
   - 创建 `types.ts` 类型定义（v2.0新结构）
   - 创建 `templates.ts` 世界观模板
   - 创建 `config.ts` 配置文件
   - 实现 `PoliticsView.tsx` 主组件骨架
   - 实现基础 `EntityCard.tsx`

2. **实体差异化阶段**
   - 实现 `NationCard.tsx` 国家卡片
   - 实现 `OrganizationCard.tsx` 组织卡片
   - 实现 `LeaderCard.tsx` 人物卡片（含所属关系）
   - 实现 `TreatyCard.tsx` 条约卡片（含参与方）

3. **功能完善阶段**
   - 实现 `AffiliationSection.tsx` 和 `AddAffiliationModal.tsx`
   - 实现 `ParticipantSection.tsx` 和 `AddParticipantModal.tsx`
   - 实现 `TreatyTermsSection.tsx` 和 `AddTreatyTermModal.tsx`
   - 实现 `CustomFieldsSection.tsx`
   - 实现跨模块关联功能
   - 实现政治关系管理（支持方向性）

4. **增强阶段**（可选）
   - 实现世界观模板切换
   - 实现自定义字段编辑器
   - 实现关系网络可视化
   - 实现时间线视图
   - 实现导入/导出功能

---

## 十一、设计原则

### 11.1 数据设计原则

- **类型安全**：完整的 TypeScript 类型定义，区分四种实体类型
- **可扩展性**：自定义字段系统支持不同世界观
- **时间一致性**：所有实体和关系都有时间维度
- **关系完整性**：支持对称/非对称关系，防止循环归属

### 11.2 视觉设计原则

- **类型区分**：通过卡片布局、专属区域区分不同实体类型
- **层次分明**：通过卡片大小、颜色深浅区分实体等级
- **信息密度**：合理控制信息展示密度，避免视觉疲劳
- **一致性**：与历史界面保持视觉风格一致

### 11.3 交互设计原则

- **直观易用**：操作流程简洁明了，符合用户心智模型
- **即时反馈**：操作后立即更新界面
- **容错设计**：提供确认机制防止误操作，验证时间线一致性
- **快捷操作**：支持快捷键和批量操作

---

## 附录：完整类型定义文件

```typescript
// types.ts - 完整版

// ============================================
// 基础类型
// ============================================
export type PoliticalEntityType = 'nation' | 'organization' | 'leader' | 'treaty';
export type EntityLevel = 'superpower' | 'major' | 'regional' | 'local';
export type EntityStatus = 'active' | 'dissolved' | 'suspended';
export type PoliticalAlignment = 
  | 'lawful-good' | 'neutral-good' | 'chaotic-good'
  | 'lawful-neutral' | 'true-neutral' | 'chaotic-neutral'
  | 'lawful-evil' | 'neutral-evil' | 'chaotic-evil';
export type GovernmentType = 
  | 'monarchy' | 'republic' | 'theocracy' | 'oligarchy'
  | 'democracy' | 'dictatorship' | 'feudal' | 'tribal';
export type RelationType = 
  | 'alliance' | 'vassal' | 'suzerain' | 'enemy' | 'neutral'
  | 'trade' | 'cultural' | 'religious' | 'personal';
export type ParticipantRole = 'signatory' | 'beneficiary' | 'guarantor' | 'mediator';
export type CrossModuleType = 'map' | 'history' | 'economy' | 'races' | 'systems' | 'special';

// ============================================
// 自定义字段系统
// ============================================
export type CustomFieldType = 
  | 'text' | 'textarea' | 'number' | 'select' | 'multiselect' 
  | 'date' | 'datetime' | 'color' | 'relation';

export interface CustomFieldDefinition {
  id: string;
  name: string;
  key: string;
  type: CustomFieldType;
  options?: string[];
  required?: boolean;
  defaultValue?: any;
  description?: string;
  order_index: number;
}

export interface WorldviewTemplate {
  id: string;
  name: string;
  description: string;
  fields: {
    nation: CustomFieldDefinition[];
    organization: CustomFieldDefinition[];
    leader: CustomFieldDefinition[];
    treaty: CustomFieldDefinition[];
  };
  relationTypes: {
    id: string;
    name: string;
    symmetric: boolean;
    reverseName?: string;
  }[];
}

// ============================================
// 跨模块引用
// ============================================
export interface CrossModuleReference {
  module_type: CrossModuleType;
  item_id: string;
  item_name: string;
  relation_description?: string;
}

// ============================================
// 政治实体基础接口
// ============================================
export interface PoliticalEntityBase {
  id: string;
  name: string;
  description?: string;
  level: EntityLevel;
  color?: string;
  icon?: string;
  order_index: number;
  foundedAt?: string;
  dissolvedAt?: string;
  status: EntityStatus;
  tags: string[];
  customFields: Record<string, any>;
  territories?: CrossModuleReference[];
  historicalEvents?: CrossModuleReference[];
  economicTies?: CrossModuleReference[];
  racialComposition?: CrossModuleReference[];
  systemTies?: CrossModuleReference[];
}

// ============================================
// 具体实体类型接口
// ============================================
export interface NationEntity extends PoliticalEntityBase {
  entityType: 'nation';
  alignment?: PoliticalAlignment;
  governmentType?: GovernmentType;
  capital?: string;
  territorySize?: string;
  memberOrganizations?: string[];
  memberLeaders?: string[];
  relatedTreaties?: string[];
}

export interface OrganizationEntity extends PoliticalEntityBase {
  entityType: 'organization';
  alignment?: PoliticalAlignment;
  organizationType?: string;
  parentOrganizationId?: string;
  subOrganizationIds?: string[];
  affiliatedNationId?: string;
  headquarters?: string;
  memberLeaders?: string[];
  relatedTreaties?: string[];
}

export interface Affiliation {
  entityId: string;
  entityType: 'nation' | 'organization';
  entityName: string;
  role?: string;
  startDate?: string;
  endDate?: string;
  isPrimary: boolean;
  description?: string;
}

export interface LeaderEntity extends PoliticalEntityBase {
  entityType: 'leader';
  affiliations: Affiliation[];
  personalAlignment?: PoliticalAlignment;
  birthPlace?: string;
  relatedTreaties?: string[];
  personalRelations?: PoliticalRelation[];
}

export interface TreatyParticipant {
  entityId: string;
  entityType: PoliticalEntityType;
  entityName: string;
  role: ParticipantRole;
  signatureDate?: string;
  withdrawalDate?: string;
}

export interface TreatyTerm {
  id: string;
  order_index: number;
  title: string;
  content: string;
}

export interface TreatyEntity extends PoliticalEntityBase {
  entityType: 'treaty';
  participants: TreatyParticipant[];
  treatyType: string;
  terms: TreatyTerm[];
  effectiveDate?: string;
  expiryDate?: string;
  isExpired: boolean;
  isBroken: boolean;
}

export type PoliticalEntity = NationEntity | OrganizationEntity | LeaderEntity | TreatyEntity;

// ============================================
// 关系定义
// ============================================
export interface PoliticalRelation {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceType: PoliticalEntityType;
  targetId: string;
  targetName: string;
  targetType: PoliticalEntityType;
  relationType: RelationType;
  isSymmetric: boolean;
  startDate?: string;
  endDate?: string;
  strength?: number;
  description?: string;
}

export interface RelationTypeConfig {
  id: RelationType;
  label: string;
  symmetric: boolean;
  reverseLabel?: string;
  color: string;
  bgColor: string;
  line: 'solid' | 'dashed' | 'dotted' | 'double';
  icon: string;
  allowBetween: PoliticalEntityType[][];
}

// ============================================
// 组件 Props
// ============================================
export interface PoliticsViewProps {
  moduleId: string;
}

export interface EntityCardProps<T extends PoliticalEntity> {
  entity: T;
  template?: WorldviewTemplate;
  onEdit: () => void;
  onDelete: () => void;
  onAddAffiliation?: () => void;      // 人物专用
  onAddParticipant?: () => void;      // 条约专用
  onAddRelation: () => void;
  onAddCrossRef: (refType: string) => void;
  onUpdateDescription: (description: string) => void;
}
```