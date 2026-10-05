# Export 导出功能设计文档

## 1. 功能概述

Export 导出功能允许用户将小说项目的内容导出为多种格式（PDF、EPUB、TXT、DOCX），方便用户在不同场景下使用作品。

### 1.1 支持格式

| 格式 | 说明 | 使用场景 |
|------|------|----------|
| PDF | 便携式文档格式（本机 Edge/Chrome 打印，矢量文字、可搜索） | 打印、分享、存档 |
| EPUB | 电子书格式（EPUB 3 + NCX 兼容） | 电子书阅读器、手机阅读 |
| TXT | 纯文本格式（带目录与首行缩进） | 简单文本编辑、兼容性最好 |
| DOCX | Word 文档格式（保留标题大纲、行距、首行缩进） | 进一步编辑、排版 |

四种格式共同保留：章节顺序（卷 → 幕 → 章）、段落、行距与段落间距、段首缩进、标题层级、
加粗/斜体/删除线/下划线、有序/无序列表（含嵌套层级）、引用、代码块、`<hr>` 分隔线，
以及一个按层级缩进的目录（TOC）。排版参数取自编辑器设置（`editorSettingsStore`）。

## 2. UI 效果

### 2.1 组件位置

Export 组件位于项目侧边栏底部，作为工具按钮组的一部分，仅在目录树非空时渲染，
并通过 `React.lazy` + `Suspense` 按需加载（点击后才拉取 pdf/docx/epub 依赖）。

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
- **背景**: `bg-popover`（`tailwind.config.js` 中的 `popover` 颜色，需要与 `index.css` 的 `--popover` 变量配套）
- **边框**: `border border-border`
- **圆角**: `rounded-lg`
- **阴影**: `shadow-lg`
- **层级**: `z-50`
- **内边距**: `p-1`

#### 菜单项
- **布局**: 垂直列表（PDF / EPUB / TXT / DOCX）
- **内边距**: `px-3 py-2`
- **字体**: `text-sm`
- **对齐**: `text-left`
- **圆角**: `rounded-md`
- **悬停效果**: `hover:bg-primary/5`、`hover:text-primary`、`transition-all duration-200`

#### 遮罩层
- **作用**: 点击外部关闭菜单
- **样式**: `fixed inset-0 z-40`

### 2.3 交互流程

```
点击导出按钮 → 展开菜单 → 选择格式
  → 按钮进入"导出中..."（禁止重复点击）
  → 串行拉取各章节 HTML（GET /api/v1/notes/{id}）
  → 解析为正文块 → 交给对应导出器 → 触发下载
  → 成功：静默完成；失败：toast.error('导出失败，请重试')
```

没有可导出的章节时（目录树里只有卷/幕），提示 `没有可导出的章节` 并直接结束。

## 3. 前端代码实现

### 3.1 文件结构

```
frontend/src/components/Export/
├── Export.tsx        # 主组件：收集章节、读取排版设置、按需加载导出器
└── index.ts          # 导出入口

frontend/src/utils/export/
├── blocks.ts         # HTML → 结构化正文块；目录（TOC）计算；纯文本渲染
├── download.ts       # 文件名清洗与 Blob 下载
├── txt.ts            # TXT 导出
├── docx.ts           # DOCX 导出（docx.js）
├── epub.ts           # EPUB 3 导出（JSZip，含 nav.xhtml 与 toc.ncx）
└── pdf.ts            # PDF 导出：拼打印用 HTML，交给后端浏览器打印

backend/app/
├── api/v1/export.py          # POST /api/v1/export/pdf
└── services/pdf_service.py   # headless Edge/Chrome + CDP Page.printToPDF
```

旧的单文件实现把正文 `textContent` 拍平成纯文本（所有段落粘成一行），
并且把 jsPDF/docx/jszip 静态打进首屏包；重构后各格式按需加载，
构建产物中 `pdf`/`docx`/`epub`/`jszip` 都是独立 chunk。
PDF 不再依赖前端的光栅化库（jsPDF / html2canvas 已移除），
前端只产出打印用 HTML，排版、分页、字体嵌入都由后端调用的浏览器完成。

### 3.2 数据模型（blocks.ts）

