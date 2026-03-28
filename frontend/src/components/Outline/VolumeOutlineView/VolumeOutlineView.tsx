// frontend/src/components/Outline/VolumeOutlineView/VolumeOutlineView.tsx
import { useCallback, useRef, useEffect } from 'react';
import { ChevronDown, BookOpen } from 'lucide-react';
import { useOutlineStore } from '../hooks/useOutlineStore';
import { useUpdateVolumeOutline } from '../hooks/useOutline';
import { PaperEditor } from './PaperEditor';
import type { ProjectOutline } from '../types';

interface VolumeOutlineViewProps {
  projectId: string;
  outlineData: ProjectOutline;
}

export const VolumeOutlineView = ({ projectId, outlineData }: VolumeOutlineViewProps) => {
  const { expandedVolumeIds, toggleVolume } = useOutlineStore();
  const updateMutation = useUpdateVolumeOutline(projectId);

  // 防抖保存
  const saveTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const handleContentChange = useCallback(
    (volumeId: string, html: string) => {
      // 清除之前的定时器
      if (saveTimerRef.current[volumeId]) {
        clearTimeout(saveTimerRef.current[volumeId]);
      }
      // 1秒后自动保存
      saveTimerRef.current[volumeId] = setTimeout(() => {
        updateMutation.mutate({ volumeId, outlineContent: html });
      }, 1000);
    },
    [updateMutation]
  );

  // 清理定时器
  useEffect(() => {
    return () => {
      Object.values(saveTimerRef.current).forEach(clearTimeout);
    };
  }, []);

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
                <span className="text-lg font-semibold text-foreground">
                  第{index + 1}卷：{volume.name}
                </span>
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
