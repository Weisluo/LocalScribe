# Modals 模态框功能设计文档

## 一、功能概述

Modals 模块提供了 LocalScribe 应用中的弹窗交互功能，主要用于：
- 创建项目（Project）
- 创建卷（Volume）
- 创建幕（Act）
- 创建章节（Note）
- 删除项目确认

## 二、UI 效果设计

### 2.1 基础模态框组件 (Modal)

**文件位置**: `frontend/src/components/Modals/Modal.tsx`

#### 视觉设计

| 属性 | 值 | 说明 |
|------|-----|------|
| 遮罩层 | `bg-black/50 backdrop-blur-sm` | 半透明黑色背景 + 毛玻璃效果 |
| 弹窗容器 | `bg-background border border-border rounded-lg shadow-lg` | 主题背景色、边框、圆角、阴影 |
| 最大宽度 | `max-w-md` (448px) | 中等尺寸弹窗 |
| 最大高度 | `max-h-[85vh]` | 视口高度的85% |
| 圆角 | `rounded-lg` (8px) | 标准圆角 |
| 动画时长 | 200ms | 打开/关闭过渡动画 |

#### 动画效果

**打开动画**:
1. 遮罩层：透明度从 0 → 100%
2. 弹窗容器：透明度从 0 → 100%，缩放从 0.95 → 1.0
3. 内容区域：透明度从 0 → 100%，位移从 4px → 0

**关闭动画**:
- 与打开动画相反，延迟 200ms 后卸载组件

#### 交互特性

| 特性 | 实现方式 | 说明 |
|------|----------|------|
| 点击遮罩关闭 | `onClick={onClose}` | 点击背景遮罩层关闭弹窗 |
| ESC 键关闭 | `keydown` 事件监听 | 按下 Escape 键关闭弹窗 |
| 焦点管理 | 自动聚焦第一个输入框 | 打开时聚焦到第一个可交互元素 |
| 焦点陷阱 | Tab 键循环 | Shift+Tab 在焦点元素间循环 |
| 焦点恢复 | 关闭后恢复之前焦点 | 记录打开前的焦点元素 |

#### 无障碍支持 (A11y)

```
role="dialog"           // 对话框角色
aria-modal="true"       // 模态对话框标记
aria-labelledby="modal-title"  // 标题关联
aria-label="关闭对话框"  // 关闭按钮标签
```

### 2.2 创建/删除弹窗 (CreateItemModal)

**文件位置**: `frontend/src/components/Modals/CreateItemModal.tsx`

#### 弹窗类型与样式

| 类型 | 标题 | 占位符 | 模式 |
|------|------|--------|------|
| `project` | 新建项目 | 项目名称 | 创建 |
| `volume` | 新建卷 | 第一卷：初入江湖 | 创建 |
| `act` | 新建幕 | 第一幕：风起 | 创建 |
| `note` | 新建章节 | 第一章：启程 | 创建 |
| `delete-project` | 删除项目 | - | 删除确认 |

#### 创建模式 UI

```
┌─────────────────────────────────────┐
│  新建项目                    [×]    │  ← 标题栏（左标题，右关闭按钮）
├─────────────────────────────────────┤
│                                     │
│  名称                               │  ← 标签
│  ┌─────────────────────────────┐   │
│  │ 项目名称                    │   │  ← 输入框（自动聚焦）
│  └─────────────────────────────┘   │
│                                     │
│              [取消]  [确认]         │  ← 操作按钮（右对齐）
│                                     │
└─────────────────────────────────────┘
```

**输入框样式**:
- 边框: `border border-input rounded-md`
- 背景: `bg-background`
- 聚焦: `focus:outline-none focus:ring-2 focus:ring-ring`
- 内边距: `px-3 py-2`

**按钮样式**:
- 取消按钮: `hover:bg-accent transition-colors`
- 确认按钮: `bg-primary text-primary-foreground hover:bg-primary/90`
- 禁用状态: `disabled:opacity-50`
- 加载状态: 显示旋转的 `Loader2` 图标

