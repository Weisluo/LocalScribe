import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { worldbuildingApi } from '@/services/worldbuildingApi';
import { Plus, X, Clock, Sparkles, Search, Edit2, Trash2, ChevronDown } from 'lucide-react';
import { compareTimes, calculateEraBasedPositions, EraTimeInfo } from '@/utils/timeParser';
import {
  Era,
  Event,
  EventItem,
  EventLevel,
  EraTheme,
  HistoryViewProps,
  EventType,
} from './HistoryView/types';
import {
  ERA_THEME_CONFIG,
  animationConfig,
  eraVariants,
  contentVariants,
  parseEraTheme,
  parseEventLevel,
  parseEventType,
  formatEventLevel,
  formatEventType,
  isEra,
} from './HistoryView/config';
import { TimelineTooltip } from './HistoryView/TimelineTooltip';
import { HistorySkeleton } from './HistoryView/HistorySkeleton';
import { EventCard } from './HistoryView/EventCard';
import { AddEraModal } from './HistoryView/modals/AddEraModal';
import { EditEraModal } from './HistoryView/modals/EditEraModal';
import { AddEventModal } from './HistoryView/modals/AddEventModal';
import { EditEventModal } from './HistoryView/modals/EditEventModal';
import { AddItemModal } from './HistoryView/modals/AddItemModal';
import { EditItemModal } from './HistoryView/modals/EditItemModal';

