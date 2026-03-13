// frontend/src/pages/EditorPage/EditorPage.tsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/utils/request';
import type { components } from '@/types/api';
import { DirectoryTree } from '@/components/DirectoryTree';
import { Editor } from '@/components/Editor';
import { AIChat } from '@/components/AIChat';
import { useNote, useUpdateNote } from '@/hooks/useNote';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { CreateItemModal } from '@/components/Modals';
import { useAutoSave } from '@/hooks/useAutoSave';
import { Loader2, Save, Settings, PlusCircle } from 'lucide-react';

type VolumeNode = components['schemas']['VolumeNode'];
type ActNode = components['schemas']['ActNode'];
type NoteNode = components['schemas']['NoteNode'];
type ProjectResponse = components['schemas']['ProjectResponse'];

export const EditorPage = () => {
  const { currentProjectId } = useProjectStore();
  const { openModal } = useUIStore();

  const [selectedNoteId, setSelectedNoteId] = useState<string | undefined>();
  const [noteTitle, setNoteTitle] = useState<string>('');
  const [noteContent, setNoteContent] = useState<string>('');
  const [isTitleFocused, setIsTitleFocused] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set()); // 展开状态

  const lastSaveTimeRef = useRef<number>(0);
  const treeRef = useRef<HTMLDivElement>(null); // 用于滚动

  const { data: project } = useQuery({
    queryKey: ['project', currentProjectId],
    queryFn: () => api.get<ProjectResponse>(`/projects/${currentProjectId}`),
    enabled: !!currentProjectId,
  });

  const { data: currentNote, isLoading: isLoadingNote } = useNote(selectedNoteId);
  const updateNoteMutation = useUpdateNote(currentProjectId || '');

  // 获取目录树数据
  const { data: tree } = useQuery({
    queryKey: ['directory', currentProjectId],
    queryFn: () => api.get<VolumeNode[]>(`/projects/${currentProjectId}/tree`),
    enabled: !!currentProjectId,
  });

  // 自动选中最新笔记（当 tree 加载完成且没有选中笔记时）
  useEffect(() => {
    if (!tree || tree.length === 0 || selectedNoteId) return;

    // 递归查找所有笔记节点
    const findAllNotes = (nodes: (VolumeNode | ActNode | NoteNode)[]): NoteNode[] => {
      let notes: NoteNode[] = [];
      for (const node of nodes) {
        if (node.type === 'note') {
          notes.push(node as NoteNode);
        } else if ('children' in node) {
          notes = notes.concat(findAllNotes(node.children as any));
        }
      }
      return notes;
    };

    const allNotes = findAllNotes(tree);
    if (allNotes.length === 0) return;

    // 按 created_at 降序排序，取最新的
    const sortedNotes = allNotes.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const latestNote = sortedNotes[0];
    
    setSelectedNoteId(latestNote.id);
    setNoteTitle(latestNote.title);

    // 展开路径：找到该笔记的所有祖先节点
    const findAncestors = (
      nodes: (VolumeNode | ActNode | NoteNode)[],
      targetId: string,
      ancestors: string[] = []
    ): string[] | null => {
      for (const node of nodes) {
        if (node.id === targetId) {
          return ancestors;
        }
        if ('children' in node && node.children.length > 0) {
          const result = findAncestors(node.children as any, targetId, [...ancestors, node.id]);
          if (result) return result;
        }
      }
      return null;
    };

    const ancestors = findAncestors(tree, latestNote.id);
    if (ancestors) {
      setExpandedIds(new Set(ancestors));
    }
  }, [tree, selectedNoteId]);

  // 滚动到选中的笔记
  useEffect(() => {
    if (selectedNoteId) {
      // 给一点时间让 DOM 更新
      setTimeout(() => {
        const element = document.getElementById(`note-${selectedNoteId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }, [selectedNoteId]);

  // 同步笔记数据（仅当切换笔记时）
  useEffect(() => {
    if (currentNote) {
      if (currentNote.title !== noteTitle) {
        setNoteTitle(currentNote.title || '无标题');
      }
      if (currentNote.content !== noteContent) {
        setNoteContent(currentNote.content || '');
      }
    } else if (!selectedNoteId) {
      setNoteTitle('');
      setNoteContent('');
    }
  }, [currentNote, selectedNoteId]);

  const noteData = useMemo(() => ({
    title: noteTitle,
    content: noteContent
  }), [noteTitle, noteContent]);

  const handleSave = useCallback((data: { title: string; content: string }) => {
    const now = Date.now();
    if (now - lastSaveTimeRef.current < 500) return;
    if (selectedNoteId && !updateNoteMutation.isPending) {
      lastSaveTimeRef.current = now;
      updateNoteMutation.mutate({
        noteId: selectedNoteId,
        data: data
      });
    }
  }, [selectedNoteId, updateNoteMutation]);

  useAutoSave({ data: noteData, onSave: handleSave });

  const onEditorChange = (html: string) => {
    setNoteContent(html);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNoteTitle(e.target.value);
  };

  const handleSelectNote = (id: string, title: string) => {
    setSelectedNoteId(id);
    setNoteTitle(title);
  };

  const handleToggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!currentProjectId) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background gap-4">
        <h1 className="text-2xl font-bold">欢迎使用 LocalScribe</h1>
        <p className="text-muted-foreground">开始创作前，请先创建一个项目</p>
        <button
          onClick={() => openModal('project')}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          <PlusCircle className="h-5 w-5" />
          新建项目
        </button>
        <CreateItemModal />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* 左侧栏 */}
      <aside className="w-52 border-r border-border flex flex-col bg-muted/20 flex-shrink-0">
        <div className="h-14 border-b border-border flex items-center justify-between px-4 flex-shrink-0">
          <h1 className="text-lg font-semibold truncate">
            {project?.title || '我的小说'}
          </h1>
          <button
            onClick={() => openModal('volume', currentProjectId)}
            className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
            title="新建卷"
          >
            <PlusCircle className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto" ref={treeRef}>
          <DirectoryTree
            projectId={currentProjectId}
            selectedNoteId={selectedNoteId}
            onSelectNote={handleSelectNote}
            expandedIds={expandedIds}
            onToggle={handleToggle}
          />
        </div>

        <div className="h-40 flex flex-col flex-shrink-0 border-t border-border">
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center text-xs px-4">
              <Settings className="h-6 w-6 mx-auto mb-2 opacity-30" />
              <p>功能设置</p>
              <p className="text-[10px] mt-1 opacity-60">开发中...</p>
            </div>
          </div>
          <div className="p-2">
            <button
              onClick={() => openModal('project')}
              className="w-full flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded"
            >
              <PlusCircle className="h-4 w-4" /> 切换/新建项目
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b border-border flex items-center justify-center px-6 bg-background flex-shrink-0">
          <input
            type="text"
            value={noteTitle}
            onChange={handleTitleChange}
            onFocus={() => setIsTitleFocused(true)}
            onBlur={() => setIsTitleFocused(false)}
            className={`text-2xl font-bold text-center bg-transparent border-none focus:outline-none w-full transition-all ${
              !isTitleFocused && noteTitle
                ? 'border-transparent'
                : 'border-b border-input'
            }`}
            placeholder="输入标题..."
          />
        </header>

        {isLoadingNote ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Editor
            key={selectedNoteId || 'new-note'}
            content={noteContent}
            onChange={onEditorChange}
          />
        )}
      </main>

      <aside className="w-1/4 border-l border-border flex flex-col bg-muted/10 flex-shrink-0">
        <div className="h-20 border-b border-border flex flex-col justify-center px-4 flex-shrink-0">
          <div className="flex items-center gap-2 text-sm">
            {updateNoteMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-primary">保存中...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4 text-green-600" />
                <span className="text-green-600">已保存</span>
              </>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            字数：{noteContent.replace(/<[^>]*>/g, '').length}
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <AIChat />
        </div>
      </aside>

      <CreateItemModal />
    </div>
  );
};