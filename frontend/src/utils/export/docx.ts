import {
  AlignmentType,
  Document,
  HeadingLevel,
  LevelFormat,
  PageBreak,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import {
  ExportBlock,
  ExportChapter,
  ExportRun,
  ExportTextSettings,
  SEPARATOR_TEXT,
  TOC_INDENT_PER_LEVEL,
  TOC_TITLE,
  buildTocEntries,
  chapterHeadingFlags,
  sanitizeXmlText,
  tocIndent,
} from './blocks';
import { buildExportFileName, downloadBlob } from './download';

export interface DocxExportOptions {
  title: string;
  date: string;
  settings: ExportTextSettings;
}

/** 正文基准字号（磅）：跟随编辑器字号（px→pt 约 0.75 倍），限制在可读区间内 */
const BODY_FONT_SIZE_PT_MIN = 9;
const BODY_FONT_SIZE_PT_MAX = 24;
const bodyFontSizePt = (settings: ExportTextSettings): number =>
  Math.min(BODY_FONT_SIZE_PT_MAX, Math.max(BODY_FONT_SIZE_PT_MIN, settings.fontSize * 0.75));
/** 1 磅 = 20 缇 */
const TWIPS_PER_PT = 20;
/** 单倍行距在 OOXML 中为 240 */
const LINE_SPACING_UNIT = 240;
/** 有序列表编号引用名 */
const ORDERED_LIST_REFERENCE = 'ordered-list';
/** 列表最多支持 9 级（OOXML 惯例） */
const MAX_LIST_LEVEL = 8;

/**
 * 标题字号相对于正文字号的倍率。
 * docx 内置的 Heading2/Heading3 是固定磅值（13pt / 12pt），
 * 当正文跟随编辑器字号变大时会比正文还小，这里统一按比例重新指定。
 */
const HEADING_SIZE_RATIOS = [1.6, 1.4, 1.25, 1.15, 1.08, 1.02];

const headingStyles = (bodyPt: number) => {
  const heading = (ratio: number) => ({
    run: { size: Math.round(bodyPt * ratio * 2), bold: true },
    paragraph: { spacing: { before: 200, after: 200 } },
  });
  return {
    heading1: heading(HEADING_SIZE_RATIOS[0]),
    heading2: heading(HEADING_SIZE_RATIOS[1]),
    heading3: heading(HEADING_SIZE_RATIOS[2]),
    heading4: heading(HEADING_SIZE_RATIOS[3]),
    heading5: heading(HEADING_SIZE_RATIOS[4]),
    heading6: heading(HEADING_SIZE_RATIOS[5]),
  };
};

/**
 * 有序列表的编号定义。
 * docx 只为无序列表内置了编号，有序列表必须自己声明 decimal 编号，
 * 否则所有列表项都会渲染成项目符号。
 */
const orderedListLevels = () =>
  Array.from({ length: MAX_LIST_LEVEL + 1 }, (_, level) => ({
    level,
    format: LevelFormat.DECIMAL,
    text: `%${level + 1}.`,
    alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
  }));

/** 把内联片段转成 docx 的 TextRun，保留加粗/斜体等样式与手动换行 */
const runsToTextRuns = (runs: ExportRun[], monospace = false): TextRun[] => {
  const textRuns: TextRun[] = [];

  for (const run of runs) {
    // OOXML 也是 XML，控制字符会让 Word 报文件损坏，先清掉
    const text = sanitizeXmlText(run.text);
    text.split('\n').forEach((part, index) => {
      if (index > 0) textRuns.push(new TextRun({ break: 1 }));
      if (!part) return;
      textRuns.push(
        new TextRun({
          text: part,
          bold: run.bold,
          italics: run.italic,
          underline: run.underline ? {} : undefined,
          strike: run.strike,
          font: monospace ? 'Consolas' : undefined,
        })
      );
    });
  }

  return textRuns;
};

const headingForLevel = (level: number): (typeof HeadingLevel)[keyof typeof HeadingLevel] => {
  // 章节标题占用 HEADING_1~3，正文里的标题从 HEADING_4 开始
  if (level <= 1) return HeadingLevel.HEADING_4;
  if (level === 2) return HeadingLevel.HEADING_5;
  return HeadingLevel.HEADING_6;
};

const blocksToParagraphs = (
  blocks: ExportBlock[],
  spacing: { line: number; after: number; firstLine: number },
  /** 有序列表实例计数器：每次重新开始编号都要换一个实例，否则 Word 会接着上一个列表数 */
  listInstances: { value: number }
): Paragraph[] => {
  const paragraphs: Paragraph[] = [];
  /**
   * 各层级正在使用的编号实例（下标即 depth）。语义与 PDF / EPUB / TXT 的计数器一致：
   * 只有真正输出的非列表内容才结束整条编号序列，无序项只关闭本级及更深的实例——
   * 否则嵌套子列表之后的同级有序项会被误判成新列表，从 1 重开。
   */
  const orderedInstances: number[] = [];

  for (const block of blocks) {
    if (block.kind === 'listItem') {
      // 空列表项不参与编号，也不影响外层计数
      if (block.runs.every((run) => !run.text.trim())) continue;

      const depth = Math.min(MAX_LIST_LEVEL, Math.max(0, block.depth ?? 0));

      if (block.ordered) {
        if (orderedInstances[depth] === undefined) {
          listInstances.value += 1;
          orderedInstances.length = depth + 1;
          orderedInstances[depth] = listInstances.value;
        }
      } else {
        // 只关闭本级及更深的计数，外层有序列表继续编号
        orderedInstances.length = depth;
      }

      paragraphs.push(
        new Paragraph({
          children: runsToTextRuns(block.runs),
          // 有序列表用 decimal 编号（按实例重新计数），无序列表用 docx 内置项目符号
          ...(block.ordered
            ? {
                numbering: {
                  reference: ORDERED_LIST_REFERENCE,
                  level: depth,
                  instance: orderedInstances[depth],
                },
              }
            : { bullet: { level: depth } }),
          spacing: { line: spacing.line, after: spacing.after },
        })
      );
      continue;
    }

    if (block.kind === 'separator') {
      orderedInstances.length = 0;
      paragraphs.push(
        new Paragraph({
          text: SEPARATOR_TEXT,
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 200 },
        })
      );
      continue;
    }

    // 空白块不参与编号，也不结束编号序列（与 TXT / PDF 一致）
    if (block.runs.every((run) => !run.text.trim())) continue;

    // 真正输出的非列表内容才结束当前编号序列
    orderedInstances.length = 0;

    if (block.kind === 'heading') {
      paragraphs.push(
        new Paragraph({
          children: runsToTextRuns(block.runs),
          heading: headingForLevel(block.level ?? 1),
          spacing: { before: 200, after: 200 },
        })
      );
      continue;
    }

    // 代码块：保留换行与行内空白，等宽字体，不加首行缩进
    if (block.kind === 'pre') {
      paragraphs.push(
        new Paragraph({
          children: runsToTextRuns(block.runs, true),
          spacing: { line: spacing.line, after: spacing.after },
        })
      );
      continue;
    }

    if (block.kind === 'quote') {
      paragraphs.push(
        new Paragraph({
          children: runsToTextRuns(block.runs),
          indent: { left: 480, firstLine: spacing.firstLine },
          spacing: { line: spacing.line, after: spacing.after },
        })
      );
      continue;
    }

    paragraphs.push(
      new Paragraph({
        children: runsToTextRuns(block.runs),
        indent: { firstLine: spacing.firstLine },
        spacing: { line: spacing.line, after: spacing.after },
      })
    );
  }

  return paragraphs;
};

