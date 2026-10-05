/**
 * 导出用的正文模型
 *
 * 编辑器保存的是 HTML（TipTap），直接取 textContent 会把所有段落粘成一行，
 * 导致导出的正文丢失段落、换行和首行缩进。这里把 HTML 解析成结构化段落块，
 * 供 TXT / DOCX / EPUB / PDF 各导出器分别渲染。
 */

export const FULL_WIDTH_SPACE = '\u3000';
export const HALF_WIDTH_SPACE = ' ';

/** 一段文字内联样式（加粗、斜体等） */
export interface ExportRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
}

export type ExportBlockKind =
  | 'paragraph'
  | 'heading'
  | 'listItem'
  | 'quote'
  /** 代码块：保留换行与缩进 */
  | 'pre'
  /** 分隔线（<hr>） */
  | 'separator';

/** 正文块 */
export interface ExportBlock {
  kind: ExportBlockKind;
  /** heading 的级别，1-3 */
  level?: number;
  /** listItem 是否属于有序列表 */
  ordered?: boolean;
  /** listItem 的嵌套层级，0 为最外层 */
  depth?: number;
  runs: ExportRun[];
}

/** 一个待导出章节 */
export interface ExportChapter {
  id: string;
  title: string;
  volumeTitle: string;
  actTitle: string;
  /** 卷/幕节点 id：同名卷幕靠 id 区分，标题只作为兜底 */
  volumeId?: string;
  actId?: string;
  blocks: ExportBlock[];
}

/** 与编辑器一致的排版参数 */
export interface ExportTextSettings {
  /** 段首缩进（em） */
  paragraphIndent: number;
  /** 段落间距（em） */
  paragraphSpacing: number;
  /** 行距倍数 */
  lineSpacing: number;
  /** 正文字号（px） */
  fontSize: number;
}

/** 列表每嵌套一级的缩进量（字符/em） */
export const LIST_INDENT_PER_LEVEL = 2;

/** <hr> 在纯文本类输出里的写法 */
export const SEPARATOR_TEXT = '* * *';

/**
 * 段首缩进前缀：一个全角空格约等于一个汉字宽度，
 * 编辑器设置以 0.5em 为步进，半格用半角空格近似。
 */
export const indentPrefix = (indentEm: number): string => {
  const whole = Math.max(0, Math.floor(indentEm));
  const remainder = indentEm - whole;
  return FULL_WIDTH_SPACE.repeat(whole) + (remainder >= 0.5 ? HALF_WIDTH_SPACE : '');
};

/**
 * 清掉 XML 1.0 不允许的控制字符（除 \t \n \r 之外的 C0，以及 U+FFFE/U+FFFF）。
 *
 * EPUB（XHTML/OPF/NCX）和 DOCX（OOXML）都是 XML：这类字符一旦混进产物，
 * 整份文件会变成非法 XML 而**直接打不开**，不是某个字符显示异常。
 * Word 的软换行 U+000B 是最常见的来源，语义上等于换行，归一化成 \n；其余直接丢弃。
 */
/* eslint-disable no-control-regex -- 这里就是要匹配并清掉这些控制字符 */
export const sanitizeXmlText = (text: string): string =>
  text.replace(/\u000b/g, '\n').replace(/[\u0000-\u0008\u000c\u000e-\u001f\ufffe\uffff]/g, '');
/* eslint-enable no-control-regex */

type RunStyle = Omit<ExportRun, 'text'>;

/** 这些标签的内容不是正文，导出时直接跳过 */
const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'TITLE',
  'HEAD',
  'NOSCRIPT',
  'TEMPLATE',
  'IFRAME',
  'OBJECT',
  'EMBED',
  'LINK',
  'META',
]);

