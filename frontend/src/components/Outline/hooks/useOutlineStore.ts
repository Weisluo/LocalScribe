// frontend/src/components/Outline/hooks/useOutlineStore.ts
import { create } from 'zustand';
import type { OutlineTab } from '../types';

interface OutlineState {
  activeTab: OutlineTab;
  setActiveTab: (tab: OutlineTab) => void;

  expandedVolumeIds: Set<string>;
  expandedActIds: Set<string>;
  expandedChapterIds: Set<string>;
  toggleVolume: (id: string) => void;
  toggleAct: (id: string) => void;
  toggleChapter: (id: string) => void;
  expandAll: (volumeIds: string[], actIds: string[], chapterIds?: string[]) => void;
  collapseAll: () => void;

  editingEventId: string | null;
  setEditingEvent: (id: string | null) => void;

  selectedEventId: string | null;
  setSelectedEvent: (id: string | null) => void;

  selectedConnectionId: string | null;
  setSelectedConnection: (id: string | null) => void;

  connectionMode: boolean;
  connectionType: string | null;
  connectionSource: string | null;
  setConnectionMode: (active: boolean, type?: string | null) => void;
  setConnectionSource: (id: string | null) => void;
  resetConnectionMode: () => void;
}

export const useOutlineStore = create<OutlineState>((set) => ({
  activeTab: 'volume-outline',
  setActiveTab: (tab) => set({ activeTab: tab }),

  expandedVolumeIds: new Set<string>(),
  expandedActIds: new Set<string>(),
  expandedChapterIds: new Set<string>(),

  toggleVolume: (id) =>
    set((state) => {
      const nextVolumeIds = new Set(state.expandedVolumeIds);
      const nextActIds = new Set(state.expandedActIds);
      const nextChapterIds = new Set(state.expandedChapterIds);
      
      if (nextVolumeIds.has(id)) {
        // 如果已经展开，则关闭该卷及其所有子项
        nextVolumeIds.delete(id);
        // 注意：这里无法直接知道该卷下有哪些幕，所以幕的关闭在组件层面处理
      } else {
        // 手风琴模式：关闭所有其他卷，只展开当前卷
        nextVolumeIds.clear();
        nextActIds.clear();
        nextChapterIds.clear();
        nextVolumeIds.add(id);
      }
      
      return { 
        expandedVolumeIds: nextVolumeIds,
        expandedActIds: nextActIds,
        expandedChapterIds: nextChapterIds,
      };
    }),

  toggleAct: (id) =>
    set((state) => {
      const next = new Set(state.expandedActIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { expandedActIds: next };
    }),

  toggleChapter: (id) =>
    set((state) => {
      const next = new Set(state.expandedChapterIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { expandedChapterIds: next };
    }),

  expandAll: (volumeIds, actIds, chapterIds = []) =>
    set({
      expandedVolumeIds: new Set(volumeIds),
      expandedActIds: new Set(actIds),
      expandedChapterIds: new Set(chapterIds),
    }),

  collapseAll: () =>
    set({
      expandedVolumeIds: new Set(),
      expandedActIds: new Set(),
      expandedChapterIds: new Set(),
    }),

  editingEventId: null,
  setEditingEvent: (id) => set({ editingEventId: id }),

  selectedEventId: null,
  setSelectedEvent: (id) => set({ selectedEventId: id }),

  selectedConnectionId: null,
  setSelectedConnection: (id) => set({ selectedConnectionId: id }),

  connectionMode: false,
  connectionType: null,
  connectionSource: null,
  setConnectionMode: (active, type = null) =>
    set({ connectionMode: active, connectionType: type, connectionSource: null }),
  setConnectionSource: (id) => set({ connectionSource: id }),
  resetConnectionMode: () =>
    set({ connectionMode: false, connectionType: null, connectionSource: null }),
}));
