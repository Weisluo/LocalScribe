// frontend/src/hooks/useNote.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/utils/request';
import type { components } from '@/types/api';

type NoteResponse = components['schemas']['NoteResponse'];
type NoteUpdate = components['schemas']['NoteUpdate'];
type MoveNoteRequest = components['schemas']['MoveNoteRequest'];

/**
 * 获取单篇笔记详情
 */
export const useNote = (noteId: string | undefined) => {
  return useQuery({
    queryKey: ['note', noteId],
    queryFn: () => api.get<NoteResponse>(`/notes/${noteId}`),
    enabled: !!noteId, // 只有 noteId 存在时才请求
  });
};

/**
 * 更新笔记内容（自动保存用）
 */
export const useUpdateNote = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ noteId, data }: { noteId: string; data: NoteUpdate }) =>
      api.put<NoteResponse>(`/notes/${noteId}`, data),
    
    onSuccess: (updatedNote, variables) => {
      // 更新成功后，更新缓存中的单篇笔记数据
      queryClient.setQueryData(['note', variables.noteId], updatedNote);
      
      // 同时更新目录树中的标题（如果标题被修改了）
      // 这里简单处理：让目录树缓存失效，重新获取
      queryClient.invalidateQueries({ queryKey: ['directory'] });
    },
  });
};

/**
 * 新增：移动/排序笔记
 */
export const useMoveNote = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ noteId, data }: { noteId: string; data: MoveNoteRequest }) =>
      api.put(`/notes/${noteId}/move`, data),
    onSuccess: () => {
      // 移动成功后，刷新目录树结构
      queryClient.invalidateQueries({ queryKey: ['directory', projectId] });
    },
  });
};