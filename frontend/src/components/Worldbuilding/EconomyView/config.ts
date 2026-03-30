import {
  EconomicEntityType,
  EconomicLevel,
  EconomicRelationType,
  EntityTypeConfig,
  RelationTypeConfig,
  LevelConfig,
  LineStyle,
} from './types';

// 默认实体类型配置
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

// 默认关系类型配置
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

// 默认经济等级配置
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

// 动画配置
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

// 卡片动画变体
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

// 内容展开动画变体
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

// 解析实体类型
export const parseEntityType = (color?: string): EconomicEntityType | undefined => {
  if (!color || !color.startsWith('type:')) return undefined;
  const parts = color.split(':');
  return parts[1] || undefined;
};

// 解析经济等级
export const parseEntityLevel = (color?: string): EconomicLevel => {
  if (!color) return 'regional';
  if (color.startsWith('type:')) {
    const parts = color.split(':');
    if (parts.length >= 3) {
      return parts[2];
    }
    return 'regional';
  }
  return 'regional';
};

// 解析关系类型
export const parseRelationType = (relationStr?: string): EconomicRelationType | undefined => {
  if (!relationStr) return undefined;
  const parts = relationStr.split(':');
  return parts[0] || undefined;
};

// 格式化实体类型
export const formatEntityType = (type: EconomicEntityType, level?: EconomicLevel): string => {
  if (level) {
    return `type:${type}:${level}`;
  }
  return `type:${type}`;
};

// 格式化经济等级
export const formatEntityLevel = (level: EconomicLevel): string => level;

// 格式化关系类型
export const formatRelationType = (
  relationType: EconomicRelationType,
  targetId: string,
  volume?: string,
  startDate?: string,
  endDate?: string
): string => {
  return `${relationType}:${targetId}:${volume || ''}:${startDate || ''}:${endDate || ''}`;
};

// 获取实体类型配置
export const getEntityTypeConfig = (
  entityType: EconomicEntityType,
  configs: EntityTypeConfig[]
): EntityTypeConfig | undefined => {
  return configs.find((c) => c.id === entityType);
};

// 获取等级配置
export const getLevelConfig = (level: EconomicLevel, configs: LevelConfig[]): LevelConfig | undefined => {
  return configs.find((c) => c.id === level);
};

// 获取关系类型配置
export const getRelationTypeConfig = (
  relationType: EconomicRelationType,
  configs: RelationTypeConfig[]
): RelationTypeConfig | undefined => {
  return configs.find((c) => c.id === relationType);
};

// 获取连线样式 CSS（已弃用，RelationGraph 使用 SVG path 实现波浪线）
// 保留此函数以备将来其他地方使用
export const getLineStyleCSS = (lineStyle: LineStyle): string => {
  switch (lineStyle) {
    case 'solid':
      return 'solid';
    case 'dashed':
      return 'dashed';
    case 'dotted':
      return 'dotted';
    case 'wavy':
      return 'wavy'; // 注意：CSS 不支持 wavy border-style，需要使用其他方式实现
    default:
      return 'solid';
  }
};
