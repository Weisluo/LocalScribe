// frontend/src/hooks/useNote.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/utils/request';
import type { components } from '@/types/api';

type NoteResponse = components['schemas']['NoteResponse'];
type NoteUpdate = components['schemas']['NoteUpdate'];
type MoveNoteRequest = components['schemas']['MoveNoteRequest'];

export const useNote = (noteId: string | undefined) => {
  return useQuery({
    queryKey: ['note', noteId],
    queryFn: () => api.get<NoteResponse>(`/notes/${noteId}`),
    enabled: !!noteId,
  });
};

export const useUpdateNote = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ noteId, data }: { noteId: string; data: NoteUpdate }) =>
      api.put<NoteResponse>(`/notes/${noteId}`, data),
    
    onSuccess: () => {
      // 只刷新目录树，不更新单篇章节缓存
      queryClient.invalidateQueries({ queryKey: ['directory', projectId] });
    },
  });
};

export const useMoveNote = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ noteId, data }: { noteId: string; data: MoveNoteRequest }) =>
      api.put(`/notes/${noteId}/move`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['directory', projectId] });
    },
  });
};

export const useCreateNote = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { folder_id: string; title: string }) =>
      api.post<NoteResponse>('/notes', {
        ...data,
        project_id: projectId,
        order: 0, // 后端会自动处理排序
      }),
    onSuccess: () => {
      // 创建成功后刷新目录树缓存
      queryClient.invalidateQueries({ queryKey: ['directory', projectId] });
    },
  });
};

export const useDeleteNote = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (noteId: string) =>
      api.delete(`/notes/${noteId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['directory', projectId] });
    },
  });
};