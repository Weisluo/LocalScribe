# EditorPage 编辑器页面文档

## 1. 概述

EditorPage 是 LocalScribe 写作应用的核心页面，提供完整的小说编辑体验。页面采用三栏布局设计，包含左侧目录树、中间编辑器区域和右侧 AI 助手面板。

---

## 2. UI 效果与布局

### 2.1 整体布局结构

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                         │
│   左侧栏 (w-72)              │   中间主编辑区 (flex-1)           │   右侧栏 (25%-50%)    │
│   ═══════════════════════    │   ════════════════════════════    │   ═════════════════   │
│                              │                                   │                       │
│   ┌─────────────────────┐    │   ┌─────────────────────────┐     │   ┌───────────────┐   │
│   │  项目切换器    [+]  │    │   │                         │     │   │  💾 已保存    │   │
│   │  [下拉选择项目]     │    │   │    章节标题输入框        │     │   │  📅 12-25     │   │
│   └─────────────────────┘    │   │    [无标题章节...]       │     │   └───────────────┘   │
│                              │   │                         │     │                       │
│   ┌─────────────────────┐    │   ├─────────────────────────┤     │   ┌───────────────┐   │
│   │                     │    │   │                         │     │   │ 📊 统计面板   │   │
│   │   📚 目录树区域     │    │   │                         │     │   │  ┌───┐ ┌───┐  │   │
│   │   (占 67% 高度)     │    │   │    📝 富文本编辑器      │     │   │  │当 │ │全 │  │   │
│   │                     │    │   │                         │     │   │  │前 │ │书 │  │   │
│   │   ▼ 第一卷          │    │   │    [纸张效果背景]       │     │   │  │章 │ │统 │  │   │
│   │     ▼ 第一幕        │    │   │                         │     │   │  │节 │ │计 │  │   │
│   │       ● 章节1       │    │   │    [打字机占位符...]    │     │   │  └───┘ └───┘  │   │
│   │       ○ 章节2       │    │   │                         │     │   │               │   │
│   │                     │    │   │                         │     │   └───────────────┘   │
│   └─────────────────────┘    │   │                         │     │                       │
│                              │   └─────────────────────────┘     │   ┌───────────────┐   │
│   ┌─────────────────────┐    │                                   │   │ 📅 写作日历   │   │
│   │  🌍 世界观设定      │    │   ┌─────────────────────────┐     │   │ [热力图...]   │   │
│   │  [点击进入世界观]   │    │   │  🔧 可折叠工具栏        │     │   │               │   │
│   └─────────────────────┘    │   │  [格式工具按钮...]      │     │   │ (点击时间     │   │
│                              │   └─────────────────────────┘     │   │  按钮切换)    │   │
│   ┌─────────────────────┐    │                                   │   └───────────────┘   │
│   │ 🗑️ │ ➕ 新建 │ 📤 │    │                                   │                       │
│   │ 删除  项目    导出  │    │                                   │   ┌───────────────┐   │
│   │ [回收站按钮]        │    │                                   │   │   🤖 AI 助手   │   │
│   └─────────────────────┘    │                                   │   │               │   │
│                              │                                   │   │  [模型选择]   │   │
│                              │                                   │   │               │   │
│                              │                                   │   │  消息列表...  │   │
│                              │                                   │   │               │   │
│                              │                                   │   │  [输入框] [➤] │   │
│                              │                                   │   │               │   │
│                              │                                   │   └───────────────┘   │
│                              │                                   │                       │
└──────────────────────────────┴───────────────────────────────────┴───────────────────────┘
```

### 2.2 各栏详细布局

#### 左侧栏 (w-72, 固定宽度)
从上到下依次是：
1. **项目标题栏** (h-16): 项目切换器 + 新建卷按钮
2. **目录树区域** (h-[67%]): 可滚动的卷/幕/章节树
3. **世界观设定区** (flex-1): 世界观设定按钮入口
4. **底部操作栏** (h-auto): 删除项目 | 新建项目 + 导出 | 回收站

#### 中间主编辑区 (flex-1, 自适应)
三种视图状态：
1. **编辑器视图** (默认):
   - 标题栏 (h-16): 章节标题输入框
   - 编辑器区域: TipTap 富文本编辑器 + 纸张效果
   - 底部工具栏: 可折叠的格式工具栏

2. **回收站视图** (`showTrash=true`):
   - 顶部标题栏: "回收站" 标题
   - 内容区域: 已删除章节列表

3. **世界观设定视图** (`showWorldbuilding=true`):
   - 全屏显示世界观设定组件

#### 右侧栏 (宽度可拖拽 25%-50%)
从上到下依次是：
1. **状态栏**: 
   - 保存状态指示器 (保存中/已保存)
   - 日期时间按钮 (点击切换统计面板/写作日历)
2. **统计面板/写作日历切换区域**:
   - **统计面板** (`showCalendar=false`): 
     - 当前章节统计卡片 (字符/中文/阅读时间) - 占 3 列
     - 全书统计卡片 (总字符/总中文) - 占 2 列
   - **写作日历** (`showCalendar=true`): 
     - 每日写作字数热力图
     - 写作数据统计
3. **AI 聊天区域** (flex-1): AI 助手对话界面

**切换逻辑:**
```typescript
// 点击日期时间按钮切换显示
<button onClick={() => setShowCalendar(!showCalendar)}>
  {format(currentTime, 'MM-dd HH:mm')}
