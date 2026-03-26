# 世界观配置系统设计方案

> LocalScribe 世界观设定 - 世界观类型适配系统

---

## 一、概述

### 1.1 设计目标

为 LocalScribe 提供灵活的世界观类型适配系统，支持**仙侠、历史、西幻、现代、科幻、末世**六种主要世界观类型，实现模块内容的智能适配和个性化展示。

### 1.2 支持的世界观类型

| 世界观类型 | 中文名称 | 核心特征 | 典型示例 | 是否系统预设 |
|-----------|---------|---------|---------|-------------|
| `xianxia` | 仙侠 | 修真修仙、门派斗争、法宝丹药 | 《凡人修仙传》、《诛仙》 | ✅ 系统预设 |
| `historical` | 历史 | 真实历史背景、王朝更迭 | 《三国演义》、《大明王朝》 | ✅ 系统预设 |
| `western` | 西幻 | 魔法、骑士、龙与地下城 | 《指环王》、《冰与火之歌》 | ✅ 系统预设 |
| `modern` | 现代 | 当代社会、科技文明 | 现实世界、近未来设定 | ✅ 系统预设 |
| `scifi` | 科幻 | 高科技、星际文明、人工智能 | 《三体》、《星际迷航》 | ✅ 系统预设 |
| `apocalypse` | 末世 | 灾难后世界、生存斗争 | 《辐射》、《最后生还者》 | ✅ 系统预设 |
| `custom` | 自定义 | 用户自定义的世界观类型 | 用户自定义设定 | ❌ 用户创建 |

---

## 二、世界观配置架构

### 2.1 核心配置接口

```typescript
// 世界观基础配置
export interface WorldviewConfig {
  id: string;
  type: WorldviewType;
  name: string;
  description: string;
  
  // 基础属性
  timeScale: TimeScale;
  techLevel: TechLevel;
  magicLevel: MagicLevel;
  politicalComplexity: ComplexityLevel;
  economicSystem: EconomicSystemType;
  
  // 模块适配配置
  moduleConfigs: {
    history: HistoryModuleConfig;
    politics: PoliticsModuleConfig;
    economy: EconomyModuleConfig;
    map: MapModuleConfig;
    races: RacesModuleConfig;
    systems: SystemsModuleConfig;
  };
  
  // 视觉主题
  theme: WorldviewTheme;
  
  // 关联规则
  relationRules: RelationRule[];
  
  // 预设内容
  presets: WorldviewPreset[];
}

// 世界观类型定义
export type WorldviewType = 
  | 'xianxia'     // 仙侠
  | 'historical'  // 历史
  | 'western'     // 西幻
  | 'modern'      // 现代
  | 'scifi'       // 科幻
  | 'apocalypse'  // 末世
  | 'custom';     // 自定义

// 时间尺度
export type TimeScale = 
  | 'ancient'     // 古代
  | 'medieval'    // 中世纪
  | 'renaissance' // 文艺复兴
  | 'industrial'  // 工业时代
  | 'modern'      // 现代
  | 'future';     // 未来

// 科技水平
export type TechLevel = 
  | 'primitive'   // 原始
  | 'medieval'    // 中世纪
  | 'industrial'  // 工业
  | 'information' // 信息
  | 'advanced'    // 先进
  | 'transcendent'; // 超越

// 魔法水平
export type MagicLevel = 
  | 'none'        // 无魔法
  | 'low'         // 低魔
  | 'medium'      // 中魔
  | 'high'        // 高魔
  | 'divine';     // 神级

// 复杂度等级
export type ComplexityLevel = 
  | 'simple'      // 简单
  | 'complex'     // 复杂
  | 'highly_complex'; // 高度复杂

// 经济系统类型
export type EconomicSystemType = 
  | 'barter'      // 物物交换
  | 'feudal'      // 封建
  | 'mercantile'  // 重商主义
  | 'capitalist'  // 资本主义
  | 'socialist'   // 社会主义
  | 'post_scarcity'; // 后稀缺
```

### 2.2 模块特定配置

