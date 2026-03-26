# ProjectSwitcher 项目切换器功能文档

## 1. 功能概述

ProjectSwitcher 是 LocalScribe 的核心导航组件，用于在不同写作项目之间快速切换。它位于编辑器侧边栏顶部，提供直观的下拉选择界面，让用户能够方便地管理和切换当前工作项目。

### 1.1 核心特性

- **下拉选择交互**：点击展开项目列表，选择后自动切换
- **当前项目高亮**：选中项目带有视觉标识（左边框 + 背景色）
- **平滑动画**：展开/收起、选中项都有过渡动画
- **空状态处理**：无项目时自动隐藏组件
- **持久化状态**：当前项目 ID 保存到 localStorage，刷新后保持

## 2. UI 设计

### 2.1 整体布局

```
┌─────────────────────────────────────┐
│  当前项目名称              [▼]      │  ← Select.Trigger
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  项目 A  ◄────────────────────────  │  ← 选中项（高亮）
│  项目 B                             │
│  项目 C                             │  ← Select.Viewport
└─────────────────────────────────────┘
         Select.Content (Dropdown)
```

### 2.2 触发器 (Select.Trigger)

**样式规范**：

| 属性 | 值 | 说明 |
|------|-----|------|
| 宽度 | `w-full` | 填满容器 |
| 背景 | `bg-muted/5` | 极淡的背景色 |
| 边框 | `border border-input` | 标准输入框边框 |
| 圆角 | `rounded-md` | 6px 圆角 |
| 内边距 | `py-2 pl-4 pr-2` | 左多右少，给图标留空间 |
| 字体 | `text-lg font-semibold` | 大号加粗字体 |

**交互状态**：

```
默认状态：
┌────────────────────────────┐
│  我的小说项目         ▼    │
└────────────────────────────┘

Focus 状态：
┌────────────────────────────┐
│  我的小说项目         ▼    │  ← 2px 蓝色 focus ring
└────────────────────────────┘
     ════════════════════

展开状态：
┌────────────────────────────┐
│  我的小说项目         ▲    │  ← 箭头旋转 180°
└────────────────────────────┘
```

**图标动画**：
- 默认：`rotate-0`
- 展开：`group-data-[state=open]:rotate-180`
- 过渡：`transition-transform duration-300 ease-out`

### 2.3 下拉内容 (Select.Content)

**定位配置**：

```typescript
position="popper"    // 相对于触发器定位
side="bottom"        // 显示在触发器下方
align="start"        // 左对齐
sideOffset={4}       // 与触发器间距 4px
```

**样式规范**：

| 属性 | 值 | 说明 |
|------|-----|------|
| 层级 | `z-50` | 确保在最上层 |
| 最小宽度 | `min-w-[var(--radix-select-trigger-width)]` | 与触发器等宽 |
| 背景 | `bg-background` | 主题背景色 |
| 边框 | `border border-border` | 标准边框 |
| 圆角 | `rounded-md` | 6px 圆角 |
| 阴影 | `shadow-lg` | 大阴影强调层级 |

### 2.4 选项项 (Select.Item)

**默认状态**：
```
┌────────────────────────────┐
│      项目名称              │
└────────────────────────────┘
```

**Hover 状态**：
```
┌────────────────────────────┐
│██████ 项目名称  ██████████│  ← bg-primary/5, text-primary
└────────────────────────────┘
```

**选中状态**：
```
┌────────────────────────────┐
│▌████ 项目名称  ███████████│  ← 左边框 + 背景高亮
└────────────────────────────┘
  ↑
  border-l-2 border-primary
```

**样式细节**：

| 状态 | 背景 | 文字 | 左边框 | 字重 |
|------|------|------|--------|------|
| 默认 | transparent | inherit | transparent | normal |
| Hover | bg-primary/5 | text-primary | transparent | normal |
| 选中 | bg-primary/10 | text-primary | border-primary | font-medium |

**入场动画**：
- 动画类型：`animate-in slide-in-from-left-4 fade-in`
- 延迟：`animationDelay: ${index * 40}ms`
- 效果：依次从左侧滑入

### 2.5 颜色变量

组件使用 Tailwind CSS 变量，适配主题系统：

```css
/* 背景 */
--background: #ffffff;        /* 下拉背景 */
--muted: #f3f4f6;             /* 触发器背景基础 */
--primary: #3b82f6;           /* 主题色（蓝色） */

/* 边框 */
--input: #e5e7eb;             /* 输入框边框 */
--border: #e5e7eb;            /* 标准边框 */

/* 文字 */
--foreground: #111827;        /* 主文字 */
--muted-foreground: #6b7280;  /* 次要文字 */

/* Focus */
--ring: #3b82f6;              /* Focus ring 颜色 */
```

