# DirectoryTree 目录树功能设计文档

## 1. 功能概述

DirectoryTree 是 LocalScribe 项目的核心组件之一，用于展示和管理写作项目的层级结构。它采用**卷(Volume) → 幕(Act) → 章节(Note)**的三级树形结构，支持拖拽排序、展开/收起、增删改查等完整操作。

### 1.1 核心特性

| 特性 | 说明 |
|------|------|
| **三级层级结构** | 卷(Volume) → 幕(Act) → 章节(Note) |
| **拖拽排序** | 支持同层级节点间的拖拽排序（长按1.5秒触发） |
| **展开/收起** | 点击文件夹图标或节点可展开/收起子节点 |
| **快捷操作** | 悬停显示操作按钮：新建、重命名、删除 |
| **选中高亮** | 当前选中章节高亮显示 |
| **缩进引导线** | 子节点左侧显示视觉引导线 |
| **动画效果** | 展开/收起、拖拽、悬停均有平滑过渡动画 |

---

## 2. 数据模型设计

### 2.1 后端数据模型

#### 2.1.1 数据库模型 (Folder)

```python
# backend/app/models/folder.py

class Folder(Base):
    __tablename__ = "folders"
    
    id: Mapped[str]              # UUID 主键
    name: Mapped[str]            # 卷名或幕名
    type: Mapped[FolderType]     # volume(卷) 或 act(幕)
    parent_id: Mapped[str]       # 父文件夹ID（卷为null，幕指向卷）
    project_id: Mapped[str]      # 所属项目ID
    order: Mapped[int]           # 排序序号
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]
    
    # 关系
    children: Mapped[List["Folder"]]  # 子文件夹（卷包含幕）
    parent: Mapped[Optional["Folder"]] # 父文件夹
    notes: Mapped[List["Note"]]       # 包含的章节
```

**层级规则：**
- **卷(Volume)**: 位于根目录，`parent_id = null`
- **幕(Act)**: 必须属于某个卷，`parent_id = 卷ID`

#### 2.1.2 API Schema (Pydantic)

```python
# backend/app/schemas/directory.py

class VolumeNode(BaseModel):
    type: Literal["volume"] = "volume"
    id: str
    name: str
    order: int
    children: List["ActNode"] = []

class ActNode(BaseModel):
    type: Literal["act"] = "act"
    id: str
    name: str
    order: int
    children: List["NoteNode"] = []

class NoteNode(BaseModel):
    type: Literal["note"] = "note"
    id: str
    title: str           # 章节用 title
    order: int
    created_at: datetime
    word_count: int = 0
```

### 2.2 前端类型定义

```typescript
// frontend/src/types/index.ts

type VolumeNode = components['schemas']['VolumeNode'];
type ActNode = components['schemas']['ActNode'];
type NoteNode = components['schemas']['NoteNode'];

export type TreeNodeType = VolumeNode | ActNode | NoteNode;
```

---

## 3. 后端实现

### 3.1 目录树构建服务

```python
# backend/app/services/directory_service.py

class DirectoryService:
    @staticmethod
    def build_tree(project_id: str, db: Session) -> List[VolumeNode]:
        """根据项目 ID 构建目录树（优化版：减少数据库查询次数）"""
        
        # 1. 批量查询所有文件夹和章节
        folders = db.query(Folder).filter(...).order_by(Folder.order).all()
        notes = db.query(Note).filter(...).order_by(Note.order).all()
        
        # 2. 构建映射表
        volume_map = {}  # 卷ID -> VolumeNode
        act_map = {}     # 幕ID -> ActNode
        
        # 3. 组装层级关系
        # - 幕归入卷
        # - 章节归入幕
        # - 返回根级卷列表
        
        return root_volumes
```

**性能优化：**
- 仅2次数据库查询（folders + notes）
- 内存中组装树结构
- 使用字典映射实现O(1)查找

### 3.2 API 路由

#### 3.2.1 获取目录树

```python
# backend/app/api/v1/projects.py

@router.get("/{project_id}/tree", response_model=DirectoryTree)
def get_project_tree(project_id: str, db: Session = Depends(get_db)):
    """获取项目的目录树结构"""
    tree = DirectoryService.build_tree(project_id, db)
    return tree
```

#### 3.2.2 文件夹操作