/** 块级元素：在顶层各自成为一个块，在块内部则作为换行分隔 */
const BLOCK_TAGS = new Set([
  'P',
  'DIV',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'LI',
  'BLOCKQUOTE',
  'PRE',
  'SECTION',
  'ARTICLE',
  'FIGURE',
  'FIGCAPTION',
  'ADDRESS',
  'DD',
  'DT',
  'DL',
  'TABLE',
  'TR',
  'TD',
  'TH',
  'CAPTION',
  'HR',
]);

/**
 * 容器元素：本身不代表一段文字，内部若直接含有块级元素，
 * 就递归按块处理（否则 <div><ul>…</ul></div> 里的列表会被整段丢掉）
 */
const CONTAINER_TAGS = new Set([
  'DIV',
  'SECTION',
  'ARTICLE',
  'FIGURE',
  'FIGCAPTION',
  'MAIN',
  'ASIDE',
  'HEADER',
  'FOOTER',
  'NAV',
  'DL',
  'TABLE',
]);

const hasBlockChild = (element: Element): boolean =>
  Array.from(element.children).some(
    (child) => BLOCK_TAGS.has(child.tagName) || child.tagName === 'UL' || child.tagName === 'OL'
  );

const inlineStyleOf = (tagName: string): RunStyle | null => {
  switch (tagName) {
    case 'B':
    case 'STRONG':
      return { bold: true };
    case 'I':
    case 'EM':
      return { italic: true };
    case 'U':
      return { underline: true };
    case 'S':
    case 'DEL':
    case 'STRIKE':
      return { strike: true };
    default:
      return null;
  }
};

const headingLevelOf = (tagName: string): number | null => {
  const match = /^H([1-6])$/.exec(tagName);
  if (!match) return null;
  return Math.min(3, Number(match[1]));
};

interface RunOptions {
  /** <pre> 内部保留原始空白（换行、缩进） */
  preserveWhitespace?: boolean;
}

/** 在已有文字之后补一个换行，避免相邻块被拼成一行 */
const pushLineBreak = (out: ExportRun[], style: RunStyle): void => {
  // 块与块之间的 HTML 空白（缩进、换行）没有意义，先丢掉，
  // 否则会在段首留下一个空 run、或在换行前留下多余空格
  while (out.length > 0 && out[out.length - 1].text.trim() === '') out.pop();
  if (out.length === 0) return;
  if (!out[out.length - 1].text.endsWith('\n')) out.push({ text: '\n', ...style });
};

