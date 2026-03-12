import { useState } from 'react';
import { Modal } from './Modal';
import { useUIStore } from '@/stores/uiStore';
import { useProjectStore } from '@/stores/projectStore'; // 引入 projectStore 获取当前项目ID
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/utils/request';
import { Loader2 } from 'lucide-react';

export const CreateItemModal = () => {
  const { 
    isCreateVolumeModalOpen, 
    isCreateChapterModalOpen, 
    parentId, // 新建卷时这里是 projectId，新建章节时这里是 folderId (volumeId)
    closeModal 
  } = useUIStore();
  
  // 获取当前项目 ID，用于给后端传 project_id
  const { currentProjectId } = useProjectStore();
  
  const [title, setTitle] = useState('');
  const queryClient = useQueryClient();

  // 判断当前模式
  const isOpen = isCreateVolumeModalOpen || isCreateChapterModalOpen;
  const isVolume = isCreateVolumeModalOpen;
  const modalTitle = isVolume ? '新建卷' : '新建章节';

  const mutation = useMutation({
    mutationFn: (data: object) => {
      // 根据模式构建不同的请求体
      if (isVolume) {
        // POST /api/v1/folders/
        // 后端 FolderCreate 需要: name, project_id, type, parent_id(可选)
        const payload = {
          name: title,
          project_id: currentProjectId, // 当前项目 ID
          type: 'volume',               // 类型为卷
          parent_id: null,              // 卷通常在根目录
          order: 0                      // 传 0 触发后端自动排序
        };
        return api.post('/folders', payload);
      } else {
        // POST /api/v1/notes/
        // 后端 NoteCreate 需要: title, project_id, folder_id, order
        const payload = {
          title: title,
          project_id: currentProjectId, // 当前项目 ID
          folder_id: parentId,          // 父级文件夹 ID (卷 ID)
          order: 0                      // 传 0 触发后端自动排序
        };
        return api.post('/notes', payload);
      }
    },
    onSuccess: () => {
      closeModal();
      setTitle('');
      // 刷新目录树
      queryClient.invalidateQueries({ queryKey: ['directory', currentProjectId] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !currentProjectId) return;
    // 新建章节时必须选中了父级
    if (!isVolume && !parentId) {
      alert("请先选择要添加章节的卷");
      return;
    }
    
    mutation.mutate({}); // payload 已在 mutationFn 中构建
  };

  return (
    <Modal isOpen={isOpen} onClose={closeModal} title={modalTitle}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">名称</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder={isVolume ? "第一卷：初入江湖" : "第一章：风起"}
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={closeModal} className="px-4 py-2 rounded-md text-sm hover:bg-accent transition-colors">
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