#### 删除确认模式 UI

```
┌─────────────────────────────────────┐
│  删除项目                    [×]    │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐   │
│  │ ⚠️ 确定要删除项目「xxx」吗？ │   │  ← 警告提示框
│  │ 此操作不可恢复...            │   │
│  └─────────────────────────────┘   │
│                                     │
│              [取消]  [确认删除]     │  ← 删除按钮使用破坏性配色
└─────────────────────────────────────┘
```

**警告框样式**:
- 背景: `bg-destructive/10`
- 边框: `border border-destructive/20`
- 图标: `AlertTriangle` 组件，颜色 `text-destructive`
- 删除按钮: `bg-destructive text-destructive-foreground`

## 三、前端代码实现

### 3.1 文件结构

```
frontend/src/components/Modals/
├── index.ts              # 模块导出
├── Modal.tsx             # 基础模态框组件
└── CreateItemModal.tsx   # 创建/删除弹窗组件
```

### 3.2 基础模态框组件 (Modal.tsx)

#### Props 接口

```typescript
interface ModalProps {
  isOpen: boolean;           // 控制显示/隐藏
  onClose: () => void;       // 关闭回调
  title: string;             // 弹窗标题
  children: React.ReactNode; // 内容插槽
}
```

#### 核心实现逻辑

**1. 动画状态管理**
```typescript
const [isVisible, setIsVisible] = useState(false);      // 控制动画状态
const [shouldRender, setShouldRender] = useState(false); // 控制组件挂载
```

**2. 打开流程**
```
isOpen = true
  ↓
setShouldRender(true)     // 挂载组件
  ↓
requestAnimationFrame
  ↓
setIsVisible(true)        // 触发动画（透明度、缩放）
  ↓
聚焦第一个输入框/元素
```

**3. 关闭流程**
```
isOpen = false
  ↓
setIsVisible(false)       // 触发动画（淡出、缩小）
  ↓
setTimeout(200ms)
  ↓
setShouldRender(false)    // 卸载组件
  ↓
恢复之前的焦点元素
```

**4. 焦点管理实现**
```typescript
// 可聚焦元素选择器
const FOCUSABLE_ELEMENTS = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

// Tab 键循环陷阱
const handleTab = (e: KeyboardEvent) => {
  const focusableElements = getFocusableElements();
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  
  if (e.shiftKey && document.activeElement === firstElement) {
    e.preventDefault();
    lastElement.focus();  // Shift+Tab 在第一个元素时跳到最后
  } else if (document.activeElement === lastElement) {
    e.preventDefault();
    firstElement.focus();  // Tab 在最后一个元素时跳到第一个
  }
};
```

### 3.3 创建弹窗组件 (CreateItemModal.tsx)

#### 依赖的 Store

**UI Store** (`frontend/src/stores/uiStore.ts`):
```typescript
type ModalType = 'project' | 'volume' | 'act' | 'note' | 'delete-project' | null;

interface UIState {
  modalType: ModalType;
  modalParentId: string | null;  // 父级ID：创建卷时为projectId，创建幕时为volumeId，创建章节时为actId
  newlyCreatedNoteId: string | null;
  openModal: (type: Exclude<ModalType, null>, parentId?: string | null) => void;
  closeModal: () => void;
  setNewlyCreatedNoteId: (noteId: string | null) => void;
}
```

**Project Store** (`frontend/src/stores/projectStore.ts`):
```typescript
interface ProjectState {
  currentProjectId: string;
  setCurrentProjectId: (id: string) => void;
}
```

#### 数据流

```
用户操作（如点击"新建项目"）
  ↓
uiStore.openModal('project')
  ↓
CreateItemModal 渲染（modalType = 'project'）
  ↓
用户输入标题，点击确认
  ↓
createMutation.mutate({ title })
  ↓
API 请求：POST /projects
  ↓
onSuccess：
  - closeModal()
  - invalidateQueries(['projects'])
  - setCurrentProjectId(newId)
```

#### API 调用映射

