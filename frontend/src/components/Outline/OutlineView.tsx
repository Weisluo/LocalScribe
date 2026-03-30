// frontend/src/components/Outline/OutlineView.tsx
import { useEffect, lazy, Suspense, useState, useCallback, useRef } from 'react';
import { FolderOpen, Plus, Settings, Search, Keyboard, Filter, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { OutlineNavigation } from './OutlineNavigation';
import { useOutlineStore } from './hooks/useOutlineStore';
import { useProjectOutline } from './hooks/useOutline';
import { StoryChainSkeleton, VolumeOutlineSkeleton, ChapterOutlineSkeleton } from './StoryChainView/Skeleton';
import { useUIStore } from '@/stores/uiStore';
import type { SearchFilters, SearchScope } from './types';

const VolumeOutlineView = lazy(() => import('./VolumeOutlineView').then(m => ({ default: m.VolumeOutlineView })));
const ChapterOutlineView = lazy(() => import('./ChapterOutlineView').then(m => ({ default: m.ChapterOutlineView })));
const StoryChainView = lazy(() => import('./StoryChainView').then(m => ({ default: m.StoryChainView })));

interface LoadingFallbackProps {
  activeTab: string;
}

const LoadingFallback = ({ activeTab }: LoadingFallbackProps) => {
  if (activeTab === 'story-chain') {
    return <StoryChainSkeleton volumeCount={2} actPerVolume={2} showProgress />;
  }
  if (activeTab === 'volume-outline') {
    return <VolumeOutlineSkeleton volumeCount={2} />;
  }
  if (activeTab === 'chapter-outline') {
    return <ChapterOutlineSkeleton volumeCount={2} actPerVolume={2} chapterPerAct={3} />;
  }
  return null;
};

export const OutlineView = () => {
  const { currentProjectId } = useProjectStore();
  const { activeTab, setActiveTab } = useOutlineStore();
  const { data: outlineData, isLoading } = useProjectOutline(currentProjectId || undefined);
  const openModal = useUIStore(state => state.openModal);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    scopes: ['title', 'content'],
    eventTypes: [],
    caseSensitive: false,
  });
  const [totalResults, setTotalResults] = useState(0);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleSearchChange = useCallback((value: string) => {
    setSearchKeyword(value);
    setCurrentResultIndex(0);
    const event = new CustomEvent('outlineSearch', { 
      detail: { keyword: value, filters } 
    });
    window.dispatchEvent(event);
  }, [filters]);

  const handleFiltersChange = useCallback((newFilters: SearchFilters) => {
    setFilters(newFilters);
    const event = new CustomEvent('outlineSearch', { 
      detail: { keyword: searchKeyword, filters: newFilters } 
    });
    window.dispatchEvent(event);
  }, [searchKeyword]);

  const handleSearchNavigate = useCallback((direction: 'next' | 'prev') => {
    if (totalResults === 0) return;
    
    const newIndex = direction === 'next'
      ? (currentResultIndex + 1) % totalResults
      : currentResultIndex === 0 ? totalResults - 1 : currentResultIndex - 1;
    
    setCurrentResultIndex(newIndex);
    const event = new CustomEvent('outlineSearchNavigate', { 
      detail: { direction } 
    });
    window.dispatchEvent(event);
  }, [totalResults, currentResultIndex]);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearchNavigate(e.shiftKey ? 'prev' : 'next');
    }
    if (e.key === 'Escape') {
      setSearchKeyword('');
      const event = new CustomEvent('outlineSearch', { detail: { keyword: '' } });
      window.dispatchEvent(event);
    }
  }, [handleSearchNavigate]);

  useEffect(() => {
    const handleSearchResults = (e: CustomEvent<{ total: number }>) => {
      setTotalResults(e.detail.total);
    };

    window.addEventListener('outlineSearchResults', handleSearchResults as EventListener);
    return () => window.removeEventListener('outlineSearchResults', handleSearchResults as EventListener);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 首次加载时展开第一个卷
  const { expandedVolumeIds, expandAll } = useOutlineStore();
  useEffect(() => {
    if (outlineData?.volumes && outlineData.volumes.length > 0 && expandedVolumeIds.size === 0) {
      const firstVolumeId = outlineData.volumes[0].id;
      const firstActIds = outlineData.volumes[0].acts?.map(a => a.id) || [];
      expandAll([firstVolumeId], firstActIds);
    }
  }, [outlineData, expandedVolumeIds.size, expandAll]);

  const handleCreateVolume = () => {
    openModal('volume', currentProjectId);
  };

  const renderRightActions = () => {
    const searchInput = (
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <div className="relative flex-1 flex items-center min-w-0">
          <Search className="absolute left-3 h-3.5 w-3.5 text-muted-foreground pointer-events-none z-10" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchKeyword}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="搜索... (Ctrl+F)"
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-muted/30 border border-border/40 rounded-lg
                     text-foreground placeholder:text-muted-foreground/50
                     focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/50
                     transition-all"
          />
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border transition-all flex-shrink-0
                    ${showFilters 
                      ? 'bg-accent/20 border-accent/40 text-foreground' 
                      : 'border-border/40 text-muted-foreground hover:bg-accent/10 hover:text-foreground'}`}
          title="筛选"
        >
          <Filter className="h-3 w-3" />
        </button>

        {totalResults > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
            <button
              onClick={() => handleSearchNavigate('prev')}
              className="p-1 rounded hover:bg-accent/20 transition-colors"
              title="上一个 (Shift+Enter)"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-[40px] text-center">
              {currentResultIndex + 1}/{totalResults}
            </span>
            <button
              onClick={() => handleSearchNavigate('next')}
              className="p-1 rounded hover:bg-accent/20 transition-colors"
              title="下一个 (Enter)"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {searchKeyword && (
          <button
            onClick={() => {
              setSearchKeyword('');
              handleSearchChange('');
            }}
            className="p-1 rounded hover:bg-accent/20 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );

    const filterPanel = showFilters && (
      <div className="absolute top-full left-0 right-0 mt-1 p-3 bg-card border border-border/40 rounded-lg shadow-lg z-50">
        <div className="space-y-3">
          <div>
            <div className="text-xs font-medium text-foreground mb-1.5">搜索范围</div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { value: 'title', label: '标题' },
                { value: 'content', label: '内容' },
                { value: 'character', label: '角色' },
                { value: 'location', label: '地点' },
                { value: 'timestamp', label: '时间' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => {
                    const scopes = filters.scopes.includes(opt.value as SearchScope)
                      ? filters.scopes.filter(s => s !== opt.value)
                      : [...filters.scopes, opt.value as SearchScope];
                    handleFiltersChange({ ...filters, scopes });
                  }}
                  className={`px-2.5 py-1 text-xs rounded-md border transition-all
                           ${filters.scopes.includes(opt.value as SearchScope)
                             ? 'bg-accent/20 border-accent/40 text-foreground'
                             : 'border-border/40 text-muted-foreground hover:bg-accent/10 hover:text-foreground'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-border/20">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={filters.caseSensitive}
                onChange={(e) => handleFiltersChange({ ...filters, caseSensitive: e.target.checked })}
                className="rounded border-border/60"
              />
              区分大小写
            </label>
            <button
              onClick={() => handleFiltersChange({
                scopes: ['title', 'content'],
                eventTypes: [],
                caseSensitive: false,
              })}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              重置
            </button>
          </div>
        </div>
      </div>
    );

    if (activeTab === 'story-chain') {
      return (
        <>
          <div className="relative flex-1 flex items-center gap-2 min-w-0">
            {searchInput}
            {filterPanel}
          </div>
          <button
            onClick={() => {
              const event = new CustomEvent('openKeyboardShortcuts');
              window.dispatchEvent(event);
            }}
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground
                     hover:text-foreground hover:bg-accent/10 rounded-lg transition-all flex-shrink-0"
            title="键盘快捷键"
          >
            <Keyboard className="h-3.5 w-3.5" />
            快捷键
          </button>
          <button
            onClick={() => {
              const event = new CustomEvent('openCanvasSettings');
              window.dispatchEvent(event);
            }}
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground
                     hover:text-foreground hover:bg-accent/10 rounded-lg transition-all flex-shrink-0"
            title="画布设置"
          >
            <Settings className="h-3.5 w-3.5" />
            画布设置
          </button>
          <button
            onClick={handleCreateVolume}
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground
                     hover:text-foreground hover:bg-accent/10 rounded-lg transition-all flex-shrink-0"
            title="新建卷"
          >
            <Plus className="h-3.5 w-3.5" />
            新建卷
          </button>
        </>
      );
    }
    
    if (activeTab === 'volume-outline' || activeTab === 'chapter-outline') {
      return (
        <>
          <div className="relative flex-1 flex items-center gap-2 min-w-0">
            {searchInput}
            {filterPanel}
          </div>
          <button
            onClick={handleCreateVolume}
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground
                     hover:text-foreground hover:bg-accent/10 rounded-lg transition-all flex-shrink-0"
            title="新建卷"
          >
            <Plus className="h-3.5 w-3.5" />
            新建卷
          </button>
        </>
      );
    }
    
    return null;
  };

  if (!currentProjectId) return null;

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col bg-background">
        <OutlineNavigation activeTab={activeTab} onTabChange={setActiveTab} rightActions={renderRightActions()} />
        <LoadingFallback activeTab={activeTab} />
      </div>
    );
  }

  // 空状态
  if (!outlineData || outlineData.volumes.length === 0) {
    return (
      <div className="flex-1 flex flex-col bg-background">
        <OutlineNavigation activeTab={activeTab} onTabChange={setActiveTab} rightActions={renderRightActions()} />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
          <div className="relative">
            <div className="absolute inset-0 bg-accent/10 blur-2xl rounded-full" />
            <FolderOpen className="h-14 w-14 text-muted-foreground/40 relative" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-base font-medium text-foreground/70">暂无卷结构</p>
            <p className="text-sm text-muted-foreground">请在左侧目录树中创建卷和幕</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background overflow-hidden">
      <OutlineNavigation activeTab={activeTab} onTabChange={setActiveTab} rightActions={renderRightActions()} />
      <div className="flex-1 overflow-hidden flex flex-col">
        <Suspense fallback={<LoadingFallback activeTab={activeTab} />}>
          {activeTab === 'story-chain' && (
            <StoryChainView
              projectId={currentProjectId}
              outlineData={outlineData}
            />
          )}
          {activeTab === 'volume-outline' && (
            <VolumeOutlineView
              projectId={currentProjectId}
              outlineData={outlineData}
            />
          )}
          {activeTab === 'chapter-outline' && (
            <ChapterOutlineView
              projectId={currentProjectId}
              outlineData={outlineData}
            />
          )}
        </Suspense>
      </div>
    </div>
  );
};

export default OutlineView;
