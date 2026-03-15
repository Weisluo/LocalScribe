// frontend/src/pages/EditorPage/EditorPage.tsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/utils/request';
import type { components } from '@/types/api';
import { DirectoryTree } from '@/components/DirectoryTree';
import { Editor } from '@/components/Editor';
import { AIChat } from '@/components/AIChat';
import { useNote, useUpdateNote, useCreateNote } from '@/hooks/useNote';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { CreateItemModal } from '@/components/Modals';
import { ProjectSwitcher } from '@/components/ProjectSwitcher';
import { useAutoSave } from '@/hooks/useAutoSave';
import { Loader2, Save, PlusCircle, Feather, BookOpen, Type } from 'lucide-react';

type VolumeNode = components['schemas']['VolumeNode'];
type ActNode = components['schemas']['ActNode'];
type NoteNode = components['schemas']['NoteNode'];
type ProjectResponse = components['schemas']['ProjectResponse'];

export const EditorPage = () => {
  const { currentProjectId } = useProjectStore();
  const { openModal, newlyCreatedNoteId, setNewlyCreatedNoteId } = useUIStore();

  const [selectedNoteId, setSelectedNoteId] = useState<string | undefined>();
  const [noteTitle, setNoteTitle] = useState<string>('');
  const [noteContent, setNoteContent] = useState<string>('');
  const [isTitleFocused, setIsTitleFocused] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set()); // 展开状态

  const lastSaveTimeRef = useRef<number>(0);
  const treeRef = useRef<HTMLDivElement>(null); // 用于滚动
  const hasAutoCreatedRef = useRef(false); // 标记是否已自动创建章节

  // 获取所有项目列表（用于切换）
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<ProjectResponse[]>('/projects'),
  });

  const { data: project } = useQuery({
    queryKey: ['project', currentProjectId],
    queryFn: () => api.get<ProjectResponse>(`/projects/${currentProjectId}`),
    enabled: !!currentProjectId,
  });

  const { data: currentNote, isLoading: isLoadingNote } = useNote(selectedNoteId);
  const updateNoteMutation = useUpdateNote(currentProjectId || '');
  const createNoteMutation = useCreateNote(currentProjectId || '');

  // 获取目录树数据
  const { data: tree } = useQuery({
    queryKey: ['directory', currentProjectId],
    queryFn: () => api.get<VolumeNode[]>(`/projects/${currentProjectId}/tree`),
    enabled: !!currentProjectId,
  });

  // 辅助函数：查找第一个幕
  const findFirstAct = (nodes: (VolumeNode | ActNode | NoteNode)[]): ActNode | null => {
    for (const node of nodes) {
      if (node.type === 'act') {
        return node as ActNode;
      }
      if ('children' in node && node.children.length > 0) {
        const found = findFirstAct(node.children as any);
        if (found) return found;
      }
    }
    return null;
  };

  // 辅助函数：检查是否有任何章节
  const hasAnyChapters = (nodes: (VolumeNode | ActNode | NoteNode)[]): boolean => {
    for (const node of nodes) {
      if (node.type === 'note') return true;
      if ('children' in node && node.children.length > 0) {
        if (hasAnyChapters(node.children as any)) return true;
      }
    }
    return false;
  };

  // 辅助函数：查找节点的所有祖先 ID
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

  // 自动选中最新章节（当 tree 加载完成且没有选中章节时）
  useEffect(() => {
    if (!tree || tree.length === 0 || selectedNoteId) return;

    // 递归查找所有章节节点
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

    // 展开路径：找到该章节的所有祖先节点
    const ancestors = findAncestors(tree, latestNote.id);
    if (ancestors) {
      setExpandedIds(new Set(ancestors));
    }
  }, [tree, selectedNoteId]);

  // 监听 projectId 变化，重置自动创建标记和选中状态
  useEffect(() => {
    hasAutoCreatedRef.current = false;
    setSelectedNoteId(undefined);
    setNoteTitle('');
    setNoteContent('');
    setExpandedIds(new Set());
  }, [currentProjectId]);

  // 监听新创建的章节，自动选中
  useEffect(() => {
    if (newlyCreatedNoteId && tree) {
      // 查找新创建的章节的标题
      const findNoteTitle = (nodes: (VolumeNode | ActNode | NoteNode)[], targetId: string): string | undefined => {
        for (const node of nodes) {
          if (node.type === 'note' && node.id === targetId) {
            return node.title;
          }
          if ('children' in node && node.children.length > 0) {
            const found = findNoteTitle(node.children as any, targetId);
            if (found) return found;
          }
        }
        return undefined;
      };

      const title = findNoteTitle(tree, newlyCreatedNoteId);
      
      // 如果找到了新章节，才进行后续操作
      if (title !== undefined) {
        setSelectedNoteId(newlyCreatedNoteId);
        setNoteTitle(title || '');
        setNoteContent('');

        // 展开新章节所在的幕及其祖先
        setExpandedIds((prev) => {
          const next = new Set(prev);
          const ancestors = findAncestors(tree, newlyCreatedNoteId);
          if (ancestors) {
            ancestors.forEach((id) => next.add(id));
          }
          return next;
        });

        // 滚动到新章节
        setTimeout(() => {
          const element = document.getElementById(`note-${newlyCreatedNoteId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);

        // 清除新创建章节标记
        setNewlyCreatedNoteId(null);
      }
    }
  }, [newlyCreatedNoteId, tree, setNewlyCreatedNoteId]);

  // 自动创建第一个章节（当项目没有任何章节时）
  useEffect(() => {
    if (!tree || tree.length === 0) return;
    if (hasAutoCreatedRef.current) return;
    if (hasAnyChapters(tree)) return;

    const firstAct = findFirstAct(tree);
    if (!firstAct) return; // 没有幕（理论上不会发生，因为后端已创建默认幕）

    hasAutoCreatedRef.current = true;

    createNoteMutation.mutate(
      {
        folder_id: firstAct.id,
        title: '', // 改为空字符串，让标题留空显示 placeholder
      },
      {
        onSuccess: (newNote) => {
          setSelectedNoteId(newNote.id);
          setNoteTitle(newNote.title); // 后端返回的 title 为空字符串，输入框显示 placeholder
          setNoteContent('');

          // 展开新章节所在的幕及其祖先
          setExpandedIds((prev) => {
            const next = new Set(prev);
            const ancestors = findAncestors(tree, newNote.folder_id);
            if (ancestors) {
              ancestors.forEach((id) => next.add(id));
            }
            return next;
          });

          // 滚动到新章节
          setTimeout(() => {
            const element = document.getElementById(`note-${newNote.id}`);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 100);
        },
      }
    );
  }, [tree, createNoteMutation, currentProjectId]);

  // 每次目录树更新后，确保当前选中的章节祖先节点保持展开
  useEffect(() => {
    if (!tree || !selectedNoteId) return;
    
    const ancestors = findAncestors(tree, selectedNoteId);
    if (ancestors) {
      setExpandedIds(prev => {
        const next = new Set(prev);
        ancestors.forEach(id => next.add(id));
        return next;
      });
    }
  }, [tree, selectedNoteId]);

  // 滚动到选中的章节
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

  // 同步章节数据（仅当切换章节时）
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
    const now = Date.now();
    if (selectedNoteId && selectedNoteId !== id && (noteTitle || noteContent) && now - lastSaveTimeRef.current > 500 && !updateNoteMutation.isPending) {
      lastSaveTimeRef.current = now;
      updateNoteMutation.mutate(
        {
          noteId: selectedNoteId,
          data: { title: noteTitle, content: noteContent }
        },
        {
          onError: (error) => {
            console.error('保存笔记失败:', error);
            // 这里可以添加更具体的错误处理，例如显示 toast 或通知
          }
        }
      );
    }
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
      <div className="flex flex-col items-center justify-center h-screen bg-background gap-6 relative overflow-hidden">
        {/* 背景装饰 */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-accent/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        </div>
        
        <div className="relative z-10 flex flex-col items-center gap-6">
          <div className="relative">
            <div className="absolute inset-0 bg-accent/20 blur-2xl rounded-full" />
            <Feather className="h-16 w-16 text-accent relative" />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-serif font-bold text-foreground mb-2">LocalScribe</h1>
            <p className="text-muted-foreground">你的本地写作工坊</p>
          </div>
          <button
            onClick={() => openModal('project')}
            className="flex items-center gap-2 px-8 py-3.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 hover:scale-105 active:scale-95 transition-all duration-200 shadow-lg shadow-primary/20"
          >
            <PlusCircle className="h-5 w-5" />
            <span className="font-medium">创建第一个项目</span>
          </button>
        </div>
        <CreateItemModal />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* 左侧栏 - 目录树 */}
      <aside className="w-72 border-r border-border/60 flex flex-col sidebar-bg flex-shrink-0">
        {/* 项目标题栏 */}
        <div className="h-16 border-b border-border/60 flex items-center justify-between px-4 flex-shrink-0 bg-card/30 backdrop-blur-sm">
          {projects && projects.length > 0 ? (
            <div className="relative flex-1 mr-2">
              <ProjectSwitcher />
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1">
              <BookOpen className="h-5 w-5 text-primary" />
              <h1 className="text-base font-serif font-semibold truncate">{project?.title || '我的小说'}</h1>
            </div>
          )}
          <button
            onClick={() => openModal('volume', currentProjectId)}
            className="p-2 hover:bg-accent/30 rounded-lg text-muted-foreground hover:text-foreground flex-shrink-0 transition-all duration-200 hover:scale-105"
            title="新建卷"
          >
            <PlusCircle className="h-4 w-4" />
          </button>
        </div>

        {/* 目录树区域 */}
        <div className="flex-1 overflow-y-auto py-2" ref={treeRef}>
          <DirectoryTree
            projectId={currentProjectId}
            selectedNoteId={selectedNoteId}
            onSelectNote={handleSelectNote}
            expandedIds={expandedIds}
            onToggle={handleToggle}
          />
        </div>

        {/* 底部操作栏 */}
        <div className="h-auto flex flex-col flex-shrink-0 border-t border-border/60 bg-card/30 backdrop-blur-sm">
          <div className="p-3">
            <button
              onClick={() => openModal('project')}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/20 rounded-lg transition-all duration-200"
            >
              <PlusCircle className="h-4 w-4" />
              <span>新建项目</span>
            </button>
          </div>
        </div>
      </aside>

      {/* 中间主编辑区 */}
      <main className="flex-1 flex flex-col overflow-hidden bg-background">
        {/* 标题栏 */}
        <header className="h-16 border-b border-border/60 flex items-center px-6 bg-card/20 backdrop-blur-sm flex-shrink-0">
          <div className="max-w-[850px] w-full mx-auto">
            <input
              type="text"
              value={noteTitle}
              onChange={handleTitleChange}
              onFocus={() => setIsTitleFocused(true)}
              onBlur={() => setIsTitleFocused(false)}
              className={`
                text-2xl font-serif font-bold text-center bg-transparent border-b-2 focus:outline-none w-full transition-all duration-300 py-2
                ${!isTitleFocused && noteTitle
                  ? 'border-transparent text-foreground'
                  : 'border-accent/50 focus:border-accent text-foreground'
                }
                placeholder:text-muted-foreground/50
              `}
              placeholder="无标题章节"
            />
          </div>
        </header>

        {/* 编辑器区域 */}
        {isLoadingNote ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <div className="relative">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <div className="absolute inset-0 blur-lg bg-primary/20 rounded-full" />
              </div>
              <span className="text-sm">加载中...</span>
            </div>
          </div>
        ) : (
          <Editor
            key={selectedNoteId || 'new-note'}
            content={noteContent}
            onChange={onEditorChange}
          />
        )}
      </main>

      {/* 右侧栏 - AI 助手 */}
      <aside className="w-80 border-l border-border/60 flex flex-col bg-card/10 flex-shrink-0">
        {/* 状态栏 */}
        <div className="h-14 border-b border-border/60 flex items-center justify-between px-4 flex-shrink-0 bg-card/30 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            {updateNoteMutation.isPending ? (
              <>
                <div className="relative">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <div className="absolute inset-0 blur-sm bg-primary/30 rounded-full" />
                </div>
                <span className="text-sm text-primary font-medium">保存中...</span>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-green-500/15">
                  <Save className="h-3 w-3 text-green-600" />
                </div>
                <span className="text-sm text-green-600 font-medium">已保存</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full">
            <Type className="h-3 w-3" />
            <span>{noteContent.replace(/<[^>]*>/g, '').length.toLocaleString()} 字</span>
          </div>
        </div>

        {/* AI 聊天区域 */}
        <div className="flex-1 overflow-hidden">
          <AIChat />
        </div>
      </aside>

      <CreateItemModal />
    </div>
  );
};