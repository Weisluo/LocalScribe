import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface EditorSettingsState {
  lineSpacing: number;
  paragraphSpacing: number;
  paragraphIndent: number;
  fontSize: number;
  setLineSpacing: (spacing: number) => void;
  increaseLineSpacing: () => void;
  decreaseLineSpacing: () => void;
  setParagraphSpacing: (spacing: number) => void;
  increaseParagraphSpacing: () => void;
  decreaseParagraphSpacing: () => void;
  setParagraphIndent: (indent: number) => void;
  increaseParagraphIndent: () => void;
  decreaseParagraphIndent: () => void;
  setFontSize: (size: number) => void;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
}

export const useEditorSettingsStore = create<EditorSettingsState>()(
  persist(
    (set, get) => ({
      lineSpacing: 1.8,
      paragraphSpacing: 1.0,
      paragraphIndent: 2.0,
      fontSize: 18,

      setLineSpacing: (spacing) => set({ lineSpacing: spacing }),

      increaseLineSpacing: () => {
        const current = get().lineSpacing;
        const next = Math.min(current + 0.2, 3.0);
        set({ lineSpacing: next });
      },

      decreaseLineSpacing: () => {
        const current = get().lineSpacing;
        const next = Math.max(current - 0.2, 1.0);
        set({ lineSpacing: next });
      },

      setParagraphSpacing: (spacing) => set({ paragraphSpacing: spacing }),

      increaseParagraphSpacing: () => {
        const current = get().paragraphSpacing;
        const next = Math.min(current + 0.2, 3.0);
        set({ paragraphSpacing: next });
      },

      decreaseParagraphSpacing: () => {
        const current = get().paragraphSpacing;
        const next = Math.max(current - 0.2, 0.2);
        set({ paragraphSpacing: next });
      },

      setParagraphIndent: (indent) => set({ paragraphIndent: indent }),

      increaseParagraphIndent: () => {
        const current = get().paragraphIndent;
        const next = Math.min(current + 0.5, 8.0);
        set({ paragraphIndent: next });
      },

      decreaseParagraphIndent: () => {
        const current = get().paragraphIndent;
        const next = Math.max(current - 0.5, 0);
        set({ paragraphIndent: next });
      },

      setFontSize: (size) => set({ fontSize: size }),

      increaseFontSize: () => {
        const current = get().fontSize;
        const next = Math.min(current + 2, 36);
        set({ fontSize: next });
      },

      decreaseFontSize: () => {
        const current = get().fontSize;
        const next = Math.max(current - 2, 12);
        set({ fontSize: next });
      },
    }),
    {
      name: 'editor-settings-storage',
    }
  )
);
