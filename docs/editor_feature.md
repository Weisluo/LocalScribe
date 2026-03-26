# 编辑器功能文档

## 1. 功能概述

编辑器是 LocalScribe 的核心功能模块，提供富文本编辑、自动保存、排版设置等功能，支持用户进行小说创作和笔记记录。

## 2. UI 效果

### 2.1 整体布局

```
┌─────────────────────────────────────────────────────────────┐
│  LocalScribe Editor                                          │
├──────────────┬──────────────────────────────┬───────────────┤
│              │                              │               │
│  目录树       │      编辑区域                 │   状态栏       │
│  (左侧栏)     │      (中间主区域)             │   (右侧栏上部)  │
│              │                              │   - 保存状态    │
│  - 卷/幕/章节 │      ┌──────────────┐        │   - 日期时间    │
│              │      │   标题输入框   │        │   - 字数统计    │
│              │      │   (居中显示)   │        │               │
│              │      └──────────────┘        ├───────────────┤
│              │      ┌──────────────────┐    │               │
│              │      │   纸张效果容器     │    │   AI 助手      │
│              │      │   ┌────────────┐   │    │   (右侧栏下部)  │
│              │      │   │            │   │    │               │
│              │      │   │  富文本内容 │   │    │   可拖拽调整    │
│              │      │   │            │   │    │   宽度 25-50%  │
│              │      │   │ 打字机提示  │   │    │               │
│              │      │   │ (空时显示)  │   │    │               │
│              │      │   └────────────┘   │    │               │
│              │      │                  │    │               │
│              │      └──────────────────┘    │               │
│              │                              │               │
│              │      [底部 50vh 占位区域]      │               │
│              │      (让最后一行可滚动到视口)   │               │
│              │                              │               │
├──────────────┴──────────────────────────────┼───────────────┤
│  ▲ 折叠/展开  │  撤销 │ 重做 │ H1 │ H2 │ B │ I │ 行间距 │ ... │
│              │  复制全部 │ 字号 │ 段落间距 │ 缩进 │           │
└──────────────┴──────────────────────────────┴───────────────┘
```

### 2.2 视觉设计特点

1. **纸张效果容器**
   - 圆角卡片设计 (`rounded-xl`)
   - 背景色使用 `bg-card`
   - 最小高度 600px
   - 优雅的内边距 (`px-8 py-6`)

2. **标题栏**
   - 位于纸张效果容器上方
   - 居中显示的标题输入框
   - 无边框设计，聚焦时显示底部边框
   - 衬线字体 (`font-serif`)

3. **打字机效果占位符**
   - 当编辑器为空时显示
   - 使用 `TextTypeLoop` 组件实现循环打字效果
   - 淡灰色文字 (`text-muted-foreground/30`)
   - 斜体衬线字体

4. **加载状态**
   - 羽毛图标动画 (`animate-pulse`)
   - 模糊光晕背景效果
   - 循环打字提示文字

5. **右侧栏状态面板**
   - 保存状态指示器（保存中/已保存）
   - 日期时间按钮（可展开日历）
   - 统计卡片网格（当前章节 + 全书统计）
   - 渐变背景 + 毛玻璃效果

6. **底部工具栏**
   - 可折叠设计
   - 渐变背景 (`bg-gradient-to-t`)
   - 毛玻璃效果 (`backdrop-blur-sm`)

## 3. 前端代码实现

### 3.1 核心组件结构

```
frontend/src/components/Editor/
├── Editor.tsx              # 主编辑器组件
├── Toolbar.tsx             # 底部工具栏
├── index.ts                # 组件导出
└── extensions/
    └── TypewriterPlaceholder.ts  # 打字机占位符扩展
```

### 3.2 Editor.tsx - 主编辑器组件

**核心功能：**
- 基于 TipTap 的富文本编辑
- 自动滚动定位（打字机模式）
- 内容同步与程序化更新
- 加载状态展示

**关键 Props：**
```typescript
interface EditorProps {
  content: string;        // 初始内容 (HTML)
  onChange: (html: string) => void;  // 内容变化回调
  noteId?: string;        // 当前笔记ID（用于切换检测）
}
```

**主要 State：**
```typescript
const [isToolbarVisible, setIsToolbarVisible] = useState(true);
```

