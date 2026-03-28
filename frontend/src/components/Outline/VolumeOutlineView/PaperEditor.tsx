// frontend/src/components/Outline/VolumeOutlineView/PaperEditor.tsx
import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';

interface PaperEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  editorId?: string;
  autoFocus?: boolean;
}

const normalizeHtml = (html: string): string => {
  if (!html) return '';
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    return doc.body.innerHTML || '';
  } catch {
    return html;
  }
};

export const PaperEditor = ({
  content,
  onChange,
  placeholder = '在此编写大纲内容...',
  editorId,
  autoFocus = false,
}: PaperEditorProps) => {
  const isProgrammaticRef = useRef(false);
  const prevEditorIdRef = useRef<string | undefined>();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: { depth: 30 },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: content || '',
    editable: true,
    onUpdate: ({ editor }) => {
      if (!isProgrammaticRef.current) {
        onChange(editor.getHTML());
      }
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[120px] px-8 py-6 text-sm leading-relaxed',
      },
    },
  });

  useEffect(() => {
    if (!editor) return;

    const isIdChanged = editorId !== prevEditorIdRef.current;
    const normalizedProp = normalizeHtml(content);
    const normalizedEditor = normalizeHtml(editor.getHTML());
    const hasContentChanged = normalizedProp !== normalizedEditor;

    if (hasContentChanged) {
      if (isIdChanged) {
        isProgrammaticRef.current = true;
        editor.commands.setContent(content, false);
        editor.commands.blur();
        setTimeout(() => {
          isProgrammaticRef.current = false;
        }, 50);
      } else if (!editor.isFocused) {
        isProgrammaticRef.current = true;
        editor.commands.setContent(content, false);
        setTimeout(() => {
          isProgrammaticRef.current = false;
        }, 0);
      }
    }

    prevEditorIdRef.current = editorId;
  }, [content, editor, editorId]);

  useEffect(() => {
    if (autoFocus && editor) {
      setTimeout(() => editor.commands.focus('end'), 100);
    }
  }, [autoFocus, editor]);

  if (!editor) {
    return (
      <div className="min-h-[120px] animate-pulse bg-muted/20 rounded-lg" />
    );
  }

  return (
    <div className="bg-card rounded-xl shadow-sm ring-1 ring-border/40 overflow-hidden transition-all duration-200 hover:shadow-md hover:ring-border/60">
      <EditorContent editor={editor} />
    </div>
  );
};
