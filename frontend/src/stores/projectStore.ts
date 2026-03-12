import { create } from 'zustand';
import { persist } from 'zustand/middleware'; // 持久化到 localStorage

interface ProjectState {
  currentProjectId: string | null;
  setCurrentProjectId: (id: string) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      currentProjectId: null,
      setCurrentProjectId: (id) => set({ currentProjectId: id }),
    }),
    {
      name: 'project-storage', // localStorage key
    }
  )
);
