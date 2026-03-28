// frontend/src/components/Outline/VolumeOutlineView/VolumeOutlineView.tsx
import { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import { ChevronDown, BookOpen } from 'lucide-react';
import { useOutlineStore } from '../hooks/useOutlineStore';
import { useUpdateVolumeOutline } from '../hooks/useOutline';
import { PaperEditor } from './PaperEditor';
import { useSearchHighlight } from '../hooks/useSearchHighlight';
import type { ProjectOutline } from '../types';

interface VolumeOutlineViewProps {
  projectId: string;
  outlineData: ProjectOutline;
}

export const VolumeOutlineView = ({ projectId, outlineData }: VolumeOutlineViewProps) => {
  const { expandedVolumeIds, toggleVolume } = useOutlineStore();
  const updateMutation = useUpdateVolumeOutline(projectId);
  const [searchKeyword, setSearchKeyword] = useState('');

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
    
    const results: { volumeId: string; volumeName: string }[] = [];
    const searchKey = searchKeyword.toLowerCase();

    outlineData.volumes.forEach(volume => {
      const nameMatch = volume.name.toLowerCase().includes(searchKey);
      const contentMatch = volume.outline_content?.toLowerCase().includes(searchKey);
      
      if (nameMatch || contentMatch) {
        results.push({
          volumeId: volume.id,
          volumeName: volume.name,
        });
      }
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
      });
    }
  }, [searchResults, expandedVolumeIds, toggleVolume]);

  const handleContentChange = useCallback(
    (volumeId: string, html: string) => {
      if (saveTimerRef.current[volumeId]) {
        clearTimeout(saveTimerRef.current[volumeId]);
      }
      saveTimerRef.current[volumeId] = setTimeout(() => {
        updateMutation.mutate({ volumeId, outlineContent: html });
      }, 1000);
    },
    [updateMutation]
  );

  useEffect(() => {
    return () => {
      Object.values(saveTimerRef.current).forEach(clearTimeout);
    };
  }, []);

  const VolumeTitle = ({ name, index }: { name: string; index: number }) => {
    const highlightedName = useSearchHighlight(name, searchKeyword);
    return (
      <span className="text-lg font-semibold text-foreground">
        第{index + 1}卷：{highlightedName}
      </span>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto py-6 px-6 space-y-4">
        {outlineData.volumes.map((volume, index) => {
          const isExpanded = expandedVolumeIds.has(volume.id);
          return (
            <div key={volume.id} className="rounded-xl overflow-hidden ring-1 ring-border/40 bg-card/20">
              {/* 卷标题栏 */}
              <button
                onClick={() => toggleVolume(volume.id)}
                className={`
                  w-full flex items-center gap-3 px-5 py-3.5 text-left
                  transition-all duration-200 group
                  ${isExpanded ? 'bg-accent/10' : 'hover:bg-accent/5'}
                `}
              >
                <div className={`
                  transition-transform duration-200
                  ${isExpanded ? 'rotate-0' : '-rotate-90'}
                `}>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </div>
                <BookOpen className="h-4 w-4 text-primary/60" />
                <VolumeTitle name={volume.name} index={index} />
                <span className="ml-auto text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                  {volume.outline_content
                    ? `${volume.outline_content.replace(/<[^>]*>/g, '').length} 字`
                    : '暂无内容'}
                </span>
              </button>

              {/* 折叠内容 */}
              <div
                className={`
                  grid transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]
                  ${isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}
                `}
              >
                <div className="overflow-hidden">
                  <div className="px-5 pb-5 pt-2">
                    <PaperEditor
                      content={volume.outline_content || ''}
                      onChange={(html) => handleContentChange(volume.id, html)}
                      placeholder={`在此编写「${volume.name}」的整体故事大纲...`}
                      editorId={volume.id}
                      autoFocus={false}
                    />
                    {/* 统计信息 */}
                    <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground px-1">
                      <span>
                        字数: {volume.outline_content?.replace(/<[^>]*>/g, '').length || 0}
                      </span>
                      {updateMutation.isPending && (
                        <span className="text-primary/70">保存中...</span>
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
  );
};

export default VolumeOutlineView;
