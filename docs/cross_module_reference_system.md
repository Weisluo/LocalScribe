# 跨模块引用系统设计方案

> LocalScribe 世界观设定 - 统一跨模块引用系统

---

## 一、概述

### 1.1 设计目标

建立统一的跨模块引用系统，实现历史、政治、经济三大核心模块之间的**双向强关联**，同时支持不同类型世界观（仙侠、历史、西幻、现代、科幻、末世）的通用适配。

### 1.2 核心特性

1. **双向引用**：支持模块间的相互引用和反向查询
2. **类型安全**：强类型化的引用关系定义
3. **世界观适配**：针对不同世界观类型的配置扩展
4. **可视化关联**：直观展示模块间的关联关系
5. **数据一致性**：确保引用数据的同步和一致性

---

## 二、统一引用接口设计

### 2.1 基础引用接口

```typescript
// 统一引用标识符
export interface UnifiedReference {
  module: ModuleType;           // 模块类型
  entityType: string;           // 实体类型
  entityId: string;            // 实体ID
  entityName: string;          // 实体名称
  timestamp?: string;          // 时间戳（用于历史关联）
  relationType: RelationType;  // 关系类型
  description?: string;        // 关系描述
  strength: 'strong' | 'weak'; // 关联强度
}

// 模块类型定义
export type ModuleType = 
  | 'history'    // 历史模块
  | 'politics'   // 政治模块
  | 'economy'   // 经济模块
  | 'map'       // 地图模块
  | 'races'     // 种族模块
  | 'systems'   // 体系模块
  | 'special';  // 特殊设定

// 关系类型定义
export type RelationType =
  | 'causal'      // 因果关系
  | 'temporal'    // 时间关系
  | 'spatial'     // 空间关系
  | 'functional'  // 功能关系
  | 'hierarchical' // 层级关系
  | 'dependency';  // 依赖关系
```

### 2.2 模块特定引用扩展

```typescript
// 历史模块引用扩展
export interface HistoryReference extends UnifiedReference {
  eventType?: EventType;       // 事件类型
  eraId?: string;             // 时代ID
  impactLevel: 'high' | 'medium' | 'low'; // 影响程度
}

// 政治模块引用扩展
export interface PoliticsReference extends UnifiedReference {
  entityType: PoliticalEntityType; // 政治实体类型
  alignment?: PoliticalAlignment;   // 政治立场
  governmentType?: GovernmentType;   // 政治体制
}

// 经济模块引用扩展
export interface EconomyReference extends UnifiedReference {
  entityType: EconomicEntityType;   // 经济实体类型
  resourceType?: ResourceType;      // 资源类型
  economicLevel: EconomicLevel;      // 经济等级
}
```

---

## 三、双向关联机制

### 3.1 关联存储结构

```typescript
// 双向关联记录
export interface BidirectionalRelation {
  id: string;
  source: UnifiedReference;     // 源引用
  target: UnifiedReference;      // 目标引用
  relationType: RelationType;    // 关系类型
  bidirectional: boolean;       // 是否双向
  metadata: {
    created: string;
    modified: string;
    createdBy: string;
    confidence: number;         // 关联置信度 (0-1)
  };
}

// 关联网络
export interface RelationNetwork {
  entity: UnifiedReference;
  incoming: BidirectionalRelation[];  // 入向关联
  outgoing: BidirectionalRelation[];  // 出向关联
  bidirectional: BidirectionalRelation[]; // 双向关联
}
```

### 3.2 关联发现机制

```typescript
// 自动关联发现规则
export interface RelationDiscoveryRule {
  id: string;
  name: string;
  description: string;
  sourceModule: ModuleType;
  targetModule: ModuleType;
  conditions: RelationCondition[];
  action: 'create' | 'suggest' | 'notify';
  confidenceThreshold: number;
}

// 关联条件
export interface RelationCondition {
  field: string;
  operator: 'equals' | 'contains' | 'matches' | 'overlaps';
  value: any;
  weight: number;
}
```

---

## 四、世界观类型适配