const collectRunsInto = (
  node: Node,
  style: RunStyle,
  out: ExportRun[],
  options: RunOptions = {}
): void => {
  if (node.nodeType === Node.TEXT_NODE) {
    const raw = node.textContent ?? '';
    // HTML 源码里的缩进/换行对正文没有意义，统一折叠成单个空格（<pre> 除外）；
    // 全角空格与 &nbsp; 是作者手动缩进，必须保留
    const collapsed = options.preserveWhitespace ? raw : raw.replace(/[ \t\r\n]+/g, ' ');
    // 折叠之后才清控制字符：U+000B 是 Word 的软换行，要留成换行（与 <br> 同义），
    // 若在折叠前清，它会被当成源码空白折叠成空格
    const text = sanitizeXmlText(collapsed);
    if (text) out.push({ text, ...style });
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const element = node as HTMLElement;
  const tagName = element.tagName;

  if (SKIP_TAGS.has(tagName)) return;
  // 嵌套列表由 addListItem 单独处理，不要混进当前段落文字
  if (tagName === 'UL' || tagName === 'OL') return;
  if (tagName === 'BR') {
    out.push({ text: '\n', ...style });
    return;
  }
  if (tagName === 'HR') {
    pushLineBreak(out, style);
    return;
  }

  // 块级元素之间要有换行，否则 <blockquote><p>a</p><p>b</p></blockquote> 会变成 "ab"
  if (BLOCK_TAGS.has(tagName)) pushLineBreak(out, style);

  const inlineStyle = inlineStyleOf(tagName);
  const nextStyle = inlineStyle ? { ...style, ...inlineStyle } : style;
  const preserveWhitespace = options.preserveWhitespace === true || tagName === 'PRE';
  Array.from(element.childNodes).forEach((child) =>
    collectRunsInto(child, nextStyle, out, { preserveWhitespace })
  );
};

/** 去掉首尾空白与空 run，避免导出出现多余空行 */
const trimRuns = (runs: ExportRun[]): ExportRun[] => {
  const result = runs.filter((run) => run.text.length > 0);
  if (result.length === 0) return result;

  // 只保留空白内容的 run 要先整体丢掉，否则一次 replace 之后
  // 下一个 run（可能正好是换行）会顶到段首
  while (result.length > 0 && result[0].text.replace(/^[ \n]+/, '').length === 0) result.shift();
  while (result.length > 0 && result[result.length - 1].text.replace(/[ \n]+$/, '').length === 0) {
    result.pop();
  }
  if (result.length === 0) return result;

  const first = result[0];
  result[0] = { ...first, text: first.text.replace(/^[ \n]+/, '') };

  const lastIndex = result.length - 1;
  const last = result[lastIndex];
  result[lastIndex] = { ...last, text: last.text.replace(/[ \n]+$/, '') };

  return result.filter((run) => run.text.length > 0);
};

const collectElementRuns = (element: Element, style: RunStyle, options: RunOptions = {}): ExportRun[] => {
  const runs: ExportRun[] = [];
  Array.from(element.childNodes).forEach((child) => collectRunsInto(child, style, runs, options));
  // <pre> 的行首缩进是内容的一部分，不能 trim
  return options.preserveWhitespace ? runs : trimRuns(runs);
};

/** 列表项：文字与嵌套列表分开处理，嵌套层级记录在 depth 上 */
const addListItem = (item: Element, out: ExportBlock[], style: RunStyle, depth: number): void => {
  const runs = collectElementRuns(item, style);
  if (runs.some((run) => run.text.trim().length > 0)) {
    out.push({ kind: 'listItem', ordered: item.parentElement?.tagName === 'OL', depth, runs });
  }

  Array.from(item.children)
    .filter((child) => child.tagName === 'UL' || child.tagName === 'OL')
    .forEach((nested) => addList(nested, out, style, depth + 1));
};

const addList = (list: Element, out: ExportBlock[], style: RunStyle, depth: number): void => {
  Array.from(list.children).forEach((child) => {
    if (child.tagName === 'LI') {
      addListItem(child, out, style, depth);
    } else if (child.tagName === 'UL' || child.tagName === 'OL') {
      // 规范外的直接嵌套（<ul> 里再放 <ul>）也不能丢内容
      addList(child, out, style, depth + 1);
    }
  });
};

const collectBlocks = (container: Node, out: ExportBlock[], style: RunStyle): void => {
  let pendingRuns: ExportRun[] = [];

  const flushPending = () => {
    const runs = trimRuns(pendingRuns);
    if (runs.some((run) => run.text.trim().length > 0)) {
      out.push({ kind: 'paragraph', runs });
    }
    pendingRuns = [];
  };

  Array.from(container.childNodes).forEach((child) => {
    if (child.nodeType !== Node.ELEMENT_NODE) {
      // 裸文本节点（例如未包在 <p> 里的内容）
      collectRunsInto(child, style, pendingRuns);
      return;
    }

    const element = child as HTMLElement;
    const tagName = element.tagName;

    if (SKIP_TAGS.has(tagName)) return;

    if (tagName === 'UL' || tagName === 'OL') {
      flushPending();
      addList(element, out, style, 0);
      return;
    }

    if (tagName === 'LI') {
      flushPending();
      addListItem(element, out, style, 0);
      return;
    }

    if (tagName === 'HR') {
      flushPending();
      out.push({ kind: 'separator', runs: [] });
      return;
    }

    if (tagName === 'BR') {
      pendingRuns.push({ text: '\n', ...style });
      return;
    }

    if (tagName === 'BLOCKQUOTE' || (CONTAINER_TAGS.has(tagName) && hasBlockChild(element))) {
      // 容器内部按块递归处理：段落各自成块、列表/代码块/分隔线各自成块，
      // 这样 <div><ul>…</ul></div>、<div><hr></div> 都不会丢内容
      flushPending();
      const inner: ExportBlock[] = [];
      collectBlocks(element, inner, style);
      inner.forEach((block) =>
        out.push(
          block.kind === 'paragraph' && tagName === 'BLOCKQUOTE'
            ? { ...block, kind: 'quote' }
            : block
        )
      );
      return;
    }

    if (BLOCK_TAGS.has(tagName)) {
      flushPending();
      const isPre = tagName === 'PRE';
      const runs = collectElementRuns(element, style, { preserveWhitespace: isPre });
      if (!runs.some((run) => run.text.trim().length > 0)) return;

      if (isPre) {
        out.push({ kind: 'pre', runs });
        return;
      }

      const level = headingLevelOf(tagName);
      if (level !== null) {
        out.push({ kind: 'heading', level, runs });
      } else {
        out.push({ kind: 'paragraph', runs });
      }
      return;
    }

    // 行内元素或未知元素：并入当前段落
    collectRunsInto(element, style, pendingRuns);
  });

  flushPending();
};

/** 把编辑器保存的 HTML 解析成正文块 */
export const parseNoteHtml = (html: string): ExportBlock[] => {
  if (!html || !html.trim()) return [];

  const parsed = new DOMParser().parseFromString(`<div id="export-root">${html}</div>`, 'text/html');
  const root = parsed.getElementById('export-root');
  if (!root) return [];

  const blocks: ExportBlock[] = [];
  collectBlocks(root, blocks, {});
  return blocks;
};

export const runsToText = (runs: ExportRun[]): string => runs.map((run) => run.text).join('');

/** 正文块的纯文本形式（不含段首缩进） */
export const blockToText = (block: ExportBlock): string => runsToText(block.runs);

/** 只去掉 ASCII 空白：全角空格与 &nbsp; 是作者的手动缩进，必须保留 */
const trimAscii = (text: string): string => text.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '');

