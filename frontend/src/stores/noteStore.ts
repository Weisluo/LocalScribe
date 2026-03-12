// frontend/src/stores/noteStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface NoteState {
  // 当前正在编辑的笔记 ID
  currentNoteId: string | null;
  setCurrentNoteId: (id: string | null) => void;

  // 可选：保存编辑器的草稿状态（如果不想每次都实时请求后端保存）
  // drafts: Record<string, string>; 
  // setDraft: (id: string, content: string) => void;
}

export const useNoteStore = create<NoteState>()(
  persist(
    (set) => ({
      currentNoteId: null,
      
      setCurrentNoteId: (id) => set({ 
        currentNoteId: id 
      }),
      
      // 如果需要本地草稿功能，可以在此扩展
    }),
    {
      name: 'note-storage', // localStorage key，刷新页面后依然记住上次编辑的笔记
    }
  )
);
