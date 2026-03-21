// frontend/src/components/Modals/CreateItemModal.tsx
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Modal } from './Modal';
import { useUIStore } from '@/stores/uiStore';
import { useProjectStore } from '@/stores/projectStore';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { api } from '@/utils/request';
import { Loader2, AlertTriangle } from 'lucide-react';
import type { components } from '@/types/api';

type ProjectResponse = components['schemas']['ProjectResponse'];

export const CreateItemModal = () => {
  const { modalType, modalParentId, closeModal, setNewlyCreatedNoteId } = useUIStore();
  const { currentProjectId, setCurrentProjectId } = useProjectStore();
  const [title, setTitle] = useState('');
  const queryClient = useQueryClient();

  // 获取所有项目列表（用于删除时检查是否有其他项目可切换）
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<ProjectResponse[]>('/projects'),
    staleTime: 5 * 60 * 1000, // 5 分钟内使用缓存
  });

  // 从项目列表中获取当前项目信息（用于删除时显示项目名称）
  const currentProject = projects?.find(p => p.id === currentProjectId);

  // 重置标题当弹窗打开时
  useEffect(() => {
    if (modalType && modalType !== 'delete-project') {
      setTitle('');
    }
  }, [modalType]);

  let modalTitle = '';
  let placeholder = '';
  let isDeleteMode = false;

  if (modalType === 'project') {
    modalTitle = '新建项目';
    placeholder = '项目名称';
  } else if (modalType === 'volume') {
    modalTitle = '新建卷';
    placeholder = '第一卷：初入江湖';
  } else if (modalType === 'act') {
    modalTitle = '新建幕';
    placeholder = '第一幕：风起';
  } else if (modalType === 'note') {
    modalTitle = '新建章节';
    placeholder = '第一章：启程';
  } else if (modalType === 'delete-project') {
    modalTitle = '删除项目';
    isDeleteMode = true;
  }
  // 如果 modalType 为 null，以上条件都不满足，modalTitle 和 placeholder 为空

  // 创建操作的 mutation（需要 title 参数）
  const createMutation = useMutation({
    mutationFn: async (data: { title: string }) => {
      if (modalType === 'project') {
        return api.post<{ id: string }>('/projects', { title: data.title });
      } else if (modalType === 'volume') {
        return api.post<{ id: string }>('/folders', {
          name: data.title,
          project_id: currentProjectId,
          type: 'volume',
          parent_id: null,
          order: 0,
        });
      } else if (modalType === 'act') {
        return api.post<{ id: string }>('/folders', {
          name: data.title,
          project_id: currentProjectId,
          type: 'act',
          parent_id: modalParentId,
          order: 0,
        });
      } else if (modalType === 'note') {
        return api.post<{ id: string }>('/notes', {
          title: data.title,
          project_id: currentProjectId,
          folder_id: modalParentId,
          order: 0,
        });
      }
      throw new Error('未知的创建类型');
    },
    onSuccess: async (data) => {
      closeModal();
      setTitle('');

      // 刷新目录树（所有涉及目录树的类型）
      if (modalType && modalType !== 'project') {
        await queryClient.invalidateQueries({ queryKey: ['directory', currentProjectId] });
        
        // 等待目录树刷新完成后再设置新章节 ID
        if (modalType === 'note' && data?.id) {
          // 延迟一下确保数据已更新
          setTimeout(() => {
            setNewlyCreatedNoteId(data.id);
          }, 100);
        }
      }

      // 如果是创建项目，自动切换到新项目
      if (modalType === 'project' && data?.id) {
        await queryClient.invalidateQueries({ queryKey: ['projects'] });
        setCurrentProjectId(data.id);
      }
    },
    onError: (error) => {
      console.error('操作失败:', error);
      toast.error('操作失败，请重试');
    },
  });

  // 删除操作的 mutation（无参数）
  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/projects/${currentProjectId}`),
    onSuccess: async () => {
      closeModal();
      setTitle('');
      
      // 刷新项目列表
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      // 切换到其他项目或清空当前项目
      const remainingProjects = projects?.filter(p => p.id !== currentProjectId);
      if (remainingProjects && remainingProjects.length > 0) {
        setCurrentProjectId(remainingProjects[0].id);
      } else {
        setCurrentProjectId('');
      }
    },
    onError: (error) => {
      console.error('操作失败:', error);
      toast.error('操作失败，请重试');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // 删除模式：调用删除 mutation
    if (isDeleteMode) {
      deleteMutation.mutate();
      return;
    }

    // 创建模式：验证并调用创建 mutation
    if (!title.trim()) return;

    // 对于幕和章节，必须存在父级 ID
    if ((modalType === 'act' || modalType === 'note') && !modalParentId) {
      toast.warning('请先选择父级');
      return;
    }

    // 创建项目时不需要 projectId，其他都需要
    if (modalType !== 'project' && !currentProjectId) {
      toast.warning('请先选择或创建项目');
      return;
    }

    createMutation.mutate({ title });
  };

  // 如果 modalType 为 null，不渲染任何内容（但 Hooks 已经调用完毕）
  if (!modalType) {
    return null;
  }

  // 删除项目的特殊渲染
  if (isDeleteMode) {
    return (
      <Modal isOpen={true} onClose={closeModal} title={modalTitle}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm text-foreground">
                确定要删除项目 <span className="font-semibold">「{currentProject?.title || '...'}」</span> 吗？
              </p>
              <p className="text-xs text-muted-foreground">
                此操作不可恢复，项目下的所有卷、幕和章节都将被永久删除。
              </p>
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 rounded-md text-sm hover:bg-accent transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={deleteMutation.isPending}
              className="px-4 py-2 rounded-md bg-destructive text-destructive-foreground text-sm hover:bg-destructive/90 disabled:opacity-50 flex items-center gap-1"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              确认删除
            </button>
          </div>
        </form>
      </Modal>
    );
  }

  // 创建项目的默认渲染
  return (
    <Modal isOpen={true} onClose={closeModal} title={modalTitle}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">名称</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder={placeholder}
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={closeModal}
            className="px-4 py-2 rounded-md text-sm hover:bg-accent transition-colors"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={!title.trim() || createMutation.isPending}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"
          >
            {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            确认
          </button>
        </div>
      </form>
    </Modal>
  );
};
