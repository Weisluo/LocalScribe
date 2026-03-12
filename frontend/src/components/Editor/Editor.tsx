import { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Toolbar } from './Toolbar';
import { ChevronDown, ChevronUp } from 'lucide-react';

// 定义 Props 接口：接收内容和变化回调
interface EditorProps {
  content: string;          // 从父组件接收的内容
  onChange: (html: string) => void; // 内容变化时通知父组件
}

export const Editor = ({ content, onChange }: EditorProps) => {
  // 工具栏显示状态
  const [isToolbarVisible, setIsToolbarVisible] = useState(true);

  // 初始化编辑器
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: { depth: 50 },
      }),
      Placeholder.configure({
        placeholder: '开始书写你的故事...',
      }),
    ],
    content: content || '', // 确保即使 content 为空也能正常初始化
    editable: true,         // 确保可编辑
    onUpdate: ({ editor }) => {
      // 当编辑器更新时，调用父组件传递的 onChange
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        // 这里的样式确保内容区域美观且可编辑
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[500px]',
      },
    },
  });

  // 同步外部 content 变化
  // 当父组件的 content 变化时（例如切换了笔记，或 AI 修改了内容），更新编辑器
  useEffect(() => {
    // 只有当 editor 已初始化，且外部 content 与编辑器内部 content 不一致时才更新
    // 避免光标跳动和死循环
    if (editor && !editor.isFocused && content !== editor.getHTML()) {
      editor.commands.setContent(content, false);
    }
  }, [content, editor]);

  // 如果编辑器还没准备好
  if (!editor) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-muted-foreground">加载编辑器中...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background overflow-hidden">
      {/* 编辑器主体区域 - 可滚动，内容居中 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[800px] mx-auto py-8 px-4">
          <EditorContent editor={editor} />
        </div>
      </div>
      
      {/* 底部工具栏容器 - 固定在编辑器底部 */}
      <div className="border-t border-border bg-muted/30 flex-shrink-0">
        {/* 折叠/展开按钮 */}
        <button
          onClick={() => setIsToolbarVisible(!isToolbarVisible)}
          className="w-full flex items-center justify-center py-1 hover:bg-accent transition-colors text-muted-foreground"
        >
          {isToolbarVisible ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </button>
        
        {/* 工具栏内容 */}
       {isToolbarVisible && <Toolbar editor={editor} />}
     </div>
   </div>
 );
};