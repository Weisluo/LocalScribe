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

// Props 接口
export interface AddEntityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    description: string;
    entityType: EconomicEntityType;
    level: EconomicLevel;
    icon: string;
    unit?: string;
    customFields?: Record<string, string | string[] | number>;
  }) => void;
  entityTypes: EntityTypeConfig[];
  levels: LevelConfig[];
  selectedEntityType?: string;
  isLoading?: boolean;
  error?: string | null;
}

export interface EditEntityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    description: string;
    entityType: EconomicEntityType;
    level: EconomicLevel;
    icon: string;
    unit?: string;
    customFields?: Record<string, string | string[] | number>;
  }) => void;
  entity: EconomicEntity | null;
  entityTypes: EntityTypeConfig[];
  levels: LevelConfig[];
  isLoading?: boolean;
  error?: string | null;
}

export interface AddRelationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    targetId: string;
    relationType: EconomicRelationType;
    description: string;
    volume?: string;
    startDate?: string;
    endDate?: string;
  }) => void;
  entities: EconomicEntity[];
  relationTypes: RelationTypeConfig[];
  currentEntityId: string;
  isLoading?: boolean;
  error?: string | null;
}

export interface EditRelationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    targetId: string;
    relationType: EconomicRelationType;
    description: string;
    volume?: string;
    startDate?: string;
    endDate?: string;
  }) => void;
  relation: EconomicRelation | null;
  entities: EconomicEntity[];
  relationTypes: RelationTypeConfig[];
  currentEntityId: string;
  isLoading?: boolean;
  error?: string | null;
}

export interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: EconomyModuleConfig;
  onSave: (config: EconomyModuleConfig) => void;
  isLoading?: boolean;
}

export interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; content: Record<string, string> }) => void;
  isLoading?: boolean;
  error?: string | null;
}

export interface EditItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; content: Record<string, string> }) => void;
  item: EconomicItem | null;
  isLoading?: boolean;
  error?: string | null;
}

export interface EconomicCardProps {
  entity: EconomicEntity;
  entityTypeConfig?: EntityTypeConfig;
  levelConfig?: LevelConfig;
  allEntities: EconomicEntity[];
  relationTypes: RelationTypeConfig[];
  onEdit: () => void;
  onDelete: () => void;
  onAddItem: () => void;
  onEditItem: (item: EconomicItem) => void;
  onDeleteItem: (itemId: string) => void;
  onAddRelation: () => void;
  onEditRelation: (relation: EconomicRelation) => void;
  onDeleteRelation: (relationId: string) => void;
  onUpdateDescription: (description: string) => void;
  onUpdateSpecification: (specification: Record<string, string>) => void;
}

export interface EntityTypeTabsProps {
  entityTypes: EntityTypeConfig[];
  activeType: EconomicEntityType;
  onTypeChange: (type: EconomicEntityType) => void;
  onAddType: () => void;
  onOpenConfig: () => void;
}

export interface FilterPanelProps {
  levels: LevelConfig[];
  selectedLevel?: EconomicLevel;
  onLevelChange: (level?: EconomicLevel) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export interface RelationGraphProps {
  entity: EconomicEntity;
  allEntities: EconomicEntity[];
  relationTypes: RelationTypeConfig[];
  onAddRelation: () => void;
  onEditRelation: (relation: EconomicRelation) => void;
  onDeleteRelation: (relationId: string) => void;
}

export interface EconomyViewProps {
  moduleId: string;
}