## 3. 前端实现

### 3.1 组件结构

```
frontend/src/components/ProjectSwitcher/
└── ProjectSwitcher.tsx          # 主组件（59行）
```

### 3.2 完整代码

```typescript
// frontend/src/components/ProjectSwitcher/ProjectSwitcher.tsx
import * as Select from '@radix-ui/react-select';
import { ChevronDown } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/utils/request';
import type { components } from '@/types/api';

type ProjectResponse = components['schemas']['ProjectResponse'];

export const ProjectSwitcher = () => {
  const { currentProjectId, setCurrentProjectId } = useProjectStore();
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<ProjectResponse[]>('/projects'),
  });

  // 空状态：无项目时不渲染
  if (!projects || projects.length === 0) return null;

  const currentProject = projects.find(p => p.id === currentProjectId);

  return (
    <Select.Root
      value={currentProjectId ?? undefined}
      onValueChange={setCurrentProjectId}
    >
      {/* 触发器 */}
      <Select.Trigger className="inline-flex items-center justify-between w-full bg-muted/5 border border-input rounded-md py-2 pl-4 pr-2 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-ring group">
        <Select.Value placeholder="选择项目">
          {currentProject?.title}
        </Select.Value>
        <Select.Icon>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-300 ease-out group-data-[state=open]:rotate-180" />
        </Select.Icon>
      </Select.Trigger>

      {/* 下拉内容 */}
      <Select.Portal>
        <Select.Content
          position="popper"
          side="bottom"
          align="start"
          sideOffset={4}
          className="z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden bg-background border border-border rounded-md shadow-lg animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95 data-[state=closed]:slide-out-to-top-2"
        >
          <Select.Viewport className="p-1">
            {projects.map((project, index) => (
              <Select.Item
                key={project.id}
                value={project.id}
                className="relative flex items-center px-6 py-2 text-sm rounded-md cursor-pointer focus:outline-none transition-all duration-200 hover:bg-primary/5 hover:text-primary data-[state=checked]:bg-primary/10 data-[state=checked]:text-primary data-[state=checked]:font-medium border-l-2 border-transparent data-[state=checked]:border-primary animate-in slide-in-from-left-4 fade-in"
                style={{ animationDelay: `${index * 40}ms`, animationFillMode: 'both' }}
              >
                <Select.ItemText>{project.title}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
};
```

### 3.3 状态管理

**Zustand Store** (`frontend/src/stores/projectStore.ts`)：

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ProjectState {
  currentProjectId: string | null;
  setCurrentProjectId: (id: string) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      currentProjectId: null,
      setCurrentProjectId: (id) => set({ currentProjectId: id }),
    }),
    {
      name: 'project-storage', // localStorage key
    }
  )
);
```

**特性**：
- 使用 Zustand 进行状态管理
- `persist` 中间件自动持久化到 localStorage
- 刷新页面后，当前项目 ID 自动恢复

### 3.4 数据获取

使用 React Query 获取项目列表：

```typescript
const { data: projects } = useQuery({
  queryKey: ['projects'],
  queryFn: () => api.get<ProjectResponse[]>('/projects'),
});
```

**类型定义**（从 OpenAPI 自动生成）：

```typescript
// frontend/src/types/api.ts
interface ProjectResponse {
  id: string;
  title: string;
  genre?: string[];
  description?: string;
  cover?: string;
  created_at: string;
  updated_at: string;
}
```

### 3.5 使用位置

组件在 `EditorPage` 的侧边栏头部使用：

```typescript
// frontend/src/pages/EditorPage/EditorPage.tsx
import { ProjectSwitcher } from '@/components/ProjectSwitcher';

// 在侧边栏渲染
<div className="sidebar">
  <ProjectSwitcher />
  {/* 其他内容 */}
</div>
```

## 4. 后端实现

### 4.1 API 路由

**文件**：`backend/app/api/v1/projects.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.models import Project, Folder
from app.models.folder import FolderType
from app.schemas import ProjectCreate, ProjectUpdate, ProjectResponse
from app.core.dependencies import get_db
from app.services.directory_service import DirectoryService

router = APIRouter()

# 获取项目列表
@router.get("/", response_model=List[ProjectResponse])
def get_projects(db: Session = Depends(get_db)):
    return db.query(Project).all()