### 4.1 世界观类型定义

```typescript
// 世界观类型
export type WorldviewType =
  | 'xianxia'     // 仙侠
  | 'historical'  // 历史
  | 'western'     // 西幻
  | 'modern'      // 现代
  | 'scifi'       // 科幻
  | 'apocalypse'; // 末世

// 世界观配置
export interface WorldviewConfig {
  type: WorldviewType;
  name: string;
  description: string;
  timeScale: 'ancient' | 'medieval' | 'modern' | 'future';
  techLevel: 'primitive' | 'medieval' | 'industrial' | 'information' | 'advanced';
  magicLevel: 'none' | 'low' | 'medium' | 'high' | 'divine';
  politicalComplexity: 'simple' | 'complex' | 'highly_complex';
  economicSystem: 'barter' | 'feudal' | 'capitalist' | 'socialist' | 'post_scarcity';
}
```

### 4.2 世界观特定关联规则

```typescript
// 世界观特定规则配置
export interface WorldviewSpecificRules {
  worldview: WorldviewType;
  moduleRelations: ModuleRelationRule[];
  entityMappings: EntityMapping[];
  relationTemplates: RelationTemplate[];
}

// 模块关系规则
export interface ModuleRelationRule {
  sourceModule: ModuleType;
  targetModule: ModuleType;
  relationTypes: RelationType[];
  strength: 'strong' | 'medium' | 'weak';
  description: string;
  examples: string[];
}

// 实体映射
export interface EntityMapping {
  sourceType: string;
  targetType: string;
  mappingRule: 'direct' | 'transform' | 'composite';
  transformation?: (entity: any) => any;
}
```

---

## 五、可视化关联展示

### 5.1 关联网络可视化

```typescript
// 关联节点
export interface RelationNode {
  id: string;
  type: ModuleType;
  entityType: string;
  name: string;
  size: number;           // 节点大小（基于重要性）
  color: string;         // 节点颜色（基于模块类型）
  x?: number;            // 布局坐标
  y?: number;
}

// 关联边
export interface RelationEdge {
  id: string;
  source: string;         // 源节点ID
  target: string;         // 目标节点ID
  type: RelationType;     // 关系类型
  strength: number;      // 关联强度 (0-1)
  label?: string;        // 关系标签
  color: string;         // 边颜色（基于关系类型）
  width: number;         // 边宽度（基于强度）
}

// 关联网络数据
export interface RelationNetworkData {
  nodes: RelationNode[];
  edges: RelationEdge[];
  metadata: {
    totalNodes: number;
    totalEdges: number;
    density: number;
    modularity: number;
  };
}
```

### 5.2 时间轴关联可视化

```typescript
// 时间轴关联点
export interface TimelineRelationPoint {
  timestamp: string;
  entities: UnifiedReference[];
  relations: BidirectionalRelation[];
  significance: number;    // 重要性评分
  color: string;         // 时间点颜色
}

// 时间轴数据
export interface TimelineData {
  start: string;
  end: string;
  points: TimelineRelationPoint[];
  eras: EraRelation[];    // 时代关联
}
```

---

## 六、实现方案

### 6.1 后端存储设计

```typescript
// 关联表结构
CREATE TABLE bidirectional_relations (
  id UUID PRIMARY KEY,
  source_module TEXT NOT NULL,
  source_entity_type TEXT NOT NULL,
  source_entity_id UUID NOT NULL,
  target_module TEXT NOT NULL,
  target_entity_type TEXT NOT NULL,
  target_entity_id UUID NOT NULL,
  relation_type TEXT NOT NULL,
  bidirectional BOOLEAN DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

// 世界观配置表
CREATE TABLE worldview_configs (
  id UUID PRIMARY KEY,
  worldview_type TEXT NOT NULL,
  config JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 6.2 API 接口设计

```typescript
// 关联查询接口
export interface RelationAPI {
  // 查询实体关联
  getEntityRelations(entityRef: UnifiedReference): Promise<RelationNetwork>;
  