**Refs：**
```typescript
const scrollContainerRef = useRef<HTMLDivElement>(null);  // 滚动容器
const isProgrammaticUpdateRef = useRef(false);            // 程序化更新标记
const prevNoteIdRef = useRef<string | undefined>();       // 上一个笔记ID
```

**TipTap 编辑器配置：**
```typescript
const editor = useEditor({
  extensions: [
    StarterKit.configure({
      history: { depth: 50 },  // 历史记录深度
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
  // ... 其他配置
});
```

**自动滚动逻辑（打字机模式）：**
```typescript
onTransaction: ({ editor, transaction }) => {
  if (isProgrammaticUpdateRef.current) return;
  if (!editor.isFocused || !scrollContainerRef.current) return;
  
  const shouldHandleScroll = transaction.docChanged || transaction.selectionSet;
  if (!shouldHandleScroll) return;
  
  setTimeout(() => {
    // 计算光标位置，滚动到容器 3/4 处
    const coords = editor.view.coordsAtPos($head.pos);
    const containerRect = scrollContainerRef.current!.getBoundingClientRect();
    const targetPosition = containerHeight * (3 / 4);
    // ... 滚动逻辑
  }, 10);
}
```

**内容同步 Effect：**
```typescript
useEffect(() => {
  if (!editor) return;
  
  const isNoteChanged = noteId !== prevNoteIdRef.current;
  const normalizedPropContent = normalizeHtml(content);
  const normalizedEditorContent = normalizeHtml(editor.getHTML());
  const hasContentChanged = normalizedPropContent !== normalizedEditorContent;
  
  if (hasContentChanged) {
    if (isNoteChanged) {
      // 笔记切换：程序化更新，重置滚动到顶部
      isProgrammaticUpdateRef.current = true;
      editor.commands.setContent(content, false);
      editor.commands.blur();
      setTimeout(() => {
        scrollContainerRef.current!.scrollTop = 0;
        isProgrammaticUpdateRef.current = false;
      }, 100);
    } else if (!editor.isFocused) {
      // 非聚焦状态下的外部更新
      isProgrammaticUpdateRef.current = true;
      editor.commands.setContent(content, false);
      setTimeout(() => isProgrammaticUpdateRef.current = false, 0);
    }
  }
  
  prevNoteIdRef.current = noteId;
}, [content, editor, noteId]);
```

### 3.3 Toolbar.tsx - 工具栏组件

**功能分组：**

| 分组 | 功能 | 图标 |
|------|------|------|
| 历史 | 撤销、重做 | Undo, Redo |
| 标题 | 标题1、标题2 | Heading1, Heading2 |
| 格式 | 粗体、斜体、删除线、行内代码 | Bold, Italic, Strikethrough, Code |
| 列表 | 无序列表、有序列表、引用 | List, ListOrdered, Quote |
| 行间距 | 减小、当前值、增大 | Minus, Plus |
| 段落间距 | 减小、当前值、增大 | Minus, Plus |
| 缩进 | 减小、当前值、增大 | Outdent, Indent |
| 字号 | 减小、当前值、增大 | Minus, Plus |
| 操作 | 复制全部内容 | Copy, Check |

**排版设置范围：**
```typescript
// 行间距: 1.0 - 3.0 (步长 0.2)
// 段落间距: 0.2 - 3.0 (步长 0.2)
// 段首缩进: 0 - 8.0em (步长 0.5)
// 字号: 12 - 36px (步长 2)
```

**复制全部功能：**
```typescript
const handleCopyAll = useCallback(async () => {
  if (!editor) return;
  const text = editor.getText();
  
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      // 降级方案：使用 execCommand
      const success = fallbackCopy(text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  } catch (err) {
    console.error('复制失败:', err);
  }
}, [editor]);
```

### 3.4 状态管理

**editorSettingsStore.ts - 编辑器设置状态：**
```typescript
interface EditorSettingsState {
  lineSpacing: number;        // 行间距 (默认 1.8)
  paragraphSpacing: number;   // 段落间距 (默认 1.0)
  paragraphIndent: number;    // 段首缩进 (默认 2.0em)
  fontSize: number;           // 字号 (默认 18px)
  
  // 操作方法
  increaseLineSpacing: () => void;
  decreaseLineSpacing: () => void;
  // ... 其他操作方法
}

// 使用 zustand + persist 持久化到 localStorage
export const useEditorSettingsStore = create<EditorSettingsState>()(
  persist(
    (set, get) => ({ ... }),
    { name: 'editor-settings-storage' }
  )
);
```

