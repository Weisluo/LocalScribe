# 回收站功能文档

## 功能概述

回收站功能允许用户查看和管理已删除的笔记，支持软删除和永久删除两种模式。用户可以在回收站中恢复误删的笔记，或者永久删除不再需要的笔记。

## 路由配置

### 前端路由

在 [App.tsx](file:///home/weizl/code/LocalScribe/frontend/src/App.tsx) 中配置：

```tsx
<Route path="/trash" element={<TrashPage />} />
```

支持两种使用模式：
1. **独立页面模式**：通过 `/trash` 路由直接访问
2. **嵌入模式**：在 [EditorPage](file:///home/weizl/code/LocalScribe/frontend/src/pages/EditorPage/EditorPage.tsx) 中作为编辑器区域的替换内容显示

## UI 设计

### 页面布局

回收站页面采用简洁的列表/卡片混合布局，包含以下区域：

#### 1. 操作工具栏

位于页面顶部，包含以下功能按钮：

| 按钮 | 功能 | 状态 |
|------|------|------|
| 全选/取消全选 | 切换所有笔记的选中状态 | 始终可用 |
| 刷新 | 重新获取回收站数据 | 始终可用 |
| 视图切换 | 在缩略视图和详细视图之间切换 | 始终可用 |
| 恢复选中 | 恢复选中的笔记 | 有选中项时可用 |
| 永久删除 | 永久删除选中的笔记 | 有选中项时可用 |
| 清空回收站 | 一键清空所有笔记 | 回收站非空时可用 |

#### 2. 视图模式

##### 缩略视图（Compact）

- 列表布局，每行显示一个笔记
- 显示：复选框、文件图标、标题、删除时间、字数
- 悬停显示操作按钮（恢复、删除）
- 入场动画：`slide-in-from-left-4 fade-in`

##### 详细视图（Detailed）

- 卡片网格布局（响应式：1-3列）
- 显示：复选框、标题、删除时间、字数、内容预览（最多300字符）
- 底部固定操作栏
- 入场动画：`slide-in-from-bottom-4 fade-in zoom-in-95`

#### 3. 空状态

当回收站为空时显示：
- 大图标（Trash2）
- 标题："回收站为空"
- 描述："暂无已删除的笔记"

#### 4. 确认对话框

执行永久删除或清空回收站时弹出：
- 警告图标（AlertTriangle）
- 操作标题
- 确认信息（显示影响的项目数量）
- 取消和确认按钮

### 视觉样式

#### 颜色方案

- **主色调**：`bg-primary` / `text-primary-foreground` - 用于恢复按钮
- **危险色**：`bg-destructive` / `text-destructive-foreground` - 用于删除按钮
- **选中状态**：`bg-accent/10 border-accent/30` - 选中项高亮
- **背景**：`bg-background` / `bg-card` / `bg-muted/30`

#### 动画效果

- 列表项入场：延迟递增的淡入滑动动画
- 悬停效果：`hover:border-accent/20 hover:shadow-sm`
- 按钮过渡：`transition-colors duration-200`

## 前端实现

### 组件结构

```
TrashPage
├── 操作工具栏（条件渲染）
│   ├── 左侧：全选按钮 + 状态文本
│   └── 右侧：刷新、视图切换、恢复、删除、清空
├── 内容区域
│   ├── 加载状态
│   ├── 空状态
│   ├── 缩略视图（列表）
│   └── 详细视图（卡片网格）
└── 确认对话框（条件渲染）
```

### 核心状态

```tsx
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
const [showConfirmClear, setShowConfirmClear] = useState(false);
const [viewMode, setViewMode] = useState<'compact' | 'detailed'>('compact');
const [isClearAllMode, setIsClearAllMode] = useState(false);
```

### API 调用

使用 React Query 进行数据获取和缓存：

```tsx
// 获取已删除笔记
const { data: deletedNotes, isLoading, refetch } = useQuery({
  queryKey: ['deletedNotes', currentProjectId],
  queryFn: () => api.get<NoteResponse[]>(`/notes/deleted?project_id=${currentProjectId}`),
  enabled: !!currentProjectId,
});

// 恢复单个笔记
const restoreMutation = useMutation({
  mutationFn: (noteId: string) => api.post(`/notes/${noteId}/restore`),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['deletedNotes', currentProjectId] });
    queryClient.invalidateQueries({ queryKey: ['directory', currentProjectId] });
  },
});

// 批量恢复
const batchRestoreMutation = useMutation({
  mutationFn: (ids: string[]) => api.post('/notes/batch-restore', { ids }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['deletedNotes', currentProjectId] });
    queryClient.invalidateQueries({ queryKey: ['directory', currentProjectId] });
    setSelectedIds(new Set());
  },
});

// 永久删除单个笔记
const permanentDeleteMutation = useMutation({
  mutationFn: (noteId: string) => api.delete(`/notes/${noteId}`, { params: { permanent: true } }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['deletedNotes', currentProjectId] });
  },
});

// 批量永久删除
const batchPermanentDeleteMutation = useMutation({
  mutationFn: (ids: string[]) => api.post('/notes/batch-delete', { ids }, { params: { permanent: true } }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['deletedNotes', currentProjectId] });
    setSelectedIds(new Set());
  },
});
```

### 工具函数

```tsx
// 日期格式化
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// 提取纯文本（移除 HTML 标签）
const extractPlainText = (html: string | null | undefined, maxLength: number = 200) => {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const text = tmp.textContent || tmp.innerText || '';
  return text.trim().length > maxLength 
    ? text.trim().substring(0, maxLength) + '...' 
    : text.trim();
};
```

### Props 接口

```tsx
interface TrashPageProps {
  embedded?: boolean; // 是否为嵌入模式（替换编辑区域）
}
```

## 后端实现

### 数据模型

在 [note.py](file:///home/weizl/code/LocalScribe/backend/app/models/note.py) 中定义：

```python
class Note(Base):
    __tablename__ = "notes"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String(255), nullable=False, comment="章节标题")
    content: Mapped[str] = mapped_column(Text, nullable=False, default="", comment="章节内容")
    folder_id: Mapped[str] = mapped_column(String(36), ForeignKey("folders.id"), nullable=False, index=True)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id"), nullable=False, index=True)
    order: Mapped[int] = mapped_column(Integer, default=0, index=True, comment="排序序号")
    tags: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True, comment="标签")
    word_count: Mapped[Optional[int]] = mapped_column(Integer, default=0, comment="字数")
    status: Mapped[NoteStatus] = mapped_column(SA_Enum(NoteStatus), default=NoteStatus.draft, index=True, comment="状态")
    deleted_at: Mapped[Optional[datetime]] = mapped_column(nullable=True, index=True, comment="删除时间")
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index('ix_notes_folder_order', 'folder_id', 'order'),
        Index('ix_notes_project_deleted', 'project_id', 'deleted_at'),
    )
```

**关键字段说明**：
- `deleted_at`: 软删除标记，为 `None` 表示未删除，有值表示删除时间
- `ix_notes_project_deleted`: 复合索引，优化按项目查询已删除笔记的性能

### API 端点

在 [notes.py](file:///home/weizl/code/LocalScribe/backend/app/api/v1/notes.py) 中实现：

#### 1. 获取已删除笔记列表

```python
@router.get("/deleted", response_model=List[NoteResponse])
def get_deleted_notes(project_id: str, db: Session = Depends(get_db)):
    """获取回收站中的笔记列表（按项目筛选）"""
    return db.query(Note).filter(
        and_(
            Note.deleted_at.isnot(None),
            Note.project_id == project_id
        )
    ).all()
```

**请求参数**：
- `project_id` (query): 项目ID，必填

**响应**：`List[NoteResponse]` - 已删除笔记列表

#### 2. 恢复单个笔记

```python
@router.post("/{note_id}/restore", response_model=NoteResponse)
def restore_note(note_id: str, request: Optional[RestoreNoteRequest] = None, db: Session = Depends(get_db)):
    """恢复已删除的笔记"""
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    if not note.deleted_at:
        raise HTTPException(status_code=400, detail="Note is not deleted")
    
    # 清除删除标记
    note.deleted_at = None
    
    # 如果指定了新的文件夹，更新文件夹 ID
    if request and request.folder_id:
        note.folder_id = request.folder_id
    
    db.commit()
    db.refresh(note)
    return note
```

**请求体**（可选）：
```json
{
  "folder_id": "string"  // 恢复时指定的目标文件夹，不传则使用原文件夹
}
```

#### 3. 批量恢复笔记

```python
@router.post("/batch-restore")
def batch_restore_notes(request: BatchDeleteRequest, db: Session = Depends(get_db)):
    """批量恢复已删除的笔记"""
    if not request.ids:
        return {"success": True, "restored_count": 0}
    
    restored_count = db.query(Note).filter(
        Note.id.in_(request.ids),
        Note.deleted_at.isnot(None)
    ).update({
        "deleted_at": None
    }, synchronize_session=False)
    
    db.commit()
    return {"success": True, "restored_count": restored_count}
```

**请求体**：
```json
{
  "ids": ["note-id-1", "note-id-2"]
}
```

**响应**：
```json
{
  "success": true,
  "restored_count": 2
}
```

#### 4. 删除笔记（支持永久删除）

```python
@router.delete("/{note_id}")
def delete_note(note_id: str, permanent: bool = False, db: Session = Depends(get_db)):
    """删除单个章节（软删除或永久删除）"""
    db_note = db.query(Note).filter(Note.id == note_id).first()
    if not db_note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    if permanent:
        db.delete(db_note)
    else:
        if db_note.deleted_at is None:
            db_note.deleted_at = datetime.utcnow()
    
    db.commit()
    return {"success": True}
```

**查询参数**：
- `permanent` (bool): 是否永久删除，默认 `false`（软删除）

#### 5. 批量删除笔记

```python
@router.post("/batch-delete")
def batch_delete_notes(request: BatchDeleteRequest, permanent: bool = False, db: Session = Depends(get_db)):
    """批量删除章节（软删除或永久删除）"""
    if not request.ids:
        return {"success": True, "deleted_count": 0}
    
    if permanent:
        # 永久删除
        deleted_count = db.query(Note).filter(Note.id.in_(request.ids)).delete(synchronize_session=False)
    else:
        # 软删除：只处理未删除的记录
        result = db.query(Note).filter(
            Note.id.in_(request.ids),
            Note.deleted_at.is_(None)
        ).update({
            "deleted_at": datetime.utcnow()
        }, synchronize_session=False)
        deleted_count = result.rowcount
    
    db.commit()
    return {"success": True, "deleted_count": deleted_count}
```

### Schema 定义

在 [note.py](file:///home/weizl/code/LocalScribe/backend/app/schemas/note.py) 中定义：

```python
class NoteResponse(NoteBase):
    id: str
    folder_id: str
    project_id: str
    order: int
    word_count: Optional[int] = 0
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None  # 包含删除时间字段

    model_config = ConfigDict(from_attributes=True)

class BatchDeleteRequest(BaseModel):
    ids: List[str]

class RestoreNoteRequest(BaseModel):
    folder_id: Optional[str] = None  # 恢复时指定的目标文件夹
```

## 业务逻辑

### 软删除机制

1. **删除操作**：设置 `deleted_at` 字段为当前 UTC 时间，而非物理删除
2. **查询过滤**：普通查询默认排除 `deleted_at IS NOT NULL` 的记录
3. **恢复操作**：将 `deleted_at` 置为 `NULL`
4. **永久删除**：物理删除数据库记录

### 数据流

```
用户删除笔记
    ↓
软删除（设置 deleted_at）
    ↓
笔记从正常列表消失，进入回收站
    ↓
用户在回收站中操作：
    ├─ 恢复 → 清除 deleted_at → 回到原位置
    └─ 永久删除 → 物理删除记录
```

### 状态管理

#### 前端状态

| 状态 | 类型 | 说明 |
|------|------|------|
| `selectedIds` | `Set<string>` | 当前选中的笔记ID集合 |
| `showConfirmClear` | `boolean` | 是否显示确认对话框 |
| `viewMode` | `'compact' \| 'detailed'` | 当前视图模式 |
| `isClearAllMode` | `boolean` | 是否为清空全部模式 |

#### 缓存策略

使用 React Query 的 `queryClient.invalidateQueries` 在操作成功后刷新相关数据：

- `['deletedNotes', projectId]` - 回收站列表
- `['directory', projectId]` - 目录树（恢复后需要更新）

### 批量操作逻辑

#### 全选/取消全选

```tsx
const handleSelectAll = () => {
  if (!deletedNotes) return;
  if (selectedIds.size === deletedNotes.length) {
    setSelectedIds(new Set());  // 取消全选
  } else {
    setSelectedIds(new Set(deletedNotes.map(note => note.id)));  // 全选
  }
};
```

#### 清空回收站

```tsx
const handleClearAll = () => {
  if (!deletedNotes || deletedNotes.length === 0) return;
  setIsClearAllMode(true);
  setSelectedIds(new Set(deletedNotes.map(note => note.id)));  // 选中所有
  setShowConfirmClear(true);  // 显示确认对话框
};
```

### 权限控制

- 必须选择项目才能查看回收站（`enabled: !!currentProjectId`）
- 恢复和删除按钮在没有选中项时禁用
- 永久删除操作需要二次确认

## 接口汇总

### 前端组件

| 文件 | 说明 |
|------|------|
| [TrashPage.tsx](file:///home/weizl/code/LocalScribe/frontend/src/pages/TrashPage.tsx) | 回收站页面主组件 |
| [App.tsx](file:///home/weizl/code/LocalScribe/frontend/src/App.tsx) | 路由配置 |
| [EditorPage.tsx](file:///home/weizl/code/LocalScribe/frontend/src/pages/EditorPage/EditorPage.tsx) | 嵌入模式使用 |

### 后端接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/notes/deleted?project_id={id}` | 获取已删除笔记列表 |
| POST | `/api/v1/notes/{id}/restore` | 恢复单个笔记 |
| POST | `/api/v1/notes/batch-restore` | 批量恢复笔记 |
| DELETE | `/api/v1/notes/{id}?permanent=true` | 永久删除单个笔记 |
| POST | `/api/v1/notes/batch-delete?permanent=true` | 批量永久删除笔记 |

### 数据模型

| 文件 | 说明 |
|------|------|
| [note.py (model)](file:///home/weizl/code/LocalScribe/backend/app/models/note.py) | Note 数据模型 |
| [note.py (schema)](file:///home/weizl/code/LocalScribe/backend/app/schemas/note.py) | Note Schema 定义 |
| [notes.py (api)](file:///home/weizl/code/LocalScribe/backend/app/api/v1/notes.py) | API 路由实现 |

## 使用示例

### 作为独立页面

访问 `/trash` 路由，显示完整的回收站页面。

### 嵌入编辑器

在 EditorPage 中使用：

```tsx
import { TrashPage } from '@/pages/TrashPage';

// 在编辑器区域条件渲染
{showTrash ? (
  <TrashPage embedded={true} />
) : (
  <Editor />
)}
```

### API 调用示例

```typescript
// 获取已删除笔记
const deletedNotes = await api.get('/notes/deleted?project_id=xxx');

// 恢复笔记
await api.post(`/notes/${noteId}/restore`);

// 批量恢复
await api.post('/notes/batch-restore', { ids: [id1, id2] });

// 永久删除
await api.delete(`/notes/${noteId}`, { params: { permanent: true } });

// 批量永久删除
await api.post('/notes/batch-delete', { ids: [id1, id2] }, { params: { permanent: true } });
```