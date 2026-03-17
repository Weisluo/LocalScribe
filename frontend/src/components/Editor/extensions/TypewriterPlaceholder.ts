import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export interface TypewriterPlaceholderOptions {
  texts: string[];
  speed?: number;
  deleteSpeed?: number;
  pauseDuration?: number;
  emptyEditorClass: string;
}

export const TypewriterPlaceholder = Extension.create<TypewriterPlaceholderOptions>({
  name: 'typewriterPlaceholder',

  addOptions() {
    return {
      texts: ['开始书写你的故事...'],
      speed: 60,
      deleteSpeed: 40,
      pauseDuration: 2000,
      emptyEditorClass: 'is-typewriter-empty',
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('typewriterPlaceholder'),
        props: {
          decorations: () => null,
          handleDOMEvents: {
            // 阻止默认的 placeholder 行为
          },
        },
      }),
    ];
  },
});

export default TypewriterPlaceholder;
