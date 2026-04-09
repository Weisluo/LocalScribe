import { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { animationConfig, EVENT_TYPE_CONFIG, ERA_THEME_CONFIG } from './config';
import { EraTimelineProps, Event, EventLevel, EventType, TimelineTooltipProps, EraTheme } from './types';
import { TimelineTooltip } from './TimelineTooltip';
import { parseChineseTime, ParsedTime } from '@/utils/timeParser';

const getEventBarWidth = (level: EventLevel): number => {
  switch (level) {
    case 'critical': return 9;
    case 'major': return 6;
    case 'normal': return 3;
    case 'minor': return 1;
    default: return 3;
  }
};

// 获取事件等级的层级权重（越小越细，应该显示在上面）
const getEventLevelPriority = (level: EventLevel): number => {
  switch (level) {
    case 'minor': return 0;   // 最细，最上层
    case 'normal': return 1;
    case 'major': return 2;
    case 'critical': return 3; // 最粗，最下层
    default: return 1;
  }
};

// 获取事件类型的颜色
const getEventTypeColor = (eventType?: EventType): string => {
  if (!eventType) return '#64748b';
  return EVENT_TYPE_CONFIG[eventType]?.color || '#64748b';
};

// 获取事件等级的呼吸灯扩散范围
const getEventGlowSpread = (level: EventLevel): number => {
  switch (level) {
    case 'critical': return 8;
    case 'major': return 5;
    case 'normal': return 3;
    case 'minor': return 0;
    default: return 3;
  }
};

// 获取时代主题色的低饱和度渐变（底部不要太浅）
const getTimelineGradient = (theme?: EraTheme): string => {
  if (!theme || theme === 'standalone') {
    return 'from-slate-500/60 via-slate-400/45 to-slate-400/30';
  }
  
  const themeConfig = ERA_THEME_CONFIG[theme];
  if (!themeConfig) {
    return 'from-slate-400/50 via-slate-300/40 to-slate-200/20';
  }

  // 根据主题返回对应的低饱和度渐变（底部不要太浅）
  const themeGradients: Record<EraTheme, string> = {
    ochre: 'from-amber-700/70 via-amber-600/50 to-amber-500/35',
    gilded: 'from-yellow-600/70 via-yellow-500/50 to-yellow-400/35',
    verdant: 'from-emerald-700/70 via-emerald-600/50 to-emerald-500/35',
    cerulean: 'from-sky-600/70 via-sky-500/50 to-sky-400/35',
    patina: 'from-stone-600/70 via-stone-500/50 to-stone-400/35',
    parchment: 'from-stone-500/70 via-stone-400/50 to-stone-300/35',
    cinnabar: 'from-red-700/70 via-red-600/50 to-red-500/35',
    ink: 'from-gray-700/70 via-gray-600/50 to-gray-500/35',
    standalone: 'from-slate-500/60 via-slate-400/45 to-slate-400/30',
  };

  return themeGradients[theme];
};

// 获取时代主题色的深色版本（用于时间轴顶部）
const getTimelineDarkColor = (theme?: EraTheme): string => {
  if (!theme || theme === 'standalone') return '#64748b';
  
  const themeConfig = ERA_THEME_CONFIG[theme];
  if (!themeConfig) return '#64748b';

  // 返回降低饱和度的深色
  const darkColors: Record<EraTheme, string> = {
    ochre: '#a16207',
    gilded: '#ca8a04',
    verdant: '#047857',
    cerulean: '#0284c7',
    patina: '#57534e',
    parchment: '#a8a29e',
    cinnabar: '#b91c1c',
    ink: '#374151',
    standalone: '#64748b',
  };

  return darkColors[theme];
};

interface TimeBoundary {
  start: ParsedTime;
  end: ParsedTime;
}

interface EventBarPosition {
  top: number;
  height: number;
  leftOffset: number;
  zIndex: number;
  hasDuration: boolean;
}

const BUFFER_YEARS = 9;
const DOT_SIZE = 14;

export const EraTimeline = ({ events, eraId: _eraId, theme }: EraTimelineProps) => {
  const [tooltip, setTooltip] = useState<TimelineTooltipProps>({
    event: null,
    position: null,
  });

  const handleMouseEnter = useCallback((event: Event, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      event: { name: event.name, eventDate: event.eventDate, eventEndDate: event.eventEndDate },
      position: { x: rect.right + window.scrollX + 12, y: rect.top + rect.height / 2 + window.scrollY },
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTooltip({ event: null, position: null });
  }, []);

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      const timeA = a.eventDate ? parseChineseTime(a.eventDate).year : 0;
      const timeB = b.eventDate ? parseChineseTime(b.eventDate).year : 0;
      return timeA - timeB;
    });
  }, [events]);

  const timeBoundary = useMemo<TimeBoundary | null>(() => {
    if (sortedEvents.length === 0) return null;

    let earliestStart: ParsedTime | undefined;
    let latestEnd: ParsedTime | undefined;

    sortedEvents.forEach(event => {
      if (!event.eventDate) return;

      const parsedStart = parseChineseTime(event.eventDate);
      if (parsedStart.year === 0) return;

      if (!earliestStart || parsedStart.year < earliestStart.year) {
        earliestStart = parsedStart;
      }

      const parsedEnd = event.eventEndDate ? parseChineseTime(event.eventEndDate) : parsedStart;
      if (parsedEnd.year === 0) return;
      
      if (!latestEnd || parsedEnd.year > latestEnd.year) {
        latestEnd = parsedEnd;
      }
    });

    if (!earliestStart || !latestEnd) return null;

    const bufferedStart: ParsedTime = {
      eraName: earliestStart.eraName,
      year: earliestStart.year - BUFFER_YEARS,
      isYuanNian: false,
      originalText: '',
      sortValue: earliestStart.sortValue - BUFFER_YEARS
    };

    const bufferedEnd: ParsedTime = {
      eraName: latestEnd.eraName,
      year: latestEnd.year + BUFFER_YEARS,
      isYuanNian: false,
      originalText: '',
      sortValue: latestEnd.sortValue + BUFFER_YEARS
    };

    return { start: bufferedStart, end: bufferedEnd };
  }, [sortedEvents]);

  const calculateEventPositions = useMemo<EventBarPosition[]>(() => {
    if (!timeBoundary || sortedEvents.length === 0) {
      return sortedEvents.map(() => ({
        top: 50,
        height: 0,
        leftOffset: 0,
        zIndex: 10,
        hasDuration: false
      }));
    }

    const { start: boundaryStart, end: boundaryEnd } = timeBoundary;
    const totalYearRange = boundaryEnd.year - boundaryStart.year;
    const totalSortRange = boundaryEnd.sortValue - boundaryStart.sortValue;

    const useYearBasedPosition = totalYearRange >= 1;

    if (totalSortRange <= 0 && totalYearRange <= 0) {
      return sortedEvents.map((_, index) => ({
        top: 10 + (index * 80 / Math.max(sortedEvents.length - 1, 1)),
        height: 0,
        leftOffset: 0,
        zIndex: 10,
        hasDuration: false
      }));
    }

    const rawPositions = sortedEvents.map((event, index) => {
      if (!event.eventDate) {
        return {
          top: 50,
          height: 0,
          leftOffset: 0,
          zIndex: 10 + index,
          hasDuration: false,
          eventIndex: index,
          startTime: 0,
          endTime: 0
        };
      }

      const parsedStart = parseChineseTime(event.eventDate);
      const parsedEnd = event.eventEndDate ? parseChineseTime(event.eventEndDate) : null;

      let startTimePercent: number;
      
      if (parsedStart.year === 0) {
        startTimePercent = 50;
      } else if (useYearBasedPosition && totalYearRange > 0) {
        startTimePercent = ((parsedStart.year - boundaryStart.year) / totalYearRange) * 100;
      } else {
        startTimePercent = ((parsedStart.sortValue - boundaryStart.sortValue) / totalSortRange) * 100;
      }

      if (!parsedEnd) {
        return {
          top: Math.max(2, Math.min(98, startTimePercent)),
          height: 0,
          leftOffset: 0,
          zIndex: 10 + index,
          hasDuration: false,
          eventIndex: index,
          startTime: startTimePercent,
          endTime: startTimePercent + 1
        };
      }

      let endTimePercent: number;
      if (parsedEnd.year === 0) {
        endTimePercent = startTimePercent;
      } else if (useYearBasedPosition && totalYearRange > 0) {
        endTimePercent = ((parsedEnd.year - boundaryStart.year) / totalYearRange) * 100;
      } else {
        endTimePercent = ((parsedEnd.sortValue - boundaryStart.sortValue) / totalSortRange) * 100;
      }
      
      const durationPercent = Math.abs(endTimePercent - startTimePercent);
      const top = Math.max(2, Math.min(98, Math.min(startTimePercent, endTimePercent)));

      if (durationPercent < 1) {
        return {
          top,
          height: 0,
          leftOffset: 0,
          zIndex: 10 + index,
          hasDuration: false,
          eventIndex: index,
          startTime: startTimePercent,
          endTime: startTimePercent + 1
        };
      }

      const maxHeightPercent = 95;
      const actualHeightPercent = Math.min(maxHeightPercent, durationPercent);

      return {
        top,
        height: actualHeightPercent,
        leftOffset: 0,
        zIndex: 10 + index,
        hasDuration: true,
        eventIndex: index,
        startTime: startTimePercent,
        endTime: endTimePercent
      };
    });

    // 使用扫描线算法优化重叠检测
    interface SweepEvent {
      time: number;
      type: 'start' | 'end';
      eventIndex: number;
    }

    const sweepEvents: SweepEvent[] = [];
    rawPositions.forEach((pos) => {
      sweepEvents.push({ time: pos.startTime, type: 'start', eventIndex: pos.eventIndex });
      sweepEvents.push({ time: pos.endTime, type: 'end', eventIndex: pos.eventIndex });
    });

    sweepEvents.sort((a, b) => {
      if (a.time !== b.time) return a.time - b.time;
      return a.type === 'end' ? -1 : 1;
    });

    const overlapCount = new Map<number, number>();
    const activeEvents = new Set<number>();

    for (const event of sweepEvents) {
      if (event.type === 'start') {
        let count = 0;
        for (const activeIndex of activeEvents) {
          if (activeIndex < event.eventIndex) {
            count++;
          }
        }
        overlapCount.set(event.eventIndex, count);
        activeEvents.add(event.eventIndex);
      } else {
        activeEvents.delete(event.eventIndex);
      }
    }

    const positionsWithOverlapHandling = rawPositions.map((pos) => {
      // 根据事件级别计算zIndex：细的事件显示在上面（zIndex更高）
      const event = sortedEvents[pos.eventIndex];
      const levelPriority = getEventLevelPriority(event.level || 'normal');
      // 基础zIndex 20，减去级别优先级（minor=0在顶层，critical=3在底层）
      const baseZIndex = 20 - levelPriority;

      return {
        ...pos,
        leftOffset: 0, // 取消偏移，让事件在相同位置重叠显示
        zIndex: baseZIndex
      };
    });

    return positionsWithOverlapHandling.map(({ eventIndex, startTime, endTime, ...rest }) => rest);
  }, [timeBoundary, sortedEvents]);

  const timelineGradient = getTimelineGradient(theme);
  const timelineDarkColor = getTimelineDarkColor(theme);

  if (sortedEvents.length === 0) {
    return (
      <div className="relative flex-shrink-0 w-16 h-full flex justify-center">
        {/* 空状态时间轴 */}
        <div 
          className={`absolute top-0 left-1/2 -translate-x-1/2 w-2 h-full rounded-full bg-gradient-to-b ${timelineGradient}`}
          style={{
            boxShadow: `inset 0 0 4px rgba(0,0,0,0.1), 0 0 8px ${timelineDarkColor}20`
          }}
        />
      </div>
    );
  }

  return (
    <div className="relative flex-shrink-0 w-20 h-full flex justify-center">
      {/* 主时间轴线 - 加宽并添加渐变 */}
      <div 
        className={`absolute top-0 left-1/2 -translate-x-1/2 w-4 h-full rounded-full bg-gradient-to-b ${timelineGradient}`}
        style={{
          boxShadow: `
            inset 0 0 6px rgba(0,0,0,0.15),
            inset 0 2px 4px rgba(255,255,255,0.3),
            0 0 12px ${timelineDarkColor}25,
            0 2px 8px rgba(0,0,0,0.1)
          `
        }}
      />

      {/* 时间轴高光效果 */}
      <div 
        className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-full rounded-full opacity-60"
        style={{
          background: `linear-gradient(180deg, 
            ${timelineDarkColor}80 0%, 
            ${timelineDarkColor}40 30%, 
            transparent 70%
          )`,
        }}
      />

      {sortedEvents.map((event, index) => {
        const level = event.level || 'normal';
        const barWidth = getEventBarWidth(level);
        const position = calculateEventPositions[index];
        const typeColor = getEventTypeColor(event.eventType);
        const glowSpread = getEventGlowSpread(level);

        return (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: position.leftOffset }}
            transition={{
              ...animationConfig.spring,
              delay: index * 0.06,
            }}
            className="absolute cursor-pointer group"
            style={{
              top: `${position.top}%`,
              height: position.hasDuration ? `${position.height}%` : undefined,
              transform: position.hasDuration ? undefined : `translateY(${DOT_SIZE / 2}px)`,
              zIndex: position.zIndex,
              left: '50%',
              marginLeft: '8px', // 从时间轴右侧开始（时间轴w-4=16px，一半8px）
            }}
            onMouseEnter={(e) => handleMouseEnter(event, e)}
            onMouseLeave={handleMouseLeave}
          >
            {/* 连接线 - 从时间轴到事件条 */}
            {!position.hasDuration && (
              <div 
                className="absolute top-1/2 -translate-y-1/2 h-0.5 rounded-full opacity-60"
                style={{
                  width: '14px',
                  left: '-14px',
                  background: `linear-gradient(90deg, ${timelineDarkColor}60, ${typeColor}80)`,
                }}
              />
            )}

            <div
              className="rounded-md relative overflow-hidden transition-all duration-200 group-hover:brightness-110 group-hover:scale-105"
              style={{
                width: `${barWidth}px`,
                height: position.hasDuration ? '100%' : `${DOT_SIZE}px`,
                marginTop: position.hasDuration ? 0 : -(DOT_SIZE / 2),
                backgroundColor: typeColor,
                borderRadius: position.hasDuration ? '4px' : '50%',
                boxShadow: position.hasDuration
                  ? `0 3px 10px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.25), 0 0 0 1px rgba(255,255,255,0.1)`
                  : `0 2px 6px rgba(0,0,0,0.15), 0 0 0 2px rgba(255,255,255,0.8), 0 0 0 3px ${typeColor}40`
              }}
            >
              {/* 光泽效果 */}
              <div
                className="absolute inset-0 opacity-50"
                style={{
                  background: position.hasDuration
                    ? 'linear-gradient(180deg, rgba(255,255,255,0.4) 0%, transparent 35%, rgba(0,0,0,0.08) 100%)'
                    : 'linear-gradient(145deg, rgba(255,255,255,0.5) 0%, transparent 50%, rgba(0,0,0,0.1) 100%)'
                }}
              />

              {/* 中心点（仅对无持续时间事件） */}
              {!position.hasDuration && (
                <div
                  className="absolute inset-0 m-auto rounded-full bg-white/95 dark:bg-gray-800/95"
                  style={{ width: barWidth * 0.45, height: barWidth * 0.45 }}
                />
              )}

              {/* 底部高光（仅对有持续时间事件） */}
              {position.hasDuration && (
                <div 
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-white/40 to-transparent" 
                />
              )}
            </div>

            {/* 呼吸灯效果 */}
            {glowSpread > 0 && (
              <motion.div
                className="absolute pointer-events-none"
                style={{
                  width: `${barWidth + glowSpread * 2}px`,
                  height: position.hasDuration ? `calc(100% + ${glowSpread * 2}px)` : `${DOT_SIZE + glowSpread * 2}px`,
                  left: `-${glowSpread}px`,
                  top: position.hasDuration ? `-${glowSpread}px` : `-${glowSpread + DOT_SIZE / 2}px`,
                  marginTop: position.hasDuration ? 0 : DOT_SIZE / 2,
                  backgroundColor: typeColor,
                  filter: `blur(${glowSpread}px)`,
                  borderRadius: position.hasDuration ? '4px' : '50%',
                  zIndex: -1,
                }}
                initial={{ opacity: 0.15 }}
                animate={{ opacity: [0.15, 0.45, 0.15] }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            )}
          </motion.div>
        );
      })}

      <TimelineTooltip event={tooltip.event} position={tooltip.position} />
    </div>
  );
};
