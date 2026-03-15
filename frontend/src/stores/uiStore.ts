// frontend/src/stores/uiStore.ts
import { create } from 'zustand';

export type ModalType = 'project' | 'volume' | 'act' | 'note' | 'delete-project' | null;

interface UIState {
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;

  // 弹窗状态
  modalType: ModalType;
  modalParentId: string | null; // 父级 ID：创建卷时为 projectId，创建幕时为 volumeId，创建章节时为 actId

  // 新创建的章节 ID（用于自动选中）
  newlyCreatedNoteId: string | null;

  // Actions
  openModal: (type: Exclude<ModalType, null>, parentId?: string | null) => void;
  closeModal: () => void;
  setNewlyCreatedNoteId: (noteId: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isSidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

  modalType: null,
  modalParentId: null,
  newlyCreatedNoteId: null,

  openModal: (type, parentId = null) => set({
    modalType: type,
    modalParentId: parentId,
  }),

  closeModal: () => set({
    modalType: null,
    modalParentId: null,
  }),

  setNewlyCreatedNoteId: (noteId) => set({ newlyCreatedNoteId: noteId }),
}));