# 获取单个项目
@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project_id: str, db: Session = Depends(get_db)):
    db_project = db.query(Project).filter(Project.id == project_id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    return db_project
```

### 4.2 数据模型

**文件**：`backend/app/models/project.py`

```python
import uuid
from datetime import datetime
from typing import List, Optional
from sqlalchemy import String, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from . import Base

class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(
        String(36), 
        primary_key=True, 
        default=lambda: str(uuid.uuid4())
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    genre: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    cover: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, 
        onupdate=datetime.utcnow
    )

    # 关联关系
    folders: Mapped[List["Folder"]] = relationship(
        back_populates="project", 
        cascade="all, delete-orphan"
    )
    notes: Mapped[List["Note"]] = relationship(
        back_populates="project", 
        cascade="all, delete-orphan"
    )
```

### 4.3 Schema 定义

**文件**：`backend/app/schemas/project.py`

```python
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

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

### 4.4 API 端点汇总

| 方法 | 路径 | 功能 | 响应模型 |
|------|------|------|----------|
| GET | `/api/v1/projects/` | 获取所有项目 | `List[ProjectResponse]` |
| GET | `/api/v1/projects/{project_id}` | 获取单个项目 | `ProjectResponse` |
| POST | `/api/v1/projects/` | 创建项目 | `ProjectResponse` |
| PUT | `/api/v1/projects/{project_id}` | 更新项目 | `ProjectResponse` |
| DELETE | `/api/v1/projects/{project_id}` | 删除项目 | `{"success": bool}` |

## 5. 业务逻辑

### 5.1 项目切换流程

```
用户点击触发器
       │
       ▼
下拉列表展开
       │
       ▼
用户选择项目
       │
       ▼
调用 setCurrentProjectId(id) ───────┐
       │                            │
       ▼                            │
更新 Zustand State                  │
       │                            │
       ▼                            │
持久化到 localStorage ◄─────────────┘
       │
       ▼
触发 React Query 重新获取
项目相关数据（目录树、笔记等）
       │
       ▼
UI 更新显示新项目内容
```

### 5.2 项目有效性验证

在 `EditorPage` 中，对当前项目进行有效性检查：

```typescript
// 处理项目获取失败的情况
useEffect(() => {
  if (projectError && currentProjectId) {
    const axiosError = projectError as { response?: { status: number } };
    if (axiosError.response?.status === 404) {
      console.warn(`Project ${currentProjectId} not found`);
      setCurrentProjectId('');  // 清除无效的项目 ID
    }
  }
}, [projectError, currentProjectId, setCurrentProjectId]);

// 初始化检查
useEffect(() => {
  if (projects && currentProjectId) {
    const projectExists = projects.some(p => p.id === currentProjectId);
    if (!projectExists) {
      setCurrentProjectId('');  // 项目不存在于列表中
    }
  }
}, [projects, currentProjectId, setCurrentProjectId]);
```

### 5.3 状态流转

| 场景 | 当前项目 ID | 行为 |
|------|-------------|------|
| 首次使用 | `null` | 显示 placeholder "选择项目" |
| 选择项目 | 有效 ID | 显示项目名称，加载项目数据 |
| 项目被删除 | 无效 ID | 自动清除，回到空状态 |
| 页面刷新 | 从 localStorage 恢复 | 恢复上次选择的项目 |

## 6. 依赖库

| 库 | 版本 | 用途 |
|----|------|------|
| @radix-ui/react-select | ^2.2.6 | 无障碍下拉选择组件 |
| lucide-react | ^0.453.0 | 图标（ChevronDown） |
| zustand | ^4.5.7 | 状态管理 |
| @tanstack/react-query | ^5.56.2 | 服务端状态管理 |
| tailwindcss | ^3.x | 样式系统 |

## 7. 文件清单

### 前端

| 文件路径 | 说明 |
|----------|------|
| `frontend/src/components/ProjectSwitcher/ProjectSwitcher.tsx` | 主组件 |
| `frontend/src/stores/projectStore.ts` | 状态管理 Store |
| `frontend/src/types/api.ts` | API 类型定义（自动生成） |

### 后端

| 文件路径 | 说明 |
|----------|------|
| `backend/app/api/v1/projects.py` | 项目 API 路由 |
| `backend/app/models/project.py` | 项目数据模型 |
| `backend/app/schemas/project.py` | Pydantic Schema |

## 8. 扩展建议

### 8.1 可能的增强功能

1. **项目搜索**：在项目列表中添加搜索框，支持快速过滤
2. **最近项目**：显示最近访问的项目，快速切换
3. **项目预览**：Hover 时显示项目基本信息（笔记数量、字数等）
4. **快捷操作**：在项目中添加快捷操作（新建笔记、打开设置等）
5. **项目分组**：支持按分类/标签对项目进行分组显示

### 8.2 无障碍改进

- 当前已实现 Radix UI 的无障碍支持
- 可添加键盘快捷键（如 `Cmd/Ctrl + P` 快速打开项目切换）
- 支持屏幕阅读器朗读项目列表