```typescript
type ExportBlockKind =
  | 'paragraph'   // 普通段落
  | 'heading'     // 正文内的标题，level 1-3
  | 'listItem'    // 列表项，ordered 表示有序，depth 表示嵌套层级
  | 'quote'       // 引用
  | 'pre'         // 代码块（保留换行与行内缩进）
  | 'separator';  // <hr> 分隔线，纯文本用 `* * *`

interface ExportRun { text: string; bold?; italic?; underline?; strike? }

interface ExportBlock {
  kind: ExportBlockKind;
  level?: number;
  ordered?: boolean;
  depth?: number;
  runs: ExportRun[];
}

interface ExportChapter {
  id: string;
  title: string;
  volumeTitle: string;
  actTitle: string;
  volumeId?: string;   // 同名卷/幕靠 id 区分，标题仅作兜底
  actId?: string;
  blocks: ExportBlock[];
}

interface ExportTextSettings {
  paragraphIndent: number;   // em
  paragraphSpacing: number;  // em
  lineSpacing: number;       // 倍数
  fontSize: number;          // px
}
```

### 3.3 HTML → 正文块解析

`parseNoteHtml(html)` 用 `DOMParser` 把编辑器保存的 HTML 解析成 `ExportBlock[]`：

- **块级元素**（`p/div/h1-h6/li/blockquote/pre/table/...`）各自成为一个块；
- **块级兄弟节点之间插入换行 run**，避免 `<blockquote><p>a</p><p>b</p></blockquote>` 被拼成 `ab`；
- **引用与容器元素**（`blockquote`，以及内部直接含块级子元素的 `div/section/table/...`）
  会按块递归处理：段落（引用转 `quote`）、列表、代码块、分隔线各自成块，
  这样 `<div><ul>…</ul></div>`、`<div><hr></div>` 都不会丢内容；
- **列表**记录 `depth`（嵌套层级）与 `ordered`；`<li>` 里的嵌套列表单独处理，不会混进父项文字；
- **`<pre>`** 进入"保留空白"模式：换行、行首缩进都不折叠；
- **`<hr>`** → `separator`；`<br>` → 换行 run；
- **`<script>/<style>/<title>` 等**直接跳过；
- **XML 非法控制字符**（除 `\t \n \r` 外的 C0、U+FFFE/U+FFFF）一律清掉，
  Word 的软换行 U+000B 归一化成换行——EPUB/DOCX 本身就是 XML，
  混进这些字符会让整份产物变成非法 XML 而直接打不开，不是单个字符显示异常；
- **空白折叠**只作用于 ASCII 空白，全角空格与 `&nbsp;`（作者手动缩进）保留；
- **标签之间的缩进空白**（`<div>\n  <p>a</p>\n</div>`）不会变成段首空行，
  但作者用 `<br><br>` 打出来的段内空行在四种格式里都保留；
- 只有空白的块（TipTap 的空 `<p>`）被丢弃，避免导出出现大量空行。

### 3.4 各格式导出器

#### TXT（txt.ts）
`blocksToText()` 把块渲染成文本：段落一行、首行加全角空格缩进（按 `paragraphIndent`，
半格用半角空格近似）、标题不缩进、列表按 `depth` 缩进并带 `1.` / `- ` 标记（续行只缩进）、
`<hr>` 输出 `* * *`、`<pre>` 原样保留。目录在正文之前，用全角空格表现层级。
卷/幕/章节标题都是纯文本，不加 `#` 这类 markdown 前缀。文件为 UTF-8（无 BOM）。

#### DOCX（docx.ts）
- 封面（TITLE）→ 目录（另起一页）→ 正文，每章之间插入分页符；
- 卷/幕/章分别用 `HEADING_1/2/3`，正文内标题降级到 `HEADING_4/5/6`；
- 正文默认字号由 `settings.fontSize` 换算（px × 0.75，限制 9–24pt），
  行距 `lineSpacing × 240`、段后距与首行缩进按该字号换算成缇（twip）；
- **有序列表**：`Document.numbering.config` 声明 decimal 编号（9 级），
  段落用 `numbering: { reference: 'ordered-list', level: depth, instance }`；
  没有 `instance` 时 Word 会把全书的有序列表当成同一个列表一路数下去，所以每个编号序列都要换实例。
  实例按 `depth` 复用：只有真正输出的非列表内容才结束整条序列，嵌套子列表只关闭更深层、
  外层有序项继续编号，与 TXT/EPUB/PDF 的计数器语义一致；
  无序列表用内置 `bullet: { level: depth }`（docx 会自动注入项目符号定义）；