/**
 * 把正文块转成纯文本，段落一行，首行缩进用全角空格表示。
 * 只有首行加缩进，续行按各格式的悬挂效果对齐；列表项带层级缩进与序号。
 */
export const blocksToText = (blocks: ExportBlock[], settings: ExportTextSettings): string => {
  const indent = indentPrefix(settings.paragraphIndent);
  const lines: string[] = [];
  /** 每一层有序列表当前的序号 */
  const orderedCounters: number[] = [];

  for (const block of blocks) {
    if (block.kind === 'separator') {
      orderedCounters.length = 0;
      lines.push(SEPARATOR_TEXT);
      continue;
    }

    const raw = blockToText(block);
    if (!raw.trim()) continue;

    if (block.kind === 'pre') {
      // 代码块原样保留换行与行内缩进
      orderedCounters.length = 0;
      raw
        .replace(/^\n+|\n+$/g, '')
        .split('\n')
        .forEach((line) => lines.push(line.replace(/[ \t\r\n]+$/, '')));
      continue;
    }

    const blockLines = raw.split('\n').map((line) => trimAscii(line));
    // 去掉首尾空行，但保留作者用 <br><br> 打出来的段内空行（与其他三种格式一致）
    while (blockLines.length > 0 && blockLines[0] === '') blockLines.shift();
    while (blockLines.length > 0 && blockLines[blockLines.length - 1] === '') blockLines.pop();
    if (blockLines.length === 0) continue;

    if (block.kind === 'listItem') {
      const depth = Math.max(0, block.depth ?? 0);
      const itemIndent = FULL_WIDTH_SPACE.repeat(depth * LIST_INDENT_PER_LEVEL);

      if (block.ordered) {
        orderedCounters[depth] = (orderedCounters[depth] ?? 0) + 1;
        orderedCounters.length = depth + 1;
      } else {
        // 只清掉本级及更深的计数，外层有序列表继续编号
        orderedCounters.length = depth;
      }

      const marker = block.ordered ? `${orderedCounters[depth] ?? 1}. ` : '- ';
      const continuation = ' '.repeat(marker.length);
      blockLines.forEach((line, index) => {
        if (line === '') {
          lines.push('');
          return;
        }
        lines.push(index === 0 ? `${itemIndent}${marker}${line}` : `${itemIndent}${continuation}${line}`);
      });
      continue;
    }

    // 任何非列表内容都结束当前编号序列，两个 <ol> 之间隔着段落时重新从 1 开始
    orderedCounters.length = 0;

    // 标题不缩进，与其他段落区分
    const prefix = block.kind === 'heading' ? '' : indent;
    blockLines.forEach((line, index) => lines.push(index === 0 ? prefix + line : line));
  }

  return lines.join('\n');
};