```typescript
// 历史模块配置
export interface HistoryModuleConfig {
  // 时间单位
  timeUnit: 'year' | 'era' | 'cycle' | 'epoch';
  
  // 事件类型适配
  eventTypes: WorldviewEventType[];
  
  // 时代主题适配
  eraThemes: WorldviewEraTheme[];
  
  // 时间轴样式
  timelineStyle: 'linear' | 'cyclical' | 'spiral' | 'branching';
  
  // 历史记录方式
  recordingMethod: 'chronicle' | 'oral' | 'digital' | 'magical';
}

// 政治模块配置
export interface PoliticsModuleConfig {
  // 政治实体类型
  entityTypes: WorldviewPoliticalEntityType[];
  
  // 政治体制
  governmentTypes: WorldviewGovernmentType[];
  
  // 立场体系
  alignmentSystem: 'dnd' | 'confucian' | 'modern' | 'faction';
  
  // 权力结构
  powerStructure: 'centralized' | 'decentralized' | 'federal' | 'tribal';
}

// 经济模块配置
export interface EconomyModuleConfig {
  // 经济实体类型
  entityTypes: WorldviewEconomicEntityType[];
  
  // 货币系统
  currencyTypes: WorldviewCurrencyType[];
  
  // 资源类型
  resourceTypes: WorldviewResourceType[];
  
  // 贸易方式
  tradeMethods: WorldviewTradeMethod[];
}
```

---

## 三、世界观特定配置

### 3.1 仙侠世界观配置

```typescript
const xianxiaConfig: WorldviewConfig = {
  id: 'xianxia-default',
  type: 'xianxia',
  name: '标准仙侠世界',
  description: '修真修仙的东方玄幻世界，包含门派斗争、法宝丹药等元素',
  
  timeScale: 'ancient',
  techLevel: 'medieval',
  magicLevel: 'high',
  politicalComplexity: 'complex',
  economicSystem: 'feudal',
  
  moduleConfigs: {
    history: {
      timeUnit: 'era',
      eventTypes: [
        { type: 'cultivation_breakthrough', label: '修为突破', icon: '🧘', color: '#8b5cf6' },
        { type: 'sect_foundation', label: '门派创立', icon: '🏯', color: '#059669' },
        { type: 'treasure_discovery', label: '法宝现世', icon: '💎', color: '#f59e0b' },
        { type: 'tribulation', label: '天劫降临', icon: '⚡', color: '#dc2626' }
      ],
      eraThemes: [
        { theme: 'primordial', label: '洪荒时代', color: '#7c3aed' },
        { theme: 'immortal', label: '仙道盛世', color: '#10b981' },
        { theme: 'demonic', label: '魔道乱世', color: '#ef4444' }
      ],
      timelineStyle: 'cyclical',
      recordingMethod: 'magical'
    },
    
    politics: {
      entityTypes: [
        { type: 'sect', label: '修仙门派', icon: '🏯', color: '#059669' },
        { type: 'clan', label: '修仙世家', icon: '👨‍👩‍👧‍👦', color: '#7c3aed' },
        { type: 'immortal_emperor', label: '仙帝', icon: '👑', color: '#f59e0b' },
        { type: 'demon_king', label: '魔尊', icon: '😈', color: '#dc2626' }
      ],
      governmentTypes: [
        { type: 'sect_hierarchy', label: '门派等级制' },
        { type: 'immortal_monarchy', label: '仙帝专制' },
        { type: 'alliance_council', label: '联盟议会制' }
      ],
      alignmentSystem: 'confucian',
      powerStructure: 'decentralized'
    },
    
    economy: {
      entityTypes: [
        { type: 'spirit_stone', label: '灵石', icon: '💎', color: '#8b5cf6' },
        { type: 'elixir', label: '丹药', icon: '💊', color: '#10b981' },
        { type: 'magical_artifact', label: '法宝', icon: '⚔️', color: '#f59e0b' },
        { type: 'cultivation_resource', label: '修炼资源', icon: '🌿', color: '#059669' }
      ],
      currencyTypes: [
        { type: 'spirit_stone', label: '灵石货币' },
        { type: 'contribution_point', label: '贡献点' },
        { type: 'favor', label: '人情债' }
      ],
      resourceTypes: [
        { type: 'spiritual', label: '灵气资源' },
        { type: 'alchemical', label: '炼丹材料' },
        { type: 'artifact', label: '炼器材料' }
      ],
      tradeMethods: [
        { type: 'auction', label: '拍卖会' },
        { type: 'barter', label: '以物易物' },
        { type: 'mission_reward', label: '任务奖励' }
      ]
    }
  },
  
  theme: {
    primaryColor: '#7c3aed',
    secondaryColor: '#10b981',
    accentColor: '#f59e0b',
    backgroundGradient: 'linear-gradient(135deg, #7c3aed 0%, #10b981 50%, #f59e0b 100%)',
    fontFamily: 'Noto Serif SC, serif'
  }
};
```