- 标题字号按正文字号的比例重新指定（h1 1.6×、h2 1.4×、h3 1.25×、h4 1.15×、h5 1.08×、h6 1.02×），
  否则 docx 内置的 Heading2/Heading3（13pt/12pt）在正文调大后会比正文还小；
- 引用左缩进、代码块等宽字体、`<hr>` 居中 `* * *`。

#### EPUB（epub.ts）
- 生成 `mimetype`（**必须第一条且不压缩**）+ `META-INF/container.xml` +
  `OEBPS/{content.opf, nav.xhtml, toc.ncx, styles/style.css, titlepage.xhtml, chapter-N.xhtml}`；
- OPF 为 EPUB 3：`properties="nav"`、`dcterms:modified`、`unique-identifier`；
  NCX 同时保留以兼容旧阅读器，`dtb:depth` 由真实目录树深度计算；
- 列表块按 `depth` 重新组装成**真正嵌套**的 `<ul>/<ol>`；
  同一层列表类型变化时先关闭当前列表（否则相邻的 `<ul>` 与 `<ol>` 会被合成一个）；
  层级跳跃（例如父项是空段落被丢弃）时补一个空 `<li>` 占位，
  避免出现 `<ul>` 直接嵌在 `<ul>` 里的非法结构；
- 所有插值都经过 `escapeXml`（同时清掉 XML 非法控制字符，
  书名、章节标题这类不经过正文解析的文本也走这里），`<br/>` 在转义之后插入，保证 XHTML 合法；
- 除 `mimetype` 外的文件用 DEFLATE 压缩；
- 目录使用嵌套 `<ol>`（nav.xhtml）与嵌套 `<navPoint>`（toc.ncx）。

#### PDF（pdf.ts + 后端 pdf_service.py）
jsPDF 内置字体没有中文字形，所以中文必须由"有字体的排版引擎"来画。旧做法是把
页面光栅化成 JPEG（中文正确但没有文字层，300 页约 40–70MB）；现在改为
**本机 Chromium 内核浏览器打印**：

1. `buildPrintHtml()` 把 `ExportChapter[]` 拼成一份完整的打印 HTML：
   封面、目录、每章一节（`break-before: page`），排版参数直接映射 CSS
   （`font-size: ${fontSize}px`、`line-height: ${lineSpacing}`、
   `text-indent: ${paragraphIndent}em`），文本全部转义且不含脚本；
2. 前端 `exportToPdf()` 把 HTML POST 给 `/api/v1/export/pdf`（`responseType: 'blob'`，
   超时放宽到 10 分钟），拿到 PDF 后走 `downloadBlob()`；
3. 后端 `pdf_service.render_pdf()` 把 HTML 写进临时文件，用
   `--headless=new --remote-debugging-port=0` 启动本机 Edge/Chrome，
   通过 CDP 依次 `Page.enable` → `Page.navigate` → 等 `Page.loadEventFired`
   → `document.fonts.ready` → `Page.printToPDF`，然后关掉浏览器、删临时目录；
4. `Page.printToPDF` 的参数：`preferCSSPageSize`（A4 由 CSS 决定）、
   `printBackground`、页边距用英寸参数控制、`headerTemplate` 放书名、
   `footerTemplate` 放"第 N 页"，均由 Chromium 自己绘制；
5. 中文由浏览器嵌入字体子集，PDF 自带 ToUnicode 映射 → **可搜索、可复制**。

关于字体有两条实测出来的硬性要求（否则会静默退化成 Type3 位图字形：
页眉页脚中文直接不显示，体积还会翻三倍）：

- 字体栈里**不能把可变字体放在最前面**（例如系统安装的 `NotoSerifSC-VF`），
  静态字体（SimSun / Songti SC / Source Han Serif）优先；
- 打印模板的 `font-family` 必须点名同一个静态 CJK 字体，且模板属性用单引号
  （`style='...'`），否则字体名里的双引号会提前结束属性、整条 CSS 失效。

