# 历史界面 UI 设计方案

> LocalScribe 世界观设定 - 历史模块设计文档（增强版）

---

## 一、概述

### 1.1 设计目标

历史界面作为世界观设定的**时间轴核心模块**，需要实现：

1. **时代管理**：创建和管理历史时代，定义时代的起止时间和主题风格
2. **事件记录**：记录历史事件，支持不同等级和类型的事件分类
3. **时间线可视化**：直观展示时代与事件的时间关系
4. **跨模块关联**：支持与政治、经济等模块的**双向强关联**
5. **世界观适配**：适配仙侠、历史、西幻、现代、科幻、末世等世界观类型
6. **详细条目**：为事件添加详细信息条目，构建完整的历史档案

### 1.2 模块关系图（增强版）

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           世界观设定系统                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐          │
│  │  地图   │────▶│  政治   │◀────│  历史   │────▶│  种族   │          │
│  │ (地区)  │     │ (核心)  │     │ (时间)  │     │ (人口)  │          │
│  └─────────┘     └─────────┘     └────┬────┘     └─────────┘          │
│                                       │               │                │
│                                       │               │                │
│                                       ▼               ▼                │
│                                  ┌─────────┐     ┌─────────┐          │
│                                  │  经济   │     │  特殊   │          │
│                                  │ (资源)  │     │ (设定)  │          │
│                                  └─────────┘     └─────────┘          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

双向关联关系：
• 历史事件 → 政治实体（因果关系、时间关系）
• 历史事件 → 经济实体（功能关系、依赖关系）
• 政治实体 → 历史事件（反向查询、影响分析）
• 经济实体 → 历史事件（反向查询、发展脉络）
```

---

## 二、数据结构设计（增强版）

### 2.1 类型定义

```typescript
// 事件等级
export type EventLevel = 
  | 'critical'  // 重点大事件 ★★★
  | 'major'     // 大事件 ★★
  | 'normal'    // 普通事件 ★
  | 'minor';    // 小事件 ○

// 时代主题
export type EraTheme = 
  | 'ochre'      // 赭石 - 时间的底色
  | 'gilded'     // 鎏金 - 文明的野心
  | 'verdant'    // 青绿 - 千里江山
  | 'cerulean'   // 釉色 - 瓷器的光泽
  | 'patina'     // 锈迹 - 遗忘与新生
  | 'parchment'  // 宣纸 - 古籍的呼吸
  | 'cinnabar'   // 朱砂 - 血与墨
  | 'ink';       // 枯墨 - 史书的颜色

// 事件类型（基础类型，支持世界观适配）
export type EventType = 
  | 'imperial'   // 帝王 - 王朝更迭
  | 'war'        // 征伐 - 战争史诗
  | 'culture'    // 文华 - 艺术思想
  | 'discovery'  // 发明 - 科技革新
  | 'disaster'   // 灾厄 - 天灾人祸
  | 'folk'       // 民俗 - 百姓故事
  | 'mystery'    // 秘闻 - 神秘事件
  | 'legacy';    // 传承 - 历史遗产

// 世界观适配的事件类型
export type WorldviewEventType = EventType & {
  worldview: WorldviewType;
  adaptedLabel: string;
  adaptedIcon: string;
  adaptedColor: string;
};

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
  | 'politics'    // 政治模块引用
  | 'economy'    // 经济模块引用
  | 'map'        // 地图模块引用
  | 'races'      // 种族模块引用
  | 'systems';   // 体系模块引用
```

### 2.2 核心接口（增强版）

```typescript
// 跨模块引用接口
export interface CrossModuleReference {
  module: CrossModuleReferenceType;
  entityId: string;
  entityName: string;
  entityType: string;
  relationType: 'causal' | 'temporal' | 'functional' | 'hierarchical' | 'dependency';
  relationStrength: 'strong' | 'medium' | 'weak';
  timestamp?: string; // 关联时间点
  description?: string; // 关联描述
}

// 时代（增强版）
export interface Era {
  id: string;
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  order_index: number;
  theme?: EraTheme;
  worldview?: WorldviewType; // 世界观类型
  
  // 跨模块关联
  politicalEntities?: CrossModuleReference[]; // 关联的政治实体
  economicSystems?: CrossModuleReference[];   // 关联的经济体系
  
  // 世界观适配属性
  adaptedName?: string; // 世界观适配后的名称
  adaptedDescription?: string; // 世界观适配后的描述
}

// 历史事件（增强版）
export interface Event {
  id: string;
  name: string;
  description?: string;
  level: EventLevel;
  eventDate?: string;
  icon?: string;
  order_index: number;
  eraId?: string;
  items: EventItem[];
  eventType?: EventType;
  worldview?: WorldviewType; // 世界观类型
  