### 3.5 自定义 Hooks

**useAutoSave.ts - 自动保存：**
```typescript
interface AutoSaveOptions {
  data: { title: string; content: string };
  onSave: (data: { title: string; content: string }) => void;
  delay?: number;  // 默认 800ms
}

export const useAutoSave = ({ data, onSave, delay = 800 }: AutoSaveOptions) => {
  const debouncedData = useDebounce(data, delay);
  const isFirstRun = useRef(true);
  const lastSavedDataRef = useRef(data);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      lastSavedDataRef.current = data;
      return;
    }

    // 只有当防抖后的数据与上次保存的数据不同时才触发
    if (debouncedData.title !== lastSavedDataRef.current.title ||
        debouncedData.content !== lastSavedDataRef.current.content) {
      if (debouncedData.title || debouncedData.content) {
        onSave(debouncedData);
        lastSavedDataRef.current = debouncedData;
      }
    }
  }, [debouncedData, onSave]);
};
```

**useDebounce.ts - 防抖：**
```typescript
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}
```

### 3.6 打字机效果组件

**TextType.tsx - 文字打字效果：**
```typescript
interface TextTypeProps {
  text: string;
  speed?: number;           // 打字速度 (默认 50ms)
  deleteSpeed?: number;     // 删除速度 (默认 30ms)
  cursor?: boolean;         // 是否显示光标
  cursorChar?: string;      // 光标字符 (默认 '|')
  repeat?: boolean;         // 是否循环
  repeatDelay?: number;     // 循环间隔
  onComplete?: () => void;  // 完成回调
}

// TextTypeLoop - 多文本循环打字
interface TextTypeLoopProps {
  texts: string[];          // 文本数组
  pauseDuration?: number;   // 文本间暂停时间
}
```

## 4. 后端代码实现

### 4.1 数据模型

**Note 模型 (backend/app/models/note.py)：**
```python
class NoteStatus(str, Enum):
    draft = "draft"
    revising = "revising"
    completed = "completed"

class Note(Base):
    __tablename__ = "notes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String(255), nullable=False)  # 章节标题
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")  # 章节内容
    
    folder_id: Mapped[str] = mapped_column(String(36), ForeignKey("folders.id"), nullable=False)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id"), nullable=False)
    
    order: Mapped[int] = mapped_column(Integer, default=0)  # 排序序号
    tags: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True)  # 标签
    word_count: Mapped[Optional[int]] = mapped_column(Integer, default=0)  # 字数
    status: Mapped[NoteStatus] = mapped_column(SA_Enum(NoteStatus), default=NoteStatus.draft)
    
    deleted_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)  # 软删除标记
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow)
```

### 4.2 API 接口

**基础 CRUD (backend/app/api/v1/notes.py)：**

| 方法 | 路径 | 功能 | 参数 |
|------|------|------|------|
| GET | `/notes/` | 获取章节列表 | folder_id, project_id, include_deleted |
| GET | `/notes/deleted` | 获取已删除章节 | project_id |
| GET | `/notes/{note_id}` | 获取单个章节 | - |
| POST | `/notes/` | 创建章节 | NoteCreate |
| PUT | `/notes/{note_id}` | 更新章节 | NoteUpdate |
| DELETE | `/notes/{note_id}` | 删除章节 | permanent (是否永久删除) |

**高级功能：**

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/notes/batch-delete` | 批量删除 |
| POST | `/notes/{note_id}/copy` | 复制章节 |
| PUT | `/notes/{note_id}/move` | 移动/排序 |
| POST | `/notes/{note_id}/restore` | 恢复删除 |
| POST | `/notes/batch-restore` | 批量恢复 |

**更新章节时自动计算字数：**
```python
@router.put("/{note_id}", response_model=NoteResponse)
def update_note(note_id: str, note_in: NoteUpdate, db: Session = Depends(get_db)):
    db_note = db.query(Note).filter(Note.id == note_id).first()
    if not db_note:
        raise HTTPException(status_code=404, detail="Note not found")

    update_data = note_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_note, key, value)

    # 自动计算字数
    if "content" in update_data and update_data["content"] is not None:
        import re
        text = re.sub(r'<[^>]+>', '', update_data["content"])  # 去除 HTML 标签
        db_note.word_count = len(text)

    db.commit()
    db.refresh(db_note)
    return db_note