### 3.5 主处理函数（Export.tsx）

```typescript
const handleExport = async (format: ExportFormat) => {
  setIsExporting(true);
  setShowMenu(false);
  try {
    const chapters = await loadChapters();          // 串行 GET /notes/{id} + parseNoteHtml
    if (chapters.length === 0) {
      toast.error('没有可导出的章节');
      return;
    }
    const options = { title: projectTitle || '我的小说', date: new Date().toLocaleDateString('zh-CN'), settings };

    if (format === 'pdf') {
      const { exportToPdf } = await import('@/utils/export/pdf');
      await exportToPdf(chapters, options);
    } else if (format === 'epub') {
      const { exportToEpub } = await import('@/utils/export/epub');
      await exportToEpub(chapters, options);
    } else if (format === 'txt') {
      const { exportToTxt } = await import('@/utils/export/txt');
      exportToTxt(chapters, options);
    } else {
      const { exportToDocx } = await import('@/utils/export/docx');
      await exportToDocx(chapters, options);
    }
  } catch (error) {
    console.error('导出失败:', error);
    // 导出失败原因（例如"未找到 Edge/Chrome"）由各导出器抛在 message 里
    toast.error(error instanceof Error && error.message ? error.message : '导出失败，请重试');
  } finally {
    setIsExporting(false);
  }
};
```

### 3.6 目录（TOC）生成

`buildTocEntries()` 是四种格式共用的唯一目录来源：

- 卷/幕只在切换时输出一次（同名的卷靠 `volumeId` 区分，换卷时同名幕会重新输出）；
- 章节逐条输出，层级为 卷(1) → 幕(2) → 章(3)；
- 既不属于卷也不属于幕的章节标记 `detached`，在嵌套目录里回到顶层；
- 目录缩进 = `tocIndent(level) × 2`（字符/em），各格式换算成自己的单位。

### 3.7 依赖库

前端（PDF 已不再需要 jspdf / html2canvas）：

```json
{
  "docx": "^9.6.1",
  "jszip": "^3.10.1"
}
```

后端（`backend/requirements.txt`）：

```
websockets>=10.4   # CDP 走 WebSocket；uvicorn[standard] 已间接依赖，这里显式声明
```

PDF 打印还需要本机存在 Chromium 内核浏览器：自动查找 Windows Edge/Chrome、
macOS 的 Edge/Chrome/Chromium、Linux 的 microsoft-edge/google-chrome/chromium；
可用环境变量 `PDF_BROWSER_PATH` 指定。

## 4. 后端 API

### 4.1 数据结构

#### 目录树节点类型（backend/app/schemas/directory.py）

```python
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
    title: str
    order: int
    created_at: datetime
    word_count: int = 0
```

#### 章节详情响应（NoteResponse）

```typescript
interface NoteResponse {
  title: string;
  content: string | null;   // 编辑器保存的 HTML（TipTap 输出，如 <p>…</p>）
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

| 端点 | 用途 |
|------|------|
| `GET /api/v1/notes/{note_id}` | 获取单个章节的完整 HTML 内容 |
| `GET /api/v1/projects/{project_id}/tree` | 目录树，Export 组件通过 props 接收 |
| `POST /api/v1/export/pdf` | 把打印用 HTML 渲染成 PDF，直接回传 `application/pdf` |

`POST /api/v1/export/pdf` 的请求体：

```json
{ "html": "<完整打印 HTML>", "title": "书名", "filename": "书名_2024-3-25.pdf" }
```

响应：`200` + PDF 字节（`Content-Disposition: attachment; filename*=UTF-8''…`）。
出错时：`400` 打印内容含白名单外的标签或属性（脚本、事件属性、外部资源等）、
`503` 本机没有浏览器、`502` 浏览器打印失败。

## 5. 业务逻辑流程

### 5.1 完整导出流程

```
用户点击导出 → 选择格式
  → collectAllChapters(tree)：递归收集 (章节 id, 标题, 卷, 幕, volumeId, actId)
  → 串行 GET /notes/{id} → parseNoteHtml(content) → ExportBlock[]
  → 读取 editorSettingsStore（缩进/段距/行距/字号）
  → 分派到对应导出器（动态 import）
      ├─ TXT / DOCX / EPUB：前端生成 Blob → downloadBlob
      └─ PDF：buildPrintHtml() → POST /api/v1/export/pdf
              → 后端 headless Edge/Chrome 打印 → PDF 字节 → downloadBlob
  → 文件名：书名_日期.扩展名，非法字符替换为 -
  → finally：恢复按钮状态