/** 目录层级：1 = 卷，2 = 幕，3 = 章节（与 DOCX 的标题大纲一致） */
export type TocLevel = 1 | 2 | 3;

/** 目录条目 */
export interface TocEntry {
  level: TocLevel;
  title: string;
  /** 该条目对应的章节下标，EPUB 用它生成跳转链接 */
  chapterIndex: number;
  /** 该章节既不属于任何卷也不属于任何幕：目录里应回到顶层 */
  detached?: boolean;
}

/** 各导出格式统一的目录标题 */
export const TOC_TITLE = '目 录';

/** 目录每加深一级的缩进量（以字符/em 计，各导出格式共用） */
export const TOC_INDENT_PER_LEVEL = 2;

/** 目录条目的缩进层数：卷 0、幕 1、章 2 */
export const tocIndent = (level: TocLevel): number => level - 1;

/**
 * 该章节是否开启新的卷 / 幕。
 * 卷幕标题只在切换时输出一次，目录和正文都用它判断，
 * 避免每章都重复打印所属的卷名、幕名。同名卷幕靠节点 id 区分。
 */
export const chapterHeadingFlags = (
  chapters: ExportChapter[],
  index: number
): { newVolume: boolean; newAct: boolean } => {
  const chapter = chapters[index];
  const previous = index > 0 ? chapters[index - 1] : null;

  const volumeKey = (item: ExportChapter) => item.volumeId ?? item.volumeTitle;
  const actKey = (item: ExportChapter) => item.actId ?? item.actTitle;

  const newVolume =
    Boolean(chapter.volumeTitle) && volumeKey(chapter) !== (previous ? volumeKey(previous) : '');
  // 换卷时同名幕也要重新输出，否则新卷下的幕会丢掉标题
  const newAct =
    Boolean(chapter.actTitle) && (newVolume || actKey(chapter) !== (previous ? actKey(previous) : ''));

  return { newVolume, newAct };
};

/**
 * 生成层级目录。
 * 卷/幕只在切换时输出一次，章节逐条输出，形成“卷 → 幕 → 章”的树状结构，
 * 而不是把每章的“卷 - 幕 - 章节”平铺成一列。
 */
export const buildTocEntries = (chapters: ExportChapter[]): TocEntry[] => {
  const entries: TocEntry[] = [];

  chapters.forEach((chapter, chapterIndex) => {
    const { newVolume, newAct } = chapterHeadingFlags(chapters, chapterIndex);

    if (newVolume) entries.push({ level: 1, title: chapter.volumeTitle, chapterIndex });
    if (newAct) entries.push({ level: 2, title: chapter.actTitle, chapterIndex });
    entries.push({
      level: 3,
      title: chapter.title,
      chapterIndex,
      detached: !chapter.volumeTitle && !chapter.actTitle,
    });
  });

  return entries;
};
