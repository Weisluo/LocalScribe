import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { animationConfig } from './config';
import { EraTimelineProps, Event, EventLevel, TimelineTooltipProps } from './types';
import { TimelineTooltip } from './TimelineTooltip';

const getEventDotSize = (level: EventLevel): { size: number; innerSize: number } => {
  switch (level) {
    case 'critical': return { size: 16, innerSize: 6 };
    case 'major': return { size: 12, innerSize: 5 };
    case 'normal': return { size: 10, innerSize: 4 };
    case 'minor': return { size: 8, innerSize: 3 };
    default: return { size: 10, innerSize: 4 };
  }
};

const getEventDotColor = (level: EventLevel): { bg: string; gradient: string; shadow: string } => {
  switch (level) {
    case 'critical':
      return { bg: 'bg-gradient-to-br from-primary to-primary/80', gradient: 'from-primary to-accent', shadow: 'shadow-primary/40' };
    case 'major':
      return { bg: 'bg-gradient-to-br from-accent to-accent/80', gradient: 'from-accent to-accent/70', shadow: 'shadow-accent/30' };
    case 'normal':
      return { bg: 'bg-gradient-to-br from-muted-foreground/70 to-muted-foreground/50', gradient: 'from-muted-foreground/70 to-muted-foreground/50', shadow: 'shadow-muted-foreground/20' };
    case 'minor':
      return { bg: 'bg-gradient-to-br from-muted-foreground/50 to-muted-foreground/30', gradient: 'from-muted-foreground/50 to-muted-foreground/30', shadow: 'shadow-muted-foreground/10' };
    default:
      return { bg: 'bg-gradient-to-br from-muted-foreground/70 to-muted-foreground/50', gradient: 'from-muted-foreground/70 to-muted-foreground/50', shadow: 'shadow-muted-foreground/20' };
  }
};

const getPosition = (index: number, total: number): number => {
  if (total <= 1) return 50;
  const padding = 10;
  const available = 100 - padding * 2;
  return padding + (index / (total - 1)) * available;
};

export const EraTimeline = ({ events, eraId: _eraId }: EraTimelineProps) => {
  const [tooltip, setTooltip] = useState<TimelineTooltipProps>({
    event: null,
    position: null,
  });

  const handleMouseEnter = useCallback((event: Event, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      event: { name: event.name, eventDate: event.eventDate },
      position: { x: rect.right + window.scrollX, y: rect.top + rect.height / 2 + window.scrollY },
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTooltip({ event: null, position: null });
  }, []);

  const sortedEvents = [...events].sort((a, b) => a.order_index - b.order_index);

  if (sortedEvents.length === 0) {
    return (
      <div className="relative flex-shrink-0 w-12 h-full flex justify-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-full rounded-full overflow-hidden bg-gradient-to-b from-primary/50 via-accent/40 to-muted/20 opacity-60" />
      </div>
    );
  }

  return (
    <div className="relative flex-shrink-0 w-12 h-full flex justify-center">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-full rounded-full overflow-hidden bg-gradient-to-b from-primary/50 via-accent/40 to-muted/20 opacity-60" />

      {sortedEvents.map((event, index) => {
        const level = event.level || 'normal';
        const { size, innerSize } = getEventDotSize(level);
        const { bg, shadow } = getEventDotColor(level);
        const positionPercent = getPosition(index, sortedEvents.length);
        const isCritical = level === 'critical';

        return (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              ...animationConfig.spring,
              delay: index * 0.05,
            }}
            className={`absolute left-1/2 -translate-x-1/2 cursor-pointer z-10 ${isCritical ? '' : 'hover:scale-125'} transition-transform duration-200`}
            style={{ top: `${positionPercent}%` }}
            onMouseEnter={(e) => handleMouseEnter(event, e)}
            onMouseLeave={handleMouseLeave}
          >
            <div
              className={`rounded-full ${bg} ${shadow} flex items-center justify-center`}
              style={{ width: size, height: size }}
            >
              <div
                className="rounded-full bg-white dark:bg-gray-900"
                style={{ width: innerSize, height: innerSize }}
              />
            </div>

            {isCritical && (
              <>
                <motion.div
                  className={`absolute inset-0 rounded-full ${bg}`}
                  initial={{ scale: 1, opacity: 0.6 }}
                  animate={{ scale: 2.2, opacity: 0 }}
                  transition={{
                    duration: 1.8,
                    repeat: Infinity,
                    ease: 'easeOut',
                  }}
                />
                <motion.div
                  className={`absolute inset-0 rounded-full ${bg}`}
                  initial={{ scale: 1, opacity: 0.4 }}
                  animate={{ scale: 1.8, opacity: 0 }}
                  transition={{
                    duration: 1.8,
                    repeat: Infinity,
                    ease: 'easeOut',
                    delay: 0.4,
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
