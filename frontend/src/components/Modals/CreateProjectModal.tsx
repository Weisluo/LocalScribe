import { useState } from 'react';
import { Modal } from './Modal';
import { useUIStore } from '@/stores/uiStore';
import { useProjectStore } from '@/stores/projectStore';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/utils/request';
import { Loader2 } from 'lucide-react';

export const CreateProjectModal = () => {
  const { isCreateProjectModalOpen, closeModal } = useUIStore();
  const { setCurrentProjectId } = useProjectStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: { title: string; description?: string }) => 
      api.post('/projects', data),
    onSuccess: (newProject) => {
      // 1. 关闭弹窗
      closeModal();
      // 2. 刷新项目列表 (如果有的话，暂时没有独立列表页，可跳过)
      // 3. 直接切换到新项目
      setCurrentProjectId(newProject.id);
      // 4. 重置表单
      setTitle('');
      setDescription('');
      
      // 提示成功
      alert('项目创建成功！');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    mutation.mutate({ title, description });
  };

  return (
    <Modal 
      isOpen={isCreateProjectModalOpen} 
      onClose={closeModal} 
      title="新建项目"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">项目名称</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="我的小说"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">简介 (可选)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring min-h-[80px]"
            placeholder="关于这个项目..."
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
            创建
          </button>
        </div>
      </form>
    </Modal>
  );
};
