/**
 * PDF 导出（交给本机 Chromium 内核浏览器打印）
 *
 * 这里只负责把章节数据拼成一份"打印用 HTML"，真正的排版与分页由后端的
 * `POST /api/v1/export/pdf` 交给 Edge/Chrome 完成（见 backend/app/services/pdf_service.py）。
 *
 * 为什么不再用 jsPDF + html2canvas：jsPDF 内置字体没有中文字形，旧方案只能
 * 先把页面光栅化成 JPEG——实测 135~230KB/页，300 页约 40~70MB，而且没有文字层。
 * 换成浏览器打印后，中文由浏览器嵌入字体子集：实测 274 页 / 18 万汉字 = 2.78MB，
 * 并且可以搜索、复制。
 */
import { api, ApiError } from '@/utils/request';
import {
  LIST_INDENT_PER_LEVEL,
  SEPARATOR_TEXT,
  TOC_INDENT_PER_LEVEL,
  TOC_TITLE,
  buildTocEntries,
  chapterHeadingFlags,
  runsToText,
  sanitizeXmlText,
  tocIndent,
} from './blocks';
import type { ExportBlock, ExportChapter, ExportRun, ExportTextSettings } from './blocks';
import { buildExportFileName, downloadBlob } from './download';

export interface PdfExportOptions {
  title: string;
  date: string;
  settings: ExportTextSettings;
}

/** 打印要等浏览器排版，远长于 axios 默认的 30 秒 */
const EXPORT_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * 打印字体栈：静态 CJK 衬线字体优先。
 *
 * 不要把可变字体（例如系统里安装的 NotoSerifSC-VF）放在最前面：Chromium 无法
 * 把可变字体嵌进 PDF，会退化成 Type3 位图字形——既没有文字层，体积还大 3 倍
 * （实测同一页：SimSun 27KB / Noto VF 82KB）。等到 Electron 阶段自带一份
 * 静态字体，再谈与编辑器字形完全一致。
 */
const PRINT_FONT_STACK =
  'SimSun, "Songti SC", "Source Han Serif SC", "Noto Serif CJK SC", "Noto Serif SC", serif';
const PRINT_MONO_STACK = 'Consolas, "Courier New", monospace';

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** 转义后再清控制字符：标题、日期这类不经过正文解析的文本也走这里 */
const escapeHtml = (text: string): string =>
  sanitizeXmlText(text).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);

/** 内联样式片段 → HTML（换行交给 <br/>，与编辑器一致） */
const runsToHtml = (runs: ExportRun[]): string =>
  runs
    .map((run) => {
      let html = escapeHtml(run.text).replace(/\n/g, '<br/>');
      if (run.strike) html = `<span class="strike">${html}</span>`;
      if (run.underline) html = `<span class="underline">${html}</span>`;
      if (run.italic) html = `<em>${html}</em>`;
      if (run.bold) html = `<strong>${html}</strong>`;
      return html;
    })
    .join('');

/** 正文块 → HTML；列表用行内标记 + 层级缩进，避免生成非法的嵌套结构 */
const renderBlocks = (blocks: ExportBlock[]): string[] => {
  const html: string[] = [];
  /** 每一层有序列表当前的序号 */
  const orderedCounters: number[] = [];

  for (const block of blocks) {
    if (block.kind === 'separator') {
      orderedCounters.length = 0;
      html.push(`<p class="separator">${escapeHtml(SEPARATOR_TEXT)}</p>`);
      continue;
    }

    // 空白块（含只剩空白的 <pre>）一律跳过，与 DOCX / EPUB 保持一致
    if (!block.runs.some((run) => run.text.trim())) continue;

    if (block.kind === 'pre') {
      orderedCounters.length = 0;
      const code = escapeHtml(runsToText(block.runs).replace(/^\n+|\n+$/g, ''));
      html.push(`<pre>${code}</pre>`);
      continue;
    }

    if (block.kind === 'listItem') {
      const depth = Math.max(0, block.depth ?? 0);
      if (block.ordered) {
        orderedCounters[depth] = (orderedCounters[depth] ?? 0) + 1;
        orderedCounters.length = depth + 1;
      } else {
        // 只清掉本级及更深的计数，外层有序列表继续编号
        orderedCounters.length = depth;
      }
      const marker = block.ordered ? `${orderedCounters[depth] ?? 1}. ` : '· ';
      const margin = 1 + depth * LIST_INDENT_PER_LEVEL;
      html.push(
        `<p class="list-item" style="margin-left: ${margin}em">${escapeHtml(marker)}${runsToHtml(block.runs)}</p>`
      );
      continue;
    }

    // 任何非列表内容都结束当前编号序列
    orderedCounters.length = 0;

    if (block.kind === 'heading') {
      // 章节标题占用 h1，正文里的标题降一级
      const level = Math.min(4, Math.max(2, (block.level ?? 1) + 1));
      html.push(`<h${level}>${runsToHtml(block.runs)}</h${level}>`);
      continue;
    }

    if (block.kind === 'quote') {
      html.push(`<blockquote>${runsToHtml(block.runs)}</blockquote>`);
      continue;
    }

    html.push(`<p>${runsToHtml(block.runs)}</p>`);
  }

  return html;
};