```python
# backend/app/api/v1/folders.py

@router.post("/", response_model=FolderResponse)
def create_folder(folder_in: FolderCreate, db: Session = Depends(get_db)):
    """创建文件夹（卷/幕）"""

@router.put("/{folder_id}", response_model=FolderResponse)
def update_folder(folder_id: str, folder_in: FolderUpdate, db: Session = Depends(get_db)):
    """更新文件夹（重命名）"""

@router.put("/{folder_id}/move")
def move_folder(folder_id: str, request: MoveFolderRequest, db: Session = Depends(get_db)):
    """移动/排序文件夹"""
    # 业务规则校验：
    # - 卷不能移动到非根目录
    # - 不能移动到自己下面

@router.delete("/{folder_id}")
def delete_folder(folder_id: str, db: Session = Depends(get_db)):
    """删除文件夹（级联删除子项）"""
```

---

## 4. 前端实现

### 4.1 组件架构

```
DirectoryTree/
├── DirectoryTree.tsx    # 主容器组件（DndContext）
├── TreeNode.tsx         # 树节点组件（递归渲染）
└── index.ts             # 导出
```

### 4.2 DirectoryTree 组件

**职责：**
- 提供 DndContext 拖拽上下文
- 管理拖拽状态
- 处理拖拽结束逻辑
- 渲染顶层卷列表

```typescript
// frontend/src/components/DirectoryTree/DirectoryTree.tsx

interface DirectoryTreeProps {
  projectId: string;
  selectedNoteId?: string;
  onSelectNote: (id: string, title: string) => void;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
}

export const DirectoryTree = ({
  projectId,
  selectedNoteId,
  onSelectNote,
  expandedIds,
  onToggle
}: DirectoryTreeProps) => {
  // 使用 React Query 获取目录树
  const { data: tree, isLoading, error } = useDirectoryTree(projectId);
  
  // 拖拽相关 hooks
  const sensors = useSensors(
    useSensor(PointerSensor, { 
      activationConstraint: { delay: 1500, tolerance: 5 }  // 长按1.5秒触发
    }),
    useSensor(KeyboardSensor)
  );
  
  // 查找节点信息（用于拖拽排序）
  const findNodeInfo = (nodes, targetId, parentId, parentType) => {
    // 递归查找节点及其父级信息
  };
  
  // 处理拖拽结束
  const handleDragEnd = (event: DragEndEvent) => {
    // 根据节点类型调用不同的移动 API
    // - volume -> useMoveFolder
    // - act -> useMoveFolder
    // - note -> useMoveNote
  };
  
  // 渲染加载/空状态/树结构
};
```

### 4.3 TreeNode 组件

**职责：**
- 渲染单个节点（卷/幕/章节）
- 处理展开/收起
- 处理选中
- 显示操作按钮（新建、重命名、删除）
- 递归渲染子节点
- 支持拖拽排序

```typescript
// frontend/src/components/DirectoryTree/TreeNode.tsx

interface TreeNodeProps {
  node: TreeNodeType;
  level: number;                    // 层级深度（用于缩进）
  isExpanded: boolean;
  isSelected: boolean;
  onToggle: (id: string) => void;
  onSelect: (node: TreeNodeType) => void;
  expandedIds?: Set<string>;
  onNoteDeleted?: (noteId: string) => void;
}

export const TreeNode = ({
  node, level, isExpanded, isSelected, onToggle, onSelect, expandedIds, onNoteDeleted
}: TreeNodeProps) => {
  // 拖拽排序 hook
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = 
    useSortable({ id: node.id });
  
  // 编辑状态
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  
  // 删除确认状态
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Mutations
  const updateFolderMutation = useUpdateFolder();
  const deleteFolderMutation = useDeleteFolder();
  const deleteNoteMutation = useDeleteNote();
  const updateNoteMutation = useUpdateNote();
  
  // 根据节点类型返回不同图标
  const getIcon = () => {
    if (node.type === 'note') return <FileText ... />;
    if (node.type === 'volume') return isExpanded ? <BookOpen ... /> : <Folder ... />;
    return isExpanded ? <FolderOpen ... /> : <Scroll ... />;
  };
  
  // 处理新建幕/章节
  const handleCreateAct = (volumeId: string) => { ... };
  const handleCreateNote = (actId: string) => { ... };
  
  // 处理重命名
  const handleStartEdit = () => { ... };
  const handleSaveEdit = () => { ... };
  
  // 处理删除
  const handleDelete = () => { ... };
  const handleConfirmDelete = () => { ... };
  
  // 递归渲染子节点
  return (
    <div ref={setNodeRef} style={style}>
      {/* 节点内容 */}
      <div className={...} onClick={handleClick} {...attributes} {...listeners}>
        {/* 展开图标、节点图标、名称、操作按钮 */}
      </div>
      
      {/* 子节点列表 */}
      {isExpanded && hasChildren && (
        <SortableContext items={childIds}>
          <div className="relative">
            {/* 缩进引导线 */}
            <div className="absolute ... bg-border/40" />
            {children.map(child => (
              <TreeNode key={child.id} node={child} level={level + 1} ... />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  );
};
```

