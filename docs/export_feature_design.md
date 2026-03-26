# Export 导出功能设计文档

## 1. 功能概述

Export 导出功能允许用户将小说项目的内容导出为多种格式（PDF、EPUB、TXT、DOCX），方便用户在不同场景下使用作品。

### 1.1 支持格式

| 格式 | 说明 | 使用场景 |
|------|------|----------|
| PDF | 便携式文档格式 | 打印、分享、存档 |
| EPUB | 电子书格式 | 电子书阅读器、手机阅读 |
| TXT | 纯文本格式 | 简单文本编辑、兼容性最好 |
| DOCX | Word文档格式 | 进一步编辑、排版 |

## 2. UI 效果

### 2.1 组件位置

Export 组件位于项目侧边栏底部，作为工具按钮组的一部分。

### 2.2 视觉设计

#### 导出按钮（默认状态）
- **图标**: `FileDown` (Lucide Icons)
- **文字**: "导出"
- **样式**:
  - 文字颜色: `text-sky-600/80` (天蓝色，80%透明度)
  - 悬停颜色: `hover:text-sky-700`
  - 背景: `hover:bg-sky-100/50` (悬停时显示浅天蓝色背景)
  - 圆角: `rounded-lg`
  - 过渡动画: `transition-all duration-200`
  - 字体大小: `text-xs`
  - 内边距: `py-2.5`

#### 导出按钮（导出中状态）
- **图标**: `Loader2` 旋转动画 (`animate-spin`)
- **文字**: "导出中..."
- **状态**: `disabled:opacity-50`

#### 下拉菜单
- **触发**: 点击按钮展开
- **位置**: 绝对定位，按钮上方 (`bottom-full`)
- **宽度**: `w-32`
- **背景**: `bg-popover`
- **边框**: `border border-border`
- **圆角**: `rounded-lg`
- **阴影**: `shadow-lg`
- **层级**: `z-50`
- **内边距**: `p-1`

#### 菜单项
- **布局**: 垂直列表
- **内边距**: `px-3 py-2`
- **字体**: `text-sm`
- **对齐**: `text-left`
- **圆角**: `rounded-md`
- **悬停效果**:
  - 背景: `hover:bg-primary/5`
  - 文字: `hover:text-primary`
  - 过渡: `transition-all duration-200`

#### 遮罩层
- **作用**: 点击外部关闭菜单
- **样式**: `fixed inset-0 z-40`

### 2.3 交互流程

```
┌─────────────────┐
│   点击导出按钮   │
└────────┬────────┘
         ▼
┌─────────────────┐
│  显示下拉菜单    │
│  PDF/EPUB/TXT/  │
│     DOCX        │
└────────┬────────┘
         ▼
┌─────────────────┐     ┌─────────────────┐
│  选择导出格式    │────▶│   点击外部区域   │
└────────┬────────┘     └────────┬────────┘
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│  显示加载状态    │     │    关闭菜单      │
│  "导出中..."    │     └─────────────────┘
└────────┬────────┘
         ▼
┌─────────────────┐
│  收集章节数据    │
│  调用后端API     │
└────────┬────────┘
         ▼
┌─────────────────┐
│  生成对应格式    │
│  文件并下载      │
└────────┬────────┘
         ▼
┌─────────────────┐     ┌─────────────────┐
│   导出成功      │     │   导出失败      │
│  (静默完成)     │     │  显示错误提示    │
└─────────────────┘     └─────────────────┘
```

## 3. 前端代码实现

### 3.1 文件结构

```
frontend/src/components/Export/
├── Export.tsx    # 主组件
└── index.ts      # 导出入口
```

### 3.2 类型定义

```typescript
// 组件 Props
interface ExportProps {
  projectId: string;       // 项目ID
  projectTitle?: string;   // 项目标题（可选）
  tree: VolumeNode[];      // 目录树结构
}

// 章节数据结构
interface ChapterData {
  id: string;           // 章节ID
  title: string;        // 章节标题
  content: string;      // 章节内容（纯文本）
  volumeTitle: string;  // 卷标题
  actTitle: string;     // 幕/章标题
}

// 导出格式类型
type ExportFormat = 'pdf' | 'epub' | 'txt' | 'docx';
```

