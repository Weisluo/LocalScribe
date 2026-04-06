import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Users, X, LayoutGrid, Network, Filter, GripVertical, BarChart3, ChevronUp, CheckSquare, Square, Trash2, BookOpen } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { characterApi } from '@/services/characterApi';
import { api } from '@/utils/request';
import { CharacterBarCard } from './CharacterBarCard';
import { EmptyState } from './EmptyState';
import { CreateCharacterModal } from './CreateCharacterModal';
import { toast } from '@/stores/toastStore';
import type { CharacterLevel, CharacterListItem, CharacterGender } from '@/types/character';
import type { TreeNodeType, VolumeNode } from '@/types';
import {
  CharacterLevelLabels,
  CharacterLevelColors,
} from '@/types/character';
import type { ProjectOutline } from '@/components/Outline/types';

interface CharacterSidebarProps {
  projectId: string;
  onSelectCharacter: (characterId: string) => void;
  selectedCharacterId: string | null;
  viewMode?: 'list' | 'cloud';
  onSwitchView?: (mode: 'list' | 'cloud') => void;
}

interface SortableCharacterCardProps {
  character: CharacterListItem;
  isSelected: boolean;
  onClick: () => void;
  isSorting: boolean;
  appearance?: {
    first: { volume: string; act: string; chapter: string } | null;
    last: { volume: string; act: string; chapter: string } | null;
  };
}

const SortableCharacterCard = ({
  character,
  isSelected,
  onClick,
  isSorting,
  appearance,
}: SortableCharacterCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: character.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group"
    >
      {isSorting && (
        <div
          {...attributes}
          {...listeners}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground z-10"
        >
          <GripVertical className="h-4 w-4" />
        </div>
      )}
      <div className={isSorting ? 'pl-5' : ''}>
        <CharacterBarCard
          character={character}
          isSelected={isSelected}
          onClick={onClick}
          appearance={appearance}
        />
      </div>
    </div>
  );
};

/**
 * 左侧人物栏组件
 *
 * 显示人物列表、搜索、筛选功能，支持拖拽排序
 */
