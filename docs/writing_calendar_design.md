# 写作日历功能文档

## 1. 功能概述

写作日历是 LocalScribe 的辅助功能，用于帮助作者追踪和可视化自己的写作进度。它提供了日历热力图和统计数据两种视图，让作者能够直观地了解自己的写作习惯和产出。

### 1.1 核心特性

- **日历热力图**：以颜色深浅展示每日写作量
- **统计数据面板**：展示本月、年度、累计等多维度数据
- **连续写作追踪**：自动计算连续写作天数
- **写作目标设置**：支持自定义每日写作目标
- **今日进度**：实时显示今日写作进度条

## 2. UI 设计

### 2.1 整体布局

```
┌─────────────────────────────────────────────────────────────┐
│  [←] 2024年12月 [→]                    [统计/日历] [×]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┐               │
│  │ 日  │ 一  │ 二  │ 三  │ 四  │ 五  │ 六  │               │
│  ├─────┼─────┼─────┼─────┼─────┼─────┼─────┤               │
│  │     │     │     │     │     │  1  │  2  │               │
│  │     │     │     │     │     │[500]│[1200]│              │
│  ├─────┼─────┼─────┼─────┼─────┼─────┼─────┤               │
│  │ ... │ ... │ ... │ ... │ ... │ ... │ ... │               │
│  └─────┴─────┴─────┴─────┴─────┴─────┴─────┘               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 头部控制栏

- **左侧**：月份导航（上一月/下一月按钮 + 当前月份显示）
- **右侧**：视图切换按钮（日历/统计）、关闭按钮

#### 月份导航交互

```typescript
// 月份切换动画
const handleMonthChange = (newMonth: Date) => {
  setIsAnimating(true);
  prevMonthRef.current = currentMonth;
  setCurrentMonth(newMonth);
  setTimeout(() => setIsAnimating(false), 40);
};

// 月份显示格式
format(currentMonth, 'yyyy年MM月', { locale: zhCN })
```

#### 视图切换按钮

```typescript
type ViewMode = 'calendar' | 'stats';

// 切换动画处理
const handleViewModeChange = (newMode: ViewMode) => {
  if (newMode !== viewMode) {
    setIsAnimating(true);
    setViewMode(newMode);
    setTimeout(() => setIsAnimating(false), 30);
  }
};
```

### 2.3 日历视图

#### 星期标题

```typescript
const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
```

使用 7 列网格布局，居中对齐，小号灰色文字。

#### 日期网格

- **布局**：7 列网格，自适应行数
- **单元格**：正方形（aspect-square），圆角（rounded-lg）
- **当前月**：正常文字颜色
- **非当前月**：淡化文字（text-muted-foreground/40）

#### 热力图颜色级别

根据当日写作字数分配颜色深度：

| 级别 | 字数范围 | 颜色样式 |
|------|----------|----------|
| 0 | 0 字 | `bg-muted/30`（灰色） |
| 1 | 1-499 字 | `bg-emerald-200/60`（浅绿） |
| 2 | 500-999 字 | `bg-emerald-300/70`（中浅绿） |
| 3 | 1000-1999 字 | `bg-emerald-400/80`（中绿） |
| 4 | 2000+ 字 | `bg-emerald-500/90`（深绿） |

```typescript
const getHeatLevel = (date: Date): number => {
  const dateStr = format(date, 'yyyy-MM-dd');
  const wordCount = statsMap.get(dateStr) || 0;
  
  if (wordCount === 0) return 0;
  if (wordCount < 500) return 1;
  if (wordCount < 1000) return 2;
  if (wordCount < 2000) return 3;
  return 4;
};