/** 把章节数据拼成一份可直接打印的完整 HTML（不含脚本，所有文本都已转义） */
export const buildPrintHtml = (chapters: ExportChapter[], options: PdfExportOptions): string => {
  const { title, date, settings } = options;

  const tocEntries = buildTocEntries(chapters);
  const tocHtml = [
    '<section class="toc">',
    `<h2 class="toc-title">${TOC_TITLE}</h2>`,
    ...tocEntries.map(
      (entry) =>
        `<p class="toc-item toc-level-${entry.level}" style="margin-left: ${
          tocIndent(entry.level) * TOC_INDENT_PER_LEVEL
        }em">${escapeHtml(entry.title)}</p>`
    ),
    '</section>',
  ].join('\n');

  const chaptersHtml = chapters
    .map((chapter, index) => {
      const { newVolume, newAct } = chapterHeadingFlags(chapters, index);
      const parts = ['<section class="chapter">'];
      if (newVolume) parts.push(`<p class="volume-title">${escapeHtml(chapter.volumeTitle)}</p>`);
      if (newAct) parts.push(`<p class="act-title">${escapeHtml(chapter.actTitle)}</p>`);
      parts.push(`<h1 class="chapter-title">${escapeHtml(chapter.title)}</h1>`);
      parts.push(...renderBlocks(chapter.blocks));
      parts.push('</section>');
      return parts.join('\n');
    })
    .join('\n');

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(title)}</title>
<style>
  /* 只用 CSS 决定纸张大小，页边距由后端打印参数控制（页眉页脚需要确定的绘制区） */
  @page { size: A4; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: ${PRINT_FONT_STACK};
    font-size: ${settings.fontSize}px;
    line-height: ${settings.lineSpacing};
    color: #000000;
    line-break: strict;
  }
  /* 与编辑器一致：字号 px、行距倍数、段间距与段首缩进用 em */
  p {
    margin: 0 0 ${settings.paragraphSpacing}em;
    text-indent: ${settings.paragraphIndent}em;
    orphans: 2;
    widows: 2;
  }
  .cover { break-after: page; text-align: center; margin-top: 38%; }
  .cover-title { font-size: 2em; margin: 0 0 0.8em; }
  .cover-date { text-indent: 0; margin: 0; }
  .toc-title { text-align: center; font-size: 1.4em; margin: 0 0 1.5em; }
  .toc-item { text-indent: 0; margin: 0 0 0.5em; }
  .toc-level-1 { font-weight: 600; }
  .chapter { break-before: page; }
  .chapter-title { font-size: 1.5em; text-align: center; margin: 0 0 1em; }
  .volume-title, .act-title { text-indent: 0; text-align: center; font-weight: 600; margin: 0 0 0.6em; }
  .volume-title { font-size: 1.2em; }
  .act-title { font-size: 1.08em; }
  h2, h3, h4 { text-indent: 0; break-after: avoid; margin: 1em 0 0.6em; }
  .list-item { text-indent: 0; margin-bottom: 0.4em; break-inside: avoid; }
  .separator { text-indent: 0; text-align: center; margin: 1.5em 0; }
  blockquote { margin: 0 0 ${settings.paragraphSpacing}em 2em; }
  blockquote p { text-indent: 0; }
  pre {
    font-family: ${PRINT_MONO_STACK};
    font-size: 0.9em;
    white-space: pre-wrap;
    text-indent: 0;
    margin: 0 0 ${settings.paragraphSpacing}em;
    break-inside: avoid;
  }
  .strike { text-decoration: line-through; }
  .underline { text-decoration: underline; }
</style>
</head>
<body>
<section class="cover">
  <h1 class="cover-title">${escapeHtml(title)}</h1>
  <p class="cover-date">${escapeHtml(date)}</p>
</section>
${tocHtml}
${chaptersHtml}
</body>
</html>
`;
};

/** 把后端返回的错误（responseType 为 blob）还原成可读提示 */
const describeError = async (error: unknown, fallback: string): Promise<string> => {
  if (error instanceof ApiError) {
    const details = error.details;
    if (details instanceof Blob) {
      try {
        const payload = JSON.parse(await details.text()) as { detail?: unknown };
        if (typeof payload.detail === 'string' && payload.detail) return payload.detail;
      } catch {
        // 不是 JSON 就用兜底提示
      }
    }
    if (error.message) return error.message;
  }
  return fallback;
};

export const exportToPdf = async (
  chapters: ExportChapter[],
  options: PdfExportOptions
): Promise<void> => {
  const html = buildPrintHtml(chapters, options);
  const fileName = buildExportFileName(options.title, options.date, 'pdf');

  try {
    const blob = await api.post<Blob>(
      '/export/pdf',
      { html, title: options.title, filename: fileName },
      { responseType: 'blob', timeout: EXPORT_TIMEOUT_MS }
    );
    downloadBlob(blob, fileName);
  } catch (error) {
    // 让上层 toast 显示"未找到 Edge/Chrome"这类具体原因
    throw new Error(await describeError(error, '导出失败，请重试'));
  }
};
