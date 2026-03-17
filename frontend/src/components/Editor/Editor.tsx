import { useEffect, useState, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Toolbar } from './Toolbar';
import { ChevronDown, ChevronUp, Feather } from 'lucide-react';
import { useEditorSettingsStore } from '../../stores/editorSettingsStore';
import { TextTypeLoop } from '@/components/TextType';

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

interface EditorProps {
  content: string;
  onChange: (html: string) => void;
  noteId?: string;
}

export const Editor = ({ content, onChange, noteId }: EditorProps) => {
  const [isToolbarVisible, setIsToolbarVisible] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isProgrammaticUpdateRef = useRef(false);
  const prevNoteIdRef = useRef<string | undefined>();
  const { lineSpacing, paragraphSpacing, paragraphIndent, fontSize } = useEditorSettingsStore();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: { depth: 50 },
      }),
      Placeholder.configure({
        placeholder: '',
      }),
    ],
    content: content || '',
    editable: true,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onTransaction: ({ editor, transaction }) => {
      // 跳过程序化更新
      if (isProgrammaticUpdateRef.current) return;
      
      // 只在编辑器聚焦时处理滚动
      if (!editor.isFocused || !scrollContainerRef.current) return;
      
      // 处理用户输入（文档变化）或选区变化的 transaction
      const shouldHandleScroll = transaction.docChanged || transaction.selectionSet;
      if (!shouldHandleScroll) return;
      
      // 使用 setTimeout 确保 DOM 已更新（特别是输入换行后）
      setTimeout(() => {
        if (!scrollContainerRef.current || !editor.isFocused) return;
        
        const { selection } = editor.state;
        const { $head } = selection;
        
        // 获取光标位置的坐标（相对于视口）
        const coords = editor.view.coordsAtPos($head.pos);
        const containerRect = scrollContainerRef.current.getBoundingClientRect();
        const containerHeight = containerRect.height;
        const currentScrollTop = scrollContainerRef.current.scrollTop;
        
        // 计算光标相对于容器的位置
        const cursorRelativeToContainer = coords.top - containerRect.top;
        
        // 目标位置：容器高度的 3/4 处
        const targetPosition = containerHeight * (3 / 4);
        
        // 如果光标在目标位置下方，将光标定位到 3/4 处
        if (cursorRelativeToContainer > targetPosition) {
          // 需要滚动的距离 = 当前滚动位置 + (光标相对位置 - 目标位置)
          const newScrollTop = currentScrollTop + (cursorRelativeToContainer - targetPosition);
          scrollContainerRef.current!.scrollTo({
            top: newScrollTop,
            behavior: 'smooth'
          });
        }
        // 如果光标在容器顶部上方（被遮挡），向上滚动
        else if (cursorRelativeToContainer < 50) {
          const newScrollTop = currentScrollTop + (cursorRelativeToContainer - targetPosition);
          scrollContainerRef.current!.scrollTo({
            top: newScrollTop,
            behavior: 'smooth'
          });
        }
      }, 10);
    },
    editorProps: {
      attributes: {
        class: 'prose max-w-none focus:outline-none min-h-[500px] px-8 py-6',
        style: `font-size: ${fontSize}px; line-height: ${lineSpacing}; --paragraph-spacing: ${paragraphSpacing}em; --paragraph-indent: ${paragraphIndent}em;`,
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    
    const isNoteChanged = noteId !== prevNoteIdRef.current;
    const normalizedPropContent = normalizeHtml(content);
    const normalizedEditorContent = normalizeHtml(editor.getHTML());
    const hasContentChanged = normalizedPropContent !== normalizedEditorContent;
    
    if (hasContentChanged) {
      if (isNoteChanged) {
        isProgrammaticUpdateRef.current = true;
        editor.commands.setContent(content, false);
        editor.commands.blur();
        // 延迟重置滚动，确保内容渲染完成
        setTimeout(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
          }
          isProgrammaticUpdateRef.current = false;
        }, 100);
      } else if (!editor.isFocused) {
        isProgrammaticUpdateRef.current = true;
        editor.commands.setContent(content, false);
        setTimeout(() => {
          isProgrammaticUpdateRef.current = false;
        }, 0);
      }
    } else if (isNoteChanged && scrollContainerRef.current) {
      // 内容未变化但 noteId 变化时，仍需重置滚动
      scrollContainerRef.current.scrollTop = 0;
    }
    
    prevNoteIdRef.current = noteId;
  }, [content, editor, noteId]);

  if (!editor) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <div className="relative">
            <Feather className="h-10 w-10 animate-pulse" />
            <div className="absolute inset-0 blur-xl bg-accent/30 rounded-full" />
          </div>
          <div className="text-center">
            <span className="text-sm font-medium block mb-2">准备纸笔</span>
            <span className="text-xs opacity-60 h-4 block">
              <TextTypeLoop
                texts={[
                  '正在准备创作环境...',
                  '灵感即将涌现...',
                  '故事等待被书写...',
                ]}
                speed={50}
                deleteSpeed={35}
                pauseDuration={1500}
                cursorChar="|"
                cursorClassName="text-accent animate-pulse"
              />
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 检查编辑器是否为空
  const isEmpty = editor.isEmpty;

  return (
    <div className="flex-1 flex flex-col bg-background overflow-hidden">
      {/* 编辑器主体区域 */}
      <div className="flex-1 overflow-y-auto" ref={scrollContainerRef}>
        <div className="max-w-[850px] mx-auto py-10 px-6">
          {/* 纸张效果容器 */}
          <div className="editor-paper bg-card rounded-xl min-h-[600px] relative">
            <EditorContent editor={editor} />
            {/* 打字机效果的占位符提示 - 在编辑器内容区域内 */}
            {isEmpty && (
              <div 
                className="absolute pointer-events-none select-none"
                style={{ 
                  top: `${1.5 * fontSize}px`,
                  left: `${2 * fontSize + fontSize * paragraphIndent}px`,
                  right: `${2 * fontSize}px`,
                  fontSize: `${fontSize}px`,
                  lineHeight: lineSpacing,
                }}
              >
                <div className="text-muted-foreground/30 font-serif italic">
                  <TextTypeLoop
                    texts={[
                      '开始书写你的故事，让文字流淌...',
                      '每一个伟大的故事都始于第一句话...',
                      '记录下此刻的灵感，它可能改变一切...',
                      '文字是思想的载体，开始创作吧...',
                    ]}
                    speed={55}
                    deleteSpeed={35}
                    pauseDuration={2500}
                    cursorChar="▋"
                    cursorClassName="text-accent/40 animate-pulse"
                  />
                </div>
              </div>
            )}
          </div>
          {/* 底部占位区域，让最后一行可以滚动到视口 3/4 位置 */}
          <div className="h-[50vh]" />
        </div>
      </div>
      
      {/* 底部工具栏 */}
      <div className="border-t border-border/60 bg-gradient-to-t from-muted/40 to-muted/20 flex-shrink-0 backdrop-blur-sm">
        {/* 折叠/展开按钮 */}
        <button
          onClick={() => setIsToolbarVisible(!isToolbarVisible)}
          className="w-full flex items-center justify-center py-1.5 hover:bg-accent/50 transition-all duration-200 text-muted-foreground/70 hover:text-muted-foreground group"
        >
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-px bg-border group-hover:w-12 transition-all duration-300" />
            {isToolbarVisible ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" />
            )}
            <div className="w-8 h-px bg-border group-hover:w-12 transition-all duration-300" />
          </div>
        </button>
        
        {/* 工具栏内容 */}
        <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isToolbarVisible ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
          <Toolbar editor={editor} />
        </div>
      </div>
    </div>
  );
};
