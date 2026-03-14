// frontend/src/hooks/useDirectory.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/utils/request';
import type { components } from '@/types/api';

type VolumeNode = components['schemas']['VolumeNode'];
type FolderCreate = components['schemas']['FolderCreate'];
type FolderResponse = components['schemas']['FolderResponse'];
type MoveFolderRequest = components['schemas']['MoveFolderRequest'];

/**
 * 获取项目目录树 Hook
 * @param projectId 项目 ID
 */
export const useDirectoryTree = (projectId: string | undefined) => {
  return useQuery({
    queryKey: ['directory', projectId],
    queryFn: () => api.get<VolumeNode[]>(`/projects/${projectId}/tree`),
    enabled: !!projectId, // 只有当 projectId 存在时才发起请求
  });
};

/**
 * 创建文件夹 (卷/幕) Hook
 */
export const useCreateFolder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: FolderCreate) => 
      api.post<FolderResponse>('/folders/', data),
    
    onSuccess: (_, variables) => {
      // 创建成功后，让该项目的目录树缓存失效，触发自动刷新
      queryClient.invalidateQueries({ 
        queryKey: ['directory', variables.project_id] 
      });
    },
  });
};

/**
 * 移动文件夹 (排序/换卷) Hook
 * @param projectId 当前项目 ID (用于刷新缓存)
 */
export const useMoveFolder = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ folderId, data }: { folderId: string; data: MoveFolderRequest }) =>
      api.put(`/folders/${folderId}/move`, data),
    
    onSuccess: () => {
      // 移动成功后刷新目录树
      queryClient.invalidateQueries({ queryKey: ['directory', projectId] });
    },
  });
};

/**
 * 删除文件夹 Hook
 */
export const useDeleteFolder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (folderId: string) => 
      api.delete(`/folders/${folderId}`),
    
    onSuccess: () => {
      // 简单粗暴：只要删除成功，刷新所有目录树缓存
      // 优化点：如果你知道具体 projectId，可以像 useCreateFolder 那样精确刷新
      queryClient.invalidateQueries({ queryKey: ['directory'] });
    },
  });
};

/**
 * 更新文件夹 Hook (重命名)
 */
export const useUpdateFolder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ folderId, data }: { folderId: string; data: { name: string } }) =>
      api.put(`/folders/${folderId}`, data),
    
    onSuccess: () => {
      // 更新成功后刷新目录树缓存
      // 这里我们无法直接获取 projectId，所以刷新所有目录树
      queryClient.invalidateQueries({ queryKey: ['directory'] });
    },
  });
};
