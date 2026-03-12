// frontend/src/components/Editor/Toolbar.tsx
import StarterKit from '@tiptap/starter-kit'; 
import { Editor } from '@tiptap/react';
import { 
  Bold, Italic, Strikethrough, Code, 
  Heading1, Heading2, List, ListOrdered, 
  Quote, Undo, Redo 
} from 'lucide-react';

interface ToolbarProps {
  editor: Editor | null;
}

export const Toolbar = ({ editor }: ToolbarProps) => {
  if (!editor) {
    return null;
  }

  // 通用按钮样式
  const btnClass = (isActive: boolean) => `
    p-2 rounded hover:bg-accent transition-colors
    ${isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}
  `;

  return (
    <div className="flex items-center gap-1 p-2 border-b border-border bg-background sticky top-0 z-10">
      {/* 撤销 / 重做 */}
      <button
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        className={btnClass(false)}
        title="撤销"
      >
        <Undo className="h-4 w-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        className={btnClass(false)}
        title="重做"
      >
        <Redo className="h-4 w-4" />
      </button>

      <div className="w-px h-6 bg-border mx-1" />

      {/* 标题 */}
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={btnClass(editor.isActive('heading', { level: 1 }))}
        title="标题 1"
      >
        <Heading1 className="h-4 w-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={btnClass(editor.isActive('heading', { level: 2 }))}
        title="标题 2"
      >
        <Heading2 className="h-4 w-4" />
      </button>

      <div className="w-px h-6 bg-border mx-1" />

      {/* 格式化 */}
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={btnClass(editor.isActive('bold'))}
        title="粗体"
      >
        <Bold className="h-4 w-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={btnClass(editor.isActive('italic'))}
        title="斜体"
      >
        <Italic className="h-4 w-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={btnClass(editor.isActive('strike'))}
        title="删除线"
      >
        <Strikethrough className="h-4 w-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleCode().run()}
        className={btnClass(editor.isActive('code'))}
        title="行内代码"
      >
        <Code className="h-4 w-4" />
      </button>

      <div className="w-px h-6 bg-border mx-1" />

      {/* 列表与引用 */}
      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={btnClass(editor.isActive('bulletList'))}
        title="无序列表"
      >
        <List className="h-4 w-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={btnClass(editor.isActive('orderedList'))}
        title="有序列表"
      >
        <ListOrdered className="h-4 w-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={btnClass(editor.isActive('blockquote'))}
        title="引用"
      >
        <Quote className="h-4 w-4" />
      </button>
    </div>
  );
};