</button>

// 统计面板 (默认显示)
<div className={`transition-all ${showCalendar ? 'max-h-0' : 'max-h-[500px]'}`}>
  <StatsGrid />
</div>

// 写作日历 (点击展开)
<div className={`transition-all ${showCalendar ? 'max-h-[500px]' : 'max-h-0'}`}>
  <WritingCalendar />
</div>
```

### 2.3 视觉设计特点

- **配色方案**: 使用 CSS 变量定义的主题色系，支持暗色/亮色模式
- **纸张效果**: 编辑器区域使用 `editor-paper` 类实现纸张质感背景
- **毛玻璃效果**: 多处使用 `backdrop-blur-sm` 实现现代毛玻璃视觉效果
- **渐变背景**: 统计面板使用渐变色彩增加层次感
- **动画过渡**: 流畅的过渡动画，包括折叠展开、悬停效果等

### 2.4 响应式交互

- **右侧面板可拖拽调整宽度**: 范围限制在 25% - 50% 之间
- **工具栏可折叠**: 底部工具栏支持展开/收起
- **目录树展开/折叠**: 卷和幕级别可展开折叠
- **统计面板/写作日历切换**: 点击时间按钮在两者之间切换显示
- **拖拽排序**: 目录树支持长按拖拽排序

---

## 3. 前端代码实现

### 3.1 文件位置

```
frontend/src/pages/EditorPage/
└── EditorPage.tsx          # 主页面组件 (886 行)

frontend/src/components/
├── DirectoryTree/          # 目录树组件
│   ├── DirectoryTree.tsx   # 目录树逻辑
│   ├── TreeNode.tsx        # 树节点渲染
│   └── index.ts
├── Editor/                 # 编辑器组件
│   ├── Editor.tsx          # TipTap 编辑器封装
│   ├── Toolbar.tsx         # 工具栏
│   └── extensions/         # 自定义扩展
├── AIChat/                 # AI 聊天组件
│   ├── AIChat.tsx
│   └── index.ts
└── ...

frontend/src/hooks/
├── useNote.ts              # 章节相关操作
├── useDirectory.ts         # 目录树操作
└── useAutoSave.ts          # 自动保存逻辑

frontend/src/stores/
├── projectStore.ts         # 当前项目状态
├── uiStore.ts              # UI 状态管理
├── noteStore.ts            # 当前章节状态
└── editorSettingsStore.ts  # 编辑器设置
```

### 3.2 核心组件说明

#### EditorPage.tsx

主页面组件，负责：
- 项目状态管理和验证
- 三栏布局的协调
- 章节数据的加载和保存
- 自动保存逻辑集成
- 拖拽调整面板宽度
- 模块懒加载预加载

**关键 State:**
```typescript
// 视图切换状态
const [showTrash, setShowTrash] = useState(false);           // 显示回收站
const [showWorldbuilding, setShowWorldbuilding] = useState(false);  // 显示世界观设定
const [showCalendar, setShowCalendar] = useState(false);     // 显示写作日历

// 章节编辑状态
const [selectedNoteId, setSelectedNoteId] = useState<string | undefined>();
const [noteTitle, setNoteTitle] = useState<string>('');
const [noteContent, setNoteContent] = useState<string>('');
const [isTitleFocused, setIsTitleFocused] = useState(false);

