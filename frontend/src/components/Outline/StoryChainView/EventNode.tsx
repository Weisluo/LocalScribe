import { useCallback } from 'react';
import {
  Circle, GitBranch, Flag, History, FastForward,
  MapPin, Users, Clock,
} from 'lucide-react';
import type { StoryEvent, EventType } from '../types';

interface EventNodeProps {
  event: StoryEvent;
  isSelected: boolean;
  isConnectionSource: boolean;
  isConnectionMode: boolean;
  isSearchResult?: boolean;
  isCurrentSearchResult?: boolean;
  onSelect: (id: string) => void;
  onDoubleClick: (id: string) => void;
  onConnectionTarget: (id: string) => void;
}

const eventTypeConfig: Record<EventType, {
  borderColor: string;
  icon: React.ReactNode;
  bgAccent: string;
  label: string;
}> = {
  normal: {
    borderColor: 'border-border/60',
    icon: <Circle className="h-3 w-3" />,
    bgAccent: '',
    label: '普通',
  },
  decision: {
    borderColor: 'border-amber-400/60',
    icon: <GitBranch className="h-3 w-3 text-amber-500" />,
    bgAccent: 'bg-amber-500/5',
    label: '决策',
  },
  milestone: {
    borderColor: 'border-purple-400/60',
    icon: <Flag className="h-3 w-3 text-purple-500" />,
    bgAccent: 'bg-purple-500/5',
    label: '里程碑',
  },
  flashback: {
    borderColor: 'border-blue-400/60 border-dashed',
    icon: <History className="h-3 w-3 text-blue-500" />,
    bgAccent: 'bg-blue-500/5',
    label: '闪回',
  },
  flashforward: {
    borderColor: 'border-green-400/60 border-dashed',
    icon: <FastForward className="h-3 w-3 text-green-500" />,
    bgAccent: 'bg-green-500/5',
    label: '闪前',
  },
};

export const EventNode = ({
  event,
  isSelected,
  isConnectionSource,
  isConnectionMode,
  isSearchResult = false,
  isCurrentSearchResult = false,
  onSelect,
  onDoubleClick,
  onConnectionTarget,
}: EventNodeProps) => {
  const config = eventTypeConfig[event.event_type] || eventTypeConfig.normal;

  const handleClick = useCallback(() => {
    if (isConnectionMode) {
      onConnectionTarget(event.id);
    } else {
      onSelect(event.id);
    }
  }, [isConnectionMode, event.id, onSelect, onConnectionTarget]);

  const handleDoubleClick = useCallback(() => {
    if (!isConnectionMode) {
      onDoubleClick(event.id);
    }
  }, [isConnectionMode, event.id, onDoubleClick]);

  return (
    <div
      data-event-id={event.id}
      className={`
        min-w-[160px] max-w-[280px] rounded-lg p-3
        border shadow-sm bg-card cursor-pointer
        transition-all duration-200 relative group
        ${config.borderColor}
        ${config.bgAccent}
        ${isSelected
          ? 'ring-2 ring-accent shadow-md scale-[1.02]'
          : 'hover:border-accent/50 hover:shadow-md'
        }
        ${isConnectionSource 
          ? 'ring-2 ring-primary shadow-lg scale-[1.05]' 
          : ''
        }
        ${isConnectionMode && !isConnectionSource 
          ? 'hover:ring-2 hover:ring-primary/50 cursor-crosshair' 
          : ''
        }
        ${isSearchResult && !isCurrentSearchResult
          ? 'bg-yellow-50/30 dark:bg-yellow-900/10'
          : ''
        }
        ${isCurrentSearchResult
          ? 'ring-2 ring-yellow-400 shadow-lg animate-pulse'
          : ''
        }
      `}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {isConnectionSource && (
        <div className="absolute inset-0 rounded-lg pointer-events-none">
          <div className="absolute inset-0 rounded-lg bg-primary/5 animate-pulse" />
          <div className="absolute -inset-1 rounded-lg border-2 border-primary/30 animate-ping" 
               style={{ animationDuration: '1.5s' }} />
        </div>
      )}

      {isConnectionMode && !isConnectionSource && (
        <div className="absolute inset-0 rounded-lg pointer-events-none">
          <div className="absolute inset-0 rounded-lg border-2 border-dashed border-primary/30 
                          opacity-0 hover:opacity-100 transition-opacity" />
        </div>
      )}

      {event.event_type !== 'normal' && (
        <div className="absolute -top-1 -right-1 p-1 rounded-full bg-card shadow-sm border border-border/40">
          {config.icon}
        </div>
      )}

      {event.event_type === 'milestone' && (
        <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-purple-400" />
      )}

      <div className="flex items-center justify-center gap-1.5 mb-1 relative z-10">
        <span className="text-sm font-semibold text-foreground truncate flex-1 text-center">
          {event.title || '未命名事件'}
        </span>
      </div>

      {event.content && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-1.5 relative z-10 text-center">
          {event.content}
        </p>
      )}

      <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground overflow-hidden relative z-10">
        {event.characters && event.characters.length > 0 && (
          <span className="flex items-center gap-0.5 truncate">
            <Users className="h-3 w-3 flex-shrink-0" />
            {event.characters.length}
          </span>
        )}
        {event.location && (
          <span className="flex items-center gap-0.5 truncate">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            {event.location}
          </span>
        )}
        {event.timestamp && (
          <span className="flex items-center gap-0.5 truncate">
            <Clock className="h-3 w-3 flex-shrink-0" />
            {event.timestamp}
          </span>
        )}
      </div>

      {isConnectionSource && (
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="text-[10px] text-primary font-medium px-2 py-0.5 
                         bg-primary/10 rounded-full border border-primary/20">
            点击目标事件
          </span>
        </div>
      )}
    </div>
  );
};

export default EventNode;