### 4.4 自定义 Hooks

#### useDirectory.ts

```typescript
// frontend/src/hooks/useDirectory.ts

// 获取目录树
export const useDirectoryTree = (projectId: string | undefined) => {
  return useQuery({
    queryKey: ['directory', projectId],
    queryFn: () => api.get<VolumeNode[]>(`/projects/${projectId}/tree`),
    enabled: !!projectId,
  });
};

// 创建文件夹
export const useCreateFolder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: FolderCreate) => api.post('/folders/', data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['directory', variables.project_id] 
      });
    },
  });
};

// 移动文件夹
export const useMoveFolder = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ folderId, data }) => api.put(`/folders/${folderId}/move`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['directory', projectId] });
    },
  });
};

// 删除文件夹
export const useDeleteFolder = () => { ... };

// 更新文件夹（重命名）
export const useUpdateFolder = () => { ... };
```

#### useNote.ts

```typescript
// frontend/src/hooks/useNote.ts

// 移动章节（用于拖拽排序）
export const useMoveNote = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ noteId, data }) => api.put(`/notes/${noteId}/move`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['directory', projectId] });
    },
  });
};

// 其他章节操作...
export const useUpdateNote = (projectId: string) => { ... };
export const useDeleteNote = (projectId: string) => { ... };
export const useCreateNote = (projectId: string) => { ... };
```

---

## 5. UI 设计规范

### 5.1 视觉层次

| 层级 | 缩进 | 字体 | 图标 |
|------|------|------|------|
| **卷(Volume)** | 0px | font-medium | BookOpen/Folder (Primary色) |
| **幕(Act)** | 14px | font-medium | FolderOpen/Scroll (Accent色) |
| **章节(Note)** | 28px | font-serif | FileText (Muted色) |

### 5.2 交互状态

#### 5.2.1 节点悬停
```
默认: hover:bg-accent/10 hover:text-accent-foreground
选中: bg-accent/20 text-accent-foreground font-medium shadow-sm
```

#### 5.2.2 操作按钮
```
默认: opacity-0 group-hover:opacity-100
位置: absolute right-1 top-1/2 -translate-y-1/2
背景: bg-inherit shadow-[-8px_0_8px_rgba(0,0,0,0.05)]
```

#### 5.2.3 展开/收起动画
```css
/* 箭头旋转 */
transition-transform duration-200
isExpanded ? 'rotate-90' : 'rotate-0'

/* 子节点滑入 */
animate-in slide-in-from-top-2 fade-in duration-300 ease-out
animationDelay: `${index * 30}ms`
```

#### 5.2.4 拖拽状态
```
拖拽中: opacity: 0.4, zIndex: 100
拖拽遮罩: bg-card border border-border/50 shadow-xl rounded-lg
```

### 5.3 空状态

```
图标: Library (h-12 w-12 opacity-30) + Sparkles装饰
标题: 书架空空如也
提示: 点击上方 + 按钮添加新卷
```

### 5.4 加载状态

```
图标: Loader2 (animate-spin text-primary) + 光晕效果
文字: 整理书架上...
```

---

## 6. 业务逻辑

### 6.1 层级约束

| 操作 | 约束规则 |
|------|----------|
| **创建卷** | 只能在根目录创建 |
| **创建幕** | 必须选择父卷 |
| **创建章节** | 必须选择父幕 |
| **移动卷** | 只能在根目录内排序，不能成为子节点 |
| **移动幕** | 只能在同卷内排序，或移动到其他卷下 |
| **移动章节** | 只能在同幕内排序，或移动到其他幕下 |

