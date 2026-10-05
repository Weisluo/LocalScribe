import {
  ExportChapter,
  ExportTextSettings,
  TOC_INDENT_PER_LEVEL,
  TOC_TITLE,
  blocksToText,
  buildTocEntries,
  chapterHeadingFlags,
  indentPrefix,
  tocIndent,
} from './blocks';
import { buildExportFileName, downloadBlob } from './download';

export interface TxtExportOptions {
  title: string;
  date: string;
  settings: ExportTextSettings;
}

/** 生成 TXT 全文（段落保留换行与首行缩进） */
export const buildTxtContent = (chapters: ExportChapter[], options: TxtExportOptions): string => {
  const { title, date, settings } = options;
  const lines: string[] = ['='.repeat(50), title, date, '='.repeat(50), ''];

  const tocEntries = buildTocEntries(chapters);
  if (tocEntries.length > 0) {
    lines.push(TOC_TITLE, '');
    tocEntries.forEach((entry) => {
      // 用全角空格表现层级，与 PDF / DOCX / EPUB 的目录结构一致
      lines.push(`${indentPrefix(tocIndent(entry.level) * TOC_INDENT_PER_LEVEL)}${entry.title}`);
    });
    lines.push('', '-'.repeat(40), '');
  }

  chapters.forEach((chapter, index) => {
    const { newVolume, newAct } = chapterHeadingFlags(chapters, index);
    // 纯文本产物不给标题加 markdown 前缀，否则 # 会被当成正文字符读出来
    if (newVolume) lines.push(chapter.volumeTitle, '');
    if (newAct) lines.push(chapter.actTitle, '');
    lines.push(chapter.title, '');

    const body = blocksToText(chapter.blocks, settings);
    if (body) lines.push(body, '');

    lines.push('-'.repeat(40), '');
  });

  return lines.join('\n');
};

export const exportToTxt = (chapters: ExportChapter[], options: TxtExportOptions): void => {
  const blob = new Blob([buildTxtContent(chapters, options)], {
    type: 'text/plain;charset=utf-8',
  });
  downloadBlob(blob, buildExportFileName(options.title, options.date, 'txt'));
};