/** 目录页：层级与正文标题（卷/幕/章）一致，卷加粗 */
const tocToParagraphs = (chapters: ExportChapter[], bodyPt: number): Paragraph[] => {
  const entries = buildTocEntries(chapters);
  if (entries.length === 0) return [];

  // 目录每级缩进：一个字宽 = 正文字号
  const indentPerLevel = TOC_INDENT_PER_LEVEL * bodyPt * TWIPS_PER_PT;

  const paragraphs: Paragraph[] = [
    new Paragraph({
      text: TOC_TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
  ];

  for (const entry of entries) {
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: sanitizeXmlText(entry.title), bold: entry.level === 1 })],
        indent: { left: Math.round(tocIndent(entry.level) * indentPerLevel) },
        spacing: { after: 120 },
      })
    );
  }

  return paragraphs;
};

/** 生成 DOCX 文档对象（正文保留首行缩进、行距与段落间距） */
export const buildDocxDocument = (
  chapters: ExportChapter[],
  options: DocxExportOptions
): Document => {
  const { title, date, settings } = options;
  const bodyPt = bodyFontSizePt(settings);
  const spacing = {
    line: Math.round(settings.lineSpacing * LINE_SPACING_UNIT),
    after: Math.round(settings.paragraphSpacing * bodyPt * TWIPS_PER_PT),
    firstLine: Math.round(settings.paragraphIndent * bodyPt * TWIPS_PER_PT),
  };

  const children: Paragraph[] = [
    new Paragraph({
      text: sanitizeXmlText(title),
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: sanitizeXmlText(date),
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
  ];

  // 封面之后是目录页，目录之后正文另起一页
  const toc = tocToParagraphs(chapters, bodyPt);
  if (toc.length > 0) {
    children.push(
      new Paragraph({ children: [new PageBreak()] }),
      ...toc,
      new Paragraph({ children: [new PageBreak()] })
    );
  }

  // 有序列表实例：跨章节递增，保证每个列表从头编号
  const listInstances = { value: 0 };

  chapters.forEach((chapter, index) => {
    const { newVolume, newAct } = chapterHeadingFlags(chapters, index);

    if (newVolume) {
      children.push(
        new Paragraph({
          text: sanitizeXmlText(chapter.volumeTitle),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 200, after: 200 },
        })
      );
    }

    if (newAct) {
      children.push(
        new Paragraph({
          text: sanitizeXmlText(chapter.actTitle),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 200 },
        })
      );
    }

    children.push(
      new Paragraph({
        text: sanitizeXmlText(chapter.title),
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 200, after: 200 },
      })
    );

    children.push(...blocksToParagraphs(chapter.blocks, spacing, listInstances));

    if (index < chapters.length - 1) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
  });

  return new Document({
    // 有序列表必须自带 decimal 编号定义，否则会退化成项目符号
    numbering: {
      config: [{ reference: ORDERED_LIST_REFERENCE, levels: orderedListLevels() }],
    },
    styles: {
      default: {
        document: {
          run: { size: Math.round(bodyPt * 2) },
        },
        // 标题字号必须跟随正文字号，否则正文调大后标题反而比正文小
        ...headingStyles(bodyPt),
      },
    },
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });
};

export const exportToDocx = async (
  chapters: ExportChapter[],
  options: DocxExportOptions
): Promise<void> => {
  const blob = await Packer.toBlob(buildDocxDocument(chapters, options));
  downloadBlob(blob, buildExportFileName(options.title, options.date, 'docx'));
};