export const HistoryView = ({ moduleId }: HistoryViewProps) => {
  const queryClient = useQueryClient();
  const [showAddEraModal, setShowAddEraModal] = useState(false);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [showEditEventModal, setShowEditEventModal] = useState(false);
  const [showEditEraModal, setShowEditEraModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showEditItemModal, setShowEditItemModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedEra, setSelectedEra] = useState<Era | null>(null);
  const [selectedItem, setSelectedItem] = useState<EventItem | null>(null);
  const [selectedEraId, setSelectedEraId] = useState<string | undefined>();
  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [createItemError, setCreateItemError] = useState<string | null>(null);
  const [editItemError, setEditItemError] = useState<string | null>(null);
  const [expandedEras, setExpandedEras] = useState<Set<string>>(new Set());
  const [editingEraDescId, setEditingEraDescId] = useState<string | null>(null);
  const [editEraDesc, setEditEraDesc] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [tooltipEvent, setTooltipEvent] = useState<{ name: string; eventDate?: string } | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: submodules, isLoading } = useQuery({
    queryKey: ['worldbuilding', 'submodules', moduleId],
    queryFn: () => worldbuildingApi.getSubmodules(moduleId),
  });

  const { data: items } = useQuery({
    queryKey: ['worldbuilding', 'items', moduleId],
    queryFn: () => worldbuildingApi.getItems(moduleId, { include_all: true }),
  });

  useEffect(() => {
    if (!isLoading && submodules) {
      setIsFirstLoad(false);
    }
  }, [isLoading, submodules]);

  const eras: Era[] = (submodules || [])
    .filter(isEra)
    .map((sub) => {
      const iconValue = sub.icon || '';
      const isEraIcon = iconValue.startsWith('era:');
      const [startDate, endDate] = isEraIcon ? iconValue.replace('era:', '').split(':') : ['', ''];
      return {
        id: sub.id,
        name: sub.name,
        description: sub.description,
        startDate,
        endDate,
        order_index: sub.order_index,
        theme: parseEraTheme(sub.color),
      };
    })
    .sort((a, b) => compareTimes(a.startDate, b.startDate));

  const events: Event[] = (submodules || [])
    .filter((sub) => !isEra(sub))
    .map((sub) => {
      const iconValue = sub.icon || '';
      const isDateIcon = iconValue.startsWith('date:');
      const eventType = parseEventType(sub.color);
      return {
        id: sub.id,
        name: sub.name,
        description: sub.description,
        level: parseEventLevel(sub.color),
        eventDate: isDateIcon ? iconValue.replace('date:', '') : undefined,
        icon: isDateIcon ? undefined : iconValue || undefined,
        order_index: sub.order_index,
        eraId: sub.parent_id || undefined,
        items: (items || []).filter((item) => item.submodule_id === sub.id).map((item) => ({
          id: item.id,
          name: item.name,
          content: item.content,
          order_index: item.order_index,
        })),
        eventType,
      };
    })
    .sort((a, b) => compareTimes(a.eventDate || '', b.eventDate || ''));

  const orphanEvents = events.filter((e) => !e.eraId);

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredEras = normalizedSearchQuery
    ? eras.filter((era) =>
        era.name.toLowerCase().includes(normalizedSearchQuery) ||
        (era.description?.toLowerCase().includes(normalizedSearchQuery))
      )
    : eras;

  const filteredEvents = normalizedSearchQuery
    ? events.filter((event) => {
        const matchesEvent =
          event.name.toLowerCase().includes(normalizedSearchQuery) ||
          (event.description?.toLowerCase().includes(normalizedSearchQuery));
        const matchesItems = event.items.some(
          (item) =>
            item.name.toLowerCase().includes(normalizedSearchQuery) ||
            Object.values(item.content).some((v) => v.toLowerCase().includes(normalizedSearchQuery))
        );
        return matchesEvent || matchesItems;
      })
    : events;

  const finalFilteredEras = normalizedSearchQuery
    ? (() => {
        const eraIdsWithMatchingEvents = new Set(
          filteredEvents
            .filter((e) => e.eraId)
            .map((e) => e.eraId as string)
        );
        const allMatchingEraIds = new Set([
          ...filteredEras.map((e) => e.id),
          ...eraIdsWithMatchingEvents,
        ]);
        return eras.filter((era) => allMatchingEraIds.has(era.id));
      })()
    : eras;

  const filteredOrphanEvents = filteredEvents.filter((e) => !e.eraId);

  const allTimelineEvents = filteredEvents.map((event) => ({
    id: event.id,
    name: event.name,
    level: event.level,
    eventDate: event.eventDate,
    eraId: event.eraId,
  }));

  const eraTimeInfos: EraTimeInfo[] = finalFilteredEras.map((era) => ({
    id: era.id,
    startDate: era.startDate,
    endDate: era.endDate,
  }));

  const timelineEventPositions = calculateEraBasedPositions(allTimelineEvents, eraTimeInfos, {
    padding: 8,
    minSpacing: 3,
  });

  const getEventDotSize = (level: EventLevel): { size: number; innerSize: number } => {
    switch (level) {
      case 'critical':
        return { size: 16, innerSize: 6 };
      case 'major':
        return { size: 12, innerSize: 5 };
      case 'normal':
        return { size: 10, innerSize: 4 };
      case 'minor':
        return { size: 8, innerSize: 3 };
      default:
        return { size: 10, innerSize: 4 };
    }
  };

  const getEventDotColor = (level: EventLevel): { bg: string; gradient: string; shadow: string } => {
    switch (level) {
      case 'critical':
        return { 
          bg: 'bg-gradient-to-br from-primary to-primary/80', 
          gradient: 'from-primary to-accent',
          shadow: 'shadow-primary/40' 
        };
      case 'major':
        return { 
          bg: 'bg-gradient-to-br from-accent to-accent/80', 
          gradient: 'from-accent to-accent/70',
          shadow: 'shadow-accent/30' 
        };
      case 'normal':
        return { 
          bg: 'bg-gradient-to-br from-slate-400 to-slate-500', 
          gradient: 'from-slate-400 to-slate-500',
          shadow: 'shadow-slate-400/20' 
        };
      case 'minor':
        return { 
          bg: 'bg-gradient-to-br from-muted-foreground/60 to-muted-foreground/40', 
          gradient: 'from-muted-foreground/60 to-muted-foreground/40',
          shadow: 'shadow-muted-foreground/10' 
        };
      default:
        return { 
          bg: 'bg-gradient-to-br from-slate-400 to-slate-500', 
          gradient: 'from-slate-400 to-slate-500',
          shadow: 'shadow-slate-400/20' 
        };
    }
  };

  useEffect(() => {
    if (normalizedSearchQuery && filteredEvents.length > 0) {
      const matchingEraIds = new Set(
        filteredEvents
          .filter((e) => e.eraId)
          .map((e) => e.eraId as string)
      );
      finalFilteredEras.forEach((era) => matchingEraIds.add(era.id));
      setExpandedEras(matchingEraIds);
    }
  }, [normalizedSearchQuery, filteredEvents, finalFilteredEras]);

  const createEraMutation = useMutation({
    mutationFn: (data: { name: string; description: string; startDate: string; endDate: string; theme: EraTheme }) => {
      const iconValue = data.startDate || data.endDate ? `era:${data.startDate}:${data.endDate}` : undefined;
      return worldbuildingApi.createSubmodule(moduleId, {
        name: data.name,
        description: data.description,
        color: `era:${data.theme}`,
        icon: iconValue,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'submodules', moduleId] });
      setShowAddEraModal(false);
      setCreateError(null);
    },
    onError: (error: Error) => {
      console.error('创建时代失败:', error);
      setCreateError(error.message || '创建失败，请稍后重试');
    },
  });

  const updateEraMutation = useMutation({
    mutationFn: (data: { name: string; description: string; startDate: string; endDate: string; theme: EraTheme }) => {
      if (!selectedEra) {
        return Promise.reject(new Error('请先选择一个时代'));
      }
      const iconValue = data.startDate || data.endDate ? `era:${data.startDate}:${data.endDate}` : undefined;
      return worldbuildingApi.updateSubmodule(selectedEra.id, {
        name: data.name,
        description: data.description,
        color: `era:${data.theme}`,
        icon: iconValue,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'submodules', moduleId] });
      setShowEditEraModal(false);
      setSelectedEra(null);
      setEditError(null);
    },
    onError: (error: Error) => {
      console.error('更新时代失败:', error);
      setEditError(error.message || '更新失败，请稍后重试');
    },
  });

  const createEventMutation = useMutation({
    mutationFn: (data: { name: string; description: string; level: EventLevel; eventDate: string; icon: string; eraId?: string; eventType?: EventType }) => {
      const iconValue = data.eventDate ? `date:${data.eventDate}` : data.icon;
      const colorValue = data.eventType ? formatEventType(data.eventType, data.level) : formatEventLevel(data.level);
      return worldbuildingApi.createSubmodule(moduleId, {
        name: data.name,
        description: data.description,
        color: colorValue,
        icon: iconValue,
        parent_id: data.eraId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'submodules', moduleId] });
      setShowAddEventModal(false);
      setCreateError(null);
      setSelectedEraId(undefined);
    },
    onError: (error: Error) => {
      console.error('创建事件失败:', error);
      setCreateError(error.message || '创建失败，请稍后重试');
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: (eventId: string) => worldbuildingApi.deleteSubmodule(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'submodules', moduleId] });
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'items', moduleId] });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: (data: { name: string; description: string; level: EventLevel; eventDate: string; icon: string; eraId?: string; eventType?: EventType }) => {
      if (!selectedEvent) {
        return Promise.reject(new Error('请先选择一个事件'));
      }
      const iconValue = data.eventDate ? `date:${data.eventDate}` : data.icon;
      const colorValue = data.eventType ? formatEventType(data.eventType, data.level) : formatEventLevel(data.level);
      return worldbuildingApi.updateSubmodule(selectedEvent.id, {
        name: data.name,
        description: data.description,
        color: colorValue,
        icon: iconValue,
        parent_id: data.eraId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'submodules', moduleId] });
      setShowEditEventModal(false);
      setSelectedEvent(null);
      setEditError(null);
    },
    onError: (error: Error) => {
      console.error('更新事件失败:', error);
      setEditError(error.message || '更新失败，请稍后重试');
    },
  });

  const updateDescriptionMutation = useMutation({
    mutationFn: (data: { eventId: string; description: string }) => {
      return worldbuildingApi.updateSubmodule(data.eventId, {
        description: data.description,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'submodules', moduleId] });
    },
    onError: (error: Error) => {
      console.error('更新描述失败:', error);
    },
  });

  const handleUpdateDescription = (event: Event, description: string) => {
    updateDescriptionMutation.mutate({ eventId: event.id, description });
  };

  const handleUpdateEraDescription = (eraId: string, description: string) => {
    updateDescriptionMutation.mutate({ eventId: eraId, description });
  };

  const createItemMutation = useMutation({
    mutationFn: (data: { name: string; content: Record<string, string> }) => {
      if (!selectedEvent) {
        return Promise.reject(new Error('请先选择一个事件'));
      }
      return worldbuildingApi.createItem(moduleId, { name: data.name, content: data.content, submodule_id: selectedEvent.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'items', moduleId] });
      setShowAddItemModal(false);
      setCreateItemError(null);
    },
    onError: (error: Error) => {
      console.error('创建条目失败:', error);
      setCreateItemError(error.message || '创建失败，请稍后重试');
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => worldbuildingApi.deleteItem(itemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'items', moduleId] }),
  });

  const updateItemMutation = useMutation({
    mutationFn: (data: { name: string; content: Record<string, string> }) => {
      if (!selectedItem) {
        return Promise.reject(new Error('请先选择一个条目'));
      }
      return worldbuildingApi.updateItem(selectedItem.id, {
        name: data.name,
        content: data.content,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'items', moduleId] });
      setShowEditItemModal(false);
      setSelectedItem(null);
      setEditItemError(null);
    },
    onError: (error: Error) => {
      console.error('更新条目失败:', error);
      setEditItemError(error.message || '更新失败，请稍后重试');
    },
  });

  const toggleEra = (eraId: string) => {
    const newExpanded = new Set(expandedEras);
    if (newExpanded.has(eraId)) {
      newExpanded.delete(eraId);
    } else {
      newExpanded.add(eraId);
    }
    setExpandedEras(newExpanded);
  };

  const handleDeleteEvent = (eventId: string) => {
    if (confirm('确定要删除此事件吗？所有相关条目也将被删除。')) {
      deleteEventMutation.mutate(eventId);
    }
  };

  const handleAddItem = (event: Event) => {
    setSelectedEvent(event);
    setShowAddItemModal(true);
  };

  const handleEditEvent = (event: Event) => {
    setSelectedEvent(event);
    setShowEditEventModal(true);
  };

  const handleEditItem = (_event: Event, item: EventItem) => {
    setSelectedItem(item);
    setShowEditItemModal(true);
  };

  const handleDeleteItem = (itemId: string) => deleteItemMutation.mutate(itemId);

  if (isLoading && isFirstLoad) {
    return (
      <div className="relative h-full overflow-auto bg-background" ref={containerRef}>
        <div className="sticky top-0 z-20 flex items-center justify-center gap-3 py-3 px-6 bg-background/90 backdrop-blur-sm border-b border-border/30">
          <div className="w-24 h-8 bg-muted/30 rounded-lg animate-pulse" />
          <div className="w-80 h-8 bg-muted/30 rounded-lg animate-pulse" />
          <div className="w-24 h-8 bg-muted/30 rounded-lg animate-pulse" />
        </div>
        <div className="flex min-h-full">
          <div className="relative flex-shrink-0 w-12 flex justify-center">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 min-h-full bg-gradient-to-b from-primary/60 via-accent/40 to-muted/20 rounded-full" />
          </div>
          <div className="flex-1 pr-8 py-6">
            <HistorySkeleton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-auto bg-background" ref={containerRef}>
      <div className="sticky top-0 z-20 flex items-center justify-center gap-4 py-4 px-6 bg-gradient-to-b from-background via-background/95 to-background/90 backdrop-blur-md border-b border-border/20">
        <motion.button
          onClick={() => setShowAddEraModal(true)}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className="px-3.5 py-1.5 rounded-lg bg-muted/40 text-muted-foreground text-sm font-medium flex items-center gap-1.5 border border-border/50 hover:bg-accent/10 hover:text-foreground hover:border-accent/30 transition-all duration-200"
        >
          <Clock className="h-4 w-4" />
          添加时代
        </motion.button>
        <div className="w-96">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索时代、事件或条目..."
              className="w-full pl-11 pr-10 py-2.5 text-sm bg-muted/30 border border-border/40 rounded-xl focus:bg-background focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/15 transition-all duration-200 placeholder:text-muted-foreground/50"
            />
            <AnimatePresence>
              {searchQuery && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-lg transition-colors"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
        <motion.button
          onClick={() => setShowAddEventModal(true)}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className="px-3.5 py-1.5 rounded-lg bg-muted/40 text-muted-foreground text-sm font-medium flex items-center gap-1.5 border border-border/50 hover:bg-accent/10 hover:text-foreground hover:border-accent/30 transition-all duration-200"
        >
          <Plus className="h-4 w-4" />
          添加事件
        </motion.button>
      </div>

      <div className="flex min-h-full">
        <div className="relative flex-shrink-0 w-16 flex justify-center">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 min-h-full rounded-full overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/50 via-purple-500/40 to-amber-500/30" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/10 to-transparent animate-pulse" style={{ animationDuration: '3s' }} />
          </div>
          
          {timelineEventPositions.length === 0 ? (
            <motion.div 
              className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center justify-center"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, ...animationConfig.spring }}
            >
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-amber-500 flex items-center justify-center shadow-xl shadow-indigo-500/40">
                  <div className="w-3 h-3 rounded-full bg-white/90" />
                </div>
                <div className="absolute inset-0 rounded-full bg-indigo-500/40 animate-ping" style={{ animationDuration: '2s' }} />
              </div>
            </motion.div>
          ) : (
            <div className="absolute top-8 bottom-8 left-1/2 -translate-x-1/2 w-full">
              {timelineEventPositions.map((event, index) => {
                const dotSize = getEventDotSize(event.level);
                const dotColor = getEventDotColor(event.level);
                return (
                  <motion.div
                    key={event.id}
                    className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center group cursor-pointer"
                    style={{ top: `${event.position}%` }}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 + index * 0.03, ...animationConfig.spring }}
                    whileHover={{ scale: 1.3 }}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTooltipPos({ x: rect.right + 12, y: rect.top + rect.height / 2 });
                      setTooltipEvent({ name: event.name, eventDate: event.eventDate });
                    }}
                    onMouseLeave={() => {
                      setTooltipEvent(null);
                      setTooltipPos(null);
                    }}
                  >
                    <div
                      className={`rounded-full ${dotColor.bg} shadow-xl ${dotColor.shadow} flex items-center justify-center transition-all duration-300 group-hover:shadow-2xl`}
                      style={{ width: dotSize.size, height: dotSize.size }}
                    >
                      <div
                        className="rounded-full bg-white/85"
                        style={{ width: dotSize.innerSize, height: dotSize.innerSize }}
                      />
                    </div>
                    {event.level === 'critical' && (
                      <motion.div
                        className="absolute inset-0 rounded-full"
                        style={{ width: dotSize.size + 8, height: dotSize.size + 8, margin: -4 }}
                        animate={{ 
                          scale: [1, 1.2, 1],
                          opacity: [0.3, 0.5, 0.3],
                        }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        <div className="w-full h-full rounded-full bg-indigo-500/30" />
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex-1 pr-8 py-6">
        {eras.length === 0 && orphanEvents.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={animationConfig.spring}
            className="text-center py-24"
          >
            <motion.div 
              initial={{ scale: 0.8, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.1, ...animationConfig.spring }}
              className="relative inline-flex items-center justify-center w-28 h-28 mb-8"
            >
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-500/20 via-purple-500/15 to-amber-500/20 animate-pulse" style={{ animationDuration: '3s' }} />
              <div className="absolute inset-2 rounded-full bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-amber-500/10" />
              <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-amber-500 flex items-center justify-center shadow-xl shadow-indigo-500/30">
                <Sparkles className="h-8 w-8 text-white" />
              </div>
            </motion.div>
            <motion.h3 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-2xl font-bold mb-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-amber-600 bg-clip-text text-transparent"
            >
              开启您的历史编年
            </motion.h3>
            <motion.p 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-sm text-muted-foreground mb-8 max-w-md mx-auto leading-relaxed"
            >
              每个伟大的世界都有其独特的历史。创建时代与事件，<br />记录那些改变世界的关键时刻。
            </motion.p>
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex justify-center gap-4"
            >
              <motion.button 
                onClick={() => setShowAddEraModal(true)} 
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                className="px-6 py-3 bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-xl hover:shadow-lg hover:shadow-amber-500/25 transition-all duration-200 flex items-center gap-2 font-semibold"
              >
                <Clock className="h-4 w-4" />
                创建第一个时代
              </motion.button>
              <motion.button 
                onClick={() => setShowAddEventModal(true)} 
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                className="px-6 py-3 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl hover:shadow-lg hover:shadow-indigo-500/25 transition-all duration-200 flex items-center gap-2 font-semibold"
              >
                <Plus className="h-4 w-4" />
                记录第一个事件
              </motion.button>
            </motion.div>
          </motion.div>
        ) : finalFilteredEras.length === 0 && filteredOrphanEvents.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={animationConfig.spring}
            className="text-center py-24"
          >
            <motion.div 
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, ...animationConfig.spring }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted/20 mb-6"
            >
              <Search className="h-10 w-10 text-muted-foreground/60" />
            </motion.div>
            <h3 className="text-xl font-bold text-foreground mb-3">未找到匹配结果</h3>
            <p className="text-sm text-muted-foreground mb-6">
              没有找到包含 "{searchQuery}" 的时代或事件
            </p>
            <motion.button 
              onClick={() => setSearchQuery('')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-5 py-2.5 text-sm bg-primary/10 text-primary hover:bg-primary/20 rounded-xl transition-colors font-medium"
            >
              清除搜索
            </motion.button>
          </motion.div>
        ) : (
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.08, delayChildren: 0.05 }
              }
            }}
            className="space-y-8"
          >
            <AnimatePresence mode="popLayout">
              {finalFilteredEras.map((era) => {
                const eraEvents = filteredEvents.filter((e) => e.eraId === era.id);
                const isExpanded = expandedEras.has(era.id);
                const eraTheme = era.theme || 'ochre';
                const themeConfig = ERA_THEME_CONFIG[eraTheme];
                
                return (
                  <motion.div
                    key={era.id}
                    variants={eraVariants}
                    layout
                    className={`relative bg-gradient-to-br ${themeConfig.gradient} rounded-2xl border ${themeConfig.border} overflow-hidden shadow-lg backdrop-blur-sm`}
                    whileHover={{ boxShadow: '0 20px 40px -12px rgba(0, 0, 0, 0.15)' }}
                  >
                    <div 
                      className="flex items-center gap-4 px-6 py-5 cursor-pointer select-none"
                      onClick={() => toggleEra(era.id)}
                    >
                      <motion.div
                        animate={{ rotate: isExpanded ? 90 : 0 }}
                        transition={{ duration: 0.2 }}
                        className={`shrink-0 ${themeConfig.text}`}
                      >
                        <ChevronDown className="h-5 w-5" />
                      </motion.div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${themeConfig.accent} shrink-0`} />
                          <h3 className={`text-lg font-semibold ${themeConfig.text} truncate`}>
                            {era.name}
                          </h3>
                          {era.startDate && (
                            <span className="text-xs text-muted-foreground/70 shrink-0">
                              {era.startDate}{era.endDate ? ` - ${era.endDate}` : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground bg-background/50 px-2.5 py-1 rounded-full">
                          {eraEvents.length} 事件
                        </span>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEra(era);
                            setShowEditEraModal(true);
                          }}
                          className="p-1.5 hover:bg-background/60 rounded-lg transition-colors"
                        >
                          <Edit2 className="h-4 w-4" />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('确定要删除此时代吗？所有相关事件也将被删除。')) {
                              deleteEventMutation.mutate(era.id);
                            }
                          }}
                          className="p-1.5 hover:bg-destructive/15 rounded-lg text-destructive transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEraId(era.id);
                            setShowAddEventModal(true);
                          }}
                          className="p-1.5 hover:bg-primary/10 rounded-lg text-primary transition-colors"
                        >
                          <Plus className="h-4 w-4" />
                        </motion.button>
                      </div>
                    </div>
                    
                    {era.description && editingEraDescId !== era.id && (
                      <div className="px-6 pb-4 ml-14">
                        <div 
                          className="relative px-4 py-3 text-sm leading-relaxed cursor-text"
                          style={{
                            background: 'linear-gradient(145deg, rgba(248, 250, 252, 0.9) 0%, rgba(241, 245, 249, 0.8) 100%)',
                            boxShadow: 'inset 1px 1px 4px rgba(0, 0, 0, 0.03), inset -1px -1px 3px rgba(255, 255, 255, 0.4)',
                            borderRadius: '10px',
                          }}
                        >
                          {editingEraDescId === era.id ? (
                            <div className="relative z-10">
                              <textarea
                                value={editEraDesc}
                                onChange={(e) => setEditEraDesc(e.target.value)}
                                className="w-full bg-transparent resize-none outline-none text-foreground/85 leading-relaxed min-h-[60px]"
                                placeholder="输入时代描述..."
                                autoFocus
                              />
                              <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-border/20">
                                <button
                                  onClick={() => { setEditingEraDescId(null); setEditEraDesc(''); }}
                                  className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  取消
                                </button>
                                <button
                                  onClick={() => { handleUpdateEraDescription(era.id, editEraDesc.trim()); setEditingEraDescId(null); }}
                                  className="px-3 py-1.5 text-xs bg-primary/90 text-primary-foreground rounded-md hover:bg-primary transition-colors"
                                >
                                  保存
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p 
                              className="cursor-text hover:text-foreground transition-colors group/desc"
                              onClick={() => { setEditingEraDescId(era.id); setEditEraDesc(era.description || ''); }}
                              title="点击编辑描述"
                            >
                              {era.description}
                              <span className="ml-2 opacity-0 group-hover/desc:opacity-40 text-xs transition-opacity">
                                (点击编辑)
                              </span>
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    {!era.description && editingEraDescId !== era.id && (
                      <div className="px-6 pb-4 ml-14">
                        <motion.button
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => { setEditingEraDescId(era.id); setEditEraDesc(''); }}
                          className="w-full px-5 py-3.5 text-sm text-muted-foreground hover:text-foreground transition-colors border border-dashed border-border/50 rounded-xl hover:border-primary/40 hover:bg-primary/5"
                        >
                          + 添加时代描述
                        </motion.button>
                      </div>
                    )}
                    
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          key="content"
                          initial="collapsed"
                          animate="expanded"
                          exit="collapsed"
                          variants={contentVariants}
                          className="overflow-hidden"
                        >
                          <div className="px-6 pb-6 ml-10 relative">
                            <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-full overflow-hidden">
                              <div className={`absolute inset-0 bg-gradient-to-b ${themeConfig.accent}/50 via-transparent to-transparent opacity-60`} />
                              <div className={`absolute top-4 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full ${themeConfig.accent}/70`} />
                              <div className={`absolute top-1/3 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full ${themeConfig.accent}/50`} />
                              <div className={`absolute top-2/3 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full ${themeConfig.accent}/40`} />
                            </div>
                            {eraEvents.length === 0 ? (
                              <div className="text-sm text-muted-foreground py-10 text-center border-2 border-dashed border-border/40 rounded-xl bg-background/60">
                                暂无事件，点击上方 + 添加
                              </div>
                            ) : (
                              <motion.div 
                                className="flex flex-wrap gap-4 ml-5"
                                initial="hidden"
                                animate="visible"
                                variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
                              >
                                {eraEvents.map((event) => (
                                  <EventCard
                                    key={event.id}
                                    event={event}
                                    onEdit={() => handleEditEvent(event)}
                                    onDelete={() => handleDeleteEvent(event.id)}
                                    onAddItem={() => handleAddItem(event)}
                                    onEditItem={(item) => handleEditItem(event, item)}
                                    onDeleteItem={(itemId) => handleDeleteItem(itemId)}
                                    onUpdateDescription={(desc) => handleUpdateDescription(event, desc)}
                                  />
                                ))}
                              </motion.div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {filteredOrphanEvents.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, ...animationConfig.spring }}
                className="relative"
              >
                {finalFilteredEras.length > 0 && (
                  <div className="mb-8 flex items-center gap-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-3 h-3 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 shadow-sm shadow-slate-400/30" />
                      <span className="text-sm font-semibold text-muted-foreground tracking-wide">独立事件</span>
                    </div>
                    <div className="h-px flex-1 bg-gradient-to-r from-border via-border/50 to-transparent" />
                  </div>
                )}
                <motion.div 
                  className="flex flex-wrap gap-4 p-6 rounded-2xl bg-gradient-to-br from-slate-500/5 to-slate-600/5 border border-slate-400/15"
                  initial="hidden"
                  animate="visible"
                  variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
                >
                  {filteredOrphanEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onEdit={() => handleEditEvent(event)}
                      onDelete={() => handleDeleteEvent(event.id)}
                      onAddItem={() => handleAddItem(event)}
                      onEditItem={(item) => handleEditItem(event, item)}
                      onDeleteItem={(itemId) => handleDeleteItem(itemId)}
                      onUpdateDescription={(desc) => handleUpdateDescription(event, desc)}
                    />
                  ))}
                </motion.div>
              </motion.div>
            )}
          </motion.div>
        )}
        </div>
      </div>

      <AddEraModal
        isOpen={showAddEraModal}
        onClose={() => { setShowAddEraModal(false); setCreateError(null); }}
        onSubmit={(data) => createEraMutation.mutate(data)}
        isLoading={createEraMutation.isPending}
        error={createError}
      />

      <EditEraModal
        isOpen={showEditEraModal}
        onClose={() => { setShowEditEraModal(false); setSelectedEra(null); setEditError(null); }}
        onSubmit={(data) => updateEraMutation.mutate(data)}
        era={selectedEra}
        isLoading={updateEraMutation.isPending}
        error={editError}
      />

      <AddEventModal
        isOpen={showAddEventModal}
        onClose={() => { setShowAddEventModal(false); setCreateError(null); setSelectedEraId(undefined); }}
        onSubmit={(data) => createEventMutation.mutate(data)}
        eras={eras}
        selectedEraId={selectedEraId}
        isLoading={createEventMutation.isPending}
        error={createError}
      />

      <EditEventModal
        isOpen={showEditEventModal}
        onClose={() => { setShowEditEventModal(false); setSelectedEvent(null); setEditError(null); }}
        onSubmit={(data) => updateEventMutation.mutate(data)}
        event={selectedEvent}
        eras={eras}
        isLoading={updateEventMutation.isPending}
        error={editError}
      />

      <AddItemModal
        isOpen={showAddItemModal}
        onClose={() => { setShowAddItemModal(false); setCreateItemError(null); setSelectedEvent(null); }}
        onSubmit={(data) => createItemMutation.mutate(data)}
        isLoading={createItemMutation.isPending}
        error={createItemError}
      />

      <EditItemModal
        isOpen={showEditItemModal}
        onClose={() => { setShowEditItemModal(false); setSelectedItem(null); setEditItemError(null); }}
        onSubmit={(data) => updateItemMutation.mutate(data)}
        item={selectedItem}
        isLoading={updateItemMutation.isPending}
        error={editItemError}
      />

      <TimelineTooltip event={tooltipEvent} position={tooltipPos} />
    </div>
  );
};
