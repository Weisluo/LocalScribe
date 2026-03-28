// frontend/src/components/Outline/ChapterOutlineView/ChapterOutlineView.tsx
import { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import { ChevronDown, BookOpen, Layers, FileText, Plus } from 'lucide-react';
import { useOutlineStore } from '../hooks/useOutlineStore';
import { useUpdateChapterOutline } from '../hooks/useOutline';
import { ChapterOutlineItem } from './ChapterOutlineItem';
import { useUIStore } from '@/stores/uiStore';
import { useSearchHighlight } from '../hooks/useSearchHighlight';
import type { ProjectOutline } from '../types';

interface ChapterOutlineViewProps {
  projectId: string;
  outlineData: ProjectOutline;
  onNavigateToNote?: (noteId: string) => void;
}

export const ChapterOutlineView = ({ projectId, outlineData, onNavigateToNote }: ChapterOutlineViewProps) => {
  const {
    expandedVolumeIds,
    expandedActIds,
    expandedChapterIds,
    toggleVolume,
    toggleAct,
    toggleChapter,
  } = useOutlineStore();
  
  const openModal = useUIStore(state => state.openModal);
  const [searchKeyword, setSearchKeyword] = useState('');

  const updateMutation = useUpdateChapterOutline(projectId);
  const saveTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const handleOutlineSearch = (e: CustomEvent<{ keyword: string }>) => {
      setSearchKeyword(e.detail.keyword);
    };

    window.addEventListener('outlineSearch', handleOutlineSearch as EventListener);
    return () => window.removeEventListener('outlineSearch', handleOutlineSearch as EventListener);
  }, []);

  const searchResults = useMemo(() => {
    if (!searchKeyword.trim()) return [];
    
    const results: { volumeId: string; actId: string; chapterId: string; chapterTitle: string }[] = [];
    const searchKey = searchKeyword.toLowerCase();

    outlineData.volumes.forEach(volume => {
      volume.acts.forEach(act => {
        act.chapters.forEach(chapter => {
          const titleMatch = chapter.title.toLowerCase().includes(searchKey);
          const contentMatch = chapter.outline_content?.toLowerCase().includes(searchKey);
          
          if (titleMatch || contentMatch) {
            results.push({
              volumeId: volume.id,
              actId: act.id,
              chapterId: chapter.id,
              chapterTitle: chapter.title,
            });
          }
        });
      });
    });

    return results;
  }, [searchKeyword, outlineData.volumes]);

  useEffect(() => {
    const event = new CustomEvent('outlineSearchResults', { 
      detail: { total: searchResults.length } 
    });
    window.dispatchEvent(event);
  }, [searchResults.length]);

  useEffect(() => {
    if (searchResults.length > 0) {
      searchResults.forEach(result => {
        if (!expandedVolumeIds.has(result.volumeId)) {
          toggleVolume(result.volumeId);
        }
        if (!expandedActIds.has(result.actId)) {
          toggleAct(result.actId);
        }
        if (!expandedChapterIds.has(result.chapterId)) {
          toggleChapter(result.chapterId);
        }
      });
    }
  }, [searchResults, expandedVolumeIds, expandedActIds, expandedChapterIds, toggleVolume, toggleAct, toggleChapter]);

  const handleContentChange = useCallback(
    (noteId: string, html: string) => {
      if (saveTimerRef.current[noteId]) {
        clearTimeout(saveTimerRef.current[noteId]);
      }
      saveTimerRef.current[noteId] = setTimeout(() => {
        updateMutation.mutate({ noteId, outlineContent: html });
      }, 1000);
    },
    [updateMutation]
  );

  useEffect(() => {
    return () => {
      Object.values(saveTimerRef.current).forEach(clearTimeout);
    };
  }, []);

  const handleCreateAct = (e: React.MouseEvent, volumeId: string) => {
    e.stopPropagation();
    openModal('act', volumeId);
  };

  const handleCreateNote = (e: React.MouseEvent, actId: string) => {
    e.stopPropagation();
    openModal('note', actId);
  };

  const VolumeTitle = ({ name, index }: { name: string; index: number }) => {
    const highlightedName = useSearchHighlight(name, searchKeyword);
    return (
      <span className="text-lg font-semibold text-foreground">
        第{index + 1}卷：{highlightedName}
      </span>
    );
  };

  const ActTitle = ({ name, index }: { name: string; index: number }) => {
    const highlightedName = useSearchHighlight(name, searchKeyword);
    return (
      <span className="text-base font-medium text-foreground">
        第{index + 1}幕：{highlightedName}
      </span>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto py-6 px-6 space-y-4">
        {outlineData.volumes.map((volume, vIndex) => {
          const isVolumeExpanded = expandedVolumeIds.has(volume.id);

          return (
            <div key={volume.id} className="rounded-xl overflow-hidden ring-1 ring-border/40 bg-card/20">
              {/* 卷标题栏 */}
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
                <VolumeTitle name={volume.name} index={vIndex} />
                <span className="ml-auto text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                  {volume.acts.reduce((acc, act) => acc + act.chapters.length, 0)} 章
                </span>
                <button
                  onClick={(e) => handleCreateAct(e, volume.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 p-1.5 rounded-md hover:bg-accent/20"
                  title="新建幕"
                >
                  <Plus className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                </button>
              </button>

              {/* 卷内容 - 幕列表 */}
              <div className={`grid transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${isVolumeExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                  <div className="px-5 pb-4 space-y-3">
                  {volume.acts.map((act, aIndex) => {
                    const isActExpanded = expandedActIds.has(act.id);

                    return (
                      <div key={act.id} className="rounded-lg overflow-hidden ring-1 ring-border/30 bg-background/50">
                        {/* 幕标题栏 */}
                        <button
                          onClick={() => toggleAct(act.id)}
                          className={`
                            w-full flex items-center gap-2.5 px-4 py-2.5 text-left
                            transition-all duration-200 group
                            ${isActExpanded ? 'bg-accent/8' : 'hover:bg-accent/5'}
                          `}
                        >
                          <div className={`transition-transform duration-200 ${isActExpanded ? 'rotate-0' : '-rotate-90'}`}>
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <Layers className="h-3.5 w-3.5 text-accent/60" />
                          <ActTitle name={act.name} index={aIndex} />
                          <span className="ml-auto text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                            {act.chapters.length} 章
                          </span>
                          <button
                            onClick={(e) => handleCreateNote(e, act.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 p-1.5 rounded-md hover:bg-accent/20"
                            title="新建章节"
                          >
                            <Plus className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                          </button>
                        </button>

                        {/* 幕内容 - 章节列表 */}
                        <div className={`grid transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${isActExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                          <div className="overflow-hidden">
                            <div className="px-4 pb-3 space-y-4 pt-1">
                            {act.chapters.length === 0 ? (
                              <div className="py-6 text-center text-sm text-muted-foreground">
                                <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                                <p>暂无章节</p>
                              </div>
                            ) : (
                              act.chapters.map((chapter, cIndex) => (
                                <ChapterOutlineItem
                                  key={chapter.id}
                                  chapter={chapter}
                                  index={cIndex}
                                  isExpanded={expandedChapterIds.has(chapter.id)}
                                  onToggle={() => toggleChapter(chapter.id)}
                                  onChange={(html) => handleContentChange(chapter.id, html)}
                                  onNavigateToNote={onNavigateToNote}
                                  isSaving={updateMutation.isPending}
                                />
                              ))
                            )}
                          </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ChapterOutlineView;
