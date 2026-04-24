import { EventLevel, EraTheme, EventType, EraThemeConfig, EventTypeConfig, EventLevelConfig, HistoryModuleConfig } from './types';

export const LEVEL_COLORS: Record<EventLevel, string> = {
  critical: '#6366f1',
  major: '#f59e0b',
  normal: '#64748b',
  minor: '#cbd5e1',
};

export const ERA_THEME_CONFIG: Record<EraTheme, EraThemeConfig> = {
  ochre: {
    label: 'Ochre',
    labelCn: '赭石',
    gradient: 'from-amber-800/20 via-orange-900/15 to-yellow-900/10',
    border: 'border-amber-700/40',
    accent: 'bg-amber-700',
    accentColor: '#b45309',
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
    accentColor: '#ca8a04',
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
    accentColor: '#059669',
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
    accentColor: '#0ea5e9',
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
    accentColor: '#78716c',
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
    accentColor: '#a8a29e',
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
    accentColor: '#dc2626',
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
    accentColor: '#4b5563',
    text: 'text-gray-700 dark:text-gray-300',
    bgLight: 'rgba(80, 80, 90, 0.15)',
    bgDark: 'rgba(60, 60, 70, 0.2)',
    description: '史书是用墨写成的，字缝里渗出岁月的风干',
  },
  standalone: {
    label: 'Standalone',
    labelCn: '独立',
    gradient: 'from-slate-500/15 via-zinc-400/10 to-stone-500/8',
    border: 'border-slate-400/40',
    accent: 'bg-slate-500',
    accentColor: '#64748b',
    text: 'text-slate-600 dark:text-slate-300',
    bgLight: 'rgba(100, 116, 139, 0.12)',
    bgDark: 'rgba(80, 96, 119, 0.15)',
    description: '游离于时代之外的独立事件，等待被归类的记忆碎片',
  },
};

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

export const DEFAULT_ERA_THEME_CONFIGS: (EraThemeConfig & { id: EraTheme })[] = Object.entries(ERA_THEME_CONFIG).map(
  ([key, config]) => ({
    id: key as EraTheme,
    ...config,
  }),
);

export const DEFAULT_EVENT_TYPE_CONFIGS: (EventTypeConfig & { id: EventType })[] = Object.entries(EVENT_TYPE_CONFIG).map(
  ([key, config]) => ({
    id: key as EventType,
    ...config,
  }),
);

export const DEFAULT_LEVEL_CONFIGS: (EventLevelConfig & { id: EventLevel })[] = Object.entries(LEVEL_CONFIG).map(
  ([key, config]) => ({
    id: key as EventLevel,
    ...config,
  }),
);

export const animationConfig = {
  spring: {
    type: 'spring' as const,
    stiffness: 280,
    damping: 28,
    mass: 0.85,
  },
  springSnappy: {
    type: 'spring' as const,
    stiffness: 380,
    damping: 26,
    mass: 0.8,
  },
  springGentle: {
    type: 'spring' as const,
    stiffness: 220,
    damping: 32,
    mass: 1,
  },
  ease: {
    duration: 0.3,
    ease: [0.4, 0, 0.2, 1] as const,
  },
  easeOut: {
    duration: 0.28,
    ease: [0.33, 1, 0.68, 1] as const,
  },
  stagger: {
    staggerChildren: 0.055,
    delayChildren: 0.12,
  },
};

export const cardVariants = {
  hidden: {
    opacity: 0,
    y: 20,
    scale: 0.97,
    filter: 'blur(4px)',
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0.01px)',
    transition: {
      type: 'spring' as const,
      stiffness: 260,
      damping: 28,
      mass: 0.9,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: -12,
    filter: 'blur(3px)',
    transition: {
      duration: 0.25,
      ease: [0.4, 0, 1, 1] as const,
    },
  },
};

