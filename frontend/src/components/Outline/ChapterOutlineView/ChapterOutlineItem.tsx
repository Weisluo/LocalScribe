import { memo, useMemo, useCallback } from 'react';
import { ChevronDown, FileText, ExternalLink, Users, Layers2 } from 'lucide-react';
import type { ChapterOutline } from '../types';
import { PaperEditor } from '../VolumeOutlineView/PaperEditor';

interface ChapterOutlineItemProps {
  chapter: ChapterOutline;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onChange: (html: string) => void;
  onNavigateToNote?: (noteId: string) => void;
  isSaving: boolean;
}

const ChapterOutlineItemInner = ({
  chapter,
  index,
  isExpanded,
  onToggle,
  onChange,
  onNavigateToNote,
  isSaving,
}: ChapterOutlineItemProps) => {
  const outlineWordCount = useMemo(() => {
    return chapter.outline_content?.replace(/<[^>]*>/g, '').length || 0;
  }, [chapter.outline_content]);

  const handleNavigate = useCallback(() => {
    onNavigateToNote?.(chapter.id);
  }, [onNavigateToNote, chapter.id]);

  return (
    <div className="rounded-lg overflow-hidden ring-1 ring-border/20 bg-card/30">
      <div className="flex items-center gap-2 px-3.5 py-2 bg-muted/20">
        <button
          onClick={onToggle}
          className="flex items-center gap-2 flex-1 text-left group"
        >
          <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`}>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <FileText className="h-3.5 w-3.5 text-muted-foreground/60" />
          <span className="text-[15px] font-medium text-foreground">
            第{index + 1}章：{chapter.title || '无标题'}
          </span>
        </button>
        <div className="flex items-center gap-2">
          {chapter.word_count ? (
            <span className="text-xs text-muted-foreground">{chapter.word_count}字</span>
          ) : null}
          {onNavigateToNote && (
            <button
              onClick={handleNavigate}
              className="p-1 rounded hover:bg-accent/20 text-muted-foreground hover:text-foreground transition-colors"
              title="跳转到正文"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className={`transition-all duration-300 ease-out overflow-hidden ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="p-3">
          <PaperEditor
            content={chapter.outline_content || ''}
            onChange={onChange}
            placeholder={`在此编写「${chapter.title || '无标题'}」的章节大纲...`}
            editorId={chapter.id}
          />
          <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground px-1">
            <span>大纲字数: {outlineWordCount}</span>
            {chapter.scene_count && chapter.scene_count > 0 && (
              <span className="flex items-center gap-1">
                <Layers2 className="h-3 w-3" />
                {chapter.scene_count} 场景
              </span>
            )}
            {chapter.outline_characters && chapter.outline_characters.length > 0 && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {chapter.outline_characters.length} 角色
              </span>
            )}
            {isSaving && <span className="text-primary/70">保存中...</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

export const ChapterOutlineItem = memo(ChapterOutlineItemInner);

ChapterOutlineItem.displayName = 'ChapterOutlineItem';