### 3.2 科幻世界观配置

```typescript
const scifiConfig: WorldviewConfig = {
  id: 'scifi-default',
  type: 'scifi',
  name: '标准科幻世界',
  description: '高科技的星际文明世界，包含人工智能、星际旅行等元素',
  
  timeScale: 'future',
  techLevel: 'advanced',
  magicLevel: 'none',
  politicalComplexity: 'highly_complex',
  economicSystem: 'post_scarcity',
  
  moduleConfigs: {
    history: {
      timeUnit: 'epoch',
      eventTypes: [
        { type: 'technological_breakthrough', label: '科技突破', icon: '🔬', color: '#0ea5e9' },
        { type: 'first_contact', label: '首次接触', icon: '👽', color: '#10b981' },
        { type: 'ai_awakening', label: 'AI觉醒', icon: '🤖', color: '#64748b' },
        { type: 'interstellar_war', label: '星际战争', icon: '🚀', color: '#dc2626' }
      ],
      eraThemes: [
        { theme: 'space_age', label: '太空时代', color: '#0ea5e9' },
        { theme: 'ai_dominance', label: 'AI主导', color: '#64748b' },
        { theme: 'galactic_empire', label: '银河帝国', color: '#7c3aed' }
      ],
      timelineStyle: 'linear',
      recordingMethod: 'digital'
    },
    
    politics: {
      entityTypes: [
        { type: 'stellar_empire', label: '星际帝国', icon: '👑', color: '#7c3aed' },
        { type: 'corporate_alliance', label: '企业联盟', icon: '🏢', color: '#0ea5e9' },
        { type: 'ai_governance', label: 'AI治理', icon: '🤖', color: '#64748b' },
        { type: 'rebel_faction', label: '反抗组织', icon: '⚔️', color: '#dc2626' }
      ],
      governmentTypes: [
        { type: 'technocracy', label: '技术官僚制' },
        { type: 'corporate_oligarchy', label: '企业寡头制' },
        { type: 'ai_demarchy', label: 'AI抽签制' }
      ],
      alignmentSystem: 'modern',
      powerStructure: 'federal'
    },
    
    economy: {
      entityTypes: [
        { type: 'energy_credit', label: '能量信用', icon: '⚡', color: '#f59e0b' },
        { type: 'nanomaterial', label: '纳米材料', icon: '🔬', color: '#64748b' },
        { type: 'data_asset', label: '数据资产', icon: '💾', color: '#0ea5e9' },
        { type: 'intellectual_property', label: '知识产权', icon: '📜', color: '#7c3aed' }
      ],
      currencyTypes: [
        { type: 'digital_credit', label: '数字信用' },
        { type: 'energy_unit', label: '能量单位' },
        { type: 'reputation', label: '声誉积分' }
      ],
      resourceTypes: [
        { type: 'energy', label: '能源' },
        { type: 'computational', label: '计算资源' },
        { type: 'biological', label: '生物资源' }
      ],
      tradeMethods: [
        { type: 'quantum_exchange', label: '量子交易' },
        { type: 'ai_negotiation', label: 'AI协商' },
        { type: 'reputation_based', label: '声誉交易' }
      ]
    }
  },
  
  theme: {
    primaryColor: '#0ea5e9',
    secondaryColor: '#64748b',
    accentColor: '#7c3aed',
    backgroundGradient: 'linear-gradient(135deg, #0ea5e9 0%, #64748b 50%, #7c3aed 100%)',
    fontFamily: 'Inter, system-ui, sans-serif'
  }
};
```

