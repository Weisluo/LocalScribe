// frontend/src/pages/EditorPage/EditorPage.tsx
import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
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
import { calculateStatistics, calculateProjectStatistics, formatReadingTime, formatNumber } from '@/hooks/useTextStatistics';
import { Loader2, Save, PlusCircle, Feather, BookOpen, Type, Clock, FileText, Languages, GripVertical, Trash2, ArchiveRestore, Globe2, Calendar } from 'lucide-react';
import { format } from 'date-fns';

const Export = lazy(() => import('@/components/Export/Export').then(m => ({ default: m.Export })));
const TrashPage = lazy(() => import('@/pages/TrashPage').then(m => ({ default: m.TrashPage })));
const WorldbuildingView = lazy(() => import('@/components/Worldbuilding').then(m => ({ default: m.WorldbuildingView })));
const WritingCalendar = lazy(() => import('@/components/WritingCalendar').then(m => ({ default: m.WritingCalendar })));

type VolumeNode = components['schemas']['VolumeNode'];
type ActNode = components['schemas']['ActNode'];
type NoteNode = components['schemas']['NoteNode'];
type ProjectResponse = components['schemas']['ProjectResponse'];

export const EditorPage = () => {
  const { currentProjectId } = useProjectStore();
  const { openModal, newlyCreatedNoteId, setNewlyCreatedNoteId } = useUIStore();

  const [showTrash, setShowTrash] = useState(false);
  const [showWorldbuilding, setShowWorldbuilding] = useState(false);

  const [selectedNoteId, setSelectedNoteId] = useState<string | undefined>();
  const [noteTitle, setNoteTitle] = useState<string>('');
  const [noteContent, setNoteContent] = useState<string>('');
  const [isTitleFocused, setIsTitleFocused] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set()); // 展开状态

  const lastSaveTimeRef = useRef<number>(0);
  const treeRef = useRef<HTMLDivElement>(null); // 用于滚动
  const hasAutoCreatedRef = useRef(false); // 标记是否已自动创建章节
  const containerRef = useRef<HTMLDivElement>(null); // 主容器引用

  // 右侧栏宽度状态 - 默认最小 25%
  const [rightPanelWidth, setRightPanelWidth] = useState<number>(25);
  const [isResizing, setIsResizing] = useState(false);

  // 日历和统计面板状态
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // 拖拽调整大小相关引用
  const resizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthPercentRef = useRef(0);
  const containerWidthRef = useRef(0);

  // 获取所有项目列表（用于切换）
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<ProjectResponse[]>('/projects'),
  });

  const { setCurrentProjectId } = useProjectStore();

  const { data: project, error: projectError } = useQuery({
    queryKey: ['project', currentProjectId],
    queryFn: () => api.get<ProjectResponse>(`/projects/${currentProjectId}`),
    enabled: !!currentProjectId,
    retry: false,
  });

  // 处理项目获取失败的情况：如果 404，清除无效的 currentProjectId
  useEffect(() => {
    if (projectError && currentProjectId) {
      const axiosError = projectError as { response?: { status: number } };
      if (axiosError.response?.status === 404) {
        console.warn(`Project ${currentProjectId} not found, clearing currentProjectId`);
        setCurrentProjectId('');
      }
    }
  }, [projectError, currentProjectId, setCurrentProjectId]);

  const { data: currentNote, isLoading: isLoadingNote, isFetching: isFetchingNote } = useNote(selectedNoteId);
  const updateNoteMutation = useUpdateNote(currentProjectId || '');
  const createNoteMutation = useCreateNote(currentProjectId || '');
  
  // 用于跟踪是否是新章节切换（用于显示加载状态）
  const isSwitchingNote = isFetchingNote && !isLoadingNote;

  // 处理删除项目 - 打开确认弹窗
  const handleDeleteProject = () => {
    if (!currentProjectId) return;
    openModal('delete-project');
  };

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

  // 时间更新效果
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 从目录树生成每日写作统计数据
  const dailyStats = useMemo(() => {
    if (!tree) return [];

    const stats = new Map<string, number>();

    const processNode = (node: VolumeNode | ActNode | NoteNode) => {
      if (node.type === 'note') {
        const note = node as NoteNode;
        // 使用 created_at 作为写作日期，转换为本地日期
        if (note.created_at && note.word_count) {
          const date = format(new Date(note.created_at), 'yyyy-MM-dd');
          const current = stats.get(date) || 0;
          stats.set(date, current + (note.word_count || 0));
        }
      }
      if ('children' in node && node.children) {
        node.children.forEach(processNode);
      }
    };

    tree.forEach(processNode);

    return Array.from(stats.entries()).map(([date, wordCount]) => ({
      date,
      wordCount,
    }));
  }, [tree]);

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
    // 如果当前在回收站或世界观设定界面，先返回编辑器
    if (showTrash) {
      setShowTrash(false);
    }
    if (showWorldbuilding) {
      setShowWorldbuilding(false);
    }
    
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

  // 开始拖拽调整大小
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;

    resizingRef.current = true;
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthPercentRef.current = rightPanelWidth;
    containerWidthRef.current = containerRef.current.getBoundingClientRect().width;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [rightPanelWidth]);

  // 拖拽中
  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizingRef.current || !containerRef.current) return;

    const containerWidth = containerWidthRef.current;
    const deltaX = startXRef.current - e.clientX; // 向左拖动减小右侧栏宽度
    const deltaPercent = (deltaX / containerWidth) * 100;
    let newWidth = startWidthPercentRef.current + deltaPercent;

    // 限制最小和最大宽度：最小 25%，最大 50%
    newWidth = Math.max(25, Math.min(50, newWidth));

    setRightPanelWidth(newWidth);
  }, []);

  // 结束拖拽
  const handleResizeEnd = useCallback(() => {
    if (!resizingRef.current) return;

    resizingRef.current = false;
    setIsResizing(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  // 添加/移除全局事件监听
  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [isResizing, handleResizeMove, handleResizeEnd]);

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
    <div ref={containerRef} className="flex h-screen bg-background text-foreground overflow-hidden">
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
            onClick={() => {
              setShowTrash(false);
              setShowWorldbuilding(false);
              openModal('volume', currentProjectId);
            }}
            className="p-2 hover:bg-accent/30 rounded-lg text-muted-foreground hover:text-foreground flex-shrink-0 transition-all duration-200 hover:scale-105"
            title="新建卷"
          >
            <PlusCircle className="h-4 w-4" />
          </button>
        </div>

        {/* 目录树区域 - 占据约 2/3 高度 */}
        <div className="h-[67%] overflow-y-auto py-2" ref={treeRef}>
          <DirectoryTree
            projectId={currentProjectId}
            selectedNoteId={selectedNoteId}
            onSelectNote={handleSelectNote}
            expandedIds={expandedIds}
            onToggle={handleToggle}
          />
        </div>

        {/* 中间功能区 - 世界观设定 */}
        <div className="flex-1 border-t border-border/60 bg-card/20 backdrop-blur-sm flex flex-col">
          <div className="p-3 flex flex-col gap-2">
            <button
              onClick={() => {
                setShowTrash(false);
                setShowWorldbuilding(true);
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/20 rounded-lg transition-all duration-200"
              title="世界观设定"
            >
              <Globe2 className="h-4 w-4" />
              <span>世界观设定</span>
            </button>
          </div>
          {/* 预留空间给后续功能 */}
          <div className="flex-1" />
        </div>

        {/* 底部操作栏 */}
        <div className="h-auto flex flex-col flex-shrink-0 border-t border-border/60 bg-card/30 backdrop-blur-sm">
          <div className="p-3 flex gap-2">
            <button
              onClick={() => {
                setShowTrash(false);
                setShowWorldbuilding(false);
                handleDeleteProject();
              }}
              disabled={!currentProjectId}
              className="flex items-center justify-center gap-2 px-3 py-2.5 text-sm text-destructive/70 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all duration-200 disabled:opacity-50"
              title="删除当前项目"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <div className="flex-1 flex gap-2">
              <button
                onClick={() => {
                  setShowTrash(false);
                  setShowWorldbuilding(false);
                  openModal('project');
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs text-emerald-600/80 hover:text-emerald-700 hover:bg-emerald-100/50 rounded-lg transition-all duration-200"
              >
                <PlusCircle className="h-4 w-4" />
                <span>新建项目</span>
              </button>
              {tree && tree.length > 0 && (
                <Suspense fallback={<div className="w-20 h-9 flex items-center justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>}>
                  <Export
                    projectId={currentProjectId}
                    projectTitle={project?.title}
                    tree={tree}
                  />
                </Suspense>
              )}
            </div>
            <button
              onClick={() => {
                setShowWorldbuilding(false);
                setShowTrash(true);
              }}
              className="flex items-center justify-center gap-2 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/20 rounded-lg transition-all duration-200"
              title="回收站"
            >
              <ArchiveRestore className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* 中间主编辑区 */}
      <main className="flex-1 flex flex-col overflow-hidden bg-background">
        {showWorldbuilding ? (
          <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
            <WorldbuildingView />
          </Suspense>
        ) : showTrash ? (
          /* 回收站界面 */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* 回收站顶部标题栏 */}
            <div className="h-16 border-b border-border/60 flex items-center px-6 bg-card/20 backdrop-blur-sm flex-shrink-0">
              <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                <ArchiveRestore className="h-5 w-5" />
                回收站
              </h2>
            </div>
            {/* 回收站内容区域 */}
            <div className="flex-1 overflow-hidden">
              <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
                <TrashPage embedded={true} />
              </Suspense>
            </div>
          </div>
        ) : (
          /* 编辑器界面 */
          <>
            {/* 标题栏 */}
            <header className="h-16 border-b border-border/60 flex items-center bg-card/20 backdrop-blur-sm flex-shrink-0">
              <div className="max-w-[850px] w-full mx-auto px-6">
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
                  disabled={isSwitchingNote}
                />
              </div>
            </header>

            {/* 编辑器区域 - 切换章节时显示加载状态 */}
            {isSwitchingNote ? (
              <div className="flex-1 flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-sm">加载中...</span>
                </div>
              </div>
            ) : (
              <Editor
                noteId={selectedNoteId}
                content={noteContent}
                onChange={onEditorChange}
              />
            )}
          </>
        )}
      </main>

      {/* 可拖拽分割线 */}
      <div
        className={`
          w-1 flex-shrink-0 cursor-col-resize flex items-center justify-center
          transition-colors duration-150 hover:bg-accent/50
          ${isResizing ? 'bg-accent/70' : 'bg-border/60'}
        `}
        onMouseDown={handleResizeStart}
        title="拖拽调整宽度"
      >
        <div className={`
          flex items-center justify-center w-4 h-8 rounded-md
          transition-all duration-150
          ${isResizing ? 'bg-accent/30' : 'hover:bg-accent/20'}
        `}>
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/60" />
        </div>
      </div>

      {/* 右侧栏 - AI 助手 */}
      <aside
        className="border-l border-border/60 flex flex-col bg-card/10 flex-shrink-0"
        style={{ width: `${rightPanelWidth}%` }}
      >
        {/* 状态栏 - 美化后的信息统计面板 */}
        <div className="border-b border-border/60 flex flex-col flex-shrink-0 bg-gradient-to-br from-card/50 via-card/30 to-accent/5 backdrop-blur-sm">
          {/* 保存状态指示器 和 日期时间 */}
          <div className="px-4 pt-3 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {updateNoteMutation.isPending ? (
                <>
                  <div className="relative flex items-center justify-center w-6 h-6 rounded-full bg-primary/10">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    <div className="absolute inset-0 rounded-full border-2 border-primary/20 border-t-primary/60 animate-spin" style={{ animationDuration: '1s' }} />
                  </div>
                  <span className="text-sm text-primary font-medium">保存中...</span>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/30">
                    <Save className="h-3 w-3 text-emerald-600" />
                  </div>
                  <span className="text-sm text-emerald-600 font-medium">已保存</span>
                </>
              )}
            </div>
            
            {/* 日期时间按钮 */}
            <button
              onClick={() => setShowCalendar(!showCalendar)}
              className={`
                flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium rounded-lg
                transition-all duration-300 ease-out
                ${showCalendar 
                  ? 'bg-primary/15 text-primary ring-1 ring-primary/30 scale-105 shadow-md' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/20 hover:scale-105'
                }
                active:scale-95
              `}
            >
              <Calendar className={`h-3.5 w-3.5 transition-transform duration-300 ${
                showCalendar ? 'rotate-12 scale-110' : ''
              }`} />
              <span>{format(currentTime, 'MM-dd HH:mm')}</span>
            </button>
          </div>

          {/* 统计卡片网格 */}
          {(() => {
            const currentText = noteContent.replace(/<[^>]*>/g, '');
            const currentStats = calculateStatistics(currentText);
            const projectStats = tree && tree.length > 0 
              ? calculateProjectStatistics(tree, selectedNoteId, currentText)
              : null;

            return (
              <div className="px-3 pb-3 space-y-2">
                {/* 统计卡片网格 - 当前章节和全书统计并排，占比3:2 */}
                <div className="grid grid-cols-5 gap-2">
                  {/* 当前章节统计 - 占3份 */}
                  <div className="col-span-3 bg-gradient-to-br from-background/80 to-muted/30 rounded-lg p-2 ring-1 ring-border/40 shadow-sm">
                    <div className="flex items-center gap-1 mb-1.5">
                      <div className="w-1 h-3 bg-primary/60 rounded-full" />
                      <span className="text-xs font-medium text-muted-foreground">当前章节</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <div className="flex flex-col items-center p-1 bg-card/60 rounded-md ring-1 ring-border/30 hover:shadow-sm hover:ring-primary/20 transition-all duration-200" title="字符总数">
                        <FileText className="h-3 w-3 text-primary/70 mb-0.5" />
                        <span className="text-xs font-semibold text-foreground">{formatNumber(currentStats.charCount)}</span>
                        <span className="text-[9px] text-muted-foreground">字符</span>
                      </div>
                      <div className="flex flex-col items-center p-1 bg-card/60 rounded-md ring-1 ring-border/30 hover:shadow-sm hover:ring-accent/20 transition-all duration-200" title="中文字符">
                        <Languages className="h-3 w-3 text-accent/70 mb-0.5" />
                        <span className="text-xs font-semibold text-foreground">{formatNumber(currentStats.chineseCharCount)}</span>
                        <span className="text-[9px] text-muted-foreground">中文</span>
                      </div>
                      <div className="flex flex-col items-center p-1 bg-card/60 rounded-md ring-1 ring-border/30 hover:shadow-sm hover:ring-primary/20 transition-all duration-200" title="预计阅读时长">
                        <Clock className="h-3 w-3 text-primary/70 mb-0.5" />
                        <span className="text-xs font-semibold text-foreground">{formatReadingTime(currentStats.readingTime)}</span>
                        <span className="text-[9px] text-muted-foreground">阅读</span>
                      </div>
                    </div>
                  </div>

                  {/* 全文统计 - 占2份 */}
                  {projectStats && (
                    <div className="col-span-2 bg-gradient-to-br from-accent/10 via-accent/5 to-background/80 rounded-lg p-2 ring-1 ring-accent/20 shadow-sm">
                      <div className="flex items-center gap-1 mb-1.5">
                        <div className="w-1 h-3 bg-accent/60 rounded-full" />
                        <span className="text-xs font-medium text-accent-foreground/70">全书统计</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        <div className="flex flex-col items-center p-1 bg-card/70 rounded-md ring-1 ring-border/30 hover:shadow-sm hover:ring-accent/20 transition-all duration-200" title="总字符">
                          <BookOpen className="h-3 w-3 text-accent/70 mb-0.5" />
                          <span className="text-xs font-semibold text-foreground">{formatNumber(projectStats.charCount)}</span>
                          <span className="text-[9px] text-muted-foreground">总字符</span>
                        </div>
                        <div className="flex flex-col items-center p-1 bg-card/70 rounded-md ring-1 ring-border/30 hover:shadow-sm hover:ring-primary/20 transition-all duration-200" title="总中文">
                          <Type className="h-3 w-3 text-primary/70 mb-0.5" />
                          <span className="text-xs font-semibold text-foreground">{formatNumber(projectStats.chineseCharCount)}</span>
                          <span className="text-[9px] text-muted-foreground">总中文</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        {/* 日历和统计面板 */}
        <div className={`
          overflow-hidden transition-all duration-500 ease-out
          ${showCalendar 
            ? 'max-h-[500px] opacity-100 translate-y-0' 
            : 'max-h-0 opacity-0 -translate-y-4'
          }
        `}>
          {showCalendar && (
            <Suspense fallback={<div className="p-4 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>}>
              <WritingCalendar
                isOpen={showCalendar}
                onClose={() => setShowCalendar(false)}
                dailyStats={dailyStats}
              />
            </Suspense>
          )}
        </div>

        {/* AI 聊天区域 - 根据日历显示状态调整高度 */}
        <div className={`overflow-hidden ${showCalendar ? 'flex-1 min-h-[200px]' : 'flex-1'}`}>
          <AIChat />
        </div>
      </aside>

      <CreateItemModal />
    </div>
  );
};