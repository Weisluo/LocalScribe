import JSZip from 'jszip';
import {
  ExportBlock,
  ExportChapter,
  ExportRun,
  ExportTextSettings,
  SEPARATOR_TEXT,
  TOC_TITLE,
  TocEntry,
  buildTocEntries,
  chapterHeadingFlags,
  sanitizeXmlText,
  tocIndent,
} from './blocks';
import { buildExportFileName, downloadBlob } from './download';

export interface EpubFile {
  path: string;
  content: string;
  /** mimetype 必须不压缩存储，否则阅读器会认为不是合法的 EPUB */
  store?: boolean;
}

export interface EpubExportOptions {
  title: string;
  date: string;
  settings: ExportTextSettings;
}

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

/**
 * XHTML 内容必须转义，否则 & < 等字符会让阅读器解析失败或显示异常。
 * 控制字符也要先清掉：它们在 XML 1.0 里非法，会让整份 EPUB 打不开。
 * 书名、章节标题这类不经过正文解析的文本同样走这里，所以必须在转义层兜住。
 */
export const escapeXml = (text: string): string =>
  sanitizeXmlText(text).replace(/[&<>"']/g, (char) => XML_ESCAPES[char]);

/** 多行片段整体缩进，只影响生成的 XML 可读性 */
const indentBlock = (block: string, spaces: number): string =>
  block
    .split('\n')
    .map((line) => (line ? ' '.repeat(spaces) + line : line))
    .join('\n');

const runsToXhtml = (runs: ExportRun[], keepNewlines = false): string =>
  runs
    .map((run) => {
      let html = escapeXml(run.text);
      if (!keepNewlines) html = html.replace(/\n/g, '<br/>');
      if (run.strike) html = `<span class="strike">${html}</span>`;
      if (run.underline) html = `<span class="underline">${html}</span>`;
      if (run.italic) html = `<em>${html}</em>`;
      if (run.bold) html = `<strong>${html}</strong>`;
      return html;
    })
    .join('');

/** 当前打开的列表帧：索引即嵌套层级 */
interface ListFrame {
  ordered: boolean;
  /** 该列表里是否有一个 <li> 处于打开状态 */
  itemOpen: boolean;
}

/**
 * 正文块转 XHTML。
 * 列表块按 depth 重新组装成嵌套的 <ul>/<ol>：层级变化时补开/闭合标签，
 * 同一层里有序/无序切换时先关闭当前列表，避免把两种列表合成一个。
 */
const blocksToXhtml = (blocks: ExportBlock[]): string => {
  const parts: string[] = [];
  const frames: ListFrame[] = [];

  const listTag = (ordered: boolean) => (ordered ? 'ol' : 'ul');

  const closeItem = () => {
    const frame = frames[frames.length - 1];
    if (frame?.itemOpen) {
      parts.push('</li>');
      frame.itemOpen = false;
    }
  };

  /** 关掉层级深于 depth 的列表（外层 <li> 保持打开，供子列表嵌套） */
  const closeListsTo = (depth: number) => {
    while (frames.length > depth + 1) {
      closeItem();
      const frame = frames.pop()!;
      parts.push(`</${listTag(frame.ordered)}>`);
    }
  };

  const flushLists = () => closeListsTo(-1);

  for (const block of blocks) {
    if (block.kind !== 'listItem') {
      flushLists();

      if (block.kind === 'separator') {
        parts.push(`<p class="separator">${escapeXml(SEPARATOR_TEXT)}</p>`);
        continue;
      }
      if (block.runs.every((run) => !run.text.trim())) continue;

      if (block.kind === 'pre') {
        parts.push(`<pre>${runsToXhtml(block.runs, true)}</pre>`);
      } else if (block.kind === 'heading') {
        // 章节标题占用 h1，正文里的标题降一级
        const level = Math.min(4, Math.max(2, (block.level ?? 1) + 1));
        parts.push(`<h${level}>${runsToXhtml(block.runs)}</h${level}>`);
      } else if (block.kind === 'quote') {
        parts.push(`<blockquote><p>${runsToXhtml(block.runs)}</p></blockquote>`);
      } else {
        parts.push(`<p>${runsToXhtml(block.runs)}</p>`);
      }
      continue;
    }

    const depth = Math.max(0, block.depth ?? 0);
    const ordered = block.ordered === true;

    if (frames.length === 0) {
      parts.push(`<${listTag(ordered)}>`);
      frames.push({ ordered, itemOpen: false });
    } else {
      // 回到较浅的层级
      closeListsTo(depth);

      const current = frames[frames.length - 1];
      if (frames.length - 1 === depth && current.ordered !== ordered) {
        // 同一层换了列表类型：先结束当前列表，避免两种列表被合成一个
        closeItem();
        frames.pop();
        parts.push(`</${listTag(current.ordered)}>`);
      }
    }

    // 需要更深层级时在父 <li> 内部继续开子列表。
    // 父项可能没打开（例如空段落被丢弃、或块列表直接从 depth>0 开始），
    // 这时补一个空 <li>，否则会出现 <ul> 直接嵌在 <ul> 里的非法结构。
    while (frames.length <= depth) {
      const parent = frames[frames.length - 1];
      if (parent && !parent.itemOpen) {
        parts.push('<li>');
        parent.itemOpen = true;
      }
      parts.push(`<${listTag(ordered)}>`);
      frames.push({ ordered, itemOpen: false });
    }

    // 同级的上一个 <li> 收尾
    closeItem();

    // 这里不写 </li>：如果后面紧跟嵌套列表，它要嵌在当前 <li> 内部
    parts.push(`<li>${runsToXhtml(block.runs)}`);
    frames[frames.length - 1].itemOpen = true;
  }

  flushLists();

  // 每个片段单独成行便于阅读，但 </li> 前的换行会变成列表项里的空白，去掉
  return parts
    .map((part) => `      ${part}`)
    .join('\n')
    .replace(/\n\s*<\/li>/g, '</li>');
};

const buildStylesheet = (settings: ExportTextSettings): string => `@charset "utf-8";

body {
  font-family: "Noto Serif SC", "Songti SC", "SimSun", serif;
  line-height: ${settings.lineSpacing};
  margin: 5%;
  color: #000000;
}

h1, h2, h3, h4 {
  font-weight: 600;
  line-height: 1.5;
  margin: ${settings.paragraphSpacing}em 0 0.6em;
}

p {
  margin: 0 0 ${settings.paragraphSpacing}em;
  text-indent: ${settings.paragraphIndent}em;
}

.volume-title,
.act-title,
.chapter-title {
  text-align: center;
  text-indent: 0;
}

.volume-title { font-size: 1.3em; }
.act-title { font-size: 1.15em; }
.chapter-title { font-size: 1.6em; margin-bottom: 1em; }

ul, ol {
  margin: 0 0 ${settings.paragraphSpacing}em;
  padding-left: 2em;
}

/* 嵌套列表不再拉开段间距 */
li ul, li ol { margin-bottom: 0; }

li { line-height: ${settings.lineSpacing}; }

blockquote {
  margin: 1em 1.5em;
  color: #333333;
}

blockquote p { text-indent: ${settings.paragraphIndent}em; }

pre {
  white-space: pre-wrap;
  text-indent: 0;
  margin: 0 0 ${settings.paragraphSpacing}em;
  font-family: "Noto Sans Mono", "Consolas", "Courier New", monospace;
  font-size: 0.9em;
}

.separator {
  text-align: center;
  text-indent: 0;
  margin: 1.2em 0;
}

.underline { text-decoration: underline; }
.strike { text-decoration: line-through; }
`;

const xhtmlDocument = (title: string, body: string): string => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="zh-CN" lang="zh-CN">
  <head>
    <meta charset="utf-8"/>
    <title>${escapeXml(title)}</title>
    <link rel="stylesheet" type="text/css" href="styles/style.css"/>
  </head>
  <body>
${body}
  </body>
</html>
`;

const chapterXhtml = (chapter: ExportChapter, headings: { newVolume: boolean; newAct: boolean }): string => {
  const bodyParts: string[] = ['    <section epub:type="chapter">'];

  if (headings.newVolume) {
    bodyParts.push(`      <p class="volume-title">${escapeXml(chapter.volumeTitle)}</p>`);
  }
  if (headings.newAct) {
    bodyParts.push(`      <p class="act-title">${escapeXml(chapter.actTitle)}</p>`);
  }
  bodyParts.push(`      <h1 class="chapter-title">${escapeXml(chapter.title)}</h1>`);

  const content = blocksToXhtml(chapter.blocks);
  if (content) bodyParts.push(content);

  bodyParts.push('    </section>');

  return xhtmlDocument(chapter.title, bodyParts.join('\n'));
};

interface TocNode {
  entry: TocEntry;
  children: TocNode[];
}

/** 把扁平的目录条目按层级组装成树，供嵌套目录列表使用 */
const buildTocTree = (entries: TocEntry[]): TocNode[] => {
  const roots: TocNode[] = [];
  const stack: { node: TocNode; depth: number }[] = [];

  for (const entry of entries) {
    const node: TocNode = { entry, children: [] };
    const depth = tocIndent(entry.level);

    // 不属于任何卷/幕的章节要回到顶层，否则会挂到上一幕下面
    if (entry.detached) stack.length = 0;

    // 回退到当前层级的父节点（层级可能因为缺少卷/幕而跳跃）
    while (stack.length > 0 && stack[stack.length - 1].depth >= depth) stack.pop();

    const parent = stack.length > 0 ? stack[stack.length - 1].node : null;
    (parent ? parent.children : roots).push(node);
    stack.push({ node, depth });
  }

  return roots;
};

/** 目录树的最大嵌套层数，用于 NCX 的 dtb:depth */
const tocTreeDepth = (nodes: TocNode[]): number =>
  nodes.reduce((max, node) => Math.max(max, 1 + tocTreeDepth(node.children)), 0);

/** nav.xhtml 的目录：嵌套 <ol>，层级与 DOCX 的标题大纲一致 */
const renderNavList = (nodes: TocNode[], hrefs: string[], depth = 0): string => {
  const pad = '  '.repeat(depth);
  const items = nodes
    .map((node) => {
      const link = `<a href="${hrefs[node.entry.chapterIndex]}">${escapeXml(node.entry.title)}</a>`;
      const children =
        node.children.length > 0 ? `\n${renderNavList(node.children, hrefs, depth + 1)}\n${pad}  ` : '';
      return `${pad}  <li>${link}${children}</li>`;
    })
    .join('\n');

  return `${pad}<ol>\n${items}\n${pad}</ol>`;
};

/** toc.ncx 的 navMap：同样按层级嵌套，兼容只读 NCX 的旧阅读器 */
const renderNavPoints = (nodes: TocNode[], hrefs: string[], counter: { value: number }): string => {
  const parts: string[] = [];

  for (const node of nodes) {
    counter.value += 1;
    const order = counter.value;
    const children =
      node.children.length > 0 ? `\n${renderNavPoints(node.children, hrefs, counter)}\n` : '';

    parts.push(
      `<navPoint id="navPoint-${order}" playOrder="${order}">\n` +
        `  <navLabel><text>${escapeXml(node.entry.title)}</text></navLabel>\n` +
        `  <content src="${hrefs[node.entry.chapterIndex]}"/>` +
        (children ? `\n  ${children.replace(/\n/g, '\n  ')}` : '') +
        `\n</navPoint>`
    );
  }

  return parts.join('\n');
};

const createUuid = (): string => {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
};

/** 生成 EPUB 内的所有文件（纯字符串，便于校验） */
export const buildEpubFiles = (
  chapters: ExportChapter[],
  options: EpubExportOptions
): EpubFile[] => {
  const { title, date, settings } = options;
  const bookId = `urn:uuid:${createUuid()}`;
  const modified = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  const chapterFiles = chapters.map((chapter, index) => ({
    id: `chapter-${index + 1}`,
    href: `chapter-${index + 1}.xhtml`,
    chapter,
  }));

  const manifestItems = [
    '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
    '<item id="stylesheet" href="styles/style.css" media-type="text/css"/>',
    '<item id="titlepage" href="titlepage.xhtml" media-type="application/xhtml+xml"/>',
    ...chapterFiles.map(
      (file) => `<item id="${file.id}" href="${file.href}" media-type="application/xhtml+xml"/>`
    ),
  ];

  const spineItems = [
    '<itemref idref="titlepage"/>',
    '<itemref idref="nav" linear="no"/>',
    ...chapterFiles.map((file) => `<itemref idref="${file.id}"/>`),
  ];

  const tocEntries = buildTocEntries(chapters);
  const tocTree = buildTocTree(tocEntries);
  const chapterHrefs = chapterFiles.map((file) => file.href);
  const tocDepth = Math.max(1, tocTreeDepth(tocTree));

  // 没有章节时也要给出合法（非空）的目录，EPUBCheck 不接受空 <ol>/<navMap>
  const emptyNavItems = `      <ol>
        <li><a href="titlepage.xhtml">${escapeXml(title)}</a></li>
      </ol>`;
  const emptyNavPoints = `    <navPoint id="navPoint-1" playOrder="1">
      <navLabel><text>${escapeXml(title)}</text></navLabel>
      <content src="titlepage.xhtml"/>
    </navPoint>`;
  const navItems = tocTree.length
    ? indentBlock(renderNavList(tocTree, chapterHrefs), 6)
    : emptyNavItems;
  const navPoints = tocTree.length
    ? indentBlock(renderNavPoints(tocTree, chapterHrefs, { value: 0 }), 4)
    : emptyNavPoints;

  const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="zh-CN">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">${escapeXml(bookId)}</dc:identifier>
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:language>zh-CN</dc:language>
    <meta property="dcterms:modified">${modified}</meta>
  </metadata>
  <manifest>
    ${manifestItems.join('\n    ')}
  </manifest>
  <spine toc="ncx">
    ${spineItems.join('\n    ')}
  </spine>
</package>
`;

  const navXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="zh-CN" lang="zh-CN">
  <head>
    <meta charset="utf-8"/>
    <title>${escapeXml(title)} - ${TOC_TITLE}</title>
    <link rel="stylesheet" type="text/css" href="styles/style.css"/>
  </head>
  <body>
    <nav epub:type="toc" id="toc">
      <h1 class="chapter-title">${TOC_TITLE}</h1>
${navItems}
    </nav>
  </body>
</html>
`;

  const tocNcx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${escapeXml(bookId)}"/>
    <meta name="dtb:depth" content="${tocDepth}"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escapeXml(title)}</text></docTitle>
  <navMap>
${navPoints}
  </navMap>
</ncx>
`;

  const titlePageXhtml = xhtmlDocument(
    title,
    `    <section epub:type="titlepage" class="titlepage">
      <h1 class="chapter-title">${escapeXml(title)}</h1>
      <p class="act-title">${escapeXml(date)}</p>
    </section>`
  );

  const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
`;

  const files: EpubFile[] = [
    { path: 'mimetype', content: 'application/epub+zip', store: true },
    { path: 'META-INF/container.xml', content: containerXml },
    { path: 'OEBPS/content.opf', content: contentOpf },
    { path: 'OEBPS/nav.xhtml', content: navXhtml },
    { path: 'OEBPS/toc.ncx', content: tocNcx },
    { path: 'OEBPS/styles/style.css', content: buildStylesheet(settings) },
    { path: 'OEBPS/titlepage.xhtml', content: titlePageXhtml },
  ];

  chapterFiles.forEach((file, index) => {
    files.push({
      path: `OEBPS/${file.href}`,
      content: chapterXhtml(chapters[index], chapterHeadingFlags(chapters, index)),
    });
  });

  return files;
};

export const exportToEpub = async (
  chapters: ExportChapter[],
  options: EpubExportOptions
): Promise<void> => {
  const zip = new JSZip();

  for (const file of buildEpubFiles(chapters, options)) {
    // mimetype 必须不压缩存储，其余文件尽量压缩；
    // createFolders: false 避免给 OEBPS/ 这类路径生成多余的目录条目（OCF 只要求文件条目）
    zip.file(file.path, file.content, {
      compression: file.store ? 'STORE' : 'DEFLATE',
      createFolders: false,
    });
  }

  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
  downloadBlob(blob, buildExportFileName(options.title, options.date, 'epub'));
};
