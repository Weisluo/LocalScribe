import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/utils/request';
import type { components } from '@/types/api';
import { DirectoryTree } from '@/components/DirectoryTree';
import { Editor } from '@/components/Editor';
import { AIChat } from '@/components/AIChat';
import { useNote, useUpdateNote } from '@/hooks/useNote';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { CreateProjectModal, CreateItemModal } from '@/components/Modals';
import { useAutoSave } from '@/hooks/useAutoSave';
import { Loader2, Save, Settings, PlusCircle, FolderPlus } from 'lucide-react';

type ProjectResponse = components['schemas']['ProjectResponse'];

export const EditorPage = () => {
  // === Stores ===
  const { currentProjectId } = useProjectStore();
  const { openModal } = useUIStore();

  // === Local State ===
  const [selectedNoteId, setSelectedNoteId] = useState<string | undefined>();
  const [noteTitle, setNoteTitle] = useState<string>('');
  const [noteContent, setNoteContent] = useState<string>('');
  const [isTitleFocused, setIsTitleFocused] = useState(false);

  // === Data Fetching ===
  const { data: project } = useQuery({
    queryKey: ['project', currentProjectId],
    queryFn: () => api.get<ProjectResponse>(`/projects/${currentProjectId}`),
    enabled: !!currentProjectId,
  });

  const { data: currentNote, isLoading: isLoadingNote } = useNote(selectedNoteId);
  const updateNoteMutation = useUpdateNote();

  // === Effects ===
  // 同步笔记数据到本地状态
  useEffect(() => {
    if (currentNote) {
      setNoteTitle(currentNote.title || '无标题');
      setNoteContent(currentNote.content || '');
    } else if (!selectedNoteId) {
      // 如果没有选中笔记，清空状态
      setNoteTitle('');
      setNoteContent('');
    }
  }, [currentNote, selectedNoteId]);

  // === 自动保存逻辑 ===
  const noteData = useMemo(() => ({
    title: noteTitle,
    content: noteContent
  }), [noteTitle, noteContent]);

  const handleSave = useCallback((data: { title: string; content: string }) => {
    if (selectedNoteId) {
      updateNoteMutation.mutate({
        noteId: selectedNoteId,
        data: data
      });
    }
  }, [selectedNoteId, updateNoteMutation]);

  useAutoSave({ 
    data: noteData, 
    onSave: handleSave 
  });

  // === Handlers ===
  const onEditorChange = (html: string) => {
    setNoteContent(html);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNoteTitle(e.target.value);
  };

  // === Render: 欢迎页 (无项目时) ===
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
        <CreateProjectModal />
      </div>
    );
  }

  // === Render: 主编辑界面 ===
  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* 左侧栏 - 固定宽度，不滚动 */}
      <aside className="w-52 border-r border-border flex flex-col bg-muted/20 flex-shrink-0">
        {/* 顶部：项目标题 + 新建卷按钮 */}
        <div className="h-14 border-b border-border flex items-center justify-between px-4 flex-shrink-0">
          <h1 className="text-lg font-semibold truncate">
            {project?.title || '我的小说'}
          </h1>
          <button 
            onClick={() => openModal('volume', currentProjectId)}
            className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
            title="新建卷"
          >
            <FolderPlus className="h-4 w-4" />
          </button>
        </div>

        {/* 中间：目录树 - 可滚动 */}
        <div className="flex-1 overflow-y-auto">
          <DirectoryTree
            projectId={currentProjectId}
            selectedNoteId={selectedNoteId}
            onSelectNote={(id, title) => {
              setSelectedNoteId(id);
              setNoteTitle(title);
            }}
          />
        </div>

        {/* 底部：预留区域 + 切换项目 + 新建章节 - 固定高度 */}
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
              onClick={() => openModal('chapter', currentProjectId)}
              className="w-full flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded mb-2"
            >
              <PlusCircle className="h-4 w-4" /> 新建章节
            </button>
            <button 
              onClick={() => openModal('project')}
              className="w-full flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded"
            >
              <PlusCircle className="h-4 w-4" /> 切换/新建项目
            </button>
          </div>
        </div>
      </aside>

      {/* 中间：主编辑区 - 占据剩余宽度，不滚动 */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* 顶部标题栏 - 固定高度 */}
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

        {/* 编辑器区域 - 占据剩余高度，包含可滚动内容和固定底部工具栏 */}
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

      {/* 右侧栏 - 固定宽度，不滚动 */}
      <aside className="w-1/4 border-l border-border flex flex-col bg-muted/10 flex-shrink-0">
        {/* 顶部信息栏 - 固定高度 */}
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
          {/* 字数统计 */}
          <div className="text-xs text-muted-foreground mt-1">
            字数：{noteContent.replace(/<[^>]*>/g, '').length}
          </div>
        </div>

        {/* 下方：AI 对话窗口 - 占据剩余高度，可滚动 */}
        <div className="flex-1 overflow-hidden">
          <AIChat />
        </div>
      </aside>

      {/* 全局弹窗容器 */}
      <CreateProjectModal />
      <CreateItemModal />
    </div>
  );
};