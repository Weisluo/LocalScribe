import { useState } from 'react';
import { toast } from 'sonner';
import { FileDown, Loader2, ChevronDown } from 'lucide-react';
import type { components } from '@/types/api';
import { api } from '@/utils/request';
import { useEditorSettingsStore } from '@/stores/editorSettingsStore';
import { ExportChapter, ExportTextSettings, parseNoteHtml } from '@/utils/export/blocks';

type VolumeNode = components['schemas']['VolumeNode'];
type ActNode = components['schemas']['ActNode'];
type NoteNode = components['schemas']['NoteNode'];

interface ExportProps {
  projectTitle?: string;
  tree: VolumeNode[];
}

interface ChapterMeta {
  id: string;
  title: string;
  volumeTitle: string;
  actTitle: string;
  volumeId?: string;
  actId?: string;
}

type ExportFormat = 'pdf' | 'epub' | 'txt' | 'docx';

export const Export = ({ projectTitle, tree }: ExportProps) => {
  const [isExporting, setIsExporting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const paragraphIndent = useEditorSettingsStore((state) => state.paragraphIndent);
  const paragraphSpacing = useEditorSettingsStore((state) => state.paragraphSpacing);
  const lineSpacing = useEditorSettingsStore((state) => state.lineSpacing);
  const fontSize = useEditorSettingsStore((state) => state.fontSize);

  const collectAllChapters = (
    nodes: (VolumeNode | ActNode | NoteNode)[],
    volumeTitle: string = '',
    actTitle: string = '',
    volumeId?: string,
    actId?: string
  ): ChapterMeta[] => {
    let chapters: ChapterMeta[] = [];
    for (const node of nodes) {
      if (node.type === 'volume') {
        chapters = chapters.concat(collectAllChapters(node.children, node.name, actTitle, node.id, actId));
      } else if (node.type === 'act') {
        chapters = chapters.concat(collectAllChapters(node.children, volumeTitle, node.name, volumeId, node.id));
      } else if (node.type === 'note') {
        chapters.push({
          id: node.id,
          title: node.title || '无标题章节',
          volumeTitle,
          actTitle,
          volumeId,
          actId,
        });
      }
    }
    return chapters;
  };

  /** 拉取各章节内容，并把编辑器 HTML 解析成带段落结构的数据 */
  const loadChapters = async (): Promise<ExportChapter[]> => {
    const metas = collectAllChapters(tree);
    const chapters: ExportChapter[] = [];

    for (const meta of metas) {
      const note = await api.get<components['schemas']['NoteResponse']>(`/notes/${meta.id}`);
      chapters.push({ ...meta, blocks: parseNoteHtml(note.content || '') });
    }

    return chapters;
  };

  const handleExport = async (format: ExportFormat) => {
    setIsExporting(true);
    setShowMenu(false);
    try {
      const chapters = await loadChapters();
      if (chapters.length === 0) {
        toast.error('没有可导出的章节');
        return;
      }
      const settings: ExportTextSettings = {
        paragraphIndent,
        paragraphSpacing,
        lineSpacing,
        fontSize,
      };
      const options = {
        title: projectTitle || '我的小说',
        date: new Date().toLocaleDateString('zh-CN'),
        settings,
      };

      // 各格式的导出器按需加载，避免 pdf/docx/epub 依赖进入首屏包
      if (format === 'pdf') {
        const { exportToPdf } = await import('@/utils/export/pdf');
        await exportToPdf(chapters, options);
      } else if (format === 'epub') {
        const { exportToEpub } = await import('@/utils/export/epub');
        await exportToEpub(chapters, options);
      } else if (format === 'txt') {
        const { exportToTxt } = await import('@/utils/export/txt');
        exportToTxt(chapters, options);
      } else {
        const { exportToDocx } = await import('@/utils/export/docx');
        await exportToDocx(chapters, options);
      }
    } catch (error) {
      console.error('导出失败:', error);
      // 导出失败原因（例如"未找到 Edge/Chrome"）由各导出器抛在 message 里
      toast.error(error instanceof Error && error.message ? error.message : '导出失败，请重试');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="relative w-20">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={isExporting}
        className="w-full flex items-center justify-center gap-1 py-2.5 text-xs text-sky-600/80 hover:text-sky-700 hover:bg-sky-100/50 rounded-lg transition-all duration-200 disabled:opacity-50"
      >
        {isExporting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>导出中...</span>
          </>
        ) : (
          <>
            <FileDown className="h-4 w-4" />
            <span>导出</span>
            <ChevronDown className="h-3 w-3" />
          </>
        )}
      </button>

      {showMenu && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute bottom-full left-0 mb-2 w-32 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden p-1">
            <button
              onClick={() => handleExport('pdf')}
              className="w-full px-3 py-2 text-sm text-left rounded-md transition-all duration-200 hover:bg-primary/5 hover:text-primary"
            >
              <span>PDF格式</span>
            </button>
            <button
              onClick={() => handleExport('epub')}
              className="w-full px-3 py-2 text-sm text-left rounded-md transition-all duration-200 hover:bg-primary/5 hover:text-primary"
            >
              <span>EPUB格式</span>
            </button>
            <button
              onClick={() => handleExport('txt')}
              className="w-full px-3 py-2 text-sm text-left rounded-md transition-all duration-200 hover:bg-primary/5 hover:text-primary"
            >
              <span>TXT格式</span>
            </button>
            <button
              onClick={() => handleExport('docx')}
              className="w-full px-3 py-2 text-sm text-left rounded-md transition-all duration-200 hover:bg-primary/5 hover:text-primary"
            >
              <span>DOCX格式</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};