  // 创建关联
  createRelation(relation: BidirectionalRelation): Promise<BidirectionalRelation>;
  
  // 批量创建关联
  batchCreateRelations(relations: BidirectionalRelation[]): Promise<BidirectionalRelation[]>;
  
  // 删除关联
  deleteRelation(relationId: string): Promise<void>;
  
  // 关联发现
  discoverRelations(entityRef: UnifiedReference): Promise<RelationDiscoveryResult[]>;
  
  // 获取关联网络
  getRelationNetwork(filters?: RelationFilter): Promise<RelationNetworkData>;
  
  // 获取时间轴关联
  getTimelineRelations(timelineFilter: TimelineFilter): Promise<TimelineData>;
}
```

### 6.3 前端集成方案

```typescript
// 关联管理器
class RelationManager {
  private relations: Map<string, BidirectionalRelation> = new Map();
  private worldviewConfig: WorldviewConfig;
  
  // 初始化
  async initialize(worldview: WorldviewType): Promise<void> {
    this.worldviewConfig = await this.loadWorldviewConfig(worldview);
    await this.loadRelations();
  }
  
  // 获取实体关联
  getEntityRelations(entityRef: UnifiedReference): RelationNetwork {
    // 实现关联查询逻辑
  }
  
  // 创建关联
  async createRelation(relation: BidirectionalRelation): Promise<void> {
    // 实现关联创建逻辑
  }
  
  // 可视化关联网络
  visualizeNetwork(network: RelationNetworkData): void {
    // 实现网络可视化
  }
}
```

---

## 七、应用示例

### 7.1 历史-政治-经济关联示例

```typescript
// 示例：汉武帝北伐的跨模块关联
const hanEmperorNorthernExpedition: BidirectionalRelation[] = [
  {
    id: 'relation-001',
    source: {
      module: 'history',
      entityType: 'event',
      entityId: 'event-han-northern-expedition',
      entityName: '汉武帝北伐',
      relationType: 'causal',
      strength: 'strong'
    },
    target: {
      module: 'politics',
      entityType: 'nation',
      entityId: 'nation-han-empire',
      entityName: '大汉帝国',
      relationType: 'functional',
      strength: 'strong'
    },
    bidirectional: true,
    metadata: { /* ... */ }
  },
  {
    id: 'relation-002',
    source: {
      module: 'history',
      entityType: 'event',
      entityId: 'event-han-northern-expedition',
      entityName: '汉武帝北伐',
      relationType: 'functional',
      strength: 'medium'
    },
    target: {
      module: 'economy',
      entityType: 'trade_route',
      entityId: 'route-silk-road',
      entityName: '丝绸之路',
      relationType: 'causal',
      strength: 'medium'
    },
    bidirectional: true,
    metadata: { /* ... */ }
  }
];
```

### 7.2 世界观适配示例

```typescript
// 仙侠世界观配置
const xianxiaWorldview: WorldviewConfig = {
  type: 'xianxia',
  name: '仙侠世界',
  description: '修真修仙的东方玄幻世界',
  timeScale: 'ancient',
  techLevel: 'medieval',
  magicLevel: 'high',
  politicalComplexity: 'complex',
  economicSystem: 'feudal'
};

// 科幻世界观配置
const scifiWorldview: WorldviewConfig = {
  type: 'scifi',
  name: '科幻未来',
  description: '高科技的星际文明世界',
  timeScale: 'future',
  techLevel: 'advanced',
  magicLevel: 'none',
  politicalComplexity: 'highly_complex',
  economicSystem: 'post_scarcity'
};
```

---

## 八、总结

本统一跨模块引用系统为 LocalScribe 世界观设定提供了：

1. **强大的双向关联能力**：支持历史、政治、经济等模块间的深度关联
2. **灵活的世界观适配**：可配置不同世界观类型的关联规则
3. **直观的可视化展示**：提供关联网络和时间轴可视化
4. **可扩展的架构**：支持未来模块的扩展和自定义规则

通过此系统，用户可以构建更加丰富、连贯的世界观设定，实现各模块间的有机整合。