### 3.3 其他世界观配置摘要

```typescript
// 历史世界观配置摘要
const historicalConfig: Partial<WorldviewConfig> = {
  timeScale: 'medieval',
  techLevel: 'medieval',
  magicLevel: 'none',
  politicalComplexity: 'complex',
  economicSystem: 'feudal'
};

// 西幻世界观配置摘要
const westernConfig: Partial<WorldviewConfig> = {
  timeScale: 'medieval',
  techLevel: 'medieval',
  magicLevel: 'medium',
  politicalComplexity: 'complex',
  economicSystem: 'feudal'
};

// 现代世界观配置摘要
const modernConfig: Partial<WorldviewConfig> = {
  timeScale: 'modern',
  techLevel: 'information',
  magicLevel: 'none',
  politicalComplexity: 'highly_complex',
  economicSystem: 'capitalist'
};

// 末世世界观配置摘要
const apocalypseConfig: Partial<WorldviewConfig> = {
  timeScale: 'modern',
  techLevel: 'industrial',
  magicLevel: 'none',
  politicalComplexity: 'simple',
  economicSystem: 'barter'
};
```

---

## 四、模块适配机制

### 4.1 动态内容适配

```typescript
// 世界观适配器
export class WorldviewAdapter {
  private config: WorldviewConfig;
  
  constructor(worldviewType: WorldviewType) {
    this.config = this.loadConfig(worldviewType);
  }
  
  // 适配历史事件类型
  adaptEventTypes(baseTypes: EventType[]): WorldviewEventType[] {
    return baseTypes.map(type => {
      const adaptedType = this.config.moduleConfigs.history.eventTypes
        .find(t => t.originalType === type.type);
      return adaptedType || this.createDefaultAdaptation(type);
    });
  }
  
  // 适配政治实体类型
  adaptPoliticalEntities(baseEntities: PoliticalEntityType[]): WorldviewPoliticalEntityType[] {
    return baseEntities.map(entity => {
      const adaptedEntity = this.config.moduleConfigs.politics.entityTypes
        .find(e => e.originalType === entity.type);
      return adaptedEntity || this.createDefaultAdaptation(entity);
    });
  }
  
  // 适配经济实体类型
  adaptEconomicEntities(baseEntities: EconomicEntityType[]): WorldviewEconomicEntityType[] {
    return baseEntities.map(entity => {
      const adaptedEntity = this.config.moduleConfigs.economy.entityTypes
        .find(e => e.originalType === entity.type);
      return adaptedEntity || this.createDefaultAdaptation(entity);
    });
  }
  
  // 获取世界观特定图标
  getIcon(entityType: string, defaultIcon: string): string {
    const moduleConfig = this.getModuleConfig(entityType);
    const adaptedType = moduleConfig?.entityTypes.find(t => t.type === entityType);
    return adaptedType?.icon || defaultIcon;
  }
  
  // 获取世界观特定颜色
  getColor(entityType: string, defaultColor: string): string {
    const moduleConfig = this.getModuleConfig(entityType);
    const adaptedType = moduleConfig?.entityTypes.find(t => t.type === entityType);
    return adaptedType?.color || defaultColor;
  }
}
```

### 4.2 关联规则适配