export const eraVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.97, filter: 'blur(4px)' },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0.01px)',
    transition: {
      type: 'spring' as const,
      stiffness: 260,
      damping: 28,
      mass: 0.9,
    },
  },
  exit: {
    opacity: 0,
    y: -16,
    scale: 0.96,
    filter: 'blur(3px)',
    transition: {
      duration: 0.25,
      ease: [0.4, 0, 1, 1] as const,
    },
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

export const parseEventLevel = (color?: string): EventLevel => {
  if (!color) return 'normal';
  if (color.startsWith('type:')) {
    const parts = color.split(':');
    if (parts.length >= 3) {
      const levelPart = parts[2];
      switch (levelPart) {
        case 'critical': return 'critical';
        case 'major': return 'major';
        case 'minor': return 'minor';
        default: return 'normal';
      }
    }
    return 'normal';
  }
  switch (color) {
    case '#6366f1':
    case 'primary':
      return 'critical';
    case '#f59e0b':
    case '#3b82f6':
    case 'accent':
      return 'major';
    case '#64748b':
    case '#94a3b8':
      return 'normal';
    case '#cbd5e1':
      return 'minor';
    default:
      return 'normal';
  }
};

export const formatEventLevel = (level: EventLevel): string => LEVEL_COLORS[level];

export const formatEventType = (type: EventType, level?: EventLevel): string => {
  if (level && level !== 'normal') {
    return `type:${type}:${level}`;
  }
  return `type:${type}`;
};

export const parseEraTheme = (color?: string): EraTheme => {
  if (!color) return 'ochre';
  const themeMap: Record<string, EraTheme> = {
    'era:ochre': 'ochre',
    'era:gilded': 'gilded',
    'era:verdant': 'verdant',
    'era:cerulean': 'cerulean',
    'era:patina': 'patina',
    'era:parchment': 'parchment',
    'era:cinnabar': 'cinnabar',
    'era:ink': 'ink',
    'era:standalone': 'standalone',
  };
  return themeMap[color] || 'ochre';
};

export const parseEventType = (color?: string): EventType | undefined => {
  if (!color || !color.startsWith('type:')) return undefined;
  const parts = color.split(':');
  const typePart = parts[1];
  const typeMap: Record<string, EventType> = {
    'imperial': 'imperial',
    'war': 'war',
    'culture': 'culture',
    'discovery': 'discovery',
    'disaster': 'disaster',
    'folk': 'folk',
    'mystery': 'mystery',
    'legacy': 'legacy',
  };
  return typeMap[typePart];
};

export const isEra = (sub: { color?: string; parent_id?: string }): boolean => {
  return (sub.color?.startsWith('era:') || sub.color === '#f59e0b') && !sub.parent_id;
};

export const getEraThemeConfig = (theme: EraTheme, configs: (EraThemeConfig & { id: string })[]): (EraThemeConfig & { id: string }) | undefined => {
  return configs.find((c) => c.id === theme);
};

export const getEventTypeConfig = (type: EventType, configs: (EventTypeConfig & { id: string })[]): (EventTypeConfig & { id: string }) | undefined => {
  return configs.find((c) => c.id === type);
};

export const getEventLevelConfig = (level: EventLevel, configs: (EventLevelConfig & { id: string })[]): (EventLevelConfig & { id: string }) | undefined => {
  return configs.find((c) => c.id === level);
};

export function validateHistoryModuleConfig(content: unknown): HistoryModuleConfig | null {
  if (typeof content !== 'object' || content === null) return null;
  const config = content as Record<string, unknown>;
  if (!Array.isArray(config.eraThemes) || !Array.isArray(config.eventTypes) || !Array.isArray(config.levels)) return null;

  const isValidEraTheme = (item: unknown): item is EraThemeConfig & { id: string } => {
    if (typeof item !== 'object' || item === null) return false;
    const obj = item as Record<string, unknown>;
    return typeof obj.id === 'string' && typeof obj.labelCn === 'string';
  };

  const isValidEventType = (item: unknown): item is EventTypeConfig & { id: string } => {
    if (typeof item !== 'object' || item === null) return false;
    const obj = item as Record<string, unknown>;
    return typeof obj.id === 'string' && typeof obj.labelCn === 'string';
  };

  const isValidLevel = (item: unknown): item is EventLevelConfig & { id: string } => {
    if (typeof item !== 'object' || item === null) return false;
    const obj = item as Record<string, unknown>;
    return typeof obj.id === 'string' && typeof obj.labelCn === 'string';
  };

  if (!config.eraThemes.every(isValidEraTheme) || !config.eventTypes.every(isValidEventType) || !config.levels.every(isValidLevel)) return null;
  return content as unknown as HistoryModuleConfig;
}