### 3.3 核心函数

#### 收集章节数据

```typescript
const collectAllChapters = (
  nodes: (VolumeNode | ActNode | NoteNode)[],
  volumeTitle: string = '',
  actTitle: string = ''
): ChapterData[] => {
  let chapters: ChapterData[] = [];
  for (const node of nodes) {
    if (node.type === 'volume') {
      chapters = chapters.concat(
        collectAllChapters(node.children, node.name, actTitle)
      );
    } else if (node.type === 'act') {
      chapters = chapters.concat(
        collectAllChapters(node.children, volumeTitle, node.name)
      );
    } else if (node.type === 'note') {
      chapters.push({
        id: node.id,
        title: node.title || '无标题章节',
        content: '',
        volumeTitle,
        actTitle,
      });
    }
  }
  return chapters;
};
```

#### HTML 转纯文本

```typescript
const htmlToPlainText = (html: string): string => {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  return tempDiv.textContent || tempDiv.innerText || '';
};
```

### 3.4 导出实现

#### PDF 导出 (使用 jsPDF)

```typescript
const exportToPDF = async (chapters: ChapterData[], date: string) => {
  const pdf = new jsPDF({
    unit: 'mm',
    format: 'a4',
    orientation: 'portrait',
  });

  // 页面配置
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const marginLeft = 20;
  const marginRight = 20;
  const marginTop = 25;
  const marginBottom = 25;
  const contentWidth = pageWidth - marginLeft - marginRight;
  const lineHeight = 6;
  const fontSize = 12;
  const titleFontSize = 16;

  // 生成封面、目录、正文...
  // 包含页眉页脚、自动分页等功能
};
```

**PDF 结构**:
1. **封面页**: 项目标题 + 导出日期
2. **目录页**: 章节列表（带层级结构）
3. **正文**: 
   - 卷标题 (14px, bold)
   - 幕标题 (13px, bold)
   - 章节标题 (16px, bold)
   - 章节内容 (12px, normal)
   - 每章新起一页

#### EPUB 导出

```typescript
const generateEPUB = async (chapters: ChapterData[], date: string) => {
  // 生成 EPUB 所需的 XML 文件结构
  // 1. mimetype
  // 2. META-INF/container.xml
  // 3. OEBPS/content.opf (包文件)
  // 4. OEBPS/toc.ncx (目录文件)
  // 5. OEBPS/titlepage.xhtml (封面)
  // 6. OEBPS/chapter{n}.xhtml (章节内容)
  
  // 使用 JSZip 打包为 .epub 文件
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  // ... 添加文件到 zip
  const blob = await zip.generateAsync({ 
    type: 'blob', 
    mimeType: 'application/epub+zip' 
  });
  // 触发下载
};
```

#### TXT 导出

```typescript
const exportToTXT = async (chapters: ChapterData[], date: string) => {
  let txtContent = '';
  
  // 标题
  txtContent += '='.repeat(50) + '\n';
  txtContent += (projectTitle || '我的小说') + '\n';
  txtContent += date + '\n';
  txtContent += '='.repeat(50) + '\n\n';
  
  // 章节内容
  for (const chapter of chapters) {
    if (chapter.volumeTitle) {
      txtContent += '\n' + '# ' + chapter.volumeTitle + '\n\n';
    }
    if (chapter.actTitle) {
      txtContent += '## ' + chapter.actTitle + '\n\n';
    }
    txtContent += '### ' + chapter.title + '\n\n';
    txtContent += chapter.content + '\n\n';
    txtContent += '-'.repeat(40) + '\n\n';
  }
  
  // 下载
  const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
  // ... 触发下载
};
```

#### DOCX 导出 (使用 docx.js)