```typescript
// 世界观特定关联规则
export interface WorldviewRelationRule {
  worldview: WorldviewType;
  sourceModule: ModuleType;
  targetModule: ModuleType;
  relationPatterns: RelationPattern[];
  strengthMultiplier: number;
  autoDiscovery: boolean;
}

// 关联模式
export interface RelationPattern {
  name: string;
  description: string;
  sourceConditions: Condition[];
  targetConditions: Condition[];
  relationType: RelationType;
  confidence: number;
}

// 示例：仙侠世界的关联规则
const xianxiaRelationRules: WorldviewRelationRule[] = [
  {
    worldview: 'xianxia',
    sourceModule: 'history',
    targetModule: 'politics',
    relationPatterns: [
      {
        name: '门派创立事件',
        description: '历史事件中的门派创立与政治实体中的门派关联',
        sourceConditions: [{ field: 'eventType', operator: 'equals', value: 'sect_foundation' }],
        targetConditions: [{ field: 'entityType', operator: 'equals', value: 'sect' }],
        relationType: 'causal',
        confidence: 0.9
      }
    ],
    strengthMultiplier: 1.2,
    autoDiscovery: true
  }
];
```

---

## 五、前端集成方案

### 5.1 世界观选择器组件

```typescript
// 世界观选择器组件
const WorldviewSelector: React.FC<{
  selectedWorldview: WorldviewType;
  onWorldviewChange: (worldview: WorldviewType) => void;
}> = ({ selectedWorldview, onWorldviewChange }) => {
  const worldviews: WorldviewOption[] = [
    { type: 'xianxia', name: '仙侠', icon: '🧘', color: '#7c3aed' },
    { type: 'historical', name: '历史', icon: '📜', color: '#c9a227' },
    { type: 'western', name: '西幻', icon: '⚔️', color: '#b91c1c' },
    { type: 'modern', name: '现代', icon: '🏢', color: '#64748b' },
    { type: 'scifi', name: '科幻', icon: '🚀', color: '#0ea5e9' },
    { type: 'apocalypse', name: '末世', icon: '💀', color: '#57534e' }
  ];
  
  return (
    <div className="worldview-selector">
      {worldviews.map(worldview => (
        <WorldviewCard
          key={worldview.type}
          worldview={worldview}
          selected={selectedWorldview === worldview.type}
          onClick={() => onWorldviewChange(worldview.type)}
        />
      ))}
    </div>
  );
};
```

### 5.2 世界观上下文提供者

```typescript
// 世界观上下文
const WorldviewContext = createContext<WorldviewContextType>({
  worldview: 'historical',
  config: historicalConfig,
  adapter: new WorldviewAdapter('historical'),
  setWorldview: () => {}
});

// 世界观提供者组件
export const WorldviewProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [worldview, setWorldview] = useState<WorldviewType>('historical');
  const [config, setConfig] = useState<WorldviewConfig>(historicalConfig);
  const [adapter, setAdapter] = useState<WorldviewAdapter>(new WorldviewAdapter('historical'));
  
  useEffect(() => {
    const newConfig = loadWorldviewConfig(worldview);
    const newAdapter = new WorldviewAdapter(worldview);
    setConfig(newConfig);
    setAdapter(newAdapter);
  }, [worldview]);
  
  return (
    <WorldviewContext.Provider value={{ worldview, config, adapter, setWorldview }}>
      {children}
    </WorldviewContext.Provider>
  );
};
```

---

## 六、自定义世界观支持

### 6.1 自定义世界观配置接口

```typescript
// 自定义世界观配置接口
export interface CustomWorldviewConfig extends WorldviewConfig {
  type: 'custom';
  isSystem: false;
  createdBy: string;                    // 创建者ID
  createdAt: string;                   // 创建时间
  lastModified: string;                 // 最后修改时间
  isPublic: boolean;                   // 是否公开
  tags: string[];                      // 标签
  basedOn?: WorldviewType;             // 基于哪个系统世界观
  
  // 自定义配置扩展
  customAttributes: Record<string, any>;  // 自定义属性
  validationRules: ValidationRule[];       // 验证规则
  templateVariables: TemplateVariable[];   // 模板变量
}

// 自定义世界观创建请求
export interface CustomWorldviewCreateRequest {
  name: string;
  description?: string;
  basedOn?: WorldviewType;             // 基于现有世界观创建
  baseConfig?: Partial<WorldviewConfig>; // 基础配置
  customAttributes?: Record<string, any>;
  isPublic?: boolean;
  tags?: string[];
}

// 自定义世界观更新请求
export interface CustomWorldviewUpdateRequest {
  name?: string;
  description?: string;
  moduleConfigs?: Partial<ModuleConfigs>;
  theme?: Partial<WorldviewTheme>;
  customAttributes?: Record<string, any>;
  isPublic?: boolean;
  tags?: string[];
}

// 验证规则
export interface ValidationRule {
  field: string;
  validator: 'required' | 'minLength' | 'maxLength' | 'pattern' | 'custom';
  value?: any;
  message: string;
}

// 模板变量
export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'color';
  defaultValue: any;
  options?: string[];                   // 选择类型的选项
  description: string;
}
```

