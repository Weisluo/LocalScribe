// frontend/src/stores/uiStore.ts
import { create } from 'zustand';

interface UIState {
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  
  // 弹窗状态
  isCreateProjectModalOpen: boolean;
  isCreateVolumeModalOpen: boolean;
  isCreateChapterModalOpen: boolean;
  isCreateNoteModalOpen: boolean;
  
  // 当前操作的父级 ID (用于创建卷/章节时知道父级是谁)
  parentId: string | null; 
  
  // Actions
  openModal: (type: 'project' | 'volume' | 'chapter' | 'note', parentId?: string | null) => void;
  closeModal: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isSidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  
  isCreateProjectModalOpen: false,
  isCreateVolumeModalOpen: false,
  isCreateChapterModalOpen: false,
  isCreateNoteModalOpen: false,
  parentId: null,
  
  openModal: (type, parentId = null) => {
    // 1. 先定义重置状态（关闭所有弹窗）
    const baseState = {
      isCreateProjectModalOpen: false,
      isCreateVolumeModalOpen: false,
      isCreateChapterModalOpen: false,
      isCreateNoteModalOpen: false,
      parentId: parentId, // 设置父级 ID
    };

    // 2. 根据类型开启对应弹窗
    switch (type) {
      case 'project':
        set({ ...baseState, isCreateProjectModalOpen: true });
        break;
      case 'volume':
        set({ ...baseState, isCreateVolumeModalOpen: true });
        break;
      case 'chapter':
        set({ ...baseState, isCreateChapterModalOpen: true });
        break;
      case 'note':
        set({ ...baseState, isCreateNoteModalOpen: true });
        break;
    }
  },
  
  closeModal: () => set({
    isCreateProjectModalOpen: false,
    isCreateVolumeModalOpen: false,
    isCreateChapterModalOpen: false,
    isCreateNoteModalOpen: false,
    parentId: null,
  }),
}));