```typescript
const exportToDOCX = async (chapters: ChapterData[], date: string) => {
  const docChildren: Paragraph[] = [];
  
  // 封面
  docChildren.push(
    new Paragraph({
      text: projectTitle || '我的小说',
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    })
  );
  
  // 章节内容
  for (const chapter of chapters) {
    if (chapter.volumeTitle) {
      docChildren.push(
        new Paragraph({
          text: chapter.volumeTitle,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 200, after: 200 },
        })
      );
    }
    // ... 添加幕标题、章节标题、内容
  }
  
  const doc = new Document({
    sections: [{ properties: {}, children: docChildren }],
  });
  
  const blob = await Packer.toBlob(doc);
  // ... 触发下载
};
```

### 3.5 主处理函数

```typescript
const handleExport = async (format: ExportFormat) => {
  setIsExporting(true);
  setShowMenu(false);
  try {
    // 1. 收集所有章节
    const chapters = collectAllChapters(tree);
    
    // 2. 获取每章的详细内容
    for (const chapter of chapters) {
      const note = await api.get<NoteResponse>(`/notes/${chapter.id}`);
      chapter.content = htmlToPlainText(note.content || '');
    }

    const date = new Date().toLocaleDateString('zh-CN');

    // 3. 根据格式导出
    switch (format) {
      case 'pdf': await exportToPDF(chapters, date); break;
      case 'epub': await generateEPUB(chapters, date); break;
      case 'txt': await exportToTXT(chapters, date); break;
      case 'docx': await exportToDOCX(chapters, date); break;
    }
  } catch (error) {
    console.error('导出失败:', error);
    toast.error('导出失败，请重试');
  } finally {
    setIsExporting(false);
  }
};
```

### 3.6 依赖库

```json
{
  "jspdf": "^2.x",
  "docx": "^8.x",
  "jszip": "^3.x"
}
```

## 4. 后端 API

### 4.1 数据结构

Export 功能主要依赖以下后端数据结构：

#### 目录树节点类型 (directory.py)

```python
from typing import List, Optional, Literal, Union
from pydantic import BaseModel

class VolumeNode(BaseModel):
    """卷节点"""
    type: Literal["volume"] = "volume"
    id: str
    name: str
    order: int
    children: List["ActNode"] = []

class ActNode(BaseModel):
    """幕/章节点"""
    type: Literal["act"] = "act"
    id: str
    name: str
    order: int
    children: List["NoteNode"] = []

class NoteNode(BaseModel):
    """笔记/章节节点"""
    type: Literal["note"] = "note"
    id: str
    title: str
    order: int
    created_at: datetime
    word_count: int = 0

# 更新前向引用
VolumeNode.model_rebuild()
ActNode.model_rebuild()
```

#### 章节详情响应 (NoteResponse)

```typescript
interface NoteResponse {
  title: string;
  content: string | null;  // HTML 格式内容
  tags?: string[];
  status: "draft" | "revising" | "completed" | null;
  id: string;
  folder_id: string;
  project_id: string;
  order: number;
  word_count: number | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}
```

### 4.2 API 端点

Export 功能使用以下后端 API：

#### 获取章节详情

```
GET /api/v1/notes/{note_id}
```

**响应**: `NoteResponse`

**说明**: 获取单个章节的完整内容（HTML格式）

### 4.3 目录树获取

目录树通过项目 API 获取：

```
GET /api/v1/projects/{project_id}/tree
```

返回 `VolumeNode[]` 结构，Export 组件通过 props 接收此数据。

## 5. 业务逻辑流程

### 5.1 完整导出流程