### 6.2 自定义世界观管理器

```typescript
// 自定义世界观管理器
export class CustomWorldviewManager {
  private customConfigs: Map<string, CustomWorldviewConfig> = new Map();
  
  // 创建自定义世界观
  async createCustomWorldview(
    request: CustomWorldviewCreateRequest,
    creatorId: string
  ): Promise<CustomWorldviewConfig> {
    // 验证名称唯一性
    await this.validateNameUniqueness(request.name);
    
    // 基于系统世界观创建基础配置
    const baseConfig = request.basedOn 
      ? await this.getSystemWorldviewConfig(request.basedOn)
      : this.getDefaultConfig();
    
    const customConfig: CustomWorldviewConfig = {
      ...baseConfig,
      ...request.baseConfig,
      id: this.generateCustomId(),
      type: 'custom',
      name: request.name,
      description: request.description || '',
      isSystem: false,
      createdBy: creatorId,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      isPublic: request.isPublic || false,
      tags: request.tags || [],
      basedOn: request.basedOn,
      customAttributes: request.customAttributes || {},
      validationRules: [],
      templateVariables: []
    };
    
    // 保存配置
    await this.saveCustomConfig(customConfig);
    return customConfig;
  }
  
  // 更新自定义世界观
  async updateCustomWorldview(
    configId: string,
    request: CustomWorldviewUpdateRequest
  ): Promise<CustomWorldviewConfig> {
    const existingConfig = await this.getCustomConfig(configId);
    if (!existingConfig) {
      throw new Error(`自定义世界观配置不存在: ${configId}`);
    }
    
    const updatedConfig: CustomWorldviewConfig = {
      ...existingConfig,
      ...request,
      lastModified: new Date().toISOString()
    };
    
    await this.saveCustomConfig(updatedConfig);
    return updatedConfig;
  }
  
  // 获取用户的自定义世界观
  async getUserCustomWorldviews(userId: string): Promise<CustomWorldviewConfig[]> {
    const configs = await this.loadAllCustomConfigs();
    return configs.filter(config => 
      config.createdBy === userId || config.isPublic
    );
  }
  
  // 基于系统世界观创建模板
  async createFromSystemTemplate(
    systemWorldview: WorldviewType,
    customName: string,
    creatorId: string
  ): Promise<CustomWorldviewConfig> {
    const systemConfig = await this.getSystemWorldviewConfig(systemWorldview);
    
    return this.createCustomWorldview({
      name: customName,
      basedOn: systemWorldview,
      baseConfig: {
        ...systemConfig,
        name: customName,
        description: `基于${systemConfig.name}的自定义世界观`
      }
    }, creatorId);
  }
}
```

### 6.3 自定义世界观适配器

