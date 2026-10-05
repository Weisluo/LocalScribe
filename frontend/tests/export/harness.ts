/**
 * 导出管道回归用例（浏览器侧）。
 *
 * 由 export.spec.ts 用 Vite 打成单文件后注入真实浏览器执行，
 * 结果写到 window.__EXPORT_TESTS__，下载产物由 Node 侧断言。
 */
import {
  SEPARATOR_TEXT,
  TOC_TITLE,
  blockToText,
  blocksToText,
  buildTocEntries,
  indentPrefix,
  parseNoteHtml,
} from '@/utils/export/blocks';
import type { ExportChapter, ExportTextSettings } from '@/utils/export/blocks';
import { buildEpubFiles, exportToEpub } from '@/utils/export/epub';
import { buildDocxDocument, exportToDocx } from '@/utils/export/docx';
import { buildTxtContent, exportToTxt } from '@/utils/export/txt';
import { buildPrintHtml } from '@/utils/export/pdf';
import { sanitizeFileName } from '@/utils/export/download';
import { Packer } from 'docx';
import JSZip from 'jszip';

interface Check {
  name: string;
  ok: boolean;
  detail?: unknown;
}

const checks: Check[] = [];
const check = (name: string, ok: boolean, detail?: unknown) => {
  checks.push({ name, ok: !!ok, detail });
};

const settings: ExportTextSettings = {
  paragraphIndent: 2,
  paragraphSpacing: 1,
  lineSpacing: 1.8,
  fontSize: 18,
};

const blocksOf = (html: string) => parseNoteHtml(html);
const textOf = (html: string) => blocksToText(blocksOf(html), settings);
const kindsOf = (html: string) => blocksOf(html).map((block) => block.kind);
const textsOf = (html: string) => blocksOf(html).map((block) => blockToText(block));
const stripWhitespace = (value: string) => value.replace(/\s+/g, '');

const richHtml = [
  '<p>第一段 &amp; 特殊字符。</p>',
  '<p><strong>加粗</strong>、<em>斜体</em>、<s>删除</s>、<u>下划线</u>混排。</p>',
  '<h2>正文标题</h2>',
  '<blockquote><p>引用段落</p></blockquote>',
  '<ul><li>无序一</li><li>无序二<ul><li>嵌套项</li></ul></li></ul>',
  '<ol><li>有序一</li><li>有序二</li></ol>',
  '<pre><code>code line1\n    indented</code></pre>',
  '<hr>',
  '<p>最后一段。</p>',
].join('\n');

const chapter = (
  id: string,
  title: string,
  volumeTitle: string,
  actTitle: string,
  volumeId: string,
  actId: string,
  blocks: ExportChapter['blocks']
): ExportChapter => ({ id, title, volumeTitle, actTitle, volumeId, actId, blocks });

const chapters: ExportChapter[] = [
  chapter('c1', '第一章 起点', '第一卷', '第一幕', 'v1', 'a1', parseNoteHtml(richHtml)),
  chapter('c2', '第二章 继续', '第一卷', '第一幕', 'v1', 'a1', parseNoteHtml('<p>第二章正文。</p>')),
  chapter('c3', '第三章 转折', '第一卷', '第一幕', 'v1', 'a1', parseNoteHtml('<p>第三章正文。</p>')),
  chapter('c4', '第四章 再起', '第一卷', '第二幕', 'v1', 'a2', parseNoteHtml('<p>第四章正文。</p>')),
  chapter('c5', '第五章 低谷', '第一卷', '第二幕', 'v1', 'a2', parseNoteHtml('<p>第五章正文。</p>')),
  chapter('c6', '第六章 收束', '第一卷', '第二幕', 'v1', 'a2', parseNoteHtml('<p>第六章正文。</p>')),
];