```
┌─────────────────────────────────────────────────────────────┐
│                        用户操作                             │
│                    点击导出按钮                             │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      UI 层 (React)                          │
│  1. 显示下拉菜单 (PDF/EPUB/TXT/DOCX)                        │
│  2. 用户选择格式                                            │
│  3. 显示"导出中..."加载状态                                 │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   数据收集层                                │
│  1. 从 props.tree 遍历收集所有章节 ID                        │
│     - 卷 (volume) → 递归处理子节点                          │
│     - 幕 (act) → 递归处理子节点                             │
│     - 章节 (note) → 记录 ID、标题、层级信息                  │
│                                                             │
│  2. 并行/串行获取每章内容                                    │
│     for each chapter:                                       │
│       GET /api/v1/notes/{id}                                │
│       chapter.content = htmlToPlainText(response.content)   │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   格式转换层                                │
│  根据选择的格式调用对应生成器：                              │
│                                                             │
│  PDF:  jsPDF                                                │
│    - A4 页面布局                                            │
│    - 页眉页脚                                               │
│    - 自动分页                                               │
│                                                             │
│  EPUB: 手动构建 XML + JSZip                                 │
│    - OPF 包文件                                             │
│    - NCX 目录                                               │
│    - XHTML 章节                                             │
│                                                             │
│  TXT: 纯文本拼接                                            │
│    - Markdown 风格层级标题                                  │
│                                                             │
│  DOCX: docx.js                                              │
│    - 标题样式                                               │
│    - 分页符                                                 │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   文件下载层                                │
│  1. 生成 Blob 对象                                          │
│  2. 创建 Object URL                                         │
│  3. 创建临时 <a> 元素触发下载                               │
│  4. 清理资源 (revokeObjectURL, removeChild)                 │
│  5. 文件名格式: {项目名}_{日期}.{格式}                       │
│     例: 我的小说_2024/3/25.pdf                              │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   状态恢复                                  │
│  1. 关闭加载状态                                            │
│  2. 成功: 静默完成                                          │
│  3. 失败: toast.error('导出失败，请重试')                   │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 数据结构转换

```
后端返回的目录树 (VolumeNode[])
│
├─ VolumeNode (卷)
│  ├─ id, name, order
│  └─ children: ActNode[]
│     └─ ActNode (幕)
│        ├─ id, name, order
│        └─ children: NoteNode[]
│           └─ NoteNode (章节)
│              ├─ id, title, order
│              └─ created_at, word_count
│
▼ 递归遍历 + API 调用

前端使用的 ChapterData[]
│
├─ ChapterData
│  ├─ id: string
│  ├─ title: string
│  ├─ content: string (纯文本，从 HTML 转换)
│  ├─ volumeTitle: string (所属卷名)
│  └─ actTitle: string (所属幕名)
```

### 5.3 错误处理

| 错误场景 | 处理方式 |
|----------|----------|
| 网络请求失败 | toast.error('导出失败，请重试') |
| 章节内容获取失败 | 继续处理其他章节，空内容导出 |
| 格式生成失败 | 捕获异常，显示错误提示 |
| 文件下载失败 | 浏览器默认行为处理 |

## 6. 性能考虑

### 6.1 优化点

1. **并行获取章节内容**
   - 当前: 串行获取 (for...of + await)
   - 优化: 使用 `Promise.all()` 并行获取

2. **大文件处理**
   - PDF/EPUB 生成时考虑分块处理
   - 避免一次性加载过多内容到内存

3. **加载状态**
   - 导出过程中禁用按钮，防止重复点击
   - 显示加载动画提升用户体验

### 6.2 限制

- 章节数量过多时可能导致导出时间较长
- 超大项目导出可能占用较多内存
- EPUB 导出依赖动态导入 JSZip

## 7. 扩展建议

### 7.1 可能的改进

1. **导出选项**
   - 选择导出范围（全部/选中章节）
   - 自定义文件名格式
   - 封面图片设置

2. **格式增强**
   - PDF 添加水印
   - EPUB 添加封面图片
   - DOCX 自定义样式模板

3. **进度显示**
   - 显示导出进度百分比
   - 已处理章节数 / 总章节数

4. **后端导出**
   - 大文件改为后端生成，前端下载
   - 支持异步导出，邮件通知

## 8. 相关文件

### 前端

| 文件 | 说明 |
|------|------|
| `frontend/src/components/Export/Export.tsx` | 主组件实现 |
| `frontend/src/components/Export/index.ts` | 组件导出 |
| `frontend/src/types/api.ts` | API 类型定义 |

### 后端

| 文件 | 说明 |
|------|------|
| `backend/app/schemas/directory.py` | 目录树节点类型定义 |
| `backend/app/api/v1/notes.py` | 章节详情 API |

### 依赖

```bash
# 前端依赖
npm install jspdf docx jszip

# 类型定义
npm install --save-dev @types/jspdf
```