const getHeatColor = (level: number): string => {
  const colors = [
    'bg-muted/30',
    'bg-emerald-200/60',
    'bg-emerald-300/70',
    'bg-emerald-400/80',
    'bg-emerald-500/90',
  ];
  return colors[level] || colors[0];
};
```

#### 今日标记

使用 2px 主色圆环标记今天：

```typescript
${isToday ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''}
```

#### 悬停效果

- 日期单元格放大（scale-110）
- 显示阴影（shadow-md）
- 弹出字数提示框

```typescript
// 悬停提示
{isHovered && wordCount > 0 && (
  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded-md shadow-lg whitespace-nowrap z-50">
    {wordCount.toLocaleString()} 字
  </div>
)}
```

### 2.4 统计面板视图

#### 概览卡片（三列布局）

```
┌─────────────┬─────────────┬─────────────┐
│ [📅] 本月   │ [🎯] 日均   │ [📈] 年度   │
│ 12,345      │ 1,234       │ 123,456     │
│ 15 天       │ 字/天       │ 89 天       │
└─────────────┴─────────────┴─────────────┘
```

卡片样式：
- 渐变背景：`bg-gradient-to-br from-primary/10 to-primary/5`
- 边框：`ring-1 ring-primary/20`
- 悬停效果：`hover:scale-105 hover:shadow-lg`

#### 累计数据卡片

```
┌─────────────────────────────────────────┐
│  123,456      │      89      │    🔥15   │
│   总字数      │    写作天数   │  连续天数  │
└─────────────────────────────────────────┘
```

#### 写作目标设置

```
┌─────────────────────────────────────────┐
│ [🎯] 写作目标                    [⚙️] │
│                                         │
│ 每日目标: 1,000 字              [已达成] │
│                                         │
│ 今日进度                                │
│ ████████████████░░░░  856 / 1,000 (86%) │
└─────────────────────────────────────────┘
```

目标编辑交互：

```typescript
// 编辑状态
const [isEditingGoal, setIsEditingGoal] = useState(false);
const [tempGoal, setTempGoal] = useState(dailyGoal.toString());

// 保存目标
const handleSaveGoal = () => {
  const newGoal = parseInt(tempGoal, 10);
  if (newGoal > 0) {
    setDailyGoal(newGoal);
    storeGoal(newGoal); // 保存到 localStorage
  }
  setIsEditingGoal(false);
};
```

进度条样式：
- 未达成：`bg-gradient-to-r from-primary/60 to-primary`
- 已达成：`bg-gradient-to-r from-emerald-400 to-emerald-500`

## 3. 业务逻辑

### 3.1 数据来源

写作日历的数据来源于项目目录树中的笔记：

```typescript
// 从目录树生成每日写作统计数据
const dailyStats = useMemo(() => {
  if (!tree) return [];

  const stats = new Map<string, number>();

  const processNode = (node: VolumeNode | ActNode | NoteNode) => {
    if (node.type === 'note') {
      const note = node as NoteNode;
      // 使用 created_at 作为写作日期
      if (note.created_at && note.word_count) {
        const date = format(new Date(note.created_at), 'yyyy-MM-dd');
        const current = stats.get(date) || 0;
        stats.set(date, current + (note.word_count || 0));
      }
    }
    if ('children' in node && node.children) {
      node.children.forEach(processNode);
    }
  };

  tree.forEach(processNode);

  return Array.from(stats.entries()).map(([date, wordCount]) => ({
    date,
    wordCount,
  }));
}, [tree]);
```

**注意**：当前实现使用笔记的 `created_at` 字段作为统计日期，而非实际编辑时间。

### 3.2 统计数据计算

```typescript
const statistics = useMemo(() => {
  // 基础统计
  const totalWords = dailyStats.reduce((sum, stat) => sum + stat.wordCount, 0);
  const writingDays = dailyStats.filter(stat => stat.wordCount > 0).length;
  const avgDaily = writingDays > 0 ? Math.round(totalWords / writingDays) : 0;

  // 连续写作天数计算
  const sortedDates = dailyStats
    .filter(stat => stat.wordCount > 0)
    .map(stat => new Date(stat.date))
    .sort((a, b) => b.getTime() - a.getTime());

  let currentStreak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < sortedDates.length; i++) {
    const date = new Date(sortedDates[i]);
    date.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === currentStreak) {
      currentStreak++;
    } else if (diffDays > currentStreak) {
      break;
    }
  }

  // 本月数据
  const currentMonthStr = format(currentMonth, 'yyyy-MM');
  const monthStats = dailyStats.filter(stat => stat.date.startsWith(currentMonthStr));
  const monthWords = monthStats.reduce((sum, stat) => sum + stat.wordCount, 0);
  const monthDays = monthStats.filter(stat => stat.wordCount > 0).length;

  // 年度数据
  const currentYearStr = format(currentMonth, 'yyyy');
  const yearStats = dailyStats.filter(stat => stat.date.startsWith(currentYearStr));
  const yearWords = yearStats.reduce((sum, stat) => sum + stat.wordCount, 0);
  const yearDays = yearStats.filter(stat => stat.wordCount > 0).length;

  return {
    totalWords,
    writingDays,
    avgDaily,
    currentStreak,
    monthWords,
    monthDays,
    yearWords,
    yearDays,
  };
}, [dailyStats, currentMonth]);
```

### 3.3 写作目标持久化

使用 localStorage 保存用户设置的写作目标：

```typescript
const GOAL_STORAGE_KEY = 'writing-daily-goal';
const DEFAULT_GOAL = 1000;