// UI 状态
const [rightPanelWidth, setRightPanelWidth] = useState<number>(25);  // 右侧面板宽度
const [isResizing, setIsResizing] = useState(false);         // 是否正在拖拽调整大小
const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());  // 目录树展开状态
const [currentTime, setCurrentTime] = useState(new Date());  // 当前时间
```

**懒加载组件:**
```typescript
const Export = lazy(() => import('@/components/Export/Export'));
const TrashView = lazy(() => import('@/components/Trash'));
const WorldbuildingView = lazy(() => import('@/components/Worldbuilding'));
const WritingCalendar = lazy(() => import('@/components/WritingCalendar'));
```

**预加载优化:**
```typescript
useEffect(() => {
  preloadModules([
    () => import('@/components/Export/Export'),
    () => import('@/components/Worldbuilding'),
    () => import('@/components/WritingCalendar'),
    () => import('jszip'),
  ], 3000);
}, []);
```

#### DirectoryTree.tsx

目录树组件，基于 `@dnd-kit` 实现拖拽排序：
- 支持卷、幕、章节三级结构
- 拖拽排序（长按 1.5 秒触发）
- 自动展开选中章节的路径

#### Editor.tsx

基于 TipTap 的富文本编辑器：
- 支持富文本格式化
- 智能滚动：光标始终保持在视口 3/4 位置
- 打字机效果占位符
- 可配置的行距、段落间距、缩进

#### AIChat.tsx

AI 助手聊天界面：
- 模拟 AI 回复（待接入 Ollama API）
- 快捷指令按钮
- 消息历史展示
- 打字机效果引导文本

### 3.3 自定义 Hooks

#### useNote.ts
```typescript
export const useNote = (noteId: string | undefined) => {
  // 获取单个章节详情
};

export const useUpdateNote = (projectId: string) => {
  // 更新章节，成功后刷新目录树缓存
};

export const useCreateNote = (projectId: string) => {
  // 创建新章节
};

export const useMoveNote = (projectId: string) => {
  // 移动/排序章节
};
```

#### useDirectory.ts
```typescript
export const useDirectoryTree = (projectId: string | undefined) => {
  // 获取项目目录树
};

export const useCreateFolder = () => {
  // 创建卷/幕
};

export const useMoveFolder = (projectId: string) => {
  // 移动/排序文件夹
};
```

### 3.4 状态管理 (Zustand)

#### projectStore.ts
```typescript
interface ProjectState {
  currentProjectId: string | null;
  setCurrentProjectId: (id: string) => void;
}
// 使用 persist 中间件持久化到 localStorage
```

#### uiStore.ts
```typescript
interface UIState {
  isSidebarCollapsed: boolean;
  modalType: ModalType;           // 当前打开的弹窗类型
  modalParentId: string | null;   // 弹窗上下文 ID
  newlyCreatedNoteId: string | null;  // 新创建章节 ID（用于自动选中）
}
```

---

## 4. 后端 API 实现

### 4.1 API 路由结构

```
backend/app/api/v1/
├── projects.py      # 项目管理
├── folders.py       # 卷/幕管理
├── notes.py         # 章节管理
├── worldbuilding.py # 世界观设定
├── characters.py    # 角色管理
├── outline.py       # 大纲管理
├── analysis.py      # 文本分析
└── ai.py            # AI 服务接口
```

### 4.2 核心 API 端点

#### 项目管理 (/projects)
```python
GET    /projects              # 获取项目列表
POST   /projects              # 创建项目（自动创建默认卷和幕）
GET    /projects/{id}         # 获取项目详情
PUT    /projects/{id}         # 更新项目
DELETE /projects/{id}         # 删除项目
GET    /projects/{id}/tree    # 获取目录树
```

#### 文件夹管理 (/folders)
```python
GET    /folders?project_id=   # 获取项目下所有文件夹
POST   /folders/              # 创建文件夹
PUT    /folders/{id}          # 更新文件夹
PUT    /folders/{id}/move     # 移动/排序文件夹
DELETE /folders/{id}          # 删除文件夹
```

**MoveFolderRequest Schema:**
```python
class MoveFolderRequest(BaseModel):
    target_parent_id: Optional[str] = None  # 目标父文件夹 ID
    new_order: int                         # 新的排序位置
```

#### 章节管理 (/notes)
```python
GET    /notes?folder_id=      # 获取章节列表
GET    /notes/{id}            # 获取章节详情
POST   /notes/                # 创建章节
PUT    /notes/{id}            # 更新章节
DELETE /notes/{id}?permanent= # 删除章节（软删除/永久删除）
PUT    /notes/{id}/move       # 移动/排序章节
POST   /notes/{id}/copy       # 复制章节
POST   /notes/{id}/restore    # 恢复已删除章节
GET    /notes/deleted?project_id=  # 获取回收站列表
```

**MoveNoteRequest Schema:**
```python
class MoveNoteRequest(BaseModel):
    target_folder_id: str  # 目标文件夹 ID
    new_order: int         # 新的排序位置
