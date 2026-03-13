// frontend/src/components/Modals/CreateItemModal.tsx
import { useState } from 'react';
import { Modal } from './Modal';
import { useUIStore } from '@/stores/uiStore';
import { useProjectStore } from '@/stores/projectStore';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/utils/request';
import { Loader2 } from 'lucide-react';

export const CreateItemModal = () => {
  const { modalType, modalParentId, closeModal } = useUIStore();
  const { currentProjectId, setCurrentProjectId } = useProjectStore();
  const [title, setTitle] = useState('');
  const queryClient = useQueryClient();

  // 默认的 mutationFn，防止为 undefined 导致 Hooks 行为变化
  let mutationFn: (data: { title: string }) => Promise<any> = async () => {
    throw new Error('未知的弹窗类型');
  };

  let modalTitle = '';
  let placeholder = '';

  if (modalType === 'project') {
    modalTitle = '新建项目';
    placeholder = '项目名称';
    mutationFn = (data) => api.post('/projects', { title: data.title });
  } else if (modalType === 'volume') {
    modalTitle = '新建卷';
    placeholder = '第一卷：初入江湖';
    mutationFn = (data) =>
      api.post('/folders', {
        name: data.title,
        project_id: currentProjectId,
        type: 'volume',
        parent_id: null,
        order: 0,
      });
  } else if (modalType === 'act') {
    modalTitle = '新建幕';
    placeholder = '第一幕：风起';
    mutationFn = (data) =>
      api.post('/folders', {
        name: data.title,
        project_id: currentProjectId,
        type: 'act',
        parent_id: modalParentId,
        order: 0,
      });
  } else if (modalType === 'note') {
    modalTitle = '新建笔记';
    placeholder = '第一章：启程';
    mutationFn = (data) =>
      api.post('/notes', {
        title: data.title,
        project_id: currentProjectId,
        folder_id: modalParentId,
        order: 0,
      });
  }
  // 如果 modalType 为 null，以上条件都不满足，modalTitle 和 placeholder 为空，mutationFn 保持默认

  const mutation = useMutation({
    mutationFn,
    onSuccess: (data) => {
      closeModal();
      setTitle('');

      // 刷新目录树（所有涉及目录树的类型）
      if (modalType && modalType !== 'project') {
        queryClient.invalidateQueries({ queryKey: ['directory', currentProjectId] });
      }

      // 如果是创建项目，自动切换到新项目
      if (modalType === 'project' && data?.id) {
        setCurrentProjectId(data.id);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // 对于幕和笔记，必须存在父级 ID
    if ((modalType === 'act' || modalType === 'note') && !modalParentId) {
      alert('请先选择父级');
      return;
    }

    // 创建项目时不需要 projectId，其他都需要
    if (modalType !== 'project' && !currentProjectId) {
      alert('请先选择或创建项目');
      return;
    }

    mutation.mutate({ title });
  };

  // 如果 modalType 为 null，不渲染任何内容（但 Hooks 已经调用完毕）
  if (!modalType) {
    return null;
  }

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
            disabled={!title.trim() || mutation.isPending}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            确认
          </button>
        </div>
      </form>
    </Modal>
  );
};