import { useState, useCallback, useMemo, useEffect } from 'react';
import { Search, Filter, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { StoryEvent, EventType, SearchScope, SearchFilters } from '../types';

interface EventSearchProps {
  events: StoryEvent[];
  onResultSelect: (eventId: string) => void;
  onResultNavigate: (direction: 'next' | 'prev') => void;
  currentResultIndex: number;
  totalResults: number;
  isOpen: boolean;
  onToggle: () => void;
}

const scopeOptions: { value: SearchScope; label: string }[] = [
  { value: 'title', label: '事件标题' },
  { value: 'content', label: '事件内容' },
  { value: 'character', label: '角色' },
  { value: 'location', label: '地点' },
  { value: 'timestamp', label: '时间标记' },
];

const eventTypeOptions: { value: EventType; label: string }[] = [
  { value: 'normal', label: '普通' },
  { value: 'decision', label: '决策' },
  { value: 'milestone', label: '里程碑' },
  { value: 'flashback', label: '闪回' },
  { value: 'flashforward', label: '闪前' },
];

export const EventSearch = ({
  events: _events,
  onResultSelect: _onResultSelect,
  onResultNavigate,
  currentResultIndex,
  totalResults,
  isOpen,
  onToggle,
}: EventSearchProps) => {
  const [keyword, setKeyword] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    scopes: ['title', 'content'],
    eventTypes: [],
    caseSensitive: false,
  });

  const handleKeywordChange = useCallback((value: string) => {
    setKeyword(value);
  }, []);

  const handleScopeToggle = useCallback((scope: SearchScope) => {
    setFilters(prev => {
      const scopes = prev.scopes.includes(scope)
        ? prev.scopes.filter(s => s !== scope)
        : [...prev.scopes, scope];
      return { ...prev, scopes };
    });
  }, []);

  const handleEventTypeToggle = useCallback((type: EventType) => {
    setFilters(prev => {
      const eventTypes = prev.eventTypes?.includes(type)
        ? prev.eventTypes?.filter(t => t !== type)
        : [...(prev.eventTypes || []), type];
      return { ...prev, eventTypes };
    });
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({
      scopes: ['title', 'content'],
      eventTypes: [],
      caseSensitive: false,
    });
    setKeyword('');
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        onToggle();
      }
      if (isOpen) {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (e.shiftKey) {
            onResultNavigate('prev');
          } else {
            onResultNavigate('next');
          }
        }
        if (e.key === 'Escape') {
          onToggle();
        }
        if (e.key === 'F3') {
          e.preventDefault();
          if (e.shiftKey) {
            onResultNavigate('prev');
          } else {
            onResultNavigate('next');
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onToggle, onResultNavigate]);

  if (!isOpen) return null;

  return (
    <div className="border-b border-border/40 bg-card/80 backdrop-blur-sm">
      <div className="flex items-center gap-3 px-6 py-3">
        <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        
        <input
          type="text"
          value={keyword}
          onChange={(e) => handleKeywordChange(e.target.value)}
          placeholder="搜索事件、角色、地点..."
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50
                   focus:outline-none min-w-0"
          autoFocus
        />

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border transition-all
                    ${showFilters 
                      ? 'bg-accent/20 border-accent/40 text-foreground' 
                      : 'border-border/40 text-muted-foreground hover:bg-accent/10 hover:text-foreground'}`}
        >
          <Filter className="h-3 w-3" />
          筛选
        </button>

        {totalResults > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <button
              onClick={() => onResultNavigate('prev')}
              className="p-1 rounded hover:bg-accent/20 transition-colors"
              title="上一个 (Shift+Enter)"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-[40px] text-center">
              {currentResultIndex + 1}/{totalResults}
            </span>
            <button
              onClick={() => onResultNavigate('next')}
              className="p-1 rounded hover:bg-accent/20 transition-colors"
              title="下一个 (Enter)"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <button
          onClick={onToggle}
          className="p-1 rounded hover:bg-accent/20 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {showFilters && (
        <div className="px-6 pb-3 space-y-3 border-t border-border/20 pt-3">
          <div>
            <div className="text-xs font-medium text-foreground mb-1.5">搜索范围</div>
            <div className="flex flex-wrap gap-1.5">
              {scopeOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleScopeToggle(opt.value)}
                  className={`px-2.5 py-1 text-xs rounded-md border transition-all
                           ${filters.scopes.includes(opt.value)
                             ? 'bg-accent/20 border-accent/40 text-foreground'
                             : 'border-border/40 text-muted-foreground hover:bg-accent/10 hover:text-foreground'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-foreground mb-1.5">事件类型</div>
            <div className="flex flex-wrap gap-1.5">
              {eventTypeOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleEventTypeToggle(opt.value)}
                  className={`px-2.5 py-1 text-xs rounded-md border transition-all
                           ${filters.eventTypes?.includes(opt.value)
                             ? 'bg-accent/20 border-accent/40 text-foreground'
                             : 'border-border/40 text-muted-foreground hover:bg-accent/10 hover:text-foreground'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={filters.caseSensitive}
                onChange={(e) => setFilters(prev => ({ ...prev, caseSensitive: e.target.checked }))}
                className="rounded border-border/60"
              />
              区分大小写
            </label>
            <button
              onClick={handleClearFilters}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              清除筛选
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export function useEventSearch(events: StoryEvent[], keyword: string, filters: SearchFilters) {
  const results = useMemo(() => {
    if (!keyword.trim()) return [];

    const searchKey = filters.caseSensitive ? keyword : keyword.toLowerCase();

    return events
      .filter(event => {
        if (filters.eventTypes && filters.eventTypes.length > 0) {
          if (!filters.eventTypes.includes(event.event_type)) return false;
        }
        return true;
      })
      .map(event => {
        const matches: { field: string; positions: number[] }[] = [];
        let score = 0;

        const checkMatch = (text: string, field: string) => {
          if (!text) return;
          const searchText = filters.caseSensitive ? text : text.toLowerCase();
          if (searchText.includes(searchKey)) {
            const positions: number[] = [];
            let index = searchText.indexOf(searchKey);
            while (index !== -1) {
              positions.push(index);
              index = searchText.indexOf(searchKey, index + 1);
            }
            matches.push({ field, positions });
            score += field === 'title' ? 10 : 5;
          }
        };

        if (filters.scopes.includes('title')) checkMatch(event.title, 'title');
        if (filters.scopes.includes('content')) checkMatch(event.content, 'content');
        if (filters.scopes.includes('location')) checkMatch(event.location || '', 'location');
        if (filters.scopes.includes('timestamp')) checkMatch(event.timestamp || '', 'timestamp');
        if (filters.scopes.includes('character') && event.characters) {
          event.characters.forEach(char => checkMatch(char, 'character'));
        }

        return matches.length > 0 ? { event, matches, score } : null;
      })
      .filter((result): result is NonNullable<typeof result> => result !== null)
      .sort((a, b) => b.score - a.score);
  }, [events, keyword, filters]);

  const [currentIndex, setCurrentIndex] = useState(0);

  const navigate = useCallback((direction: 'next' | 'prev') => {
    if (results.length === 0) return;
    
    setCurrentIndex(prev => {
      if (direction === 'next') {
        return (prev + 1) % results.length;
      } else {
        return prev === 0 ? results.length - 1 : prev - 1;
      }
    });
  }, [results.length]);

  useEffect(() => {
    setCurrentIndex(0);
  }, [keyword, filters]);

  return {
    results,
    currentIndex,
    currentResult: results[currentIndex],
    navigate,
    highlightText: useCallback((text: string, _field: string) => {
      if (!keyword.trim()) return text;
      
      const searchKey = filters.caseSensitive ? keyword : keyword.toLowerCase();
      const searchText = filters.caseSensitive ? text : text.toLowerCase();
      
      if (!searchText.includes(searchKey)) return text;
      
      const parts: React.ReactNode[] = [];
      let lastIndex = 0;
      let index = searchText.indexOf(searchKey);
      
      while (index !== -1) {
        if (index > lastIndex) {
          parts.push(text.slice(lastIndex, index));
        }
        parts.push(
          <mark key={index} className="bg-yellow-300/50 text-inherit rounded px-0.5">
            {text.slice(index, index + searchKey.length)}
          </mark>
        );
        lastIndex = index + searchKey.length;
        index = searchText.indexOf(searchKey, lastIndex);
      }
      
      if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex));
      }
      
      return parts.length > 0 ? parts : text;
    }, [keyword, filters.caseSensitive]),
  };
}

export default EventSearch;