export const CharacterSidebar = ({
  projectId,
  onSelectCharacter,
  selectedCharacterId,
  viewMode = 'list',
  onSwitchView,
}: CharacterSidebarProps) => {
  const queryClient = useQueryClient();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [levelFilter, setLevelFilter] = useState<CharacterLevel | null>(null);
  const [isSorting, setIsSorting] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [volumeFilter, setVolumeFilter] = useState<string | null>(null);
  const [actFilter, setActFilter] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<'all' | 'history' | 'main' | null>('all');
  const [showUnifiedFilter, setShowUnifiedFilter] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState<'level' | 'source' | 'appearance'>('level');
  const unifiedFilterRef = useRef<HTMLDivElement>(null);

  const { data: tree } = useQuery({
    queryKey: ['directory', projectId],
    queryFn: () => api.get<VolumeNode[]>(`/projects/${projectId}/tree`),
    enabled: !!projectId,
  });

  const { data: outline } = useQuery({
    queryKey: ['outline', projectId],
    queryFn: () => api.get<ProjectOutline>(`/outline/projects/${projectId}/outline`),
    enabled: !!projectId,
  });

  const { volumes } = useMemo(() => {
    const volSet = new Set<string>();

    const processNode = (node: TreeNodeType) => {
      if (node.type === 'volume') {
        volSet.add(node.name);
      }
      if ('children' in node && node.children) {
        node.children.forEach(processNode);
      }
    };

    tree?.forEach(processNode);
    return {
      volumes: Array.from(volSet),
    };
  }, [tree]);

  const availableActs = useMemo(() => {
    if (!volumeFilter || !tree) return [];
    
    const actSet = new Set<string>();
    
    const findVolume = (nodes: TreeNodeType[]): TreeNodeType | null => {
      for (const node of nodes) {
        if (node.type === 'volume' && node.name === volumeFilter) {
          return node;
        }
      }
      return null;
    };
    
    const volume = findVolume(tree);
    if (volume && 'children' in volume && volume.children) {
      volume.children.forEach((child) => {
        if (child.type === 'act') {
          actSet.add(child.name);
        }
      });
    }
    
    return Array.from(actSet);
  }, [tree, volumeFilter]);

  const { data: characters = [], isLoading } = useQuery({
    queryKey: ['characters', projectId, levelFilter, searchKeyword, volumeFilter, actFilter, sourceFilter, isSorting],
    queryFn: () =>
      characterApi.getCharacters(projectId, {
        level: levelFilter || undefined,
        search: searchKeyword || undefined,
        volume: volumeFilter || undefined,
        act: actFilter || undefined,
        source: sourceFilter && sourceFilter !== 'all' ? sourceFilter : undefined,
        sort_by: isSorting ? 'order_index' : 'default',
        sort_order: 'asc',
      }),
    enabled: !!projectId,
  });

  interface AppearanceMatch {
    volume: string;
    act: string;
    chapter: string;
  }

  const characterAppearances = useMemo(() => {
    const result: Record<string, { first: AppearanceMatch | null; last: AppearanceMatch | null }> = {};
    
    if (!outline?.volumes || !tree) {
      return result;
    }

    characters.forEach(char => {
      const characterName = char.name.toLowerCase();
      const aliases = char.aliases?.map(a => a.content.toLowerCase()) || [];
      const searchTerms = [characterName, ...aliases];

      const matches: AppearanceMatch[] = [];

      const searchInText = (text: string): boolean => {
        if (!text) return false;
        const lowerText = text.toLowerCase();
        return searchTerms.some(term => lowerText.includes(term));
      };

      outline.volumes.forEach(volume => {
        volume.acts.forEach(act => {
          act.chapters.forEach(chapter => {
            if (chapter.outline_content && searchInText(chapter.outline_content)) {
              matches.push({
                volume: volume.name,
                act: act.name,
                chapter: chapter.title,
              });
            }
          });
        });
      });

      result[char.id] = {
        first: matches.length > 0 ? matches[0] : null,
        last: matches.length > 0 ? matches[matches.length - 1] : null,
      };
    });

    return result;
  }, [outline, tree, characters]);

  const filteredBySource = useMemo(() => {
    if (!sourceFilter || sourceFilter === 'all') return characters;
    if (sourceFilter === 'history') return characters.filter(c => c.source === 'history' || c.level === 'past');
    return characters.filter(c => !c.source || c.source !== 'history');
  }, [characters, sourceFilter]);

  // 获取统计数据
  const { data: stats } = useQuery({
    queryKey: ['character-stats', projectId],
    queryFn: () => characterApi.getCharacterStats(projectId),
    enabled: !!projectId,
  });

  // 创建人物
  const createCharacterMutation = useMutation({
    mutationFn: (data: { name: string; level: CharacterLevel; gender: CharacterGender }) =>
      characterApi.createCharacter(projectId, data),
    onSuccess: (newCharacter) => {
      queryClient.invalidateQueries({ queryKey: ['characters', projectId] });
      onSelectCharacter(newCharacter.id);
      setShowCreateModal(false);
      toast.success('创建成功', `人物"${newCharacter.name}"已创建`);
    },
    onError: (error) => {
      toast.error('创建失败', error instanceof Error ? error.message : '未知错误');
    },
  });

  // 批量更新排序
  const batchUpdateOrderMutation = useMutation({
    mutationFn: (data: { orders: Record<string, number> }) =>
      characterApi.batchUpdateCharacterOrder(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['characters', projectId] });
    },
  });

  // 配置拖拽传感器
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 处理拖拽结束
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = characters.findIndex((c) => c.id === active.id);
      const newIndex = characters.findIndex((c) => c.id === over.id);

      const newCharacters = arrayMove(characters, oldIndex, newIndex);

      // 更新服务器排序 - 转换为后端期望的格式
      const orders: Record<string, number> = {};
      newCharacters.forEach((c, index) => {
        orders[c.id] = index;
      });
      batchUpdateOrderMutation.mutate({ orders });
    }
  }, [characters, batchUpdateOrderMutation]);

  // 处理搜索
  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchKeyword(e.target.value);
  }, []);

  // 处理等级筛选
  const handleLevelFilter = useCallback((level: CharacterLevel | null) => {
    setLevelFilter(level);
  }, []);

  // 处理来源筛选
  const handleSourceFilter = useCallback((source: 'all' | 'history' | 'main') => {
    if (source === 'all') {
      setSourceFilter('all');
    } else {
      setSourceFilter(source);
    }
  }, []);

  // 处理创建人物
  const handleCreateCharacter = useCallback(() => {
    setShowCreateModal(true);
  }, []);

  // 处理创建人物确认
  const handleCreateConfirm = useCallback((data: { name: string; level: CharacterLevel; gender: CharacterGender }) => {
    createCharacterMutation.mutate(data);
  }, [createCharacterMutation]);

  // 点击外部关闭筛选下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (unifiedFilterRef.current && !unifiedFilterRef.current.contains(event.target as Node)) {
        setShowUnifiedFilter(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 当搜索或筛选时，禁用排序和批量模式
  const hasActiveFilter = levelFilter || volumeFilter || actFilter || (sourceFilter && sourceFilter !== 'all');
  const canSort = !searchKeyword && !hasActiveFilter && !isLoading && !isBatchMode;
  const canBatch = !searchKeyword && !hasActiveFilter && !isLoading && !isSorting;

  const handleClearAppearanceFilter = useCallback(() => {
    setVolumeFilter(null);
    setActFilter(null);
  }, []);

  // 处理批量选择
  const handleToggleSelect = useCallback((characterId: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(characterId)) {
        newSet.delete(characterId);
      } else {
        newSet.add(characterId);
      }
      return newSet;
    });
  }, []);

  // 处理全选
  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === characters.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(characters.map((c) => c.id)));
    }
  }, [characters, selectedIds.size]);

  // 处理批量删除
  const handleBatchDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    
    const confirmed = window.confirm(`确定要删除选中的 ${selectedIds.size} 位人物吗？此操作不可恢复。`);
    if (!confirmed) return;

    try {
      await characterApi.batchDeleteCharacters(projectId, { ids: Array.from(selectedIds) });
      queryClient.invalidateQueries({ queryKey: ['characters', projectId] });
      setSelectedIds(new Set());
      setIsBatchMode(false);
      toast.success('删除成功', `已删除 ${selectedIds.size} 位人物`);
    } catch (error) {
      toast.error('删除失败', error instanceof Error ? error.message : '未知错误');
    }
  }, [projectId, selectedIds, queryClient]);

  // 退出批量模式
  const handleExitBatchMode = useCallback(() => {
    setIsBatchMode(false);
    setSelectedIds(new Set());
  }, []);

  return (
    <div className="flex flex-col h-full bg-card/30">
      {/* 标题栏 */}
      <div className="h-14 border-b border-border/60 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="font-serif font-semibold text-foreground">人物设定</h2>
        </div>
        <div className="flex items-center gap-1">
          {/* 批量模式按钮 */}
          {canBatch && (
            <button
              onClick={() => setIsBatchMode(!isBatchMode)}
              className={`p-1.5 rounded-lg transition-all duration-200 mr-1 ${
                isBatchMode
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/30'
              }`}
              title={isBatchMode ? '退出批量' : '批量操作'}
            >
              {isBatchMode ? <X className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
            </button>
          )}
          {/* 排序切换按钮 */}
          {canSort && (
            <button
              onClick={() => setIsSorting(!isSorting)}
              className={`p-1.5 rounded-lg transition-all duration-200 mr-1 ${
                isSorting
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/30'
              }`}
              title={isSorting ? '完成排序' : '调整排序'}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}
          {/* 视图切换按钮 */}
          <div className="flex items-center bg-accent/10 rounded-lg p-0.5">
            <button
              onClick={() => onSwitchView?.('list')}
              className={`p-1.5 rounded-md transition-all duration-200 ${
                viewMode === 'list'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="列表视图"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => onSwitchView?.('cloud')}
              className={`p-1.5 rounded-md transition-all duration-200 ${
                viewMode === 'cloud'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="云图视图"
            >
              <Network className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 批量操作栏 */}
      {isBatchMode && (
        <div className="px-3 py-2 border-b border-border/60 flex-shrink-0 bg-primary/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                {selectedIds.size === characters.length ? (
                  <CheckSquare className="h-4 w-4" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                全选 ({selectedIds.size}/{characters.length})
              </button>
            </div>
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <button
                  onClick={handleBatchDelete}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-lg transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  删除 ({selectedIds.size})
                </button>
              )}
              <button
                onClick={handleExitBatchMode}
                className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/20 rounded-lg transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 搜索栏 + 筛选整合 */}
      <div className="p-3 border-b border-border/60 flex-shrink-0">
        <div className="flex items-center gap-2">
          {/* 搜索框 */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchKeyword}
              onChange={handleSearch}
              placeholder="搜索人物..."
              className="w-full pl-9 pr-7 py-2 text-sm bg-background border border-border/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
            />
            {searchKeyword && (
              <button
                onClick={() => setSearchKeyword('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* 统一筛选按钮 */}
          <div className="relative flex-shrink-0" ref={unifiedFilterRef}>
            <button
              onClick={() => setShowUnifiedFilter(!showUnifiedFilter)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition-all duration-200 ${
                hasActiveFilter
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-accent/10 text-muted-foreground hover:text-foreground hover:bg-accent/20'
              }`}
              title="筛选"
            >
              <Filter className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">筛选</span>
              {hasActiveFilter && (
                <span className="ml-0.5 w-4 h-4 flex items-center justify-center text-[10px] bg-primary-foreground/20 rounded-full">
                  {[levelFilter, sourceFilter !== 'all' ? sourceFilter : null, volumeFilter, actFilter].filter(Boolean).length}
                </span>
              )}
            </button>

            {/* 统一筛选面板 */}
            {showUnifiedFilter && (
              <div className="absolute top-full right-0 mt-1.5 w-64 bg-card border border-border/60 rounded-xl shadow-xl z-20 overflow-hidden">
                {/* 标签页切换 */}
                <div className="flex border-b border-border/40">
                  {[
                    { key: 'level', label: '等级', icon: Users },
                    { key: 'source', label: '来源', icon: BookOpen },
                    { key: 'appearance', label: '出场', icon: LayoutGrid },
                  ].map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => setActiveFilterTab(key as typeof activeFilterTab)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors ${
                        activeFilterTab === key
                          ? 'text-primary bg-primary/5 border-b-2 border-primary'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent/10'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  ))}
                </div>

                {/* 等级筛选内容 */}
                {activeFilterTab === 'level' && (
                  <div className="p-3 space-y-1">
                    <button
                      onClick={() => handleLevelFilter(null)}
                      className={`w-full px-3 py-2 text-sm text-left rounded-lg transition-colors ${
                        levelFilter === null
                          ? 'bg-primary/10 text-primary'
                          : 'hover:bg-accent/10 text-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                        全部角色
                      </div>
                    </button>
                    <div className="my-2 border-t border-border/30" />
                    {(['protagonist', 'major_support', 'support', 'minor'] as CharacterLevel[]).map(
                      (level) => (
                        <button
                          key={level}
                          onClick={() => handleLevelFilter(level)}
                          className={`w-full px-3 py-2 text-sm text-left rounded-lg transition-colors ${
                            levelFilter === level
                              ? 'bg-primary/10 text-primary'
                              : 'hover:bg-accent/10 text-foreground'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: CharacterLevelColors[level].bar }}
                            />
                            {CharacterLevelLabels[level]}
                          </div>
                        </button>
                      )
                    )}
                  </div>
                )}

                {/* 来源筛选内容 */}
                {activeFilterTab === 'source' && (
                  <div className="p-3 space-y-1">
                    {[
                      { key: 'all', label: '全部人物', desc: '显示所有人物' },
                      { key: 'main', label: '主线人物', desc: '故事主要角色' },
                      { key: 'history', label: '历史背景', desc: '仅历史中出现' },
                    ].map(({ key, label, desc }) => (
                      <button
                        key={key}
                        onClick={() => handleSourceFilter(key as 'all' | 'history' | 'main')}
                        className={`w-full px-3 py-2.5 text-left rounded-lg transition-colors ${
                          (sourceFilter === key || (key === 'all' && !sourceFilter))
                            ? 'bg-primary/10 text-primary'
                            : 'hover:bg-accent/10 text-foreground'
                        }`}
                      >
                        <div className="text-sm font-medium">{label}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{desc}</div>
                      </button>
                    ))}
                  </div>
                )}

                {/* 出场筛选内容 */}
                {activeFilterTab === 'appearance' && (
                  <div className="p-3 space-y-3 max-h-64 overflow-y-auto">
                    {volumes.length > 0 ? (
                      <>
                        <div>
                          <span className="text-xs font-medium text-muted-foreground block mb-2">选择卷</span>
                          <div className="flex flex-wrap gap-1.5">
                            {volumes.map((vol) => (
                              <button
                                key={vol}
                                onClick={() => {
                                  if (volumeFilter === vol) {
                                    setVolumeFilter(null);
                                    setActFilter(null);
                                  } else {
                                    setVolumeFilter(vol);
                                    setActFilter(null);
                                  }
                                }}
                                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                                  volumeFilter === vol
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-accent/10 hover:bg-accent/20 text-foreground'
                                }`}
                              >
                                {vol}
                              </button>
                            ))}
                          </div>
                        </div>

                        {volumeFilter && availableActs.length > 0 && (
                          <>
                            <div className="border-t border-border/30 pt-2">
                              <span className="text-xs font-medium text-muted-foreground block mb-2">选择幕</span>
                              <div className="flex flex-wrap gap-1.5">
                                {availableActs.map((act) => (
                                  <button
                                    key={act}
                                    onClick={() => setActFilter(actFilter === act ? null : act)}
                                    className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                                      actFilter === act
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-accent/10 hover:bg-accent/20 text-foreground'
                                    }`}
                                  >
                                    {act}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </>
                    ) : (
                      <div className="text-xs text-muted-foreground text-center py-4">
                        暂无章节数据
                      </div>
                    )}

                    {(volumeFilter || actFilter) && (
                      <div className="border-t border-border/30 pt-2">
                        <button
                          onClick={handleClearAppearanceFilter}
                          className="w-full py-1.5 text-xs text-primary hover:bg-primary/5 rounded-md transition-colors"
                        >
                          清除出场筛选
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* 底部清除全部 */}
                {hasActiveFilter && (
                  <div className="border-t border-border/40 p-2 bg-accent/5">
                    <button
                      onClick={() => {
                        setLevelFilter(null);
                        setSourceFilter('all');
                        setVolumeFilter(null);
                        setActFilter(null);
                      }}
                      className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5"
                    >
                      <X className="h-3 w-3" />
                      清除全部筛选
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {isSorting && (
          <div className="mt-2 text-xs text-primary">
            拖拽调整顺序
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <EmptyState type="loading" />
        ) : filteredBySource.length === 0 ? (
          <EmptyState
            type={searchKeyword ? 'no-search-results' : hasActiveFilter ? 'no-filter-results' : 'no-characters'}
            onAction={handleCreateCharacter}
          />
        ) : isSorting ? (
          // 排序模式 - 可拖拽列表
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={filteredBySource.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {filteredBySource.map((character) => (
                  <SortableCharacterCard
                    key={character.id}
                    character={character}
                    isSelected={selectedCharacterId === character.id}
                    onClick={() => onSelectCharacter(character.id)}
                    isSorting={isSorting}
                    appearance={characterAppearances[character.id]}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : isBatchMode ? (
          // 批量模式 - 带复选框
          filteredBySource.map((character) => (
            <div
              key={character.id}
              className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                selectedIds.has(character.id)
                  ? 'bg-primary/10'
                  : 'hover:bg-accent/5'
              }`}
              onClick={() => handleToggleSelect(character.id)}
            >
              <div className="flex-shrink-0">
                {selectedIds.has(character.id) ? (
                  <CheckSquare className="h-5 w-5 text-primary" />
                ) : (
                  <Square className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <CharacterBarCard
                  character={character}
                  isSelected={selectedCharacterId === character.id}
                  onClick={() => {}}
                  appearance={characterAppearances[character.id]}
                />
              </div>
            </div>
          ))
        ) : (
          filteredBySource.map((character) => (
            <CharacterBarCard
              key={character.id}
              character={character}
              isSelected={selectedCharacterId === character.id}
              onClick={() => onSelectCharacter(character.id)}
              appearance={characterAppearances[character.id]}
            />
          ))
        )}
      </div>

      {/* 底部统计 */}
      <div className="border-t border-border/60 flex-shrink-0">
        {/* 统计面板 */}
        {showStats && stats && (
          <div className="p-3 border-b border-border/40 space-y-3">
            {/* 按等级统计 */}
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2">角色等级分布</h4>
              <div className="space-y-1.5">
                {(['protagonist', 'major_support', 'support', 'minor', 'past'] as const).map((level) => {
                  const count = stats.by_level[level] || 0;
                  const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
                  return (
                    <div key={level} className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: CharacterLevelColors[level].bar }}
                      />
                      <span className="text-xs text-muted-foreground w-16">{CharacterLevelLabels[level]}</span>
                      <div className="flex-1 h-1.5 bg-accent/20 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: CharacterLevelColors[level].bar,
                          }}
                        />
                      </div>
                      <span className="text-xs text-foreground w-6 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 按性别统计 */}
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2">性别分布</h4>
              <div className="flex gap-4">
                {[
                  { key: 'male', label: '男', color: 'hsl(200 70% 50%)' },
                  { key: 'female', label: '女', color: 'hsl(330 70% 55%)' },
                  { key: 'other', label: '其他', color: 'hsl(150 50% 50%)' },
                  { key: 'unknown', label: '未知', color: 'hsl(0 0% 70%)' },
                ].map(({ key, label, color }) => {
                  const count = stats.by_gender[key as CharacterGender] || 0;
                  return (
                    <div key={key} className="flex items-center gap-1.5">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <span className="text-xs font-medium">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 新增人物按钮 */}
        {!isBatchMode && (
          <div className="px-3 py-2 border-b border-border/40">
            <button
              onClick={handleCreateCharacter}
              disabled={createCharacterMutation.isPending}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-all duration-200 text-sm font-medium"
            >
              {createCharacterMutation.isPending ? (
                <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              新增人物
            </button>
          </div>
        )}

        <div className="p-3 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>共 {filteredBySource.length} 位人物</span>
            {stats && (
              <button
                onClick={() => setShowStats(!showStats)}
                className="flex items-center gap-1 text-primary hover:underline"
              >
                <BarChart3 className="h-3 w-3" />
                {showStats ? (
                  <>
                    收起 <ChevronUp className="h-3 w-3" />
                  </>
                ) : (
                  '统计'
                )}
              </button>
            )}
          </div>
          {hasActiveFilter && (
            <button
              onClick={() => {
                setLevelFilter(null);
                setSourceFilter('all');
                setVolumeFilter(null);
                setActFilter(null);
              }}
              className="text-primary hover:underline flex items-center gap-1"
            >
              <X className="h-3 w-3" />
              清除筛选
            </button>
          )}
        </div>
      </div>

      <CreateCharacterModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onConfirm={handleCreateConfirm}
        isLoading={createCharacterMutation.isPending}
      />
    </div>
  );
};

export default CharacterSidebar;
