// frontend/src/components/Outline/OutlineView.tsx
import { useEffect, lazy, Suspense } from 'react';
import { FolderOpen, Plus, Settings, Search } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { OutlineNavigation } from './OutlineNavigation';
import { useOutlineStore } from './hooks/useOutlineStore';
import { useProjectOutline } from './hooks/useOutline';
import { StoryChainSkeleton, VolumeOutlineSkeleton, ChapterOutlineSkeleton } from './StoryChainView/Skeleton';
import { useUIStore } from '@/stores/uiStore';
import { KeyboardShortcutsHelp } from './StoryChainView/KeyboardShortcutsHelp';

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

  // 根据当前 tab 渲染不同的右侧操作按钮
  const renderRightActions = () => {
    if (activeTab === 'story-chain') {
      return (
        <>
          <KeyboardShortcutsHelp />
          <button
            onClick={() => {
              // 这个状态会在 StoryChainView 中处理
              const event = new CustomEvent('openCanvasSettings');
              window.dispatchEvent(event);
            }}
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground
                     hover:text-foreground hover:bg-accent/10 rounded-lg transition-all"
            title="画布设置"
          >
            <Settings className="h-3.5 w-3.5" />
            画布设置
          </button>
          <button
            onClick={() => {
              const event = new CustomEvent('openEventSearch');
              window.dispatchEvent(event);
            }}
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground
                     hover:text-foreground hover:bg-accent/10 rounded-lg transition-all"
            title="搜索 (Ctrl+F)"
          >
            <Search className="h-3.5 w-3.5" />
            搜索事件
          </button>
        </>
      );
    }
    
    if (activeTab === 'volume-outline' || activeTab === 'chapter-outline') {
      return (
        <button
          onClick={handleCreateVolume}
          className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground
                   hover:text-foreground hover:bg-accent/10 rounded-lg transition-all"
          title="新建卷"
        >
          <Plus className="h-3.5 w-3.5" />
          新建卷
        </button>
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