```

### 5.2 数据结构转换

```
VolumeNode / ActNode / NoteNode（后端目录树）
        │ 递归
        ▼
ChapterMeta[]（id、title、volumeTitle、actTitle、volumeId、actId）
        │ 逐章 GET /notes/{id}
        ▼
ExportChapter[]（…加上 blocks: ExportBlock[]）
        │ blocks.ts / 各导出器
        ▼
TXT / DOCX / EPUB / PDF
```

### 5.3 错误处理

| 错误场景 | 处理方式 |
|----------|----------|
| 网络请求失败 | toast 显示具体原因（导出器抛出的 message），按钮恢复可用 |
| 目录树里没有章节 | `toast.error('没有可导出的章节')` |
| 单个章节内容为空 | 该章只输出标题，其余章节继续导出 |
| 本机没有 Edge/Chrome | 接口返回 `503` + "未找到 Microsoft Edge 或 Google Chrome…"，前端 toast 原文显示 |
| 浏览器打印失败/超时 | 接口返回 `502` + 失败原因（打印超时 180 秒、CDP 调用失败等） |
| 打印 HTML 含白名单外的标签/属性 | 接口返回 `400` 并列出违规项（HTML 由本前端生成，正常不会出现） |
| 格式生成失败 | 捕获异常，显示错误提示 |

## 6. 性能与取舍（实测）

### 6.1 分包

`Export.tsx` 通过动态 `import()` 按需加载导出器，生产构建的独立 chunk（未 gzip）：
`pdf ≈ 9KB`（只拼 HTML）、`docx ≈ 343KB`、`jszip ≈ 96KB`、`epub ≈ 7KB`、
`txt ≈ 0.7KB`、`Export ≈ 4.3KB`。首屏不加载这些依赖；
PDF 不再往首屏带 jsPDF（约 408KB）与 html2canvas（约 200KB）。

### 6.2 PDF 体积与内存（浏览器打印 vs 旧光栅）

同一份内容（A4、13.5px、行距 1.8、25/20mm 页边距）：

| 方案 | 页数 | 体积 | 每页 | 文字层 |
|------|------|------|------|--------|
| 旧：html2canvas + jsPDF（144dpi JPEG） | 300 | 40–70MB | 135–230KB | 无 |
| 新：Chromium 打印（矢量） | 273 | 0.92MB | 3.3KB | 有 |
| 新：Chromium 打印（真实中文语料） | 274 | 2.78MB | 10.1KB | 有 |

- 体积下降约 20~50 倍；排版在浏览器进程里完成，前端不再持有整本书的位图；
- 打印时间：274 页约 2 秒、617 页约 6 秒（含启动浏览器）；
- 代价：没有 Chromium 内核浏览器就没有 PDF；页眉页脚由打印模板绘制，
  会出现在**每一页**（包括封面），不像旧实现能跳过封面。

### 6.3 PDF 打印流水线

- 每次导出启动一个一次性的浏览器实例（独立 `--user-data-dir` 与随机端口），
  结束即 `terminate()`（必要时 `kill()`）并删除临时目录；
- 页面用 `file://` 打开临时 HTML；因为不带 `--allow-file-access-from-files`，
  `file://` 页面无法读取其他本地文件；
- 打印用 `Page.printToPDF` 返回 Base64，直接解码成字节流，不经过 Base64 字符串中转；
- 三种失败都有独立异常：找不到浏览器（`PdfBrowserUnavailable` → 503）、
  启动/连接/打印失败（`PdfRenderError` → 502）、请求体超限（Pydantic 校验 → 422）。

### 6.4 其他格式

- EPUB 除 `mimetype` 外用 DEFLATE 压缩（同样内容比全 STORE 小约 45%）；
- DOCX/EPUB 都是纯字符串拼接或库调用，主要成本是逐章请求；
- 章节内容目前**串行**获取（`for…of + await`）。章节很多时可以改成
  `Promise.all` 分批并发，但要注意后端压力。

