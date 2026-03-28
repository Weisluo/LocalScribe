// frontend/src/components/Outline/hooks/useOutline.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/utils/request';
import type {
  ProjectOutline,
  StoryEvent,
  StoryEventCreate,
  StoryEventUpdate,
  EventConnection,
  EventConnectionCreate,
  EventConnectionUpdate,
  ActEvents,
  ProjectEvents,
} from '../types';

// ======== 项目大纲数据 ========

export function useProjectOutline(projectId: string | undefined) {
  return useQuery({
    queryKey: ['outline', projectId],
    queryFn: () => api.get<ProjectOutline>(`/outline/projects/${projectId}/outline`),
    enabled: !!projectId,
  });
}

export function useProjectEvents(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-events', projectId],
    queryFn: () => api.get<ProjectEvents>(`/outline/projects/${projectId}/events`),
    enabled: !!projectId,
  });
}

// ======== 卷大纲 ========

export function useUpdateVolumeOutline(_projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ volumeId, outlineContent }: { volumeId: string; outlineContent: string }) =>
      api.put(`/outline/volumes/${volumeId}/outline`, { outline_content: outlineContent }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outline', _projectId] });
    },
  });
}

// ======== 章节大纲 ========

export function useUpdateChapterOutline(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ noteId, outlineContent }: { noteId: string; outlineContent: string }) =>
      api.put(`/outline/notes/${noteId}/outline`, { outline_content: outlineContent }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outline', projectId] });
    },
  });
}

// ======== 幕事件 ========

export function useActEvents(actId: string | undefined) {
  return useQuery({
    queryKey: ['act-events', actId],
    queryFn: () => api.get<ActEvents>(`/outline/acts/${actId}/events`),
    enabled: !!actId,
  });
}

export function useCreateEvent(_projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ actId, data }: { actId: string; data: StoryEventCreate }) =>
      api.post<StoryEvent>(`/outline/acts/${actId}/events`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['act-events', variables.actId] });
    },
  });
}

export function useUpdateEvent(_projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, data }: { eventId: string; data: StoryEventUpdate }) =>
      api.put<StoryEvent>(`/outline/events/${eventId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['act-events'] });
    },
  });
}

export function useDeleteEvent(_projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) =>
      api.delete(`/outline/events/${eventId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['act-events'] });
    },
  });
}

export function useCreateConnection(_projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: EventConnectionCreate) =>
      api.post<EventConnection>(`/outline/connections`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['act-events'] });
    },
  });
}

export function useUpdateConnection(_projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ connectionId, data }: { connectionId: string; data: EventConnectionUpdate }) =>
      api.put<EventConnection>(`/outline/connections/${connectionId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['act-events'] });
    },
  });
}

export function useDeleteConnection(_projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (connectionId: string) =>
      api.delete(`/outline/connections/${connectionId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['act-events'] });
    },
  });
}
