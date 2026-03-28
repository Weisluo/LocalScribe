import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  ChevronDown, BookOpen, Layers, Plus, GitBranch, Maximize,
  ZoomIn, ZoomOut, Grid3X3, Settings,
} from 'lucide-react';
import { useOutlineStore } from '../hooks/useOutlineStore';
import {
  useActEvents,
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
  useCreateConnection,
} from '../hooks/useOutline';
import { EventNode } from './EventNode';
import { ConnectionLine, SvgDefs } from './ConnectionLine';
import { EventModal } from './EventModal';
import { FloatingActionBar } from './FloatingActionBar';
import { Timeline } from './Timeline';
import { ConnectionModeIndicator } from './ConnectionModeIndicator';
import { EventSearch } from './EventSearch';
import { GridOverlay, AlignmentLines, useSnapToGrid, DEFAULT_GRID_CONFIG } from './GridSystem';
import { DraggableEvent } from './DragDrop';
import { BatchActionBar, useBatchSelection } from './BatchSelection';
import { StoryChainSkeleton } from './Skeleton';
import { CanvasSettingsModal } from './CanvasSettingsModal';
import { useCanvasKeyboard } from './useCanvasKeyboard';
import type {
  ProjectOutline, StoryEvent, StoryEventCreate, StoryEventUpdate,
  EventConnection, ConnectionType, EventType, GridConfig, SearchFilters,
} from '../types';

interface StoryChainViewProps {
  projectId: string;
  outlineData: ProjectOutline;
}

function autoLayout(events: StoryEvent[], connections: EventConnection[]) {
  const positions = new Map<string, { x: number; y: number; width: number; height: number }>();
  if (events.length === 0) return positions;

  const CARD_WIDTH = 220;
  const CARD_HEIGHT = 90;
  const GAP_Y = 60;
  const GAP_X = 50;
  const TIMELINE_OFFSET = 120;

  const hasManualPosition = (event: StoryEvent) => 
    event.position_x !== undefined && event.position_x !== null &&
    event.position_y !== undefined && event.position_y !== null;

  events.forEach(event => {
    if (hasManualPosition(event)) {
      positions.set(event.id, {
        x: event.position_x!,
        y: event.position_y!,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
      });
    }
  });

  const eventsWithoutPosition = events.filter(e => !hasManualPosition(e));
  if (eventsWithoutPosition.length === 0) return positions;

  const outMap = new Map<string, string[]>();
  const inMap = new Map<string, string[]>();
  events.forEach(e => {
    outMap.set(e.id, []);
    inMap.set(e.id, []);
  });
  connections.forEach(c => {
    outMap.get(c.from_event_id)?.push(c.to_event_id);
    inMap.get(c.to_event_id)?.push(c.from_event_id);
  });

  const roots = eventsWithoutPosition.filter(e => (inMap.get(e.id)?.length || 0) === 0);
  if (roots.length === 0) {
    eventsWithoutPosition.sort((a, b) => a.order - b.order).forEach((e, i) => {
      positions.set(e.id, { 
        x: TIMELINE_OFFSET, 
        y: i * (CARD_HEIGHT + GAP_Y), 
        width: CARD_WIDTH, 
        height: CARD_HEIGHT 
      });
    });
    return positions;
  }

  const levels = new Map<string, number>();
  const queue = [...roots.map(r => ({ id: r.id, level: 0 }))];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { id, level } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    levels.set(id, Math.max(levels.get(id) || 0, level));

    const children = outMap.get(id) || [];
    children.forEach(childId => {
      if (!visited.has(childId) && !hasManualPosition(events.find(e => e.id === childId)!)) {
        queue.push({ id: childId, level: level + 1 });
      }
    });
  }

  eventsWithoutPosition.forEach(e => {
    if (!visited.has(e.id)) {
      levels.set(e.id, (levels.size || 0));
    }
  });

  const levelGroups = new Map<number, string[]>();
  levels.forEach((level, id) => {
    if (!levelGroups.has(level)) levelGroups.set(level, []);
    levelGroups.get(level)!.push(id);
  });

  const maxLevelWidth = Math.max(...Array.from(levelGroups.values()).map(g => g.length));
  const centerX = TIMELINE_OFFSET + (maxLevelWidth * (CARD_WIDTH + GAP_X)) / 2;

  levelGroups.forEach((ids, level) => {
    const totalWidth = ids.length * CARD_WIDTH + (ids.length - 1) * GAP_X;
    const startX = centerX - totalWidth / 2;
    ids.forEach((id, col) => {
      positions.set(id, {
        x: startX + col * (CARD_WIDTH + GAP_X),
        y: level * (CARD_HEIGHT + GAP_Y),
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
      });
    });
  });

  return positions;
}

