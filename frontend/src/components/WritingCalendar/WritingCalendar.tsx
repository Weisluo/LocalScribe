import { useState, useMemo, useEffect, useRef } from 'react';
import { BarChart3, ChevronLeft, ChevronRight, X, TrendingUp, Target, Flame, CalendarDays, Settings2, CheckCircle2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface DailyStats {
  date: string;
  wordCount: number;
}

interface WritingCalendarProps {
  isOpen: boolean;
  onClose: () => void;
  dailyStats: DailyStats[];
  currentMonth?: Date;
}

type ViewMode = 'calendar' | 'stats';

// 从 localStorage 读取写作目标
const getStoredGoal = (): number => {
  if (typeof window === 'undefined') return 1000;
  const stored = localStorage.getItem('writing-daily-goal');
  return stored ? parseInt(stored, 10) : 1000;
};

// 保存写作目标到 localStorage
const storeGoal = (goal: number): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('writing-daily-goal', goal.toString());
};

export const WritingCalendar = ({ isOpen, onClose, dailyStats, currentMonth: propMonth }: WritingCalendarProps) => {
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [currentMonth, setCurrentMonth] = useState(propMonth || new Date());
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [dailyGoal, setDailyGoal] = useState<number>(getStoredGoal());
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [tempGoal, setTempGoal] = useState(dailyGoal.toString());
  const [isAnimating, setIsAnimating] = useState(false);
  const prevMonthRef = useRef<Date>(propMonth || new Date());

  // 处理视图切换动画
  const handleViewModeChange = (newMode: ViewMode) => {
    if (newMode !== viewMode) {
      setIsAnimating(true);
      setViewMode(newMode);
      setTimeout(() => setIsAnimating(false), 30);
    }
  };

  // 处理月份切换动画
  const handleMonthChange = (newMonth: Date) => {
    setIsAnimating(true);
    prevMonthRef.current = currentMonth;
    setCurrentMonth(newMonth);
    setTimeout(() => setIsAnimating(false), 40);
  };

  useEffect(() => {
    if (propMonth && propMonth.getTime() !== currentMonth.getTime()) {
      handleMonthChange(propMonth);
    }
  }, [propMonth]);

  // 将统计数据转换为 Map 便于查询
  const statsMap = useMemo(() => {
    const map = new Map<string, number>();
    dailyStats.forEach(stat => {
      map.set(stat.date, stat.wordCount);
    });
    return map;
  }, [dailyStats]);

  // 计算统计数据
  const statistics = useMemo(() => {
    const totalWords = dailyStats.reduce((sum, stat) => sum + stat.wordCount, 0);
    const writingDays = dailyStats.filter(stat => stat.wordCount > 0).length;
    const avgDaily = writingDays > 0 ? Math.round(totalWords / writingDays) : 0;

    // 计算连续写作天数
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

  // 生成日历数据
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { locale: zhCN });
    const calendarEnd = endOfWeek(monthEnd, { locale: zhCN });
    
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  // 获取日期的写作量级别（用于热力图颜色）
  const getHeatLevel = (date: Date): number => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const wordCount = statsMap.get(dateStr) || 0;
    
    if (wordCount === 0) return 0;
    if (wordCount < 500) return 1;
    if (wordCount < 1000) return 2;
    if (wordCount < 2000) return 3;
    return 4;
  };

  // 获取热力图颜色
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

  // 获取星期标题
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  if (!isOpen) return null;

  return (
    <div className="bg-gradient-to-br from-card/90 via-card/70 to-accent/5 backdrop-blur-sm border-t border-border/60 animate-in slide-in-from-top-2 duration-500 ease-out">
      {/* 头部控制栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          {viewMode === 'calendar' ? (
            <>
              <button
                onClick={() => handleMonthChange(subMonths(currentMonth, 1))}
                className="p-1.5 hover:bg-accent/20 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95"
              >
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              <span className={`text-sm font-medium text-foreground min-w-[100px] text-center transition-all duration-300 ${
                isAnimating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
              }`}>
                {format(currentMonth, 'yyyy年MM月', { locale: zhCN })}
              </span>
              <button
                onClick={() => handleMonthChange(addMonths(currentMonth, 1))}
                className="p-1.5 hover:bg-accent/20 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95"
              >
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">统计面板</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleViewModeChange(viewMode === 'calendar' ? 'stats' : 'calendar')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/20 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
          >
            {viewMode === 'calendar' ? (
              <>
                <BarChart3 className="h-3.5 w-3.5" />
                <span>统计</span>
              </>
            ) : (
              <>
                <CalendarDays className="h-3.5 w-3.5" />
                <span>日历</span>
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-accent/20 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95 group"
          >
            <X className="h-4 w-4 text-muted-foreground transition-all duration-200 group-hover:rotate-90 group-hover:text-destructive" />
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="p-4 relative min-h-[300px]">
        {/* 日历视图动画 */}
        <div className={`transition-all duration-500 ease-out ${
          viewMode === 'calendar' 
            ? 'opacity-100 scale-100 translate-x-0' 
            : 'opacity-0 scale-95 -translate-x-4 absolute pointer-events-none'
        }`}>
          {viewMode === 'calendar' && (
          /* 日历视图 */
          <div className="space-y-3">
            {/* 星期标题 */}
            <div className="grid grid-cols-7 gap-1">
              {weekDays.map(day => (
                <div key={day} className="text-center text-xs text-muted-foreground py-1">
                  {day}
                </div>
              ))}
            </div>
            
            {/* 日期网格 */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((date: Date, index: number) => {
                const dateStr = format(date, 'yyyy-MM-dd');
                const isCurrentMonth = isSameMonth(date, currentMonth);
                const isToday = isSameDay(date, new Date());
                const heatLevel = getHeatLevel(date);
                const wordCount = statsMap.get(dateStr) || 0;
                const isHovered = hoveredDate === dateStr;
                
                return (
                  <div
                    key={index}
                    className={`
                      relative aspect-square rounded-lg flex items-center justify-center cursor-pointer
                      transition-all duration-500 ease-out
                      ${isCurrentMonth ? 'text-foreground' : 'text-muted-foreground/40'}
                      ${getHeatColor(heatLevel)}
                      ${isToday ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''}
                      ${isHovered ? 'scale-110 shadow-md z-10' : 'hover:scale-105'}
                      ${isAnimating ? 'opacity-0 translate-y-6' : 'opacity-100 translate-y-0'}
                    `}
                    style={{
                      transitionDelay: isAnimating ? `${(index % 7) * 30 + Math.floor(index / 7) * 60}ms` : '0ms'
                    }}
                    onMouseEnter={() => setHoveredDate(dateStr)}
                    onMouseLeave={() => setHoveredDate(null)}
                  >
                    <span className={`text-xs font-medium ${heatLevel >= 3 ? 'text-white' : ''}`}>
                      {format(date, 'd')}
                    </span>
                    
                    {/* 悬停提示 */}
                    {isHovered && wordCount > 0 && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded-md shadow-lg whitespace-nowrap z-50 animate-in fade-in-50 slide-in-from-bottom-2 duration-200">
                        {wordCount.toLocaleString()} 字
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-popover" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        </div>
        
        {/* 统计面板动画 */}
        <div className={`transition-all duration-500 ease-out ${
          viewMode === 'stats' 
            ? 'opacity-100 scale-100 translate-x-0' 
            : 'opacity-0 scale-95 translate-x-4 absolute pointer-events-none'
        }`}>
          {viewMode === 'stats' && (
          /* 统计面板视图 */
          <div className="space-y-3">
            {/* 概览卡片 - 三列布局 */}
            <div className="grid grid-cols-3 gap-2">
              <div className={`bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-2.5 ring-1 ring-primary/20 transition-all duration-600 ease-out hover:scale-105 hover:shadow-lg ${
                isAnimating ? 'opacity-0 -translate-y-6' : 'opacity-100 translate-y-0'
              }`} style={{
                 transitionDelay: isAnimating ? '100ms' : '0ms'
               }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <CalendarDays className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-medium text-muted-foreground">本月</span>
                </div>
                <div className="text-lg font-bold text-foreground transition-all duration-700 ease-out">
                  {statistics.monthWords.toLocaleString()}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {statistics.monthDays} 天
                </div>
              </div>

              <div className={`bg-gradient-to-br from-accent/10 to-accent/5 rounded-lg p-2.5 ring-1 ring-accent/20 transition-all duration-600 ease-out hover:scale-105 hover:shadow-lg ${
                isAnimating ? 'opacity-0 -translate-y-6' : 'opacity-100 translate-y-0'
              }`} style={{
                 transitionDelay: isAnimating ? '200ms' : '0ms'
               }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Target className="h-3 w-3 text-accent" />
                  <span className="text-[10px] font-medium text-muted-foreground">日均</span>
                </div>
                <div className="text-lg font-bold text-foreground transition-all duration-700 ease-out">
                  {statistics.avgDaily.toLocaleString()}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  字/天
                </div>
              </div>

              <div className={`bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 rounded-lg p-2.5 ring-1 ring-emerald-500/20 transition-all duration-600 ease-out hover:scale-105 hover:shadow-lg ${
                isAnimating ? 'opacity-0 -translate-y-6' : 'opacity-100 translate-y-0'
              }`} style={{
                 transitionDelay: isAnimating ? '300ms' : '0ms'
               }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="h-3 w-3 text-emerald-600" />
                  <span className="text-[10px] font-medium text-muted-foreground">年度</span>
                </div>
                <div className="text-lg font-bold text-foreground transition-all duration-700 ease-out">
                  {statistics.yearWords.toLocaleString()}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {statistics.yearDays} 天
                </div>
              </div>
            </div>

            {/* 累计数据 */}
            <div className={`bg-gradient-to-br from-card/80 to-muted/30 rounded-lg p-3 ring-1 ring-border/40 transition-all duration-600 ease-out hover:shadow-lg ${
              isAnimating ? 'opacity-0 -translate-y-6' : 'opacity-100 translate-y-0'
            }`} style={{
               transitionDelay: isAnimating ? '400ms' : '0ms'
             }}>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center">
                  <div className="text-base font-bold text-foreground transition-all duration-700 ease-out">
                    {statistics.totalWords.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-muted-foreground">总字数</div>
                </div>
                <div className="text-center border-x border-border/30">
                  <div className="text-base font-bold text-foreground transition-all duration-700 ease-out">
                    {statistics.writingDays}
                  </div>
                  <div className="text-[10px] text-muted-foreground">写作天数</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-0.5">
                    <Flame className="h-3 w-3 text-orange-500 transition-all duration-300 hover:scale-110" />
                    <span className="text-base font-bold text-foreground transition-all duration-700 ease-out">
                      {statistics.currentStreak}
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">连续天数</div>
                </div>
              </div>
            </div>
            
            {/* 写作目标设置 */}
            <div className={`bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent rounded-xl p-4 ring-1 ring-emerald-500/20 transition-all duration-600 ease-out hover:shadow-lg ${
              isAnimating ? 'opacity-0 -translate-y-6' : 'opacity-100 translate-y-0'
            }`} style={{
               transitionDelay: isAnimating ? '500ms' : '0ms'
             }}>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <Target className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-foreground">
                      写作目标
                    </div>
                    <button
                      onClick={() => {
                        setIsEditingGoal(true);
                        setTempGoal(dailyGoal.toString());
                      }}
                      className="p-1 hover:bg-emerald-500/20 rounded-md transition-all duration-200 hover:scale-110 active:scale-95 group"
                      title="设置目标"
                    >
                      <Settings2 className="h-3.5 w-3.5 text-emerald-600 transition-all duration-200 group-hover:rotate-45" />
                    </button>
                  </div>
                  
                  {isEditingGoal ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={tempGoal}
                        onChange={(e) => setTempGoal(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const newGoal = parseInt(tempGoal, 10);
                            if (newGoal > 0) {
                              setDailyGoal(newGoal);
                              storeGoal(newGoal);
                            }
                            setIsEditingGoal(false);
                          } else if (e.key === 'Escape') {
                            setIsEditingGoal(false);
                            setTempGoal(dailyGoal.toString());
                          }
                        }}
                        className="w-20 px-2 py-1 text-sm bg-background rounded-md border border-emerald-500/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                        autoFocus
                      />
                      <span className="text-xs text-muted-foreground">字/天</span>
                      <button
                        onClick={() => {
                          const newGoal = parseInt(tempGoal, 10);
                          if (newGoal > 0) {
                            setDailyGoal(newGoal);
                            storeGoal(newGoal);
                          }
                          setIsEditingGoal(false);
                        }}
                        className="p-1 hover:bg-emerald-500/20 rounded-md transition-all duration-200 hover:scale-110 active:scale-95 group"
                      >
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 transition-all duration-200 group-hover:scale-125" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground">
                          每日目标: <span className="font-medium text-emerald-600">{dailyGoal.toLocaleString()}</span> 字
                        </span>
                        <span className={`text-xs font-medium ${statistics.avgDaily >= dailyGoal ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                          {statistics.avgDaily >= dailyGoal ? '已达成' : '进行中'}
                        </span>
                      </div>
                      {/* 今日进度 */}
                      {(() => {
                        const today = format(new Date(), 'yyyy-MM-dd');
                        const todayWords = statsMap.get(today) || 0;
                        const todayProgress = Math.min(100, Math.round((todayWords / dailyGoal) * 100));
                        return (
                          <div className="mt-3 pt-3 border-t border-emerald-500/20 space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">今日进度</span>
                              <span className={`font-medium ${todayWords >= dailyGoal ? 'text-emerald-600' : 'text-foreground'}`}>
                                {todayWords.toLocaleString()} / {dailyGoal.toLocaleString()} 字 ({todayProgress}%)
                              </span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-1000 ease-out ${
                                  todayWords >= dailyGoal 
                                    ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' 
                                    : 'bg-gradient-to-r from-primary/60 to-primary'
                                }`}
                                style={{ 
                                  width: `${todayProgress}%`,
                                  transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1), background 0.5s ease'
                                }}
                              />
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};
