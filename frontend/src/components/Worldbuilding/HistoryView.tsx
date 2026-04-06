import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { worldbuildingApi } from '@/services/worldbuildingApi';
import { Plus, X, Clock, Sparkles, Search, Settings } from 'lucide-react';
import { compareTimes } from '@/utils/timeParser';
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
  animationConfig,
  parseEraTheme,
  parseEventLevel,
  parseEventType,
  formatEventLevel,
  formatEventType,
  isEra,
  DEFAULT_ERA_THEME_CONFIGS,
  DEFAULT_EVENT_TYPE_CONFIGS,
  DEFAULT_LEVEL_CONFIGS,
  validateHistoryModuleConfig,
} from './HistoryView/config';
import { TimelineTooltip } from './HistoryView/TimelineTooltip';
import { HistorySkeleton } from './HistoryView/HistorySkeleton';
import { AddEraModal } from './HistoryView/modals/AddEraModal';
import { EditEraModal } from './HistoryView/modals/EditEraModal';
import { AddEventModal } from './HistoryView/modals/AddEventModal';
import { EditEventModal } from './HistoryView/modals/EditEventModal';
import { AddItemModal } from './HistoryView/modals/AddItemModal';
import { EditItemModal } from './HistoryView/modals/EditItemModal';
import { EraSwitchContainer } from './HistoryView/EraSwitchContainer';
import { EraContentPanel } from './HistoryView/EraContentPanel';
import { HistoryModuleConfig } from './HistoryView/types';
import { ConfigModal } from './HistoryView/modals/ConfigModal';
import { DeleteConfirmModal } from './HistoryView/modals/DeleteConfirmModal';