const run = async () => {
  // ---- HTML → 正文块 ----
  const quoteBlocks = blocksOf('<blockquote><p>引用一</p><p>引用二</p></blockquote>');
  check(
    '解析：blockquote 内两个段落各自成块，不会拼成一段',
    quoteBlocks.length === 2 &&
      quoteBlocks.every((block) => block.kind === 'quote') &&
      quoteBlocks.map(blockToText).join('|') === '引用一|引用二',
    quoteBlocks.map((block) => `${block.kind}:${blockToText(block)}`)
  );

  const liBlocks = blocksOf('<ul><li><p>项一</p><p>项二</p></li></ul>');
  check(
    '解析：列表项内的块级兄弟节点之间补换行',
    liBlocks.length === 1 && liBlocks[0].kind === 'listItem' && blockToText(liBlocks[0]) === '项一\n项二',
    textsOf('<ul><li><p>项一</p><p>项二</p></li></ul>')
  );

  const preBlocks = blocksOf('<pre><code>line1\n    indented\nline2</code></pre>');
  check(
    '解析：代码块保留换行与行首缩进',
    preBlocks.length === 1 && preBlocks[0].kind === 'pre' && blockToText(preBlocks[0]) === 'line1\n    indented\nline2',
    preBlocks.map((block) => `${block.kind}:${JSON.stringify(blockToText(block))}`)
  );

  const scriptBlocks = blocksOf('<script>var x = 1;</script><style>.a{color:red}</style><p>正文</p>');
  check(
    '解析：script/style 的文本不会进入正文',
    scriptBlocks.length === 1 && blockToText(scriptBlocks[0]) === '正文',
    textsOf('<script>var x = 1;</script><style>.a{color:red}</style><p>正文</p>')
  );

  check(
    '解析：<hr> 变成独立的分隔块',
    kindsOf('<p>前</p><hr><p>后</p>').join(',') === 'paragraph,separator,paragraph',
    kindsOf('<p>前</p><hr><p>后</p>')
  );

  const nestedList = blocksOf('<ul><li>一<ul><li>二</li></ul></li></ul>');
  check(
    '解析：嵌套列表记录 depth',
    nestedList.map((block) => block.depth).join(',') === '0,1',
    nestedList.map((block) => ({ depth: block.depth, text: blockToText(block) }))
  );

  check(
    '解析：只有空白的段落被丢弃',
    blocksOf('<p>甲</p><p></p><p><br></p><p>乙</p>').length === 2,
    textsOf('<p>甲</p><p></p><p><br></p><p>乙</p>')
  );

  const manualIndent = blocksOf('<p>\u3000\u3000全角缩进</p><p>&nbsp;&nbsp;半角缩进</p>');
  check(
    '解析：手打的全角空格与 &nbsp; 缩进被保留',
    blockToText(manualIndent[0]).startsWith('\u3000\u3000') && blockToText(manualIndent[1]).startsWith('\u00a0\u00a0'),
    manualIndent.map((block) => JSON.stringify(blockToText(block)))
  );

  check(
    '解析：同一行内的表格单元格之间补换行',
    textsOf('<table><tr><td>c1</td><td>c2</td></tr></table>').join('') === 'c1\nc2',
    textsOf('<table><tr><td>c1</td><td>c2</td></tr></table>')
  );

  check(
    '解析：引用里的列表内容不会被丢弃',
    textsOf('<blockquote><ul><li>引用列表</li></ul></blockquote>').join('|') === '引用列表',
    textsOf('<blockquote><ul><li>引用列表</li></ul></blockquote>')
  );

  check(
    '解析：容器里的 <hr> 仍是分隔块，容器里的列表不丢内容',
    kindsOf('<div><p>a</p><hr><p>b</p></div>').join(',') === 'paragraph,separator,paragraph' &&
      textsOf('<div><ul><li>x</li></ul></div>').join('|') === 'x',
    [kindsOf('<div><p>a</p><hr><p>b</p></div>'), textsOf('<div><ul><li>x</li></ul></div>')]
  );

  const wrappedWhitespace = '<div>\n  <p>a</p>\n  <p>b</p>\n</div>';
  check(
    '解析：标签之间的缩进空白不会变成段首空行',
    textOf(wrappedWhitespace) === '\u3000\u3000a\n\u3000\u3000b',
    JSON.stringify(textOf(wrappedWhitespace))
  );

  // ---- 纯文本渲染 ----
  check(
    'TXT：段首缩进只作用于首行',
    textOf('<p>上行<br>下行</p>') === '\u3000\u3000上行\n下行',
    JSON.stringify(textOf('<p>上行<br>下行</p>'))
  );

  check(
    'TXT：段落隔开的两个有序列表重新从 1 开始',
    textOf('<ol><li>甲</li><li>乙</li></ol><p>中间段</p><ol><li>丙</li></ol>') ===
      '1. 甲\n2. 乙\n\u3000\u3000中间段\n1. 丙',
    JSON.stringify(textOf('<ol><li>甲</li><li>乙</li></ol><p>中间段</p><ol><li>丙</li></ol>'))
  );

  check(
    'TXT：嵌套列表按层级缩进，标记只加在首行',
    textOf('<ol><li>一</li><li>二<ul><li>子</li></ul></li></ol>') === '1. 一\n2. 二\n\u3000\u3000- 子' &&
      textOf('<ul><li>a<br>b</li></ul>') === '- a\n  b',
    [JSON.stringify(textOf('<ol><li>一</li><li>二<ul><li>子</li></ul></li></ol>')), JSON.stringify(textOf('<ul><li>a<br>b</li></ul>'))]
  );

  check(
    'TXT：0.5em 步进的缩进用半角空格近似',
    indentPrefix(0) === '' &&
      indentPrefix(0.5) === ' ' &&
      indentPrefix(1) === '\u3000' &&
      indentPrefix(1.5) === '\u3000 ' &&
      indentPrefix(2) === '\u3000\u3000',
    [indentPrefix(0), indentPrefix(0.5), indentPrefix(1), indentPrefix(1.5), indentPrefix(2)]
  );

  check(
    'TXT：<hr> 输出分隔线，标题不缩进',
    textOf('<p>前</p><hr><p>后</p>').includes(SEPARATOR_TEXT) && textOf('<h2>标题</h2>') === '标题',
    [JSON.stringify(textOf('<p>前</p><hr><p>后</p>')), JSON.stringify(textOf('<h2>标题</h2>'))]
  );

  check(
    'TXT：作者用 <br><br> 打的段内空行会被保留',
    textOf('<p>a<br><br>b</p>') === '\u3000\u3000a\n\nb',
    JSON.stringify(textOf('<p>a<br><br>b</p>'))
  );

  const txt = buildTxtContent(chapters, { title: '回归书', date: '2024/3/25', settings });
  check(
    'TXT：全文包含书名、目录与章节标题，且标题不带 markdown 前缀',
    txt.includes('回归书') &&
      txt.includes(TOC_TITLE) &&
      txt.includes('第一章 起点') &&
      txt.includes('\u3000\u3000第一段') &&
      !/^#{1,3} /m.test(txt),
    txt.split('\n').slice(0, 12)
  );

  // ---- 目录 ----
  const tocEntries = buildTocEntries(chapters);
  check(
    '目录：卷 / 幕 / 章 的层级与顺序',
    tocEntries.map((entry) => `${entry.level}:${entry.title}`).join('|') ===
      '1:第一卷|2:第一幕|3:第一章 起点|3:第二章 继续|3:第三章 转折|2:第二幕|3:第四章 再起|3:第五章 低谷|3:第六章 收束',
    tocEntries
  );

  const sameNameDifferentId = [
    chapter('x1', '甲', '第一卷', '第一幕', 'v1', 'a1', []),
    chapter('x2', '乙', '第一卷', '第一幕', 'v2', 'a1', []),
  ];
  const sameNameSameId = [
    chapter('y1', '甲', '第一卷', '第一幕', 'v1', 'a1', []),
    chapter('y2', '乙', '第一卷', '第一幕', 'v1', 'a1', []),
  ];
  check(
    '目录：同名卷靠 volumeId 区分，同一卷只输出一次',
    buildTocEntries(sameNameDifferentId).filter((entry) => entry.level === 1).length === 2 &&
      buildTocEntries(sameNameSameId).filter((entry) => entry.level === 1).length === 1,
    [buildTocEntries(sameNameDifferentId), buildTocEntries(sameNameSameId)]
  );

  const detached = buildTocEntries([chapter('d1', '散章', '', '', undefined as never, undefined as never, [])]);
  check(
    '目录：不属于卷/幕的章节标记 detached',
    detached.length === 1 && detached[0].level === 3 && detached[0].detached === true,
    detached
  );

  // ---- EPUB 文本结构 ----
  const epubOptions = { title: '回归书 & <名>', date: '2024/3/25', settings };
  const epubFiles = buildEpubFiles(chapters, epubOptions);
  const xmlErrors: string[] = [];
  for (const file of epubFiles) {
    if (!/\.(xhtml|opf|ncx|xml)$/.test(file.path)) continue;
    const parsed = new DOMParser().parseFromString(file.content, 'application/xml');
    const error = parsed.querySelector('parsererror');
    if (error) xmlErrors.push(`${file.path}: ${error.textContent?.slice(0, 160)}`);
  }
  check('EPUB：所有 XML 都是合法 XML', xmlErrors.length === 0, xmlErrors);

  const chapterOne = epubFiles.find((file) => file.path.endsWith('chapter-1.xhtml'))?.content ?? '';
  check(
    'EPUB：相邻的 ul/ol 不会被合成一个列表',
    stripWhitespace(chapterOne).includes('<ul><li>无序一</li><li>无序二<ul><li>嵌套项</li></ul></li></ul><ol><li>有序一</li><li>有序二</li></ol>'),
    stripWhitespace(chapterOne).match(/<ul>.*?<\/ol>/)?.[0]?.slice(0, 240)
  );

  const opf = epubFiles.find((file) => file.path.endsWith('content.opf'))?.content ?? '';
  const nav = epubFiles.find((file) => file.path.endsWith('nav.xhtml'))?.content ?? '';
  check(
    'EPUB：书名与目录标题都做了 XML 转义',
    opf.includes('&amp;') && opf.includes('&lt;名&gt;') && !/&(?!amp;|lt;|gt;|quot;|apos;|#)/.test(opf.replace(/<\?xml[^>]*\?>/, '')),
    opf.match(/<dc:title>[^<]*<\/dc:title>/)?.[0]
  );

  const flatEpub = buildEpubFiles([chapter('f1', '单章', '', '', undefined as never, undefined as never, parseNoteHtml('<p>正文</p>'))], epubOptions);
  const flatDepth = flatEpub.find((file) => file.path.endsWith('toc.ncx'))?.content.match(/dtb:depth" content="(\d+)"/)?.[1];
  const nestedDepth = epubFiles.find((file) => file.path.endsWith('toc.ncx'))?.content.match(/dtb:depth" content="(\d+)"/)?.[1];
  check('EPUB：dtb:depth 反映真实目录树深度', flatDepth === '1' && nestedDepth === '3', { flatDepth, nestedDepth });

  const emptyEpub = buildEpubFiles([], epubOptions);
  const emptyNav = emptyEpub.find((file) => file.path.endsWith('nav.xhtml'))?.content ?? '';
  const emptyNcx = emptyEpub.find((file) => file.path.endsWith('toc.ncx'))?.content ?? '';
  check(
    'EPUB：没有章节时目录仍然非空（EPUBCheck 不接受空 ol/navMap）',
    /<ol>[\s\S]*<li>/.test(emptyNav) && /<navPoint/.test(emptyNcx),
    [emptyNav.match(/<ol>[\s\S]*<\/ol>/)?.[0], emptyNcx.match(/<navMap>[\s\S]*<\/navMap>/)?.[0]]
  );

  // ---- DOCX 文档对象（产物由 Node 侧校验）----
  const docxDocument = buildDocxDocument(chapters, { title: '回归书', date: '2024/3/25', settings });
  check('DOCX：能构造文档对象', typeof docxDocument === 'object' && docxDocument !== null);

  // ---- 回归：列表层级跳跃时的 EPUB 嵌套合法性 ----
  const depthJumpFiles = buildEpubFiles(
    [
      chapter('j1', '跳跃列表', '', '', undefined as never, undefined as never,
        parseNoteHtml('<ul><li><p></p><ul><li>x<ul><li>y</li></ul></li></ul></li></ul>')),
    ],
    epubOptions
  );
  const depthJumpXhtml = depthJumpFiles.find((file) => file.path.endsWith('chapter-1.xhtml'))?.content ?? '';
  const compactDepthJump = stripWhitespace(depthJumpXhtml);
  const depthJumpDoc = new DOMParser().parseFromString(depthJumpXhtml, 'application/xml');
  check(
    'EPUB：列表层级跳跃时不会出现列表直接嵌列表的非法结构',
    !/<(ul|ol)><(ul|ol)>/.test(compactDepthJump) &&
      !depthJumpDoc.querySelector('parsererror') &&
      compactDepthJump.includes('<ul><li><ul><li>x<ul><li>y</li></ul></li></ul></li></ul>'),
    compactDepthJump.match(/<ul>.*<\/ul>/)?.[0]?.slice(0, 240)
  );

  // ---- 回归：DOCX 有序列表重新编号、标题字号不倒挂 ----
  const listChapters = [
    chapter('o1', '列表章', '卷', '幕', 'v1', 'a1',
      parseNoteHtml('<ol><li>甲</li><li>乙</li></ol><p>中间段</p><ol><li>丙</li></ol>')),
    chapter('o2', '第二章', '卷', '幕', 'v1', 'a1', parseNoteHtml('<ol><li>丁</li></ol>')),
  ];
  const listDocxZip = await JSZip.loadAsync(
    await Packer.toBlob(buildDocxDocument(listChapters, { title: 'T', date: 'd', settings }))
  );
  const listNumberingXml = (await listDocxZip.file('word/numbering.xml')?.async('string')) ?? '';
  const listStylesXml = (await listDocxZip.file('word/styles.xml')?.async('string')) ?? '';

  const decimalAbstractIds = new Set(
    [...listNumberingXml.matchAll(/<w:abstractNum w:abstractNumId="(\d+)"[\s\S]*?<\/w:abstractNum>/g)]
      .filter((match) => match[0].includes('<w:numFmt w:val="decimal"/>'))
      .map((match) => match[1])
  );
  const decimalNumIds = [...listNumberingXml.matchAll(/<w:num w:numId="(\d+)">([\s\S]*?)<\/w:num>/g)]
    .filter((match) => {
      const abstractId = /<w:abstractNumId w:val="(\d+)"\/>/.exec(match[2])?.[1];
      return abstractId !== undefined && decimalAbstractIds.has(abstractId);
    })
    .map((match) => match[1]);
  check(
    'DOCX：每个有序列表使用独立编号实例（列表之间重新从 1 开始）',
    decimalNumIds.length >= 3,
    { decimalNumIds, decimalAbstractIds: [...decimalAbstractIds] }
  );

  const styleSize = (id: string) =>
    Number(
      new RegExp(`<w:style [^>]*w:styleId="${id}"[\\s\\S]*?<w:sz w:val="(\\d+)"`).exec(listStylesXml)?.[1] ?? 0
    );
  const bodySize = Number(
    /<w:docDefaults>[\s\S]*?<w:sz w:val="(\d+)"[\s\S]*?<\/w:docDefaults>/.exec(listStylesXml)?.[1] ?? 0
  );
  check(
    'DOCX：标题字号大于正文字号（层级不倒挂）',
    bodySize > 0 &&
      styleSize('Heading1') > styleSize('Heading2') &&
      styleSize('Heading2') > styleSize('Heading3') &&
      styleSize('Heading3') > bodySize,
    { bodySize, h1: styleSize('Heading1'), h2: styleSize('Heading2'), h3: styleSize('Heading3') }
  );

  // ---- 回归：控制字符、文件名与嵌套列表编号 ----
  check(
    '文件名：控制字符被清掉、非法字符替换为 -、超长书名被截断',
    sanitizeFileName('a\u0000b/c:d*e?f"g<h>i|j') === 'ab-c-d-e-f-g-h-i-j' &&
      sanitizeFileName('书'.repeat(300)).length === 80 &&
      sanitizeFileName('   ') === '导出',
    [
      sanitizeFileName('a\u0000b/c:d*e?f"g<h>i|j'),
      sanitizeFileName('书'.repeat(300)).length,
      sanitizeFileName('   '),
    ]
  );

  const controlBlocks = blocksOf('<p>软换行前\u000b软换行后\u0001结束</p>');
  check(
    '解析：非法控制字符被清理（U+000B 变成软换行，其余丢弃）',
    controlBlocks.length === 1 && blockToText(controlBlocks[0]) === '软换行前\n软换行后结束',
    controlBlocks.map((block) => JSON.stringify(blockToText(block)))
  );

  // 标题、卷幕名不经过正文解析，是 escapeXml 必须兜住的旁路
  const dirtyEpubFiles = buildEpubFiles(
    [chapter('z1', '标题\u000bA', '卷\u0000B', '幕\u0001C', 'v1', 'a1', parseNoteHtml('<p>正文\u000b换行</p>'))],
    epubOptions
  );
  const illegalXmlChars = dirtyEpubFiles.filter((file) =>
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(file.content)
  );
  check(
    'EPUB：标题等旁路的控制字符也被清掉，产物里不含 XML 非法字符',
    illegalXmlChars.length === 0,
    illegalXmlChars.map((file) => file.path)
  );

  const nestedDocxZip = await JSZip.loadAsync(
    await Packer.toBlob(
      buildDocxDocument(
        [
          chapter(
            'n1',
            '嵌套编号',
            '卷',
            '幕',
            'v1',
            'a1',
            parseNoteHtml('<ol><li>甲</li><li>乙<ul><li>子</li></ul></li><li>丙</li></ol>')
          ),
        ],
        { title: 'T', date: 'd', settings }
      )
    )
  );
  const nestedDocxXml = (await nestedDocxZip.file('word/document.xml')?.async('string')) ?? '';
  const nestedNumIds = [...nestedDocxXml.matchAll(/<w:numId w:val="(\d+)"/g)].map((match) => match[1]);
  check(
    'DOCX：嵌套子列表之后的同级有序项继续编号，不被误判成新列表',
    nestedNumIds.length >= 4 && nestedNumIds[0] === nestedNumIds[nestedNumIds.length - 1],
    { nestedNumIds }
  );

  // ---- PDF：打印用 HTML（真正的 PDF 由后端浏览器打印，见 backend/tests/test_pdf_export.py）----
  const printTitle = '导出<t>回归 & 书';
  const printHtml = buildPrintHtml(chapters, { title: printTitle, date: '2024/3/25', settings });
  check(
    'PDF：打印 HTML 是完整文档且纸张为 A4',
    printHtml.startsWith('<!doctype html>') && printHtml.includes('@page { size: A4; }'),
    printHtml.slice(0, 60)
  );
  check(
    'PDF：书名在标题与封面里都做了转义，且整份 HTML 不含脚本',
    printHtml.includes('<title>导出&lt;t&gt;回归 &amp; 书</title>') &&
      printHtml.includes('<h1 class="cover-title">导出&lt;t&gt;回归 &amp; 书</h1>') &&
      !/<script/i.test(printHtml)
  );
  check(
    'PDF：封面、目录、每章各一节，章节与封面之间强制分页',
    printHtml.includes('class="cover"') &&
      printHtml.includes('class="toc"') &&
      (printHtml.match(/class="chapter"/g) ?? []).length === chapters.length &&
      printHtml.includes('break-after: page') &&
      printHtml.includes('break-before: page'),
    (printHtml.match(/class="chapter"/g) ?? []).length
  );
  check(
    'PDF：排版参数来自编辑器设置（字号 / 行距 / 段首缩进）',
    printHtml.includes('font-size: 18px') &&
      printHtml.includes('line-height: 1.8') &&
      printHtml.includes('text-indent: 2em')
  );
  check(
    'PDF：内联样式、列表标记与层级缩进',
    printHtml.includes('<strong>加粗</strong>') &&
      printHtml.includes('<em>斜体</em>') &&
      printHtml.includes('<span class="strike">删除</span>') &&
      printHtml.includes('<span class="underline">下划线</span>') &&
      printHtml.includes('· 无序一') &&
      printHtml.includes('1. 有序一') &&
      printHtml.includes('margin-left: 3em')
  );
  check(
    'PDF：代码块保留换行与缩进，<hr> 输出分隔标记',
    printHtml.includes('<pre>code line1\n    indented</pre>') &&
      printHtml.includes('class="separator"') &&
      printHtml.includes(SEPARATOR_TEXT)
  );
  check(
    'PDF：正文里的标题不缩进，卷幕标题居中',
    /h2, h3, h4 \{ text-indent: 0;/.test(printHtml) &&
      /\.volume-title, \.act-title \{ text-indent: 0;/.test(printHtml)
  );

  // ---- 三种前端产出格式的真实下载 ----
  const exportOptions = { title: '导出回归', date: '2024/3/25', settings };
  await exportToDocx(chapters, exportOptions);
  await exportToEpub(chapters, exportOptions);
  exportToTxt(chapters, exportOptions);

  (window as unknown as Record<string, unknown>).__EXPORT_TESTS__ = {
    done: true,
    checks,
    fixture: { chapters: chapters.length },
  };
};

run().catch((error: unknown) => {
  checks.push({ name: '运行时异常', ok: false, detail: String((error as Error)?.stack ?? error) });
  (window as unknown as Record<string, unknown>).__EXPORT_TESTS__ = { done: true, checks };
});