### 6.2 删除逻辑

- **删除卷**: 级联删除其下所有幕和章节
- **删除幕**: 级联删除其下所有章节
- **删除章节**: 
  - 软删除（进入回收站）
  - 自动切换到上一章或下一章

### 6.3 排序算法

```python
# 简单重排算法（腾出空位法）

# 1. 找到目标位置及之后的同级文件夹
affected_siblings = query.filter(Folder.order >= new_order).all()

# 2. 将他们的 order + 1
for sib in affected_siblings:
    sib.order += 1

# 3. 设置当前文件夹的新顺序
folder.order = new_order
```

---

## 7. 数据流

```
┌─────────────────────────────────────────────────────────────┐
│                         用户操作                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    DirectoryTree 组件                        │
│  - 管理 expandedIds 状态（展开/收起）                        │
│  - 处理 onSelectNote 回调                                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                     TreeNode 组件                            │
│  - 渲染节点 UI                                               │
│  - 处理本地交互（编辑状态、删除确认）                        │
│  - 调用 Mutations                                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   React Query Hooks                          │
│  useDirectoryTree / useCreateFolder / useMoveFolder ...     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                      API 请求                                │
│  GET /projects/{id}/tree                                     │
│  POST /folders/                                              │
│  PUT /folders/{id}/move                                      │
│  DELETE /folders/{id}                                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    后端服务层                                │
│  DirectoryService.build_tree()                               │
│  Folder CRUD 操作                                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                      数据库                                  │
│  folders 表 / notes 表                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. 文件清单

### 8.1 前端文件

| 文件路径 | 说明 |
|----------|------|
| `frontend/src/components/DirectoryTree/DirectoryTree.tsx` | 目录树主组件 |
| `frontend/src/components/DirectoryTree/TreeNode.tsx` | 树节点组件 |
| `frontend/src/components/DirectoryTree/index.ts` | 组件导出 |
| `frontend/src/hooks/useDirectory.ts` | 文件夹相关 Hooks |
| `frontend/src/hooks/useNote.ts` | 章节相关 Hooks |
| `frontend/src/types/index.ts` | 类型定义 |

### 8.2 后端文件

| 文件路径 | 说明 |
|----------|------|
| `backend/app/models/folder.py` | Folder 数据模型 |
| `backend/app/schemas/directory.py` | 目录树 Schema |
| `backend/app/services/directory_service.py` | 目录树构建服务 |
| `backend/app/api/v1/projects.py` | 项目 API（含获取目录树） |
| `backend/app/api/v1/folders.py` | 文件夹 API |

---

## 9. 依赖库

### 9.1 前端依赖

```json
{
  "@dnd-kit/core": "^6.x",      // 拖拽核心
  "@dnd-kit/sortable": "^8.x",  // 排序拖拽
  "@dnd-kit/utilities": "^3.x", // 拖拽工具
  "@tanstack/react-query": "^5.x", // 数据获取
  "lucide-react": "^0.x",       // 图标库
  "sonner": "^1.x"              // Toast 通知
}
```

### 9.2 后端依赖

```python
# 核心依赖已在项目中
fastapi
sqlalchemy
pydantic
```

---

## 10. 使用示例

### 10.1 基础用法

```tsx
import { DirectoryTree } from '@/components/DirectoryTree';

function EditorPage() {
  const [selectedNoteId, setSelectedNoteId] = useState<string>();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  
  const handleToggle = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  
  return (
    <DirectoryTree
      projectId="project-123"
      selectedNoteId={selectedNoteId}
      onSelectNote={(id, title) => setSelectedNoteId(id)}
      expandedIds={expandedIds}
      onToggle={handleToggle}
    />
  );
}
```

---

## 11. 注意事项

1. **拖拽触发**: 需要长按1.5秒才能触发拖拽，防止误操作
2. **层级限制**: 卷不能成为子节点，幕必须属于卷
3. **级联删除**: 删除卷/幕会级联删除其下所有内容
4. **缓存刷新**: 所有修改操作成功后都会刷新目录树缓存
5. **性能优化**: 目录树构建使用批量查询，避免N+1问题
