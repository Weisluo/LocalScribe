import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/utils/request';
import type { components } from '@/types/api';
import { useProjectStore } from '@/stores/projectStore';
import { 
  Trash2, 
  RotateCcw, 
  AlertTriangle,
  Check,
  X,
  FileText,
  Calendar,
  Grid3x3,
  List
} from 'lucide-react';

type NoteResponse = components['schemas']['NoteResponse'];

interface TrashViewProps {
  embedded?: boolean;
}

export const TrashView = ({ embedded = true }: TrashViewProps) => {
  const { currentProjectId } = useProjectStore();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [viewMode, setViewMode] = useState<'compact' | 'detailed'>('compact');
  const [isClearAllMode, setIsClearAllMode] = useState(false);

  const { data: deletedNotes, isLoading, refetch } = useQuery({
    queryKey: ['deletedNotes', currentProjectId],
    queryFn: () => api.get<NoteResponse[]>(`/notes/deleted?project_id=${currentProjectId}`),
    enabled: !!currentProjectId,
  });

  const restoreMutation = useMutation({
    mutationFn: (noteId: string) => api.post(`/notes/${noteId}/restore`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deletedNotes', currentProjectId] });
      queryClient.invalidateQueries({ queryKey: ['directory', currentProjectId] });
    },
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: (noteId: string) => api.delete(`/notes/${noteId}`, { params: { permanent: true } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deletedNotes', currentProjectId] });
    },
  });

  const batchRestoreMutation = useMutation({
    mutationFn: (ids: string[]) => api.post('/notes/batch-restore', { ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deletedNotes', currentProjectId] });
      queryClient.invalidateQueries({ queryKey: ['directory', currentProjectId] });
      setSelectedIds(new Set());
    },
  });

  const batchPermanentDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => api.post('/notes/batch-delete', { ids }, { params: { permanent: true } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deletedNotes', currentProjectId] });
      setSelectedIds(new Set());
    },
  });

  const handleToggleSelect = (noteId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(noteId)) {
        next.delete(noteId);
      } else {
        next.add(noteId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (!deletedNotes) return;
    if (selectedIds.size === deletedNotes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(deletedNotes.map(note => note.id)));
    }
  };

  const handleRestore = (noteId?: string) => {
    if (noteId) {
      restoreMutation.mutate(noteId);
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(noteId);
        return next;
      });
    } else if (selectedIds.size > 0) {
      batchRestoreMutation.mutate(Array.from(selectedIds));
    }
  };

  const handlePermanentDelete = (noteId?: string) => {
    if (noteId) {
      permanentDeleteMutation.mutate(noteId);
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(noteId);
        return next;
      });
    } else if (selectedIds.size > 0) {
      batchPermanentDeleteMutation.mutate(Array.from(selectedIds));
    }
    setShowConfirmClear(false);
    setIsClearAllMode(false);
  };

  const handleClearAll = () => {
    if (!deletedNotes || deletedNotes.length === 0) return;
    setIsClearAllMode(true);
    setSelectedIds(new Set(deletedNotes.map(note => note.id)));
    setShowConfirmClear(true);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const extractPlainText = (html: string | null | undefined, maxLength: number = 200) => {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const text = tmp.textContent || tmp.innerText || '';
    return text.trim().length > maxLength ? text.trim().substring(0, maxLength) + '...' : text.trim();
  };

  const toggleViewMode = () => {
    setViewMode(prev => prev === 'compact' ? 'detailed' : 'compact');
  };

  if (!currentProjectId) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
          <p>请先选择一个项目</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col bg-background ${embedded ? '' : 'container mx-auto px-4 py-8'}`}>
      {deletedNotes && deletedNotes.length > 0 && (
        <div className={`border-b border-border bg-muted/30 ${embedded ? '' : '-mx-4 -mt-4 px-4 py-3'}`}>
          <div className={embedded ? 'px-6 py-3' : ''}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSelectAll}
                  className="px-3 py-1.5 text-sm border border-input rounded-md hover:bg-accent/10 transition-colors"
                >
                  {selectedIds.size === deletedNotes.length ? '取消全选' : '全选'}
                </button>
                <span className="text-sm text-muted-foreground">
                  {selectedIds.size > 0 ? `已选择 ${selectedIds.size} 项` : `${deletedNotes.length} 个已删除的笔记`}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => refetch()}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm border border-input rounded-md hover:bg-accent/10 transition-colors"
                  title="刷新"
                >
                  <RotateCcw className="h-4 w-4" />
                  刷新
                </button>
                <button
                  onClick={toggleViewMode}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm border border-input rounded-md hover:bg-accent/10 transition-colors"
                  title={viewMode === 'compact' ? '切换到详细视图' : '切换到缩略视图'}
                >
                  {viewMode === 'compact' ? (
                    <>
                      <List className="h-4 w-4" />
                      <span>详细视图</span>
                    </>
                  ) : (
                    <>
                      <Grid3x3 className="h-4 w-4" />
                      <span>缩略视图</span>
                    </>
                  )}
                </button>
                <div className="w-px h-6 bg-border mx-1" />
                <button
                  onClick={() => handleRestore()}
                  disabled={selectedIds.size === 0}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <RotateCcw className="h-4 w-4" />
                  恢复选中
                </button>
                <button
                  onClick={() => {
                    setIsClearAllMode(false);
                    setShowConfirmClear(true);
                  }}
                  disabled={selectedIds.size === 0}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  永久删除
                </button>
                <button
                  onClick={handleClearAll}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-destructive/80 text-destructive-foreground rounded-md hover:bg-destructive transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  清空回收站
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`flex-1 overflow-y-auto ${embedded ? 'px-6 py-4' : 'container mx-auto px-4 py-8'}`}>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : !deletedNotes || deletedNotes.length === 0 ? (
          <div className="text-center py-12">
            <Trash2 className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">回收站为空</h3>
            <p className="text-muted-foreground">暂无已删除的笔记</p>
          </div>
        ) : viewMode === 'compact' ? (
          <div className="grid gap-3">
            {deletedNotes.map((note, index) => (
              <div
                key={note.id}
                className={`
                  group flex items-center gap-4 p-4 rounded-lg border transition-all duration-200
                  ${selectedIds.has(note.id)
                    ? 'bg-accent/10 border-accent/30'
                    : 'bg-card border-border hover:border-accent/20 hover:shadow-sm'
                  }
                  animate-in slide-in-from-left-4 fade-in duration-300 ease-out
                `}
                style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
              >
                <button
                  onClick={() => handleToggleSelect(note.id)}
                  className={`
                    flex items-center justify-center w-5 h-5 rounded border transition-colors
                    ${selectedIds.has(note.id)
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'border-input hover:border-accent'
                    }
                  `}
                >
                  {selectedIds.has(note.id) && <Check className="h-3.5 w-3.5" />}
                </button>

                <div className="p-2 rounded-lg bg-muted/50">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-foreground truncate">
                    {note.title || '无标题'}
                  </h3>
                  <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      删除于：{formatDate(note.deleted_at!)}
                    </span>
                    {note.word_count !== undefined && note.word_count !== null && (
                      <span>{note.word_count} 字</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleRestore(note.id)}
                    disabled={restoreMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary/10 text-primary rounded-md hover:bg-primary/20 disabled:opacity-50 transition-colors"
                    title="恢复"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    恢复
                  </button>
                  <button
                    onClick={() => handlePermanentDelete(note.id)}
                    disabled={permanentDeleteMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-destructive/10 text-destructive rounded-md hover:bg-destructive/20 disabled:opacity-50 transition-colors"
                    title="永久删除"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {deletedNotes.map((note, index) => (
              <div
                key={note.id}
                className={`
                  group flex flex-col rounded-lg border transition-all duration-200 overflow-hidden
                  ${selectedIds.has(note.id)
                    ? 'bg-accent/10 border-accent/30'
                    : 'bg-card border-border hover:border-accent/20 hover:shadow-md'
                  }
                  animate-in slide-in-from-bottom-4 fade-in zoom-in-95 duration-300 ease-out
                `}
                style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'both' }}
              >
                <div className="flex items-start gap-3 p-4 border-b border-border/50">
                  <button
                    onClick={() => handleToggleSelect(note.id)}
                    className={`
                      flex items-center justify-center w-5 h-5 rounded border transition-colors flex-shrink-0 mt-0.5
                      ${selectedIds.has(note.id)
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'border-input hover:border-accent'
                      }
                    `}
                  >
                    {selectedIds.has(note.id) && <Check className="h-3.5 w-3.5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate pr-2">
                      {note.title || '无标题'}
                    </h3>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(note.deleted_at!)}
                      </span>
                      {note.word_count !== undefined && note.word_count !== null && (
                        <span>{note.word_count} 字</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex-1 p-4">
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">
                    {extractPlainText(note.content, 300)}
                  </p>
                </div>

                <div className="flex items-center gap-2 p-3 bg-muted/30 border-t border-border/50 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleRestore(note.id)}
                    disabled={restoreMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    title="恢复"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    恢复
                  </button>
                  <button
                    onClick={() => handlePermanentDelete(note.id)}
                    disabled={permanentDeleteMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 disabled:opacity-50 transition-colors"
                    title="永久删除"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showConfirmClear && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="h-6 w-6 text-destructive" />
              <h3 className="text-lg font-semibold text-foreground">
                {isClearAllMode ? '确认清空回收站' : '确认永久删除'}
              </h3>
            </div>
            <p className="text-muted-foreground mb-6">
              {isClearAllMode 
                ? `此操作不可恢复，确定要清空回收站中的所有 ${deletedNotes?.length || 0} 个笔记吗？`
                : `此操作不可恢复，确定要永久删除选中的 ${selectedIds.size} 个笔记吗？`
              }
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowConfirmClear(false);
                  if (isClearAllMode) {
                    setSelectedIds(new Set());
                    setIsClearAllMode(false);
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 text-sm border border-input rounded-md hover:bg-accent/10 transition-colors"
              >
                <X className="h-4 w-4" />
                取消
              </button>
              <button
                onClick={() => handlePermanentDelete()}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                {isClearAllMode ? '确认清空' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