  // 跨模块双向关联
  crossModuleReferences: {
    politics: CrossModuleReference[]; // 政治关联
    economy: CrossModuleReference[];  // 经济关联
    map: CrossModuleReference[];      // 地图关联
    races: CrossModuleReference[];    // 种族关联
    systems: CrossModuleReference[];  // 体系关联
  };
  
  // 关联网络数据
  relationNetwork?: {
    incoming: CrossModuleReference[]; // 入向关联
    outgoing: CrossModuleReference[]; // 出向关联
    bidirectional: CrossModuleReference[]; // 双向关联
  };
  
  // 世界观适配属性
  adaptedEventType?: WorldviewEventType; // 世界观适配后的事件类型
  impactAnalysis?: { // 影响分析
    politicalImpact: number; // 政治影响度 (0-100)
    economicImpact: number;  // 经济影响度 (0-100)
    culturalImpact: number;  // 文化影响度 (0-100)
    technologicalImpact: number; // 科技影响度 (0-100)
  };
}

// 事件条目（增强版）
export interface EventItem {
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

## 三、跨模块关联与世界观适配

### 3.1 跨模块关联机制

#### 3.1.1 历史-政治双向关联

```typescript
// 示例：汉武帝北伐事件的跨模块关联
const hanEmperorNorthernExpedition: Event = {
  id: 'event-han-northern-expedition',
  name: '汉武帝北伐',
  description: '卫青、霍去病北击匈奴，开辟河西走廊的重大军事行动',
  level: 'major',
  eventDate: '前119年',
  eventType: 'war',
  worldview: 'historical',
  
  crossModuleReferences: {
    politics: [
      {
        module: 'politics',
        entityId: 'nation-han-empire',
        entityName: '大汉帝国',
        entityType: 'nation',
        relationType: 'causal',
        relationStrength: 'strong',
        description: '汉武帝发动的军事行动'
      },
      {
        module: 'politics',
        entityId: 'leader-liu-che',
        entityName: '汉武帝刘彻',
        entityType: 'leader',
        relationType: 'functional',
        relationStrength: 'strong',
        description: '决策者和指挥者'
      }
    ],
    economy: [
      {
        module: 'economy',
        entityId: 'trade-route-silk-road',
        entityName: '丝绸之路',
        entityType: 'trade_route',
        relationType: 'functional',
        relationStrength: 'medium',
        description: '军事行动为丝绸之路开辟创造条件'
      }
    ]
  },
  
  impactAnalysis: {
    politicalImpact: 85,
    economicImpact: 70,
    culturalImpact: 60,
    technologicalImpact: 40
  }
};
```

#### 3.1.2 世界观适配示例

```typescript
// 仙侠世界观适配示例
const xianxiaEventAdaptation: Event = {
  id: 'event-cultivation-breakthrough',
  name: '元婴突破',
  description: '某修士成功突破元婴境界，引发天地异象',
  level: 'major',
  eventDate: '修真历 2350年',
  eventType: 'discovery',
  worldview: 'xianxia',
  
  adaptedEventType: {
    type: 'discovery',
    worldview: 'xianxia',
    adaptedLabel: '修为突破',
    adaptedIcon: '🧘',
    adaptedColor: '#8b5cf6'
  },
  
  crossModuleReferences: {
    politics: [
      {
        module: 'politics',
        entityId: 'sect-tai-xu',
        entityName: '太虚门',
        entityType: 'sect',
        relationType: 'hierarchical',
        relationStrength: 'strong',
        description: '所属门派'
      }
    ],
    systems: [
      {
        module: 'systems',
        entityId: 'cultivation-realm-yuanying',
        entityName: '元婴境',
        entityType: 'cultivation_realm',
        relationType: 'functional',
        relationStrength: 'strong',
        description: '突破的境界'
      }
    ]
  }
};

// 科幻世界观适配示例
const scifiEventAdaptation: Event = {
  id: 'event-ai-awakening',
  name: 'AI觉醒事件',
  description: '超级人工智能"天网"实现自我意识觉醒',
  level: 'critical',
  eventDate: '2245-03-15',
  eventType: 'discovery',
  worldview: 'scifi',
  
  adaptedEventType: {
    type: 'discovery',
    worldview: 'scifi',
    adaptedLabel: '科技突破',
    adaptedIcon: '🤖',
    adaptedColor: '#0ea5e9'
  },
  
  crossModuleReferences: {
    politics: [
      {
        module: 'politics',
        entityId: 'corp-neuralink',
        entityName: '神经链接公司',
        entityType: 'organization',
        relationType: 'causal',
        relationStrength: 'strong',
        description: '研发机构'
      }
    ],
    economy: [
      {
        module: 'economy',
        entityId: 'tech-ai',
        entityName: '人工智能技术',
        entityType: 'industry',
        relationType: 'functional',
        relationStrength: 'strong',
        description: '相关产业'
      }
    ]
  }
};
```

### 3.2 关联可视化组件

#### 3.2.1 关联网络面板

```typescript
// 关联网络可视化组件
const RelationNetworkPanel: React.FC<{ event: Event }> = ({ event }) => {
  const { crossModuleReferences, relationNetwork } = event;
  
  return (
    <div className="relation-network-panel">
      <h4>📊 跨模块关联网络</h4>
      
      {/* 政治关联 */}
      {crossModuleReferences.politics.length > 0 && (
        <div className="relation-category">
          <h5>🏛️ 政治关联</h5>
          {crossModuleReferences.politics.map(ref => (
            <RelationNode key={ref.entityId} reference={ref} />
          ))}
        </div>
      )}
      
      {/* 经济关联 */}
      {crossModuleReferences.economy.length > 0 && (
        <div className="relation-category">
          <h5>💰 经济关联</h5>
          {crossModuleReferences.economy.map(ref => (
            <RelationNode key={ref.entityId} reference={ref} />
          ))}
        </div>
      )}
      
      {/* 影响分析图表 */}
      {event.impactAnalysis && (
        <ImpactAnalysisChart analysis={event.impactAnalysis} />
      )}
    </div>
  );
};
```

#### 3.2.2 世界观适配指示器

```typescript
// 世界观适配指示器组件
const WorldviewIndicator: React.FC<{ worldview: WorldviewType }> = ({ worldview }) => {
  const worldviewConfigs = {
    xianxia: { label: '仙侠', icon: '🧘', color: '#7c3aed' },
    historical: { label: '历史', icon: '📜', color: '#c9a227' },
    western: { label: '西幻', icon: '⚔️', color: '#b91c1c' },
    modern: { label: '现代', icon: '🏢', color: '#64748b' },
    scifi: { label: '科幻', icon: '🚀', color: '#0ea5e9' },
    apocalypse: { label: '末世', icon: '💀', color: '#57534e' }
  };
  
  const config = worldviewConfigs[worldview];
  
  return (
    <div className="worldview-indicator" style={{ borderColor: config.color }}>
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </div>
  );
};
```

---

## 四、UI 布局设计（增强版）

### 4.1 主界面布局（增强版）

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  [添加时代]  [世界观: 🧘 仙侠]  [🔍 搜索时代、事件或关联...]                 │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    ▼ 时间线（时代区间可视化 + 关联热点）                 │ │
│  │  ────────────────────────────────────────────────────────────────────  │ │
│  │  ○────●────●────○────●────○────●                                       │ │
│  │  │    │    │    │    │    │    │                                       │ │
│  │ 前206 前119 8年 220年 ...                                              │ │
│  │  ●: 强关联事件  ○: 普通事件                                             │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ 🏺 大汉时代 🧘 [仙侠适配]                                [编辑] [删除] │ │
│  │ ══════════════════════════════════════════════════════════════════════ │ │
│  │ 时间: 前206年 - 220年  |  主题: 鎏金  |  世界观: 历史 → 仙侠适配         │ │
│  │ 描述: 统一六国后建立的中央集权帝国，修真界称之为"凡间王朝"...           │ │
│  │                                                                        │ │
│  │ ┌──────────────────────────────────────────────────────────────────┐  │ │
│  │ │ 🧘 元婴突破                                      [编辑] [删除]    │  │ │
│  │ │ 修真历2350年 | 修为突破 | 大事件                                  │  │ │
│  │ │ 太虚门长老张三丰成功突破元婴境界，引发天地异象...                 │  │ │
│  │ │                                                                  │  │ │
│  │ │ [🏛️ 太虚门] [⚔️ 元婴境] [📊 影响分析] [+ 添加关联]               │  │ │
│  │ │                                                                  │  │ │
│  │ │ ┌──────────────────────────────────────────────────────────────┐ │  │ │
│  │ │ │ 📊 跨模块关联网络                                            │ │  │ │
│  │ │ │ 政治: 太虚门 (门派) ──▶ 修为突破 (事件)                      │ │  │ │
│  │ │ │ 体系: 元婴境 (境界) ──▶ 修为突破 (事件)                      │ │  │ │
│  │ │ │ 影响: 政治 85% | 经济 40% | 文化 60% | 科技 70%              │ │  │ │
│  │ │ └──────────────────────────────────────────────────────────────┘ │  │ │
│  │ └──────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                        │ │
│  │ ┌──────────────────────────────────────────────────────────────────┐  │ │
│  │ │ 🤖 AI觉醒事件                                   [编辑] [删除]    │  │ │
│  │ │ 2245-03-15 | 科技突破 | 重点大事件                               │  │ │
│  │ │ 神经链接公司研发的超级AI"天网"实现自我意识觉醒...                │  │ │
│  │ │                                                                  │  │ │
│  │ │ [🏢 神经链接公司] [💻 AI技术] [📊 影响分析] [+ 添加关联]         │  │ │
│  │ │                                                                  │  │ │
│  │ │ ┌──────────────────────────────────────────────────────────────┐ │  │ │
│  │ │ │ 📊 跨模块关联网络                                            │ │  │ │
│  │ │ │ 政治: 神经链接公司 (企业) ──▶ AI觉醒 (事件)                  │ │  │ │
│  │ │ │ 经济: AI技术 (产业) ───────▶ AI觉醒 (事件)                  │ │  │ │
│  │ │ │ 影响: 政治 90% | 经济 95% | 文化 75% | 科技 100%             │ │  │ │
│  │ │ └──────────────────────────────────────────────────────────────┘ │  │ │
│  │ └──────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                        │ │
│  │ [+ 添加事件]                                                           │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ 📜 三国时代 🧘 [仙侠适配]                                [编辑] [删除] │ │
│  │ 时间: 220年 - 280年  |  主题: 朱砂  |  世界观: 历史 → 仙侠适配         │ │
│  │ ...                                                                    │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 卡片设计规格

| 事件等级 | 图标 | 主色调 | 卡片样式 |
|---------|------|--------|---------|
| 重点大事件 | ★★★ | 紫色 `#6366f1` | 100% 宽度，渐变背景，强阴影，发光效果 |
| 大事件 | ★★ | 琥珀 `#f59e0b` | 50% 宽度，渐变背景，中等阴影 |
| 普通事件 | ★ | 灰色 `#64748b` | 33% 宽度，轻阴影 |
| 小事件 | ○ | 浅灰 `#cbd5e1` | 25% 宽度，虚线边框，简洁样式 |

### 3.3 时代主题样式

| 主题 | 中文名 | 主色调 | 视觉效果 |
|------|--------|--------|---------|
| ochre | 赭石 | 琥珀色 | 泥土、古陶、大地的颜色 |
| gilded | 鎏金 | 金色 | 宫殿琉璃、帝王龙袍 |
| verdant | 青绿 | 翠绿 | 千里江山图的石绿 |
| cerulean | 釉色 | 天蓝 | 瓷器的光泽 |
| patina | 锈迹 | 石灰 | 青铜器上的绿锈 |
| parchment | 宣纸 | 米白 | 古籍的呼吸 |
| cinnabar | 朱砂 | 暗红 | 血与墨混合 |
| ink | 枯墨 | 灰黑 | 史书的颜色 |

---

## 四、配色方案

### 4.1 事件等级配色

```typescript
export const LEVEL_COLORS: Record<EventLevel, string> = {
  critical: '#6366f1',  // 紫色 - 重点大事件
  major: '#f59e0b',     // 琥珀 - 大事件
  normal: '#64748b',    // 灰色 - 普通事件
  minor: '#cbd5e1',     // 浅灰 - 小事件
};

export const LEVEL_CONFIG: Record<EventLevel, EventLevelConfig> = {
  critical: {
    label: '重点大事件',
    labelCn: '★★★',
    flexBasis: 'flex-[1_1_100%]',
    minHeight: 'min-h-[220px]',
    padding: 'p-6',
    bgClass: 'bg-gradient-to-br from-indigo-500/15 via-purple-500/10 to-pink-500/15',
    borderClass: 'border-2 border-indigo-400/50 shadow-xl shadow-indigo-500/20',
    textClass: 'text-foreground',
    titleSize: 'text-xl font-bold',
    icon: '★',
    glowColor: 'rgba(99, 102, 241, 0.4)',
    accentGradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
  },
  major: {
    label: '大事件',
    labelCn: '★★',
    flexBasis: 'flex-[1_1_calc(50%-12px)]',
    minHeight: 'min-h-[170px]',
    padding: 'p-5',
    bgClass: 'bg-gradient-to-br from-amber-500/10 via-orange-500/8 to-yellow-500/10',
    borderClass: 'border-2 border-amber-400/40 shadow-lg shadow-amber-500/15',
    textClass: 'text-foreground',
    titleSize: 'text-lg font-semibold',
    icon: '★',
    glowColor: 'rgba(245, 158, 11, 0.3)',
    accentGradient: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
  },
  normal: {
    label: '普通事件',
    labelCn: '★',
    flexBasis: 'flex-[1_1_calc(33.333%-12px)]',
    minHeight: 'min-h-[130px]',
    padding: 'p-4',
    bgClass: 'bg-gradient-to-br from-slate-400/8 via-slate-500/5 to-slate-400/8',
    borderClass: 'border border-slate-400/30 shadow-md shadow-slate-500/10',
    textClass: 'text-foreground',
    titleSize: 'text-base font-medium',
    icon: '○',
    glowColor: 'rgba(100, 116, 139, 0.2)',
    accentGradient: 'linear-gradient(135deg, #64748b 0%, #94a3b8 100%)',
  },
  minor: {
    label: '小事件',
    labelCn: '○',
    flexBasis: 'flex-[1_1_calc(25%-12px)]',
    minHeight: 'min-h-[100px]',
    padding: 'p-3',
    bgClass: 'bg-muted/40',
    borderClass: 'border border-dashed border-border/70',
    textClass: 'text-muted-foreground',
    titleSize: 'text-sm font-medium',
    icon: '○',
    glowColor: 'transparent',
    accentGradient: 'linear-gradient(135deg, #cbd5e1 0%, #e2e8f0 100%)',
  },
};
```

### 4.2 事件类型配色

```typescript
export const EVENT_TYPE_CONFIG: Record<EventType, EventTypeConfig> = {
  imperial: {
    label: 'Imperial',
    labelCn: '帝王',
    color: '#c9a227',
    gradient: 'from-yellow-600/15 via-amber-500/10 to-orange-500/8',
    border: 'border-yellow-500/40',
    accent: 'bg-yellow-500',
    text: 'text-yellow-700 dark:text-yellow-300',
    icon: '👑',
    description: '王朝更迭、帝王功业、宫廷大事',
  },
  war: {
    label: 'War',
    labelCn: '征伐',
    color: '#b91c1c',
    gradient: 'from-red-700/15 via-rose-600/10 to-orange-700/8',
    border: 'border-red-500/40',
    accent: 'bg-red-600',
    text: 'text-red-700 dark:text-red-300',
    icon: '⚔️',
    description: '战争、征伐、英雄史诗',
  },
  culture: {
    label: 'Culture',
    labelCn: '文华',
    color: '#059669',
    gradient: 'from-emerald-600/15 via-teal-500/10 to-cyan-600/8',
    border: 'border-emerald-400/40',
    accent: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-300',
    icon: '📜',
    description: '艺术、文学、思想、文化繁荣',
  },
  discovery: {
    label: 'Discovery',
    labelCn: '发明',
    color: '#0284c7',
    gradient: 'from-sky-600/15 via-blue-500/10 to-indigo-500/8',
    border: 'border-sky-400/40',
    accent: 'bg-sky-500',
    text: 'text-sky-700 dark:text-sky-300',
    icon: '💡',
    description: '科技发明、探索发现、革新突破',
  },
  disaster: {
    label: 'Disaster',
    labelCn: '灾厄',
    color: '#6b7280',
    gradient: 'from-stone-500/15 via-zinc-500/10 to-slate-500/8',
    border: 'border-stone-400/40',
    accent: 'bg-stone-500',
    text: 'text-stone-600 dark:text-stone-300',
    icon: '🌋',
    description: '天灾人祸、瘟疫饥馑、文明衰落',
  },
  folk: {
    label: 'Folk',
    labelCn: '民俗',
    color: '#a16207',
    gradient: 'from-amber-600/15 via-orange-500/10 to-yellow-600/8',
    border: 'border-amber-400/40',
    accent: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-300',
    icon: '🏘️',
    description: '民间生活、风俗传统、百姓故事',
  },
  mystery: {
    label: 'Mystery',
    labelCn: '秘闻',
    color: '#7c3aed',
    gradient: 'from-violet-600/15 via-purple-500/10 to-indigo-600/8',
    border: 'border-violet-400/40',
    accent: 'bg-violet-500',
    text: 'text-violet-700 dark:text-violet-300',
    icon: '🔮',
    description: '未解之谜、传说秘闻、神秘事件',
  },
  legacy: {
    label: 'Legacy',
    labelCn: '传承',
    color: '#0891b2',
    gradient: 'from-cyan-600/15 via-teal-500/10 to-emerald-600/8',
    border: 'border-cyan-400/40',
    accent: 'bg-cyan-500',
    text: 'text-cyan-700 dark:text-cyan-300',
    icon: '🏛️',
    description: '历史遗产、建筑文物、传统延续',
  },
};
```

### 4.3 时代主题配色

```typescript
export const ERA_THEME_CONFIG: Record<EraTheme, EraThemeConfig> = {
  ochre: {
    label: 'Ochre',
    labelCn: '赭石',
    gradient: 'from-amber-800/20 via-orange-900/15 to-yellow-900/10',
    border: 'border-amber-700/40',
    accent: 'bg-amber-700',
    text: 'text-amber-800 dark:text-amber-300',
    bgLight: 'rgba(180, 130, 80, 0.15)',
    bgDark: 'rgba(140, 100, 60, 0.2)',
    description: '时间的底色，泥土、古陶、千万人赤足踩过的大地',
  },
  gilded: {
    label: 'Gilded',
    labelCn: '鎏金',
    gradient: 'from-yellow-600/20 via-amber-500/15 to-orange-600/10',
    border: 'border-yellow-500/50',
    accent: 'bg-yellow-600',
    text: 'text-yellow-700 dark:text-yellow-300',
    bgLight: 'rgba(200, 160, 60, 0.15)',
    bgDark: 'rgba(180, 140, 40, 0.2)',
    description: '文明的野心，宫殿琉璃、帝王龙袍、圣像冠冕',
  },
  verdant: {
    label: 'Verdant',
    labelCn: '青绿',
    gradient: 'from-emerald-700/20 via-teal-600/15 to-cyan-700/10',
    border: 'border-emerald-500/40',
    accent: 'bg-emerald-600',
    text: 'text-emerald-700 dark:text-emerald-300',
    bgLight: 'rgba(60, 140, 100, 0.15)',
    bgDark: 'rgba(40, 120, 80, 0.2)',
    description: '千里江山图的石绿，汝窑雨过天青的静谧',
  },
  cerulean: {
    label: 'Cerulean',
    labelCn: '釉色',
    gradient: 'from-sky-600/20 via-blue-500/15 to-indigo-600/10',
    border: 'border-sky-400/40',
    accent: 'bg-sky-500',
    text: 'text-sky-700 dark:text-sky-300',
    bgLight: 'rgba(80, 140, 180, 0.15)',
    bgDark: 'rgba(60, 120, 160, 0.2)',
    description: '瓷器的光泽，火焰中成形的瞬间',
  },
  patina: {
    label: 'Patina',
    labelCn: '锈迹',
    gradient: 'from-stone-500/20 via-zinc-600/15 to-slate-500/10',
    border: 'border-stone-400/40',
    accent: 'bg-stone-500',
    text: 'text-stone-600 dark:text-stone-300',
    bgLight: 'rgba(120, 110, 100, 0.15)',
    bgDark: 'rgba(100, 90, 80, 0.2)',
    description: '青铜器上的绿锈，石碑上的苔藓，遗忘与新生的颜色',
  },
  parchment: {
    label: 'Parchment',
    labelCn: '宣纸',
    gradient: 'from-stone-300/20 via-amber-200/15 to-yellow-100/10',
    border: 'border-stone-300/50',
    accent: 'bg-stone-400',
    text: 'text-stone-700 dark:text-stone-300',
    bgLight: 'rgba(220, 200, 170, 0.2)',
    bgDark: 'rgba(180, 160, 130, 0.15)',
    description: '古籍的呼吸，家书在樟木箱里慢慢老去的颜色',
  },
  cinnabar: {
    label: 'Cinnabar',
    labelCn: '朱砂',
    gradient: 'from-red-700/20 via-rose-600/15 to-orange-700/10',
    border: 'border-red-500/40',
    accent: 'bg-red-600',
    text: 'text-red-700 dark:text-red-300',
    bgLight: 'rgba(180, 60, 60, 0.15)',
    bgDark: 'rgba(160, 40, 40, 0.2)',
    description: '血与墨混合后干涸的暗红，战争的伤痕',
  },
  ink: {
    label: 'Ink',
    labelCn: '枯墨',
    gradient: 'from-gray-700/20 via-slate-600/15 to-zinc-700/10',
    border: 'border-gray-500/40',
    accent: 'bg-gray-600',
    text: 'text-gray-700 dark:text-gray-300',
    bgLight: 'rgba(80, 80, 90, 0.15)',
    bgDark: 'rgba(60, 60, 70, 0.2)',
    description: '史书是用墨写成的，字缝里渗出岁月的风干',
  },
};
```

---

## 五、后端数据存储方案

### 5.1 数据映射关系

利用现有 `WorldSubmodule` 和 `WorldModuleItem` 结构存储历史数据：

| 字段 | 存储内容 | 格式示例 |
|------|---------|---------|
| `color` | 类型标识 | 时代: `era:ochre`，事件: `type:imperial:major` |
| `icon` | 时间信息 | 时代: `era:前206:220`，事件: `date:前206年` |
| `parent_id` | 所属时代 | 事件所属的时代ID |
| `WorldModuleItem` | 事件详细条目 | 见下方详细说明 |

### 5.2 时代存储

```typescript
// WorldSubmodule - 时代
{
  id: "era-001",
  module_id: "history_module_id",
  name: "大汉时代",
  description: "统一六国后建立的中央集权帝国...",
  color: "era:gilded",
  icon: "era:前206:220",
  parent_id: null,
  order_index: 0
}
```

### 5.3 事件存储

```typescript
// WorldSubmodule - 历史事件
{
  id: "event-001",
  module_id: "history_module_id",
  name: "楚汉争霸",
  description: "刘邦与项羽争夺天下的战争...",
  color: "type:imperial:critical",
  icon: "date:前206年",
  parent_id: "era-001",
  order_index: 0
}
```

### 5.4 事件条目存储

```typescript
// WorldModuleItem - 事件详细条目
{
  id: "item-001",
  module_id: "history_module_id",
  submodule_id: "event-001",
  name: "政治背景",
  content: {
    "秦末农民起义": "陈胜吴广起义，天下大乱",
    "楚怀王之约": "先入关中者为王",
    "鸿门宴": "项羽设宴，刘邦险些被杀"
  }
}

// WorldModuleItem - 参战势力
{
  id: "item-002",
  module_id: "history_module_id",
  submodule_id: "event-001",
  name: "参战势力",
  content: {
    "汉军": "刘邦统领，以关中为基地",
    "楚军": "项羽统领，势力范围广大",
    "诸侯联军": "各方诸侯势力"
  }
}
```

---

## 六、组件结构

### 6.1 文件结构

```
HistoryView/
├── index.ts                    # 导出入口
├── types.ts                    # 类型定义
├── config.ts                   # 配置（颜色、图标、样式）
├── HistoryView.tsx             # 主组件
├── EventCard.tsx               # 事件卡片组件
├── EraCard.tsx                 # 时代卡片组件（内联在主组件中）
├── TimelineTooltip.tsx         # 时间线提示组件
├── HistorySkeleton.tsx         # 加载骨架屏
└── modals/
    ├── index.ts
    ├── AddEraModal.tsx         # 添加时代弹窗
    ├── EditEraModal.tsx        # 编辑时代弹窗
    ├── AddEventModal.tsx       # 添加事件弹窗
    ├── EditEventModal.tsx      # 编辑事件弹窗
    ├── AddItemModal.tsx        # 添加条目弹窗
    └── EditItemModal.tsx       # 编辑条目弹窗
```

### 6.2 组件职责

| 组件 | 职责 |
|------|------|
| `HistoryView` | 主容器，管理状态、数据获取、筛选逻辑、时间线渲染 |
| `EventCard` | 单个事件卡片，展示事件信息和条目 |
| `TimelineTooltip` | 时间线上的悬浮提示 |
| `HistorySkeleton` | 加载状态的骨架屏 |
| `AddEraModal` | 添加新时代的表单弹窗 |
| `EditEraModal` | 编辑时代信息的表单弹窗 |
| `AddEventModal` | 添加新事件的表单弹窗 |
| `EditEventModal` | 编辑事件信息的表单弹窗 |
| `AddItemModal` | 添加事件条目的表单弹窗 |
| `EditItemModal` | 编辑事件条目的表单弹窗 |

---

## 七、交互设计

### 7.1 核心交互

| 功能 | 描述 | 实现方式 |
|------|------|---------|
| **时代展开/折叠** | 点击时代标题展开或折叠事件列表 | 手风琴组件 |
| **搜索过滤** | 按时代、事件、条目名称搜索 | 搜索框 + 过滤逻辑 |
| **快速编辑** | 点击描述区域直接编辑 | 内联编辑器 |
| **时间线导航** | 悬浮时间线显示事件信息 | Tooltip 组件 |
| **条目管理** | 添加/编辑/删除事件条目 | Modal + 表单 |

### 7.2 交互流程

#### 添加时代

```
点击"添加时代" → 填写时代名称 → 选择起止时间 
→ 选择主题风格 → 填写描述 → 保存
```

#### 添加事件

```
点击"添加事件" → 选择所属时代 → 填写事件名称 
→ 选择事件等级 → 选择事件类型 → 填写时间 → 保存
```

#### 添加事件条目

```
点击事件卡片中的"+ 添加条目" → 填写条目名称 
→ 添加键值对内容 → 保存
```

### 7.3 动画设计

```typescript
export const animationConfig = {
  spring: {
    type: 'spring' as const,
    stiffness: 300,
    damping: 30,
  },
  ease: {
    duration: 0.3,
    ease: [0.4, 0, 0.2, 1] as const,
  },
  stagger: {
    staggerChildren: 0.06,
    delayChildren: 0.05,
  },
};

export const cardVariants = {
  hidden: { 
    opacity: 0, 
    y: 16,
    scale: 0.98,
  },
  visible: { 
    opacity: 1, 
    y: 0,
    scale: 1,
    transition: animationConfig.spring,
  },
  exit: { 
    opacity: 0, 
    scale: 0.95,
    y: -8,
    transition: { duration: 0.2, ease: 'easeOut' as const },
  },
};

export const eraVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: animationConfig.spring,
  },
  exit: { 
    opacity: 0, 
    y: -10,
    transition: { duration: 0.2 },
  },
};

export const contentVariants = {
  collapsed: {
    height: 0,
    opacity: 0,
    transition: animationConfig.ease,
  },
  expanded: {
    height: 'auto',
    opacity: 1,
    transition: animationConfig.spring,
  },
};
```

---

## 八、API 调用

### 8.1 数据获取

```typescript
// 获取历史模块的子模块（时代和事件）
const { data: submodules } = useQuery({
  queryKey: ['worldbuilding', 'submodules', moduleId],
  queryFn: () => worldbuildingApi.getSubmodules(moduleId),
});

// 获取历史模块的所有条目（事件详细内容）
const { data: items } = useQuery({
  queryKey: ['worldbuilding', 'items', moduleId],
  queryFn: () => worldbuildingApi.getItems(moduleId, { include_all: true }),
});
```

### 8.2 数据操作

```typescript
// 创建时代
const createEraMutation = useMutation({
  mutationFn: (data) => worldbuildingApi.createSubmodule(moduleId, {
    name: data.name,
    description: data.description,
    color: `era:${data.theme}`,
    icon: `era:${data.startDate}:${data.endDate}`,
  }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'submodules', moduleId] });
  },
});

// 创建事件
const createEventMutation = useMutation({
  mutationFn: (data) => worldbuildingApi.createSubmodule(moduleId, {
    name: data.name,
    description: data.description,
    color: `type:${data.eventType}:${data.level}`,
    icon: `date:${data.eventDate}`,
    parent_id: data.eraId,
  }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'submodules', moduleId] });
  },
});

// 创建事件条目
const createItemMutation = useMutation({
  mutationFn: (data) => worldbuildingApi.createItem(moduleId, {
    name: data.name,
    content: data.content,
    submodule_id: data.eventId,
  }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'items', moduleId] });
  },
});
```

---

## 九、参考实现

### 9.1 实现文件

- 主组件：`frontend/src/components/Worldbuilding/HistoryView.tsx`
- 类型定义：`frontend/src/components/Worldbuilding/HistoryView/types.ts`
- 配置文件：`frontend/src/components/Worldbuilding/HistoryView/config.ts`
- 事件卡片：`frontend/src/components/Worldbuilding/HistoryView/EventCard.tsx`
- 骨架屏：`frontend/src/components/Worldbuilding/HistoryView/HistorySkeleton.tsx`
- 时间提示：`frontend/src/components/Worldbuilding/HistoryView/TimelineTooltip.tsx`
- 弹窗组件：`frontend/src/components/Worldbuilding/HistoryView/modals/`

### 9.2 时间解析工具

- 时间比较：`frontend/src/utils/timeParser.ts` - `compareTimes()`
- 位置计算：`frontend/src/utils/timeParser.ts` - `calculateEraBasedPositions()`

---

## 十、设计原则

### 10.1 视觉设计

- **时间感**：通过时代主题配色营造历史氛围
- **层次分明**：通过卡片大小、颜色深浅区分事件等级
- **信息密度**：合理控制信息展示密度，避免视觉疲劳
- **一致性**：与其他世界观模块保持视觉风格一致

### 10.2 交互设计

- **直观易用**：操作流程简洁明了
- **即时反馈**：操作后立即更新界面
- **容错设计**：提供确认机制防止误操作
- **流畅动画**：使用 Framer Motion 提供流畅的过渡效果

### 10.3 设计理念

历史界面的设计灵感来源于中国传统文化的色彩体系：

- **赭石**：时间的底色，泥土、古陶、千万人赤足踩过的大地
- **鎏金**：文明的野心，宫殿琉璃、帝王龙袍、圣像冠冕
- **青绿**：千里江山图的石绿，汝窑雨过天青的静谧
- **釉色**：瓷器的光泽，火焰中成形的瞬间
- **锈迹**：青铜器上的绿锈，石碑上的苔藓，遗忘与新生的颜色
- **宣纸**：古籍的呼吸，家书在樟木箱里慢慢老去的颜色
- **朱砂**：血与墨混合后干涸的暗红，战争的伤痕
- **枯墨**：史书是用墨写成的，字缝里渗出岁月的风干