export const HistoryView = ({ moduleId, projectId, onNavigateToCharacter }: HistoryViewProps) => {
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
  const [activeEraId, setActiveEraId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'event' | 'era'; id: string; name: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: submodules, isLoading } = useQuery({
    queryKey: ['worldbuilding', 'submodules', moduleId],
    queryFn: () => worldbuildingApi.getSubmodules(moduleId),
  });

  const { data: items } = useQuery({
    queryKey: ['worldbuilding', 'items', moduleId],
    queryFn: () => worldbuildingApi.getItems(moduleId, { include_all: true }),
  });

  const configItem = useMemo(() => {
    return items?.find((item) => item.name === 'moduleConfig');
  }, [items]);

  const moduleConfig: HistoryModuleConfig = useMemo(() => {
    if (!configItem?.content) {
      return {
        eraThemes: DEFAULT_ERA_THEME_CONFIGS,
        eventTypes: DEFAULT_EVENT_TYPE_CONFIGS,
        levels: DEFAULT_LEVEL_CONFIGS,
      };
    }
    const validated = validateHistoryModuleConfig(configItem.content);
    if (!validated) {
      console.warn('Invalid history module config format, using defaults');
      return {
        eraThemes: DEFAULT_ERA_THEME_CONFIGS,
        eventTypes: DEFAULT_EVENT_TYPE_CONFIGS,
        levels: DEFAULT_LEVEL_CONFIGS,
      };
    }
    return validated;
  }, [configItem]);

  useEffect(() => {
    if (!isLoading && submodules) {
      setIsFirstLoad(false);
    }
  }, [isLoading, submodules]);

  const STANDALONE_ERA_ID = '__standalone_era__';

  const baseEras: Era[] = (submodules || [])
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
      
      let eventDate: string | undefined;
      let eventEndDate: string | undefined;
      let icon: string | undefined;
      
      if (isDateIcon) {
        const datePart = iconValue.replace('date:', '');
        const dateParts = datePart.split(':');
        eventDate = dateParts[0] || undefined;
        eventEndDate = dateParts[1] || undefined;
      } else {
        icon = iconValue || undefined;
      }
      
      return {
        id: sub.id,
        name: sub.name,
        description: sub.description,
        level: parseEventLevel(sub.color),
        eventDate,
        eventEndDate,
        icon,
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

  // 创建独立时代（当有独立事件时）
  const standaloneEra = useMemo<Era | null>(() => orphanEvents.length > 0 ? {
    id: STANDALONE_ERA_ID,
    name: '时间之外',
    description: '游离于时间之外的独立事件，等待被归类的记忆碎片',
    order_index: Infinity,
    theme: 'standalone',
  } : null, [orphanEvents]);

  // 合并时代列表，独立时代放在最后
  const eras = useMemo<Era[]>(() => standaloneEra
    ? [...baseEras, standaloneEra]
    : baseEras, [baseEras, standaloneEra]);

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
        // 如果有独立事件匹配搜索，添加独立时代
        const hasMatchingOrphanEvents = filteredEvents.some((e) => !e.eraId);
        const allMatchingEraIds = new Set([
          ...filteredEras.map((e) => e.id),
          ...eraIdsWithMatchingEvents,
        ]);
        if (hasMatchingOrphanEvents && standaloneEra) {
          allMatchingEraIds.add(standaloneEra.id);
        }
        return eras.filter((era) => allMatchingEraIds.has(era.id));
      })()
    : eras;

  const filteredOrphanEvents = filteredEvents.filter((e) => !e.eraId);

  useEffect(() => {
    if (eras.length > 0 && !activeEraId) {
      setActiveEraId(eras[0].id);
    }
  }, [eras, activeEraId]);

  useEffect(() => {
    if (normalizedSearchQuery && finalFilteredEras.length > 0) {
      if (!activeEraId || !finalFilteredEras.find(e => e.id === activeEraId)) {
        setActiveEraId(finalFilteredEras[0].id);
      }
    }
  }, [normalizedSearchQuery, finalFilteredEras, activeEraId]);

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
    mutationFn: (data: { name: string; description: string; level: EventLevel; eventDate: string; eventEndDate: string; icon: string; eraId?: string; eventType?: EventType }) => {
      let iconValue: string | undefined;
      if (data.eventDate) {
        iconValue = data.eventEndDate ? `date:${data.eventDate}:${data.eventEndDate}` : `date:${data.eventDate}`;
      } else {
        iconValue = data.icon || undefined;
      }
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
    mutationFn: (data: { name: string; description: string; level: EventLevel; eventDate: string; eventEndDate: string; icon: string; eraId?: string; eventType?: EventType }) => {
      if (!selectedEvent) {
        return Promise.reject(new Error('请先选择一个事件'));
      }
      let iconValue: string | undefined;
      if (data.eventDate) {
        iconValue = data.eventEndDate ? `date:${data.eventDate}:${data.eventEndDate}` : `date:${data.eventDate}`;
      } else {
        iconValue = data.icon || undefined;
      }
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

  const createItemForEventMutation = useMutation({
    mutationFn: (data: { eventId: string; name: string; content: Record<string, string> }) => {
      return worldbuildingApi.createItem(moduleId, { name: data.name, content: data.content, submodule_id: data.eventId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'items', moduleId] });
    },
    onError: (error: Error) => {
      console.error('创建人物关联条目失败:', error);
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

  const saveConfigMutation = useMutation({
    mutationFn: (config: HistoryModuleConfig) => {
      if (configItem) {
        return worldbuildingApi.updateItem(configItem.id, {
          name: 'moduleConfig',
          content: config as unknown as Record<string, string>,
        });
      } else {
        return worldbuildingApi.createItem(moduleId, {
          name: 'moduleConfig',
          content: config as unknown as Record<string, string>,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'items', moduleId] });
      setShowConfigModal(false);
    },
  });

  const handleDeleteEvent = (eventId: string, eventName?: string) => {
    setDeleteTarget({ type: 'event', id: eventId, name: eventName || '此事件' });
    setShowDeleteConfirmModal(true);
  };

  const handleDeleteEra = (eraId: string, eraName?: string) => {
    setDeleteTarget({ type: 'era', id: eraId, name: eraName || '此时代' });
    setShowDeleteConfirmModal(true);
  };

  const handleConfirmDelete = () => {
    if (deleteTarget) {
      deleteEventMutation.mutate(deleteTarget.id);
      setShowDeleteConfirmModal(false);
      setDeleteTarget(null);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirmModal(false);
    setDeleteTarget(null);
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

  const handleAddCharRefItem = (event: Event, name: string, content: Record<string, string>) => {
    createItemForEventMutation.mutate({ eventId: event.id, name, content });
  };

  if (isLoading && isFirstLoad) {
    return (
      <div className="relative h-full overflow-auto bg-background" ref={containerRef}>
        <div className="sticky top-0 z-20 flex items-center justify-center gap-3 py-3 px-6 bg-background/90 backdrop-blur-sm border-b border-border/30">
          <div className="w-24 h-8 bg-muted/30 rounded-lg animate-pulse" />
          <div className="w-80 h-8 bg-muted/30 rounded-lg animate-pulse" />
          <div className="w-24 h-8 bg-muted/30 rounded-lg animate-pulse" />
        </div>
        <div className="px-6 py-6">
          <HistorySkeleton />
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
        <motion.button
          onClick={() => setShowConfigModal(true)}
          whileHover={{ scale: 1.05, rotate: 90 }}
          whileTap={{ scale: 0.95 }}
          className="p-2 rounded-lg bg-muted/40 text-muted-foreground text-sm font-medium flex items-center gap-1.5 border border-border/50 hover:bg-accent/10 hover:text-foreground hover:border-accent/30 transition-all duration-200"
          title="样式配置"
        >
          <Settings className="h-4 w-4" />
        </motion.button>
      </div>

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
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 via-accent/15 to-primary/20 animate-pulse" style={{ animationDuration: '3s' }} />
            <div className="absolute inset-2 rounded-full bg-gradient-to-br from-primary/10 via-accent/10 to-primary/10" />
            <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-primary via-primary/90 to-accent flex items-center justify-center shadow-xl shadow-primary/25">
              <Sparkles className="h-8 w-8 text-primary-foreground" />
            </div>
          </motion.div>
          <motion.h3 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-2xl font-bold mb-3 text-foreground"
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
              className="px-6 py-3 bg-gradient-to-br from-accent to-accent/90 text-accent-foreground rounded-xl hover:shadow-lg hover:shadow-accent/20 transition-all duration-200 flex items-center gap-2 font-semibold"
            >
              <Clock className="h-4 w-4" />
              创建第一个时代
            </motion.button>
            <motion.button 
              onClick={() => setShowAddEventModal(true)} 
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="px-6 py-3 bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-xl hover:shadow-lg hover:shadow-primary/20 transition-all duration-200 flex items-center gap-2 font-semibold"
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
        <div>
          <EraSwitchContainer
            eras={finalFilteredEras}
            activeEraId={activeEraId}
            onSwitchEra={setActiveEraId}
            renderEraContent={(era) => {
              const isStandaloneEra = era.id === STANDALONE_ERA_ID;
              return (
                <EraContentPanel
                  key={era.id}
                  era={era}
                  events={isStandaloneEra ? filteredOrphanEvents : filteredEvents.filter(e => e.eraId === era.id)}
                  onEditEra={() => { setSelectedEra(era); setShowEditEraModal(true); }}
                  onDeleteEra={() => handleDeleteEra(era.id, era.name)}
                  onAddEvent={() => { setSelectedEraId(isStandaloneEra ? undefined : era.id); setShowAddEventModal(true); }}
                  onEditEvent={handleEditEvent}
                  onDeleteEvent={(eventId) => handleDeleteEvent(eventId)}
                  onAddItem={handleAddItem}
                  onEditItem={handleEditItem}
                  onDeleteItem={handleDeleteItem}
                  onUpdateEventDescription={handleUpdateDescription}
                  onUpdateEraDescription={(desc) => handleUpdateEraDescription(era.id, desc)}
                  onAddCharRefItem={handleAddCharRefItem}
                  projectId={projectId}
                  moduleId={moduleId}
                  isStandalone={isStandaloneEra}
                  onNavigateToCharacter={onNavigateToCharacter}
                  eraThemeConfigs={moduleConfig.eraThemes}
                  eventTypeConfigs={moduleConfig.eventTypes}
                  levelConfigs={moduleConfig.levels}
                />
              );
            }}
          />
        </div>
      )}

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

      <ConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        config={moduleConfig}
        onSave={(config) => saveConfigMutation.mutate(config)}
        isLoading={saveConfigMutation.isPending}
      />

      <DeleteConfirmModal
        isOpen={showDeleteConfirmModal}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title={deleteTarget?.type === 'era' ? '删除时代' : '删除事件'}
        message={
          deleteTarget?.type === 'era'
            ? `确定要删除时代「${deleteTarget.name}」吗？该时代下的所有事件也将被删除。`
            : `确定要删除事件「${deleteTarget?.name}」吗？所有相关条目也将被删除。`
        }
        isLoading={deleteEventMutation.isPending}
      />

      <TimelineTooltip event={null} position={null} />
    </div>
  );
};