```

### 4.3 React Query Hooks

**useNote.ts - 笔记数据管理：**
```typescript
// 获取单个笔记
export const useNote = (noteId: string | undefined) => {
  return useQuery({
    queryKey: ['note', noteId],
    queryFn: () => api.get<NoteResponse>(`/notes/${noteId}`),
    enabled: !!noteId,
  });
};

// 更新笔记
export const useUpdateNote = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ noteId, data }: { noteId: string; data: NoteUpdate }) =>
      api.put<NoteResponse>(`/notes/${noteId}`, data),
    onSuccess: (updatedNote) => {
      queryClient.setQueryData(['note', updatedNote.id], updatedNote);
      queryClient.invalidateQueries({ queryKey: ['directory', projectId] });
    },
  });
};

// 创建笔记
export const useCreateNote = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { folder_id: string; title: string }) =>
      api.post<NoteResponse>('/notes', { ...data, project_id: projectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['directory', projectId] });
    },
  });
};
```

## 5. 业务逻辑

### 5.1 自动保存流程

```
用户输入
    ↓
Editor.onChange 触发 → 更新 noteContent state
    ↓
useAutoSave 监听数据变化
    ↓
useDebounce 防抖 800ms
    ↓
数据变化且非首次运行
    ↓
调用 handleSave → 调用 updateNoteMutation.mutate
    ↓
API 请求 PUT /notes/{note_id}
    ↓
后端更新数据库 + 计算字数
    ↓
前端缓存更新 + 目录树刷新
```

### 5.2 笔记切换流程

```
用户点击目录树中的笔记
    ↓
handleSelectNote 执行
    ↓
保存当前笔记（如果有变更且超过 500ms）
    ↓
setSelectedNoteId 更新选中ID
    ↓
useNote Hook 触发新请求
    ↓
Editor useEffect 检测到 noteId 变化
    ↓
程序化更新编辑器内容
    ↓
重置滚动位置到顶部
    ↓
blur 编辑器避免焦点问题
```

### 5.3 打字机滚动模式

**触发条件：**
- 编辑器处于聚焦状态
- 发生文档变化或选区变化
- 非程序化更新

**滚动逻辑：**
1. 获取光标在视口的坐标位置
2. 计算相对于滚动容器的位置
3. 如果光标在容器高度的 3/4 下方，向上滚动使光标位于 3/4 处
4. 如果光标在容器顶部上方（被遮挡），向上滚动显示光标

**目的：** 让用户始终在当前输入行的上方有一定预览空间，类似传统打字机效果。

### 5.4 排版设置应用

**CSS 变量传递：**
```typescript
editorProps: {
  attributes: {
    style: `
      font-size: ${fontSize}px;
      line-height: ${lineSpacing};
      --paragraph-spacing: ${paragraphSpacing}em;
      --paragraph-indent: ${paragraphIndent}em;
    `,
  },
}
```

**全局样式 (Tailwind)：**
```css
/* 段落间距 */
.ProseMirror p {
  margin-bottom: var(--paragraph-spacing);
}

/* 段首缩进 */
.ProseMirror p {
  text-indent: var(--paragraph-indent);
}
```

## 6. 文件依赖关系

```
EditorPage.tsx
    ├── DirectoryTree (左侧目录)
    ├── Editor (中间编辑区)
    │     ├── Toolbar (底部工具栏)
    │     │     └── useEditorSettingsStore
    │     ├── TextTypeLoop (打字机效果)
    │     └── TipTap Editor
    ├── AIChat (右侧AI助手)
    └── 各类 Modals

useNote.ts
    ├── useQuery (获取笔记)
    ├── useMutation (更新/创建/删除)
    └── api (请求工具)

useAutoSave.ts
    ├── useDebounce
    └── useEffect (监听保存)
```

## 7. 技术栈

| 类别 | 技术 |
|------|------|
| 编辑器框架 | TipTap (ProseMirror) |
| 状态管理 | Zustand + persist |
| 数据获取 | React Query (TanStack Query) |
| HTTP 客户端 | Axios |
| UI 组件 | Radix UI |
| 样式 | Tailwind CSS |
| 图标 | Lucide React |
| 后端框架 | FastAPI |
| ORM | SQLAlchemy |
| 数据库 | SQLite |
