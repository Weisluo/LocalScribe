import { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { animationConfig } from './config';
import { EraTimelineProps, Event, EventLevel, TimelineTooltipProps } from './types';
import { TimelineTooltip } from './TimelineTooltip';
import { parseChineseTime, ParsedTime } from '@/utils/timeParser';

const getEventBarWidth = (level: EventLevel): number => {
  switch (level) {
    case 'critical': return 8;
    case 'major': return 6;
    case 'normal': return 5;
    case 'minor': return 4;
    default: return 5;
  }
};

const getEventBarColor = (level: EventLevel): { bg: string; gradient: string; shadow: string; border: string } => {
  switch (level) {
    case 'critical':
      return {
        bg: 'bg-gradient-to-r from-primary to-primary/80',
        gradient: 'from-primary to-accent',
        shadow: 'shadow-primary/50',
        border: 'border-primary/30'
      };
    case 'major':
      return {
        bg: 'bg-gradient-to-r from-accent to-accent/80',
        gradient: 'from-accent to-accent/70',
        shadow: 'shadow-accent/40',
        border: 'border-accent/30'
      };
    case 'normal':
      return {
        bg: 'bg-gradient-to-r from-muted-foreground/70 to-muted-foreground/50',
        gradient: 'from-muted-foreground/70 to-muted-foreground/50',
        shadow: 'shadow-muted-foreground/30',
        border: 'border-muted-foreground/20'
      };
    case 'minor':
      return {
        bg: 'bg-gradient-to-r from-muted-foreground/50 to-muted-foreground/30',
        gradient: 'from-muted-foreground/50 to-muted-foreground/30',
        shadow: 'shadow-muted-foreground/20',
        border: 'border-muted-foreground/10'
      };
    default:
      return {
        bg: 'bg-gradient-to-r from-muted-foreground/70 to-muted-foreground/50',
        gradient: 'from-muted-foreground/70 to-muted-foreground/50',
        shadow: 'shadow-muted-foreground/30',
        border: 'border-muted-foreground/20'
      };
  }
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
const DOT_SIZE = 12;

export const EraTimeline = ({ events, eraId: _eraId }: EraTimelineProps) => {
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
      // 使用 year 而不是 sortValue 来排序，确保同一时代卡片内的事件按年份正确排序
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
      // 忽略无法解析年份的事件（year: 0），避免它们影响时间边界计算
      if (parsedStart.year === 0) return;

      // 使用 year 而不是 sortValue 来比较，因为同一时代卡片内应该是同一朝代
      // 使用 year 可以避免 eraName 哈希值不同导致的比较错误
      if (!earliestStart || parsedStart.year < earliestStart.year) {
        earliestStart = parsedStart;
      }

      const parsedEnd = event.eventEndDate ? parseChineseTime(event.eventEndDate) : parsedStart;
      // 同样忽略无法解析年份的结束日期
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
      // 保持 sortValue 与 year 的一致性：如果原始 sortValue = eraHash * 100000 + year
      // 那么新的 sortValue = eraHash * 100000 + (year - BUFFER_YEARS)
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

    // 使用扫描线算法优化重叠检测，复杂度从 O(n²) 降到 O(n log n)
    // 1. 创建事件点（开始和结束）
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

    // 2. 按时间排序，时间相同则结束事件优先（避免错误重叠）
    sweepEvents.sort((a, b) => {
      if (a.time !== b.time) return a.time - b.time;
      return a.type === 'end' ? -1 : 1;
    });

    // 3. 扫描计算每个事件的重叠数量
    const overlapCount = new Map<number, number>();
    const activeEvents = new Set<number>();

    for (const event of sweepEvents) {
      if (event.type === 'start') {
        // 新事件开始，计算与当前活跃事件的重叠
        let count = 0;
        for (const activeIndex of activeEvents) {
          // 只计算 eventIndex 更小的事件（即在它上方的事件）
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

    // 4. 应用偏移量
    const positionsWithOverlapHandling = rawPositions.map((pos) => {
      const count = overlapCount.get(pos.eventIndex) || 0;
      const offsetAmount = count * 16;
      const maxOffset = 48;
      const finalOffset = Math.min(offsetAmount, maxOffset);

      return {
        ...pos,
        leftOffset: finalOffset,
        zIndex: 10 + count
      };
    });

    return positionsWithOverlapHandling.map(({ eventIndex, startTime, endTime, ...rest }) => rest);
  }, [timeBoundary, sortedEvents]);

  if (sortedEvents.length === 0) {
    return (
      <div className="relative flex-shrink-0 w-20 h-full flex justify-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-full rounded-full overflow-hidden bg-gradient-to-b from-primary/40 via-accent/30 to-muted/15 opacity-50" />
      </div>
    );
  }

  return (
    <div className="relative flex-shrink-0 w-20 h-full flex justify-center">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-full bg-gradient-to-b from-primary/30 via-accent/20 to-transparent opacity-60" />

      {sortedEvents.map((event, index) => {
        const level = event.level || 'normal';
        const barWidth = getEventBarWidth(level);
        const { bg, shadow, border } = getEventBarColor(level);
        const position = calculateEventPositions[index];
        const isCritical = level === 'critical';

        return (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: position.leftOffset }}
            transition={{
              ...animationConfig.spring,
              delay: index * 0.06,
            }}
            className={`absolute cursor-pointer group ${isCritical ? '' : 'hover:brightness-110'} transition-all duration-200`}
            style={{
              top: `${position.top}%`,
              height: position.hasDuration ? `${position.height}%` : undefined,
              transform: position.hasDuration ? undefined : `translateY(${DOT_SIZE / 2}px)`,
              zIndex: position.zIndex,
            }}
            onMouseEnter={(e) => handleMouseEnter(event, e)}
            onMouseLeave={handleMouseLeave}
          >
            <div
              className={`rounded-sm ${bg} ${shadow} ${border} relative overflow-hidden transition-all duration-200 ${
                position.hasDuration ? '' : 'rounded-full'
              } ${isCritical ? 'ring-1 ring-primary/40' : ''}`}
              style={{
                width: `${barWidth}px`,
                height: position.hasDuration ? '100%' : `${DOT_SIZE}px`,
                marginTop: position.hasDuration ? 0 : -(DOT_SIZE / 2),
                boxShadow: position.hasDuration
                  ? `0 2px 8px rgba(0,0,0,${isCritical ? 0.25 : 0.15}), inset 0 1px 0 rgba(255,255,255,0.2)`
                  : `0 1px 3px rgba(0,0,0,${isCritical ? 0.2 : 0.1})`
              }}
            >
              <div
                className="absolute inset-0 opacity-60"
                style={{
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 40%, rgba(0,0,0,0.05) 100%)'
                }}
              />

              {!position.hasDuration && (
                <div
                  className="absolute inset-0 m-auto rounded-full bg-white/90 dark:bg-gray-800/90"
                  style={{ width: barWidth * 0.5, height: barWidth * 0.5 }}
                />
              )}

              {position.hasDuration && (
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
              )}
            </div>

            {isCritical && (
              <>
                <motion.div
                  className={`absolute -inset-0.5 rounded-sm ${bg} opacity-0 group-hover:opacity-100 blur-sm`}
                  transition={{ duration: 0.3 }}
                />
                <motion.div
                  className={`absolute inset-0 rounded-sm ${bg}`}
                  initial={{ opacity: 0.7 }}
                  animate={{ opacity: 0, scale: 1.2 }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeOut',
                  }}
                />
              </>
            )}
          </motion.div>
        );
      })}

      <TimelineTooltip event={tooltip.event} position={tooltip.position} />
    </div>
  );
};
