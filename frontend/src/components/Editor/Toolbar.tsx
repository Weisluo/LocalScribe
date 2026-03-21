import { Editor } from '@tiptap/react';
import {
  Bold, Italic, Strikethrough, Code,
  Heading1, Heading2, List, ListOrdered,
  Quote, Undo, Redo,
  Minus, Plus, Indent, Outdent,
  Copy, Check
} from 'lucide-react';
import { useEditorSettingsStore } from '../../stores/editorSettingsStore';
import { useState, memo, useCallback } from 'react';

interface ToolbarProps {
  editor: Editor | null;
}

const getBtnClass = (isActive: boolean, isDisabled = false) => `
  p-2 rounded-lg transition-all duration-200 ease-out
  ${isDisabled 
    ? 'opacity-30 cursor-not-allowed' 
    : 'hover:bg-accent/60 hover:scale-105 active:scale-95 cursor-pointer'
  }
  ${isActive 
    ? 'bg-accent text-accent-foreground shadow-sm' 
    : 'text-muted-foreground hover:text-foreground'
  }
`;

interface ToolbarButtonProps {
  onClick: () => void;
  isActive: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}

const ToolbarButton = memo(({ onClick, isActive, disabled, title, children }: ToolbarButtonProps) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={getBtnClass(isActive, disabled)}
    title={title}
  >
    {children}
  </button>
));

ToolbarButton.displayName = 'ToolbarButton';

const Divider = () => (
  <div className="w-px h-5 bg-border/60 mx-1 hidden sm:block" />
);

const ToolbarGroup = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-0.5 flex-shrink-0">
    {children}
  </div>
);

export const Toolbar = ({ editor }: ToolbarProps) => {
  const [copied, setCopied] = useState(false);

  const {
    lineSpacing,
    paragraphSpacing,
    paragraphIndent,
    fontSize,
    increaseLineSpacing,
    decreaseLineSpacing,
    increaseParagraphSpacing,
    decreaseParagraphSpacing,
    increaseParagraphIndent,
    decreaseParagraphIndent,
    increaseFontSize,
    decreaseFontSize
  } = useEditorSettingsStore(state => ({
    lineSpacing: state.lineSpacing,
    paragraphSpacing: state.paragraphSpacing,
    paragraphIndent: state.paragraphIndent,
    fontSize: state.fontSize,
    increaseLineSpacing: state.increaseLineSpacing,
    decreaseLineSpacing: state.decreaseLineSpacing,
    increaseParagraphSpacing: state.increaseParagraphSpacing,
    decreaseParagraphSpacing: state.decreaseParagraphSpacing,
    increaseParagraphIndent: state.increaseParagraphIndent,
    decreaseParagraphIndent: state.decreaseParagraphIndent,
    increaseFontSize: state.increaseFontSize,
    decreaseFontSize: state.decreaseFontSize
  }));

  const handleCopyAll = useCallback(async () => {
    if (!editor) return;
    
    const text = editor.getText();
    
    const fallbackCopy = (textToCopy: string): boolean => {
      const textArea = document.createElement('textarea');
      textArea.value = textToCopy;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      textArea.style.top = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      let success = false;
      try {
        success = document.execCommand('copy');
      } catch (err) {
        console.error('execCommand copy failed:', err);
      }
      
      document.body.removeChild(textArea);
      return success;
    };
    
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const success = fallbackCopy(text);
        if (!success) {
          throw new Error('复制失败：浏览器不支持复制功能');
        }
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  }, [editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-0.5 gap-y-1 p-2.5">
      <ToolbarGroup>
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          isActive={false}
          disabled={!editor.can().undo()}
          title="撤销 (Ctrl+Z)"
        >
          <Undo className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          isActive={false}
          disabled={!editor.can().redo()}
          title="重做 (Ctrl+Y)"
        >
          <Redo className="h-4 w-4" />
        </ToolbarButton>
      </ToolbarGroup>

      <Divider />

      <ToolbarGroup>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive('heading', { level: 1 })}
          title="标题 1"
        >
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
          title="标题 2"
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
      </ToolbarGroup>

      <Divider />

      <ToolbarGroup>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="粗体 (Ctrl+B)"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="斜体 (Ctrl+I)"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          title="删除线"
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          isActive={editor.isActive('code')}
          title="行内代码"
        >
          <Code className="h-4 w-4" />
        </ToolbarButton>
      </ToolbarGroup>

      <Divider />

      <ToolbarGroup>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="无序列表"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          title="有序列表"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive('blockquote')}
          title="引用"
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
      </ToolbarGroup>

      <Divider />

      <ToolbarGroup>
        <ToolbarButton
          onClick={decreaseLineSpacing}
          isActive={false}
          disabled={lineSpacing <= 1.0}
          title="减小行间距"
        >
          <Minus className="h-4 w-4" />
        </ToolbarButton>
        <div className="flex items-center justify-center min-w-[3rem] text-xs text-muted-foreground font-medium">
          {lineSpacing.toFixed(1)}
        </div>
        <ToolbarButton
          onClick={increaseLineSpacing}
          isActive={false}
          disabled={lineSpacing >= 3.0}
          title="增大行间距"
        >
          <Plus className="h-4 w-4" />
        </ToolbarButton>
      </ToolbarGroup>

      <Divider />

      <ToolbarGroup>
        <ToolbarButton
          onClick={decreaseParagraphSpacing}
          isActive={false}
          disabled={paragraphSpacing <= 0.2}
          title="减小段落间距"
        >
          <Minus className="h-4 w-4" />
        </ToolbarButton>
        <div className="flex items-center justify-center min-w-[3rem] text-xs text-muted-foreground font-medium">
          {paragraphSpacing.toFixed(1)}
        </div>
        <ToolbarButton
          onClick={increaseParagraphSpacing}
          isActive={false}
          disabled={paragraphSpacing >= 3.0}
          title="增大段落间距"
        >
          <Plus className="h-4 w-4" />
        </ToolbarButton>
      </ToolbarGroup>

      <Divider />

      <ToolbarGroup>
        <ToolbarButton
          onClick={decreaseParagraphIndent}
          isActive={false}
          disabled={paragraphIndent <= 0}
          title="减小段首缩进"
        >
          <Outdent className="h-4 w-4" />
        </ToolbarButton>
        <div className="flex items-center justify-center min-w-[3rem] text-xs text-muted-foreground font-medium">
          {paragraphIndent.toFixed(1)}em
        </div>
        <ToolbarButton
          onClick={increaseParagraphIndent}
          isActive={false}
          disabled={paragraphIndent >= 8.0}
          title="增大段首缩进"
        >
          <Indent className="h-4 w-4" />
        </ToolbarButton>
      </ToolbarGroup>

      <Divider />

      <ToolbarGroup>
        <ToolbarButton
          onClick={decreaseFontSize}
          isActive={false}
          disabled={fontSize <= 12}
          title="减小字号"
        >
          <Minus className="h-4 w-4" />
        </ToolbarButton>
        <div className="flex items-center justify-center min-w-[3rem] text-xs text-muted-foreground font-medium">
          {fontSize}px
        </div>
        <ToolbarButton
          onClick={increaseFontSize}
          isActive={false}
          disabled={fontSize >= 36}
          title="增大字号"
        >
          <Plus className="h-4 w-4" />
        </ToolbarButton>
      </ToolbarGroup>

      <Divider />

      <ToolbarGroup>
        <ToolbarButton
          onClick={handleCopyAll}
          isActive={copied}
          title={copied ? '已复制' : '复制全部内容'}
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </ToolbarButton>
      </ToolbarGroup>
    </div>
  );
};