```

### 4.3 数据库模型关系

```
Project (项目)
├── Folder (卷/幕)
│   ├── type: "volume" | "act"
│   ├── parent_id: 父文件夹 ID
│   └── children: Folder[] | Note[]
└── Note (章节)
    ├── folder_id: 所属幕 ID
    ├── content: HTML 内容
    ├── word_count: 字数统计
    └── deleted_at: 软删除标记
```

### 4.4 目录树构建逻辑

```python
# DirectoryService.build_tree()
def build_tree(project_id: str, db: Session) -> List[VolumeNode]:
    # 1. 获取项目下所有卷 (parent_id is None)
    # 2. 为每个卷获取其下的幕
    # 3. 为每个幕获取其下的章节
    # 4. 按 order 字段排序
    # 5. 递归构建树形结构
```

---

## 5. 业务逻辑

### 5.1 项目初始化与验证流程

1. **项目有效性验证**
   - 加载项目列表后验证当前项目 ID 是否存在
   - 如项目不存在（404 或不在列表中），自动清除 `currentProjectId`
   - 防止因项目被删除导致的错误状态

2. **创建项目** (`POST /projects`)
   - 创建项目记录
   - 自动创建 "第一卷" (volume)
   - 自动创建 "第一幕" (act) 作为卷的子项

3. **首次进入编辑器**
   - 检查项目是否有章节
   - 如无章节，自动在第一个幕下创建空白章节
   - 自动展开目录树路径

4. **项目切换处理**
   - 重置自动创建标记
   - 清空选中章节状态
   - 关闭回收站/世界观设定视图
   - 清除世界观设定缓存

### 5.2 章节编辑流程

1. **自动选中最新章节**
   - 当目录树加载完成且没有选中章节时
   - 递归查找所有章节节点
   - 按 `created_at` 降序排序，自动选中最新章节
   - 展开该章节的所有祖先节点

2. **选中章节**
   - 点击目录树中的章节
   - 如当前在回收站或世界观设定视图，先返回编辑器
   - 保存当前章节（如有更改）
   - 加载章节详情 (`GET /notes/{id}`)
   - 展开章节所在的卷和幕
   - 滚动到选中章节位置

3. **编辑内容**
   - 标题输入框实时更新，支持聚焦样式变化
   - 编辑器内容变化触发 `onChange`
   - 自动保存机制（防抖 2 秒）
   - 保存时显示"保存中..."状态指示器

4. **自动保存**
   ```typescript
   useAutoSave({
     data: { title, content },
     onSave: handleSave,
     delay: 2000  // 2 秒防抖
   });
   ```
   - 使用 `lastSaveTimeRef` 防止频繁保存（最小间隔 500ms）

5. **切换章节**
   - 保存当前章节（防抖检查）
   - 加载新章节内容
   - 重置编辑器滚动位置到顶部
   - 显示加载状态指示器

6. **删除章节处理**
   - 如删除的是当前选中章节，自动切换到上一章
   - 如删除的是第一章，切换到新的第一章
   - 如无其他章节，清空选中状态

### 5.3 目录树操作

#### 创建结构
```
创建卷 → POST /folders (type="volume", parent_id=null)
创建幕 → POST /folders (type="act", parent_id=volumeId)
创建章节 → POST /notes (folder_id=actId)
```

#### 拖拽排序
1. **长按 1.5 秒**触发拖拽（防止误触）
2. 同类型节点之间可排序：
   - 卷只能在根目录间排序
   - 幕只能在同卷下排序
   - 章节只能在同幕下排序
3. 释放后调用 `moveFolder` 或 `moveNote`

### 5.4 删除与恢复

- **软删除**: 设置 `deleted_at` 时间戳
- **回收站**: 显示 `deleted_at is not null` 的章节
- **恢复**: 清除 `deleted_at` 标记
- **永久删除**: 从数据库物理删除

### 5.5 字数统计

**当前章节统计:**
```typescript
const currentText = noteContent.replace(/<[^>]*>/g, '');
const currentStats = calculateStatistics(currentText);
// {
//   wordCount: number,        // 词数
//   charCount: number,        // 字符总数
//   chineseCharCount: number, // 中文字符数
//   readingTime: number       // 预计阅读时间(分钟)
// }
```

**全书统计:**
```typescript
const projectStats = calculateProjectStatistics(tree, selectedNoteId, currentText);
// 汇总所有章节的字符数和中文字符数
// 包含当前编辑章节的实时更新数据
```

**每日写作统计:**
```typescript
const dailyStats = useMemo(() => {
  // 从目录树中提取每个章节的 created_at 和 word_count
  // 按日期汇总，生成日历热力图数据
  // [{ date: '2024-01-01', wordCount: 1500 }, ...]
}, [tree]);
```

---

## 6. 性能优化

### 6.1 懒加载与预加载
- **组件懒加载**: Export、TrashView、WorldbuildingView、WritingCalendar 使用 `React.lazy` 按需加载
- **模块预加载**: 使用 `useIdlePreload` 在空闲时预加载常用模块
  ```typescript
  preloadModules([
    () => import('@/components/Export/Export'),
    () => import('@/components/Worldbuilding'),
    () => import('@/components/WritingCalendar'),
    () => import('jszip'),
  ], 3000); // 延迟 3 秒后开始预加载
  ```

### 6.2 缓存策略
- **React Query 缓存**: 目录树、章节数据自动缓存
- **乐观更新**: 保存后先更新本地缓存，再刷新目录树
- **缓存失效**: 章节更新后自动使目录树缓存失效

### 6.3 渲染优化
- **useMemo**: 每日写作统计数据缓存
- **useCallback**: 事件处理函数缓存
- **防抖节流**: 自动保存防抖 2 秒，保存操作最小间隔 500ms

### 6.4 交互优化
- **拖拽延迟**: 目录树拖拽触发延迟 1.5 秒，防止误触
- **平滑滚动**: 选中章节后平滑滚动到视口中央
- **智能光标滚动**: 编辑器光标始终保持在视口 3/4 位置

---

## 7. 技术栈

### 前端
- **框架**: React 18 + TypeScript
- **构建**: Vite
- **样式**: Tailwind CSS + CSS 变量
- **状态**: Zustand (持久化)
- **数据获取**: React Query (TanStack Query)
- **编辑器**: TipTap (ProseMirror)
- **拖拽**: @dnd-kit
- **图标**: Lucide React
- **日期**: date-fns

### 后端
- **框架**: FastAPI
- **ORM**: SQLAlchemy
- **数据库**: SQLite
- **迁移**: Alembic
- **数据验证**: Pydantic v2

---

## 8. 待完善功能

1. **AI 助手集成**: 当前为模拟回复，需接入 Ollama API
2. **导出功能**: 已预留组件，待完善
3. **回收站界面**: 已预留组件，待完善
4. **世界观设定**: 已预留组件，待完善
5. **写作日历**: 已预留组件，待完善

---

## 9. 关键实现细节

### 9.1 无项目状态
当 `currentProjectId` 为空时，显示欢迎页面：
- LocalScribe Logo 和标语
- "创建第一个项目" 按钮
- 背景装饰动画效果

### 9.2 标题栏交互
- 聚焦时显示底部边框（`border-accent/50`）
- 失焦且非空时隐藏边框（`border-transparent`）
- 切换章节时显示加载状态（`isSwitchingNote`）

### 9.3 拖拽调整宽度实现
```typescript
// 使用 ref 跟踪拖拽状态，避免频繁 re-render
const resizingRef = useRef(false);
const startXRef = useRef(0);
const startWidthPercentRef = useRef(0);

// 计算新宽度：向左拖动减小右侧栏宽度
const deltaX = startXRef.current - e.clientX;
const deltaPercent = (deltaX / containerWidth) * 100;
let newWidth = startWidthPercentRef.current + deltaPercent;

// 限制范围 25% - 50%
newWidth = Math.max(25, Math.min(50, newWidth));
```

### 9.4 编辑器智能滚动
```typescript
// 目标位置：容器高度的 3/4 处
const targetPosition = containerHeight * (3 / 4);

// 如果光标在目标位置下方，将光标定位到 3/4 处
if (cursorRelativeToContainer > targetPosition) {
  const newScrollTop = currentScrollTop + (cursorRelativeToContainer - targetPosition);
  scrollContainerRef.current.scrollTo({ top: newScrollTop, behavior: 'smooth' });
}
// 如果光标在容器顶部上方（被遮挡），向上滚动
else if (cursorRelativeToContainer < 50) {
  const newScrollTop = currentScrollTop + (cursorRelativeToContainer - targetPosition);
  scrollContainerRef.current.scrollTo({ top: newScrollTop, behavior: 'smooth' });
}
```