interface ActChainItemProps {
  actId: string;
  actName: string;
  actIndex: number;
  projectId: string;
  isExpanded: boolean;
  onToggle: () => void;
  searchKeyword: string;
  searchFilters: SearchFilters;
  searchResultIds: Set<string>;
  currentSearchResultId: string | null;
  gridConfig: GridConfig;
  onGridConfigChange: (config: GridConfig) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

const ActChainItem = ({
  actId,
  actName,
  actIndex,
  projectId,
  isExpanded,
  onToggle,
  searchKeyword: _searchKeyword,
  searchFilters: _searchFilters,
  searchResultIds,
  currentSearchResultId,
  gridConfig,
  onGridConfigChange,
  zoom,
  onZoomChange,
}: ActChainItemProps) => {
  const { data: actData, isLoading } = useActEvents(isExpanded ? actId : undefined);
  const createEventMutation = useCreateEvent(projectId);
  const updateEventMutation = useUpdateEvent(projectId);
  const deleteEventMutation = useDeleteEvent(projectId);
  const createConnectionMutation = useCreateConnection(projectId);

  const {
    selectedEventId, setSelectedEvent,
    connectionMode, connectionType, connectionSource,
    setConnectionMode, setConnectionSource, resetConnectionMode,
  } = useOutlineStore();

  const {
    selectedIds: batchSelectedIds,
    toggleSelection,
    clearSelection,
    isSelected: isBatchSelected,
  } = useBatchSelection();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingEvent, setEditingEvent] = useState<StoryEvent | undefined>();
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null);
  void draggingEventId;
  const [alignmentLines, setAlignmentLines] = useState<{
    showH: boolean;
    showV: boolean;
    hY: number;
    vX: number;
  }>({ showH: false, showV: false, hY: 0, vX: 0 });
  
  const canvasRef = useRef<HTMLDivElement>(null);

  const events = actData?.events || [];
  const connections = actData?.connections || [];

  const positions = useMemo(() => autoLayout(events, connections), [events, connections]);

  const [manualPositions, setManualPositions] = useState<Map<string, { x: number; y: number }>>(new Map());

  const finalPositions = useMemo(() => {
    const final = new Map(positions);
    manualPositions.forEach((pos, id) => {
      const auto = final.get(id);
      if (auto) {
        final.set(id, { ...auto, x: pos.x, y: pos.y });
      }
    });
    return final;
  }, [positions, manualPositions]);

  const { snapPosition } = useSnapToGrid(gridConfig, zoom, finalPositions);

  const canvasSize = useMemo(() => {
    if (finalPositions.size === 0) return { width: 500, height: 300 };
    let maxX = 0, maxY = 0;
    finalPositions.forEach(pos => {
      maxX = Math.max(maxX, pos.x + pos.width);
      maxY = Math.max(maxY, pos.y + pos.height);
    });
    return { width: Math.max(500, maxX + 100), height: Math.max(300, maxY + 100) };
  }, [finalPositions]);

  const selectedEvent = useMemo(() => 
    events.find(e => e.id === selectedEventId),
    [events, selectedEventId]
  );

  const selectedEventPosition = useMemo(() => {
    if (!selectedEventId) return null;
    const pos = finalPositions.get(selectedEventId);
    if (!pos || !canvasRef.current) return null;
    
    const eventNode = canvasRef.current.querySelector(`[data-event-id="${selectedEventId}"]`);
    
    if (eventNode) {
      const eventRect = eventNode.getBoundingClientRect();
      return { 
        x: eventRect.left + eventRect.width / 2, 
        y: eventRect.top,
        height: eventRect.height
      };
    }
    
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const x = canvasRect.left + (pos.x + pos.width / 2) * zoom;
    const y = canvasRect.top + pos.y * zoom;
    
    return { x, y, height: pos.height };
  }, [selectedEventId, finalPositions, zoom]);

  const handleSelectEvent = useCallback((id: string) => {
    setSelectedEvent(id === selectedEventId ? null : id);
  }, [selectedEventId, setSelectedEvent]);

  const handleDoubleClick = useCallback((id: string) => {
    const ev = events.find(e => e.id === id);
    if (ev) {
      setEditingEvent(ev);
      setModalMode('edit');
      setModalOpen(true);
      setSelectedEvent(null);
    }
  }, [events, setSelectedEvent]);

  const handleConnectionTarget = useCallback((targetId: string) => {
    if (!connectionMode || !connectionType) return;

    if (!connectionSource) {
      setConnectionSource(targetId);
    } else if (connectionSource !== targetId) {
      createConnectionMutation.mutate({
        from_event_id: connectionSource,
        to_event_id: targetId,
        connection_type: connectionType as ConnectionType,
      });
      resetConnectionMode();
    }
  }, [connectionMode, connectionType, connectionSource, setConnectionSource, createConnectionMutation, resetConnectionMode]);

  const handleAddEvent = useCallback(() => {
    setEditingEvent(undefined);
    setModalMode('create');
    setModalOpen(true);
  }, []);

  const handleSaveEvent = useCallback((data: StoryEventCreate | StoryEventUpdate) => {
    if (modalMode === 'create') {
      createEventMutation.mutate({ actId, data: data as StoryEventCreate });
    } else if (editingEvent) {
      updateEventMutation.mutate({ eventId: editingEvent.id, data: data as StoryEventUpdate });
    }
  }, [modalMode, actId, editingEvent, createEventMutation, updateEventMutation]);

  const handleDeleteEvent = useCallback((eventId: string) => {
    deleteEventMutation.mutate(eventId);
    setSelectedEvent(null);
  }, [deleteEventMutation, setSelectedEvent]);

  const handleStartConnection = useCallback((type: ConnectionType) => {
    setConnectionMode(true, type);
    setSelectedEvent(null);
  }, [setConnectionMode, setSelectedEvent]);

  const handleStyleChange = useCallback((type: EventType) => {
    if (!selectedEventId) return;
    updateEventMutation.mutate({ 
      eventId: selectedEventId, 
      data: { event_type: type } 
    });
  }, [selectedEventId, updateEventMutation]);

  const handleCopyEvent = useCallback(() => {
    if (!selectedEvent) return;
    const copiedEvent = {
      title: `${selectedEvent.title} (副本)`,
      content: selectedEvent.content,
      event_type: selectedEvent.event_type,
      location: selectedEvent.location,
      timestamp: selectedEvent.timestamp,
    };
    createEventMutation.mutate({ actId, data: copiedEvent as StoryEventCreate });
  }, [selectedEvent, actId, createEventMutation]);

  const handleDragStart = useCallback((id: string) => {
    setDraggingEventId(id);
  }, []);

  const handleDragMove = useCallback((id: string, x: number, y: number) => {
    const snapped = snapPosition(x, y, 200, 100, id);
    setManualPositions(prev => {
      const next = new Map(prev);
      next.set(id, { x: snapped.x, y: snapped.y });
      return next;
    });
    setAlignmentLines({
      showH: snapped.showHLine,
      showV: snapped.showVLine,
      hY: snapped.hLineY,
      vX: snapped.vLineX,
    });
  }, [snapPosition]);

  const handleDragEnd = useCallback((id: string, x: number, y: number) => {
    setDraggingEventId(null);
    setAlignmentLines({ showH: false, showV: false, hY: 0, vX: 0 });
    
    updateEventMutation.mutate({
      eventId: id,
      data: { position_x: x, position_y: y },
    });
  }, [updateEventMutation]);

  const handleBatchDelete = useCallback(() => {
    batchSelectedIds.forEach(id => {
      deleteEventMutation.mutate(id);
    });
    clearSelection();
  }, [batchSelectedIds, deleteEventMutation, clearSelection]);

  const handleBatchCopy = useCallback(() => {
    const selectedEvents = events.filter(e => batchSelectedIds.has(e.id));
    selectedEvents.forEach(event => {
      const copiedEvent = {
        title: `${event.title} (副本)`,
        content: event.content,
        event_type: event.event_type,
        location: event.location,
        timestamp: event.timestamp,
      };
      createEventMutation.mutate({ actId, data: copiedEvent as StoryEventCreate });
    });
    clearSelection();
  }, [batchSelectedIds, events, actId, createEventMutation, clearSelection]);

  const handleBatchConnect = useCallback((type: ConnectionType) => {
    const selectedEvents = events.filter(e => batchSelectedIds.has(e.id));
    for (let i = 0; i < selectedEvents.length - 1; i++) {
      createConnectionMutation.mutate({
        from_event_id: selectedEvents[i].id,
        to_event_id: selectedEvents[i + 1].id,
        connection_type: type,
      });
    }
    clearSelection();
  }, [batchSelectedIds, events, createConnectionMutation, clearSelection]);

  const handleBatchAlign = useCallback(() => {
    const selectedEvents = events.filter(e => batchSelectedIds.has(e.id));
    if (selectedEvents.length < 2) return;
    
    const positions = selectedEvents.map(e => finalPositions.get(e.id));
    const avgY = positions.reduce((sum, pos) => sum + (pos?.y || 0), 0) / positions.length;
    
    selectedEvents.forEach(event => {
      const pos = finalPositions.get(event.id);
      if (pos) {
        updateEventMutation.mutate({
          eventId: event.id,
          data: { position_y: avgY },
        });
      }
    });
    clearSelection();
  }, [batchSelectedIds, events, finalPositions, updateEventMutation, clearSelection]);

  const handleBatchMerge = useCallback(() => {
    const selectedEvents = events.filter(e => batchSelectedIds.has(e.id));
    if (selectedEvents.length < 2) return;
    
    const mergedContent = selectedEvents.map(e => e.content).join('\n\n');
    const mergedTitle = selectedEvents.map(e => e.title).join(' + ');
    
    updateEventMutation.mutate({
      eventId: selectedEvents[0].id,
      data: { title: mergedTitle, content: mergedContent },
    });
    
    selectedEvents.slice(1).forEach(event => {
      deleteEventMutation.mutate(event.id);
    });
    clearSelection();
  }, [batchSelectedIds, events, updateEventMutation, deleteEventMutation, clearSelection]);

  const handleZoomIn = () => onZoomChange(Math.min(2, zoom + 0.1));
  const handleZoomOut = () => onZoomChange(Math.max(0.25, zoom - 0.1));
  const handleFit = () => {
    if (!canvasRef.current) return;
    const containerWidth = canvasRef.current.parentElement?.clientWidth || 800;
    const containerHeight = canvasRef.current.parentElement?.clientHeight || 400;
    const fitZoom = Math.min(containerWidth / canvasSize.width, containerHeight / canvasSize.height, 1);
    onZoomChange(Math.max(0.25, fitZoom));
  };

  const handleAutoLayout = useCallback(() => {
    setManualPositions(new Map());
  }, []);

  useCanvasKeyboard({
    gridConfig,
    onGridConfigChange,
    onZoomIn: handleZoomIn,
    onZoomOut: handleZoomOut,
    onFitCanvas: handleFit,
    onAutoLayout: handleAutoLayout,
    enabled: isExpanded,
  });

  return (
    <div className="rounded-lg overflow-hidden ring-1 ring-border/30 bg-background/50">
      <button
        onClick={onToggle}
        className={`
          w-full flex items-center gap-2.5 px-4 py-2.5 text-left
          transition-all duration-200 group
          ${isExpanded ? 'bg-accent/8' : 'hover:bg-accent/5'}
        `}
      >
        <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`}>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <Layers className="h-3.5 w-3.5 text-accent/60" />
        <span className="text-base font-medium text-foreground">
          第{actIndex + 1}幕：{actName}
        </span>
        <span className="ml-auto text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
          {events.length} 事件
        </span>
      </button>

      <div 
        className={`
          grid transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
          ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}
        `}
      >
        <div className="overflow-hidden">
          <div className={`transition-all duration-300 ${isExpanded ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}>
          {isLoading ? (
          <StoryChainSkeleton volumeCount={1} actPerVolume={1} showProgress={false} />
        ) : events.length === 0 ? (
          <div className="py-10 text-center">
            <GitBranch className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground mb-3">暂无事件</p>
            <button
              onClick={handleAddEvent}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-primary
                       border border-dashed border-primary/40 rounded-lg
                       hover:bg-primary/5 hover:border-primary/60 transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              添加事件
            </button>
          </div>
        ) : (
          <>
            <div className="relative overflow-auto bg-muted/5 border-t border-border/20" style={{ maxHeight: '1000px' }}>
              <div
                ref={canvasRef}
                data-canvas="true"
                className="relative"
                style={{
                  width: canvasSize.width * zoom,
                  height: canvasSize.height * zoom,
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top left',
                  minWidth: canvasSize.width,
                  minHeight: canvasSize.height,
                }}
                onClick={(e) => {
                  if (e.target === e.currentTarget) {
                    setSelectedEvent(null);
                    clearSelection();
                  }
                }}
              >
                <GridOverlay
                  config={gridConfig}
                  canvasWidth={canvasSize.width}
                  canvasHeight={canvasSize.height}
                  zoom={zoom}
                />

                <AlignmentLines
                  showHorizontal={alignmentLines.showH}
                  showVertical={alignmentLines.showV}
                  horizontalY={alignmentLines.hY}
                  verticalX={alignmentLines.vX}
                  canvasWidth={canvasSize.width}
                  canvasHeight={canvasSize.height}
                />

                <Timeline
                  events={events}
                  eventPositions={finalPositions}
                  zoom={zoom}
                />

                <svg
                  className="absolute inset-0 pointer-events-none"
                  style={{ width: canvasSize.width, height: canvasSize.height }}
                >
                  <SvgDefs />
                  {connections.map((conn) => {
                    return (
                      <ConnectionLine
                        key={conn.id}
                        connection={conn}
                        eventPositions={finalPositions}
                      />
                    );
                  })}
                </svg>

                {events.map((event) => {
                  const pos = finalPositions.get(event.id);
                  if (!pos) return null;
                  
                  const isSearchResult = searchResultIds.has(event.id);
                  const isCurrentSearchResult = currentSearchResultId === event.id;
                  
                  return (
                    <DraggableEvent
                      key={event.id}
                      event={event}
                      position={{ x: pos.x, y: pos.y }}
                      onDragStart={handleDragStart}
                      onDragMove={handleDragMove}
                      onDragEnd={handleDragEnd}
                      isDraggable={!connectionMode}
                    >
                      <EventNode
                        event={event}
                        isSelected={selectedEventId === event.id || isBatchSelected(event.id)}
                        isConnectionSource={connectionSource === event.id}
                        isConnectionMode={connectionMode}
                        isSearchResult={isSearchResult}
                        isCurrentSearchResult={isCurrentSearchResult}
                        onSelect={(id) => {
                          const isShiftKey = (window.event as MouseEvent)?.shiftKey;
                          if (isShiftKey) {
                            toggleSelection(id, true);
                          } else {
                            handleSelectEvent(id);
                          }
                        }}
                        onDoubleClick={handleDoubleClick}
                        onConnectionTarget={handleConnectionTarget}
                      />
                    </DraggableEvent>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2 px-4 py-2 border-t border-border/20 bg-card/30">
              <button
                onClick={handleAddEvent}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs
                         border border-dashed border-border/60 rounded-lg
                         hover:bg-accent/10 hover:border-accent/40 transition-all text-muted-foreground"
              >
                <Plus className="h-3 w-3" />
                添加事件
              </button>
              <div className="flex-1" />
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => onGridConfigChange({ ...gridConfig, enabled: !gridConfig.enabled })}
                  className={`p-1.5 rounded transition-colors ${gridConfig.enabled ? 'bg-accent/20 text-accent' : 'hover:bg-accent/20 text-muted-foreground'}`}
                  title="切换网格"
                >
                  <Grid3X3 className="h-3.5 w-3.5" />
                </button>
                <button 
                  onClick={() => onGridConfigChange({ ...gridConfig, snapEnabled: !gridConfig.snapEnabled })}
                  className={`p-1.5 rounded transition-colors ${gridConfig.snapEnabled ? 'bg-accent/20 text-accent' : 'hover:bg-accent/20 text-muted-foreground'}`}
                  title="切换吸附"
                >
                  <Settings className="h-3.5 w-3.5" />
                </button>
                <div className="w-px h-4 bg-border/40 mx-1" />
                <button onClick={handleZoomOut} className="p-1.5 rounded hover:bg-accent/20 text-muted-foreground transition-colors" title="缩小">
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</span>
                <button onClick={handleZoomIn} className="p-1.5 rounded hover:bg-accent/20 text-muted-foreground transition-colors" title="放大">
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
                <button onClick={handleFit} className="p-1.5 rounded hover:bg-accent/20 text-muted-foreground transition-colors" title="适应画布">
                  <Maximize className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </>
        )}

        <EventModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          event={editingEvent}
          actId={actId}
          projectId={projectId}
          mode={modalMode}
          onSave={handleSaveEvent}
          onDelete={handleDeleteEvent}
        />
          </div>
        </div>
      </div>

      {selectedEventId && selectedEventPosition && !modalOpen && batchSelectedIds.size === 0 && (
        <FloatingActionBar
          selectedEventId={selectedEventId}
          onEdit={() => {
            setEditingEvent(selectedEvent);
            setModalMode('edit');
            setModalOpen(true);
            setSelectedEvent(null);
          }}
          onConnect={handleStartConnection}
          onCopy={handleCopyEvent}
          onStyleChange={handleStyleChange}
          onDelete={() => handleDeleteEvent(selectedEventId)}
          onDeselect={() => setSelectedEvent(null)}
          currentEventType={selectedEvent?.event_type || 'normal'}
          position={selectedEventPosition}
        />
      )}

      {batchSelectedIds.size > 1 && (
        <BatchActionBar
          selectedCount={batchSelectedIds.size}
          onDelete={handleBatchDelete}
          onCopy={handleBatchCopy}
          onConnect={handleBatchConnect}
          onAlign={handleBatchAlign}
          onMerge={handleBatchMerge}
          onDeselect={clearSelection}
        />
      )}
    </div>
  );
};

export const StoryChainView = ({ projectId, outlineData }: StoryChainViewProps) => {
  const { 
    expandedVolumeIds, 
    expandedActIds, 
    toggleVolume, 
    toggleAct,
    connectionMode,
    connectionType,
    connectionSource,
    resetConnectionMode,
  } = useOutlineStore();

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    scopes: ['title', 'content'],
    eventTypes: [],
    caseSensitive: false,
  });
  void searchKeyword;
  void setSearchKeyword;
  void searchFilters;
  void setSearchFilters;
  const [gridConfig, setGridConfig] = useState<GridConfig>(DEFAULT_GRID_CONFIG);
  const [globalZoom, setGlobalZoom] = useState(1);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [showCanvasSettings, setShowCanvasSettings] = useState(false);

  const allEvents = useMemo(() => {
    const events: StoryEvent[] = [];
    return events;
  }, []);

  const searchResults = useMemo(() => {
    if (!searchKeyword.trim()) return [];
    const results: { eventId: string; volumeId: string; actId: string }[] = [];
    return results;
  }, [searchKeyword, searchFilters]);

  const searchResultIds = useMemo(() => {
    return new Set(searchResults.map(r => r.eventId));
  }, [searchResults]);

  const currentSearchResultId = searchResults[currentSearchIndex]?.eventId || null;

  const handleSearchNavigate = useCallback((direction: 'next' | 'prev') => {
    if (searchResults.length === 0) return;
    setCurrentSearchIndex(prev => {
      if (direction === 'next') {
        return (prev + 1) % searchResults.length;
      } else {
        return prev === 0 ? searchResults.length - 1 : prev - 1;
      }
    });
  }, [searchResults.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 监听来自 OutlineView 的事件
  useEffect(() => {
    const handleOpenCanvasSettings = () => setShowCanvasSettings(true);
    const handleOpenEventSearch = () => setSearchOpen(true);

    window.addEventListener('openCanvasSettings', handleOpenCanvasSettings);
    window.addEventListener('openEventSearch', handleOpenEventSearch);

    return () => {
      window.removeEventListener('openCanvasSettings', handleOpenCanvasSettings);
      window.removeEventListener('openEventSearch', handleOpenEventSearch);
    };
  }, []);

  return (
    <>
      {connectionMode && connectionType && (
        <ConnectionModeIndicator
          connectionType={connectionType as ConnectionType}
          connectionSource={connectionSource}
          onCancel={resetConnectionMode}
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {searchOpen && (
          <EventSearch
            events={allEvents}
            onResultSelect={(eventId) => {
              const result = searchResults.find(r => r.eventId === eventId);
              if (result) {
                if (!expandedVolumeIds.has(result.volumeId)) {
                  toggleVolume(result.volumeId);
                }
                if (!expandedActIds.has(result.actId)) {
                  toggleAct(result.actId);
                }
              }
            }}
            onResultNavigate={handleSearchNavigate}
            currentResultIndex={currentSearchIndex}
            totalResults={searchResults.length}
            isOpen={searchOpen}
            onToggle={() => setSearchOpen(false)}
          />
        )}

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto py-6 px-6 space-y-4">
            {outlineData.volumes.map((volume, vIndex) => {
              const isVolumeExpanded = expandedVolumeIds.has(volume.id);

              return (
                <div key={volume.id} className="rounded-xl overflow-hidden ring-1 ring-border/40 bg-card/20">
                  <button
                    onClick={() => toggleVolume(volume.id)}
                    className={`
                      w-full flex items-center gap-3 px-5 py-3.5 text-left
                      transition-all duration-200 group
                      ${isVolumeExpanded ? 'bg-accent/10' : 'hover:bg-accent/5'}
                    `}
                  >
                    <div className={`transition-transform duration-200 ${isVolumeExpanded ? 'rotate-0' : '-rotate-90'}`}>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <BookOpen className="h-4 w-4 text-primary/60" />
                    <span className="text-lg font-semibold text-foreground">
                      第{vIndex + 1}卷：{volume.name}
                    </span>
                  </button>

                  <div 
                    className={`
                      grid transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
                      ${isVolumeExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}
                    `}
                  >
                    <div className="overflow-hidden">
                      <div className={`transition-all duration-300 ${isVolumeExpanded ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}>
                        <div className="px-5 pb-4 space-y-3">
                      {volume.acts.map((act, aIndex) => (
                        <ActChainItem
                          key={act.id}
                          actId={act.id}
                          actName={act.name}
                          actIndex={aIndex}
                          projectId={projectId}
                          isExpanded={expandedActIds.has(act.id)}
                          onToggle={() => toggleAct(act.id)}
                          searchKeyword={searchKeyword}
                          searchFilters={searchFilters}
                          searchResultIds={searchResultIds}
                          currentSearchResultId={currentSearchResultId}
                          gridConfig={gridConfig}
                          onGridConfigChange={setGridConfig}
                          zoom={globalZoom}
                          onZoomChange={setGlobalZoom}
                        />
                      ))}
                      {volume.acts.length === 0 && (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                          <Layers className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                          <p>暂无幕结构</p>
                        </div>
                      )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <CanvasSettingsModal
        isOpen={showCanvasSettings}
        onClose={() => setShowCanvasSettings(false)}
        config={gridConfig}
        onConfigChange={setGridConfig}
      />
    </>
  );
};

export default StoryChainView;
