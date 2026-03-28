import { useMemo } from 'react';
import type { StoryEvent } from '../types';

interface TimelineProps {
  events: StoryEvent[];
  eventPositions: Map<string, { x: number; y: number; width: number; height: number }>;
  zoom: number;
}

interface TimelineNode {
  eventId: string;
  timestamp: string;
  y: number;
  isHighlighted: boolean;
}

export const Timeline = ({ events, eventPositions, zoom }: TimelineProps) => {
  const timelineNodes = useMemo(() => {
    const nodes: TimelineNode[] = [];
    const timestampMap = new Map<string, string[]>();

    events.forEach(event => {
      if (event.timestamp) {
        const ts = event.timestamp;
        if (!timestampMap.has(ts)) {
          timestampMap.set(ts, []);
        }
        timestampMap.get(ts)!.push(event.id);
      }
    });

    const uniqueTimestamps = Array.from(timestampMap.keys());

    uniqueTimestamps.forEach(timestamp => {
      const eventIds = timestampMap.get(timestamp)!;
      const positions = eventIds
        .map(id => eventPositions.get(id))
        .filter(Boolean) as { x: number; y: number; width: number; height: number }[];

      if (positions.length > 0) {
        const avgY = positions.reduce((sum, pos) => sum + pos.y, 0) / positions.length;
        nodes.push({
          eventId: eventIds[0],
          timestamp,
          y: avgY + 50,
          isHighlighted: false,
        });
      }
    });

    events.forEach(event => {
      if (!event.timestamp) {
        const pos = eventPositions.get(event.id);
        if (pos) {
          const existingNode = nodes.find(n => Math.abs(n.y - (pos.y + 50)) < 40);
          if (!existingNode) {
            nodes.push({
              eventId: event.id,
              timestamp: '',
              y: pos.y + 50,
              isHighlighted: false,
            });
          }
        }
      }
    });

    return nodes.sort((a, b) => a.y - b.y);
  }, [events, eventPositions]);

  if (events.length === 0) return null;

  const timelineHeight = Math.max(...Array.from(eventPositions.values()).map(p => p.y + p.height + 100), 300);

  return (
    <div 
      className="absolute left-0 top-0 bottom-0 w-24 pointer-events-none"
      style={{ height: timelineHeight * zoom }}
    >
      <div className="relative h-full">
        <div 
          className="absolute left-[60px] top-0 bottom-0 w-0.5 bg-border/30"
          style={{ height: timelineHeight }}
        />

        {timelineNodes.map((node, index) => (
          <div
            key={`${node.eventId}-${index}`}
            className="absolute left-0 flex items-center gap-2 pointer-events-auto"
            style={{ 
              top: node.y * zoom,
              transform: 'translateY(-50%)',
            }}
          >
            <div className="w-16 text-right pr-2">
              {node.timestamp && (
                <span className="text-[11px] font-medium text-muted-foreground/70">
                  {node.timestamp}
                </span>
              )}
            </div>
            
            <div className="relative flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30 border-2 border-background
                              shadow-sm" />
              <div className="absolute w-4 h-4 rounded-full bg-primary/10 animate-pulse" 
                   style={{ animationDuration: '2s' }} />
            </div>
          </div>
        ))}

        <div 
          className="absolute left-[60px] top-0 w-0.5 h-8"
          style={{
            background: 'linear-gradient(to bottom, transparent, hsl(var(--muted-foreground) / 0.3))',
          }}
        />
        
        <div 
          className="absolute left-[60px] bottom-0 w-0.5 h-8"
          style={{
            background: 'linear-gradient(to top, transparent, hsl(var(--muted-foreground) / 0.3))',
            top: 'auto',
          }}
        />
      </div>
    </div>
  );
};

export default Timeline;