| 弹窗类型 | HTTP 方法 | 端点 | 请求体 |
|----------|-----------|------|--------|
| project | POST | `/projects` | `{ title }` |
| volume | POST | `/folders` | `{ name, project_id, type: 'volume', parent_id: null }` |
| act | POST | `/folders` | `{ name, project_id, type: 'act', parent_id }` |
| note | POST | `/notes` | `{ title, project_id, folder_id, order: 0 }` |
| delete-project | DELETE | `/projects/{id}` | - |

#### 表单验证逻辑

```typescript
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  
  // 删除模式
  if (isDeleteMode) {
    deleteMutation.mutate();
    return;
  }
  
  // 验证标题非空
  if (!title.trim()) return;
  
  // 幕和章节需要父级ID
  if ((modalType === 'act' || modalType === 'note') && !modalParentId) {
    toast.warning('请先选择父级');
    return;
  }
  
  // 非项目类型需要当前项目
  if (modalType !== 'project' && !currentProjectId) {
    toast.warning('请先选择或创建项目');
    return;
  }
  
  createMutation.mutate({ title });
};
```

## 四、后端代码实现

### 4.1 API 端点

#### 项目相关 (`backend/app/api/v1/projects.py`)

```python
# 获取项目列表
GET    /api/v1/projects

# 创建项目（自动创建默认卷和幕）
POST   /api/v1/projects
Body: { "title": "string", "genre"?: [...], "description"?: "string", "cover"?: "string" }

# 获取单个项目
GET    /api/v1/projects/{project_id}

# 更新项目
PUT    /api/v1/projects/{project_id}
Body: { "title"?: "string", ... }

# 删除项目
DELETE /api/v1/projects/{project_id}

# 获取项目目录树
GET    /api/v1/projects/{project_id}/tree
```

**创建项目特殊逻辑**:
```python
def create_project(project_in: ProjectCreate, db: Session):
    # 1. 创建项目
    db_project = Project(**project_in.model_dump())
    db.add(db_project)
    db.flush()  # 获取项目ID
    
    # 2. 自动创建默认卷
    volume = Folder(name="第一卷", type=FolderType.volume, ...)
    db.add(volume)
    db.flush()  # 获取卷ID
    
    # 3. 自动创建默认幕
    act = Folder(name="第一幕", type=FolderType.act, parent_id=volume.id, ...)
    db.add(act)
    
    db.commit()
    return db_project
```

#### 文件夹相关 (`backend/app/api/v1/folders.py`)

```python
# 获取项目下所有文件夹
GET    /api/v1/folders?project_id={id}

# 创建文件夹
POST   /api/v1/folders
Body: { 
  "name": "string", 
  "type": "volume" | "act", 
  "project_id": "string",
  "parent_id"?: "string",
  "order"?: number 
}

# 更新文件夹
PUT    /api/v1/folders/{folder_id}
Body: { "name"?: "string", "parent_id"?: "string" }

# 移动/排序文件夹
PUT    /api/v1/folders/{folder_id}/move
Body: { "target_parent_id"?: "string", "new_order": number }

# 删除文件夹
DELETE /api/v1/folders/{folder_id}
```

**移动/排序业务规则**:
```python
def move_folder(folder_id: str, request: MoveFolderRequest, db: Session):
    folder = db.query(Folder).filter(Folder.id == folder_id).first()
    
    # 业务规则校验
    if folder.type == "volume" and new_parent_id is not None:
        raise HTTPException(400, "卷只能位于根目录下")
    
    if folder.id == new_parent_id:
        raise HTTPException(400, "不能将文件夹移动到自己内部")
    
    # 排序逻辑：将目标位置及之后的同级文件夹 order + 1
    affected_siblings = query.filter(Folder.order >= request.new_order).all()
    for sib in affected_siblings:
        sib.order += 1
    
    folder.order = request.new_order
    db.commit()
```

#### 章节相关 (`backend/app/api/v1/notes.py`)