### 6.5 限制

- 章节数量多时导出耗时较长，UI 只有"导出中..."状态，没有进度百分比；
- PDF 依赖本机 Chromium 内核浏览器（Windows 上等于依赖 Edge/Chrome）；
- PDF 的页眉页脚由打印模板统一绘制，无法像旧实现那样"封面不画页眉"；
- 打印字形跟随系统字体：编辑器用的是 Google Fonts 的 Noto Serif SC，
  PDF 在 Windows 上会落到宋体（静态字体才能被 Chromium 嵌成文字层）。
  想要完全一致，需要在 Electron 阶段自带一份静态字体并用 `@font-face` 引入；
- PDF 目录目前没有页码（Chromium 不支持 CSS 页码边距盒；有文字层后可以用
  两遍打印 + 解析结果回填，见第 7 节）。

## 7. 扩展建议

1. **PDF 目录页码/书签**：先打印一遍，用文字层定位各章所在页，
   再打印第二遍把页码填进目录（Chromium 打印输出不含 PDF 大纲）。
2. **导出选项**：选择导出范围（全部/选中章节）、自定义文件名、封面图片、按卷拆分
   （`Page.printToPDF` 支持 `pageRanges`）。
3. **进度显示**：已处理章节数 / 总章节数 + 取消导出。
4. **并发拉取**：把逐章请求改为分批并发。
5. **自带字体**：Electron 阶段把静态 CJK 字体打进安装包，打印时用 `@font-face`
   引用本地文件，既与编辑器一致，也不依赖系统字体。
6. **Electron 原生打印**：迁移到 Electron 后把后端这一步换成
   `webContents.printToPDF`，`buildPrintHtml()` 与打印参数可以原样复用。

## 8. 相关文件

### 前端

| 文件 | 说明 |
|------|------|
| `frontend/src/components/Export/Export.tsx` | 主组件：收集章节、读取设置、按需加载导出器 |
| `frontend/src/components/Export/index.ts` | 组件导出 |
| `frontend/src/utils/export/blocks.ts` | HTML → 正文块、目录计算、纯文本渲染 |
| `frontend/src/utils/export/txt.ts` | TXT 导出 |
| `frontend/src/utils/export/docx.ts` | DOCX 导出 |
| `frontend/src/utils/export/epub.ts` | EPUB 导出 |
| `frontend/src/utils/export/pdf.ts` | PDF 导出：拼打印 HTML + 调后端接口 |
| `frontend/src/utils/export/download.ts` | 文件名清洗与下载 |
| `frontend/src/stores/editorSettingsStore.ts` | 排版设置来源 |
| `frontend/src/types/api.ts` | API 类型定义 |

### 测试

| 文件 | 说明 |
|------|------|
| `frontend/tests/export/harness.ts` | 浏览器侧断言：HTML 解析、纯文本渲染、目录、EPUB/DOCX 结构、打印 HTML |
| `frontend/tests/export/export.spec.ts` | Playwright 用例：注入断言并校验三种前端格式的真实下载产物 |
| `frontend/tests/export/bundle.mjs` | 用 Vite 把浏览器侧断言打成单文件 |
| `backend/tests/test_pdf_export.py` | pytest：真实调用浏览器打印，校验页数、文字层、页脚页码与体积 |
| `backend/tests/test_export_api.py` | pytest：打印 HTML 白名单校验、400/502/503 映射、文件名编码（不启动浏览器） |

运行 `cd frontend && npm test`（默认使用系统 Edge，可用 `PW_CHANNEL` 覆盖浏览器通道）；
后端用例用 `cd backend && ./venv/bin/pytest tests/test_export_api.py tests/test_pdf_export.py`
（接口校验用例始终运行，PDF 打印用例在本机没有浏览器时自动跳过）。

### 后端

| 文件 | 说明 |
|------|------|
| `backend/app/schemas/directory.py` | 目录树节点类型定义 |
| `backend/app/api/v1/notes.py` | 章节详情 API |
| `backend/app/api/v1/export.py` | `POST /api/v1/export/pdf`：校验并按需转成 503/502 |
| `backend/app/services/pdf_service.py` | 启动 headless Edge/Chrome，CDP `Page.printToPDF` 出 PDF |