// 读取目标
const getStoredGoal = (): number => {
  if (typeof window === 'undefined') return DEFAULT_GOAL;
  const stored = localStorage.getItem(GOAL_STORAGE_KEY);
  return stored ? parseInt(stored, 10) : DEFAULT_GOAL;
};

// 保存目标
const storeGoal = (goal: number): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(GOAL_STORAGE_KEY, goal.toString());
};
```

### 3.4 动画效果

#### 月份切换动画

日期单元格依次进入，产生波浪效果：

```typescript
style={{
  transitionDelay: isAnimating 
    ? `${(index % 7) * 30 + Math.floor(index / 7) * 60}ms` 
    : '0ms'
}}
```

- 横向延迟：每列 30ms
- 纵向延迟：每行 60ms

#### 视图切换动画

```typescript
// 日历视图
<div className={`transition-all duration-500 ease-out ${
  viewMode === 'calendar' 
    ? 'opacity-100 scale-100 translate-x-0' 
    : 'opacity-0 scale-95 -translate-x-4 absolute pointer-events-none'
}`}>

// 统计视图
<div className={`transition-all duration-500 ease-out ${
  viewMode === 'stats' 
    ? 'opacity-100 scale-100 translate-x-0' 
    : 'opacity-0 scale-95 translate-x-4 absolute pointer-events-none'
}`}>
```

## 4. 组件接口

### 4.1 Props 定义

```typescript
interface DailyStats {
  date: string;        // 日期格式：yyyy-MM-dd
  wordCount: number;   // 当日写作字数
}

interface WritingCalendarProps {
  isOpen: boolean;                    // 控制显示/隐藏
  onClose: () => void;                // 关闭回调
  dailyStats: DailyStats[];           // 每日统计数据
  currentMonth?: Date;                // 可选：指定当前月份
}
```

### 4.2 使用示例

```typescript
import { WritingCalendar } from '@/components/WritingCalendar';

// 在 EditorPage 中使用
const [showCalendar, setShowCalendar] = useState(false);

// 生成统计数据
const dailyStats = useMemo(() => {
  // ... 从目录树计算
  return [{ date: '2024-12-01', wordCount: 1500 }, ...];
}, [tree]);

// 渲染
<WritingCalendar
  isOpen={showCalendar}
  onClose={() => setShowCalendar(false)}
  dailyStats={dailyStats}
/>
```

## 5. 文件结构

```
frontend/src/components/WritingCalendar/
├── index.ts              # 导出组件
└── WritingCalendar.tsx   # 主组件实现
```

## 6. 依赖库

- **date-fns**: 日期处理（格式化、计算、本地化）
- **lucide-react**: 图标组件

```typescript
import { format, startOfMonth, endOfMonth, eachDayOfInterval, 
         isSameMonth, isSameDay, addMonths, subMonths, 
         startOfWeek, endOfWeek } from 'date-fns';
import { zhCN } from 'date-fns/locale';
```

## 7. 未来优化建议

1. **数据准确性**：使用笔记的 `updated_at` 字段或专门的写作时间记录
2. **历史趋势**：添加月度/年度趋势图表
3. **导出功能**：支持导出写作数据为 CSV/Excel
4. **成就系统**：基于统计数据添加写作成就徽章
5. **多项目统计**：支持跨项目统计写作数据