```python
# 获取章节列表
GET    /api/v1/notes?folder_id={id}&project_id={id}&include_deleted={bool}

# 获取已删除章节（回收站）
GET    /api/v1/notes/deleted?project_id={id}

# 获取单个章节
GET    /api/v1/notes/{note_id}

# 创建章节
POST   /api/v1/notes
Body: { 
  "title": "string",
  "content"?: "string",
  "folder_id": "string",
  "project_id": "string",
  "order"?: number,
  "tags"?: [...],
  "status"?: "draft" | "revising" | "completed"
}

# 更新章节
PUT    /api/v1/notes/{note_id}
Body: { "title"?: "string", "content"?: "string", ... }

# 删除章节（软删除/永久删除）
DELETE /api/v1/notes/{note_id}?permanent={bool}

# 批量删除
POST   /api/v1/notes/batch-delete
Body: { "ids": [...] }

# 复制章节
POST   /api/v1/notes/{note_id}/copy

# 移动章节
PUT    /api/v1/notes/{note_id}/move
Body: { "target_folder_id": "string", "new_order": number }

# 恢复已删除章节
POST   /api/v1/notes/{note_id}/restore
Body: { "folder_id"?: "string" }
```

### 4.2 数据模型

#### 项目模型 (`backend/app/schemas/project.py`)

```python
class ProjectBase(BaseModel):
    title: str
    genre: Optional[List[str]] = None
    description: Optional[str] = None
    cover: Optional[str] = None

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    genre: Optional[List[str]] = None
    description: Optional[str] = None
    cover: Optional[str] = None

class ProjectResponse(ProjectBase):
    id: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
```

#### 文件夹模型 (`backend/app/schemas/folder.py`)

```python
class FolderType(str, Enum):
    volume = "volume"
    act = "act"

class FolderBase(BaseModel):
    name: str
    type: FolderType
    parent_id: Optional[str] = None

class FolderCreate(FolderBase):
    project_id: str
    order: Optional[int] = 0

class FolderUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[str] = None

class FolderResponse(FolderBase):
    id: str
    project_id: str
    order: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
```

#### 章节模型 (`backend/app/schemas/note.py`)

```python
class NoteStatus(str, Enum):
    draft = "draft"
    revising = "revising"
    completed = "completed"

class NoteBase(BaseModel):
    title: str
    content: Optional[str] = ""
    tags: Optional[List[str]] = None
    status: Optional[NoteStatus] = NoteStatus.draft

class NoteCreate(NoteBase):
    folder_id: str
    project_id: str
    order: Optional[int] = 0

class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    folder_id: Optional[str] = None
    tags: Optional[List[str]] = None
    status: Optional[NoteStatus] = None

class NoteResponse(NoteBase):
    id: str
    folder_id: str
    project_id: str
    order: int
    word_count: Optional[int] = 0
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)
```

## 五、业务逻辑说明

### 5.1 创建流程

#### 创建项目
```
1. 用户点击"新建项目"
2. 弹出 Modal，输入项目名称
3. 调用 POST /projects
4. 后端自动创建：项目 + 默认卷"第一卷" + 默认幕"第一幕"
5. 前端自动切换到新项目
6. 刷新项目列表
```

#### 创建卷
```
1. 用户选择项目后，点击"新建卷"
2. 弹出 Modal，输入卷名称
3. 调用 POST /folders
   Body: { name, project_id, type: 'volume', parent_id: null }
4. 刷新目录树
```

#### 创建幕
```
1. 用户选择卷后，点击"新建幕"
2. 弹出 Modal，输入幕名称
3. 调用 POST /folders
   Body: { name, project_id, type: 'act', parent_id: volumeId }
4. 刷新目录树
```

#### 创建章节
```
1. 用户选择幕后，点击"新建章节"
2. 弹出 Modal，输入章节标题
3. 调用 POST /notes
   Body: { title, project_id, folder_id: actId, order: 0 }
4. 刷新目录树
5. 自动选中新创建的章节
```

### 5.2 删除流程