```typescript
// 自定义世界观适配器
export class CustomWorldviewAdapter extends WorldviewAdapter {
  private customConfig: CustomWorldviewConfig;
  
  constructor(customConfig: CustomWorldviewConfig) {
    super('custom');
    this.customConfig = customConfig;
  }
  
  // 重写适配方法以支持自定义配置
  override adaptEventTypes(baseTypes: EventType[]): WorldviewEventType[] {
    // 优先使用自定义配置
    if (this.customConfig.moduleConfigs.history.eventTypes.length > 0) {
      return this.customConfig.moduleConfigs.history.eventTypes;
    }
    
    // 回退到基于系统世界观的适配
    if (this.customConfig.basedOn) {
      const systemAdapter = new WorldviewAdapter(this.customConfig.basedOn);
      return systemAdapter.adaptEventTypes(baseTypes);
    }
    
    // 最后使用默认适配
    return super.adaptEventTypes(baseTypes);
  }
  
  // 获取自定义图标
  override getIcon(entityType: string, defaultIcon: string): string {
    // 检查自定义配置中是否有特定图标
    const customIcon = this.findCustomIcon(entityType);
    if (customIcon) return customIcon;
    
    // 回退到系统适配
    return super.getIcon(entityType, defaultIcon);
  }
  
  // 支持自定义模板变量替换
  processTemplateVariables(content: string): string {
    let processed = content;
    this.customConfig.templateVariables.forEach(variable => {
      const pattern = new RegExp(`{{${variable.name}}}`, 'g');
      processed = processed.replace(pattern, variable.defaultValue);
    });
    return processed;
  }
}
```

### 6.4 自定义世界观前端组件

```tsx
// 自定义世界观创建向导
const CustomWorldviewWizard: React.FC<{
  onComplete: (config: CustomWorldviewConfig) => void;
  onCancel: () => void;
}> = ({ onComplete, onCancel }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [config, setConfig] = useState<Partial<CustomWorldviewCreateRequest>>({});
  
  const steps = [
    {
      title: '基础信息',
      component: <BasicInfoStep config={config} onChange={setConfig} />
    },
    {
      title: '选择模板',
      component: <TemplateSelectionStep config={config} onChange={setConfig} />
    },
    {
      title: '模块配置',
      component: <ModuleConfigurationStep config={config} onChange={setConfig} />
    },
    {
      title: '视觉主题',
      component: <ThemeConfigurationStep config={config} onChange={setConfig} />
    }
  ];
  
  return (
    <div className="custom-worldview-wizard">
      <WizardHeader steps={steps} currentStep={currentStep} />
      
      <div className="wizard-content">
        {steps[currentStep].component}
      </div>
      
      <WizardFooter 
        currentStep={currentStep}
        totalSteps={steps.length}
        onNext={() => setCurrentStep(prev => prev + 1)}
        onBack={() => setCurrentStep(prev => prev - 1)}
        onComplete={() => onComplete(config as CustomWorldviewConfig)}
        onCancel={onCancel}
      />
    </div>
  );
};

// 自定义世界观管理面板
const CustomWorldviewManagerPanel: React.FC = () => {
  const [customWorldviews, setCustomWorldviews] = useState<CustomWorldviewConfig[]>([]);
  const [showWizard, setShowWizard] = useState(false);
  
  useEffect(() => {
    loadCustomWorldviews();
  }, []);
  
  const loadCustomWorldviews = async () => {
    const worldviews = await customWorldviewManager.getUserCustomWorldviews(currentUserId);
    setCustomWorldviews(worldviews);
  };
  
  return (
    <div className="custom-worldview-manager">
      <div className="manager-header">
        <h2>自定义世界观管理</h2>
        <Button onClick={() => setShowWizard(true)}>
          + 创建自定义世界观
        </Button>
      </div>
      
      <div className="worldview-grid">
        {customWorldviews.map(worldview => (
          <CustomWorldviewCard 
            key={worldview.id}
            worldview={worldview}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        ))}
      </div>
      
      {showWizard && (
        <CustomWorldviewWizard
          onComplete={handleWizardComplete}
          onCancel={() => setShowWizard(false)}
        />
      )}
    </div>
  );
};
```

---

## 七、总结

本世界观配置系统为 LocalScribe 提供了：

1. **全面的世界观支持**：覆盖六种主要世界观类型和自定义世界观
2. **灵活的配置架构**：支持模块级别的深度定制和自定义扩展
3. **智能的内容适配**：根据世界观类型动态调整界面内容
4. **统一的视觉主题**：为不同世界观提供独特的视觉体验
5. **强大的关联能力**：支持世界观特定的关联规则
6. **自定义扩展能力**：用户可创建和管理自己的世界观配置

通过此系统，用户可以轻松创建、切换和自定义不同的世界观设定，享受更加个性化和沉浸式的世界观构建体验。