#### 删除项目
```
1. 用户点击"删除项目"
2. 弹出确认 Modal，显示项目名称和警告信息
3. 用户点击"确认删除"
4. 调用 DELETE /projects/{id}
5. 级联删除：项目下的所有卷、幕、章节（数据库级联）
6. 切换到其他项目或清空当前项目
7. 刷新项目列表
```

### 5.3 状态管理

#### 弹窗状态 (UI Store)
```typescript
// 打开弹窗
openModal('note', actId)  // 类型 + 父级ID

// 状态变化
modalType = 'note'
modalParentId = actId

// 关闭弹窗
closeModal()

// 状态变化
modalType = null
modalParentId = null
```

#### 数据缓存 (React Query)
```typescript
// 项目列表缓存
queryKey: ['projects']
staleTime: 5 * 60 * 1000  // 5分钟

// 目录树缓存
queryKey: ['directory', currentProjectId]

// 创建成功后刷新
queryClient.invalidateQueries({ queryKey: ['directory', currentProjectId] })
```

### 5.4 错误处理

| 错误场景 | 处理方式 |
|----------|----------|
| 网络错误 | `toast.error('操作失败，请重试')` |
| 标题为空 | 禁用确认按钮 `disabled={!title.trim()}` |
| 未选择父级 | `toast.warning('请先选择父级')` |
| 未选择项目 | `toast.warning('请先选择或创建项目')` |

### 5.5 加载状态

```typescript
// 创建/删除操作中
<button disabled={mutation.isPending}>
  {mutation.isPending && <Loader2 className="animate-spin" />}
  确认
</button>
```

## 六、使用示例

### 6.1 打开创建项目弹窗

```typescript
import { useUIStore } from '@/stores/uiStore';

const { openModal } = useUIStore();

// 在按钮点击事件中
<button onClick={() => openModal('project')}>
  新建项目
</button>
```

### 6.2 打开创建章节弹窗

```typescript
import { useUIStore } from '@/stores/uiStore';

const { openModal } = useUIStore();
const currentActId = 'act-123';

// 在按钮点击事件中
<button onClick={() => openModal('note', currentActId)}>
  新建章节
</button>
```

### 6.3 在页面中使用 CreateItemModal

```typescript
import { CreateItemModal } from '@/components/Modals';

function EditorPage() {
  return (
    <div>
      {/* 页面内容 */}
      
      {/* 弹窗组件 - 自动根据 store 状态显示 */}
      <CreateItemModal />
    </div>
  );
}
```

## 七、扩展指南

### 7.1 添加新的弹窗类型

1. **在 UI Store 中添加类型**:
```typescript
export type ModalType = 'project' | 'volume' | 'act' | 'note' | 'delete-project' | 'new-type' | null;
```

2. **在 CreateItemModal 中添加处理逻辑**:
```typescript
} else if (modalType === 'new-type') {
  modalTitle = '新类型';
  placeholder = '占位符文本';
}
```

3. **添加对应的 API 调用**:
```typescript
} else if (modalType === 'new-type') {
  return api.post('/new-endpoint', { ... });
}
```

### 7.2 自定义 Modal 内容

直接使用基础 Modal 组件：

```typescript
import { Modal } from '@/components/Modals';

function CustomModal() {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <Modal 
      isOpen={isOpen} 
      onClose={() => setIsOpen(false)} 
      title="自定义标题"
    >
      {/* 自定义内容 */}
    </Modal>
  );
}
```

## 八、技术依赖

### 前端依赖

| 包名 | 用途 |
|------|------|
| `react` | 核心框架 |
| `zustand` | 状态管理 |
| `@tanstack/react-query` | 数据获取与缓存 |
| `lucide-react` | 图标库 |
| `sonner` | Toast 通知 |
| `tailwindcss` | 样式框架 |

### 后端依赖

| 包名 | 用途 |
|------|------|
| `fastapi` | Web 框架 |
| `sqlalchemy` | ORM |
| `pydantic` | 数据验证 |
| `alembic` | 数据库迁移 |
