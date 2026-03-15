import { useState } from 'react';
import { FileDown, Loader2, ChevronDown } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak } from 'docx';
import type { components } from '@/types/api';
import { api } from '@/utils/request';

type VolumeNode = components['schemas']['VolumeNode'];
type ActNode = components['schemas']['ActNode'];
type NoteNode = components['schemas']['NoteNode'];

interface ExportProps {
  projectId: string;
  projectTitle?: string;
  tree: VolumeNode[];
}

interface ChapterData {
  id: string;
  title: string;
  content: string;
  volumeTitle: string;
  actTitle: string;
}

type ExportFormat = 'pdf' | 'epub' | 'txt' | 'docx';

export const Export = ({ projectId, projectTitle, tree }: ExportProps) => {
  const [isExporting, setIsExporting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

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

  const htmlToPlainText = (html: string): string => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || '';
  };

  const exportToPDF = async (chapters: ChapterData[], date: string) => {
    const pdf = new jsPDF({
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait',
    });

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

    pdf.setFont('helvetica');
    pdf.setFontSize(fontSize);

    let finalPage = 1;
    let finalY = marginTop;

    const finalAddHeader = () => {
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text(projectTitle || '我的小说', marginLeft, 15);
      pdf.text(`第 ${finalPage} 页`, pageWidth - marginRight, 15, { align: 'right' });
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(fontSize);
    };

    const finalAddNewPage = () => {
      pdf.addPage();
      finalPage++;
      finalY = marginTop;
      finalAddHeader();
    };

    const checkAndAddPage = (neededSpace: number) => {
      if (finalY + neededSpace > pageHeight - marginBottom) {
        finalAddNewPage();
      }
    };

    const addText = (text: string, size: number = fontSize) => {
      pdf.setFontSize(size);
      const lines = pdf.splitTextToSize(text, contentWidth);
      for (const line of lines) {
        checkAndAddPage(lineHeight);
        pdf.text(line, marginLeft, finalY);
        finalY += lineHeight;
      }
      pdf.setFontSize(fontSize);
    };

    finalAddHeader();

    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    const titleY = pageHeight / 3;
    pdf.text(projectTitle || '我的小说', pageWidth / 2, titleY, { align: 'center' });
    
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.text(date, pageWidth / 2, titleY + 20, { align: 'center' });

    finalAddNewPage();

    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text('目 录', pageWidth / 2, finalY, { align: 'center' });
    finalY += 15;

    const tocChapters: { title: string; pageNumber: number }[] = [];

    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];
      const tocEntry = `${chapter.volumeTitle ? chapter.volumeTitle + ' - ' : ''}${chapter.actTitle ? chapter.actTitle + ' - ' : ''}${chapter.title}`;
      tocChapters.push({ title: tocEntry, pageNumber: 0 });
    }

    for (let i = 0; i < tocChapters.length; i++) {
      if (finalY + lineHeight * 2 > pageHeight - marginBottom) {
        finalAddNewPage();
      }
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text(tocChapters[i].title, marginLeft, finalY);
      finalY += lineHeight;
    }

    finalAddNewPage();

    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];
      
      if (finalY + lineHeight * 4 > pageHeight - marginBottom) {
        finalAddNewPage();
      }
      
      finalY += 5;
      
      if (chapter.volumeTitle) {
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text(chapter.volumeTitle, marginLeft, finalY);
        finalY += lineHeight + 2;
      }
      
      if (chapter.actTitle) {
        pdf.setFontSize(13);
        pdf.setFont('helvetica', 'bold');
        pdf.text(chapter.actTitle, marginLeft, finalY);
        finalY += lineHeight + 2;
      }
      
      pdf.setFontSize(titleFontSize);
      pdf.setFont('helvetica', 'bold');
      pdf.text(chapter.title, marginLeft, finalY);
      finalY += lineHeight + 5;
      
      tocChapters[i].pageNumber = finalPage;
      
      if (chapter.content) {
        pdf.setFontSize(fontSize);
        pdf.setFont('helvetica', 'normal');
        addText(chapter.content);
      }
      
      finalY += 10;
      
      if (i < chapters.length - 1) {
        finalAddNewPage();
      }
    }

    pdf.save(`${projectTitle || '我的小说'}_${date.replace(/\//g, '-')}.pdf`);
  };

  const generateEPUB = async (chapters: ChapterData[], date: string) => {
    const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });

    const bookId = uuid();
    const bookTitle = projectTitle || '我的小说';
    
    let contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:title>${bookTitle}</dc:title>
    <dc:language>zh-CN</dc:language>
    <dc:identifier id="BookId" opf:scheme="UUID">${bookId}</dc:identifier>
    <dc:date>${new Date().toISOString().split('T')[0]}</dc:date>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="titlepage" href="titlepage.xhtml" media-type="application/xhtml+xml"/>`;

    let spine = `<spine toc="ncx">
    <itemref idref="titlepage"/>`;

    let tocNcx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${bookId}"/>
    <meta name="dtb:depth" content="3"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle>
    <text>${bookTitle}</text>
  </docTitle>
  <navMap>`;

    let navPoints = '';
    let allXhtml = '';

    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];
      const chapterId = `chapter${i + 1}`;
      const fileName = `${chapterId}.xhtml`;
      
      contentOpf += `
    <item id="${chapterId}" href="${fileName}" media-type="application/xhtml+xml"/>`;
      
      spine += `
    <itemref idref="${chapterId}"/>`;
      
      navPoints += `
    <navPoint id="navPoint-${i + 1}" playOrder="${i + 1}">
      <navLabel>
        <text>${chapter.title}</text>
      </navLabel>
      <content src="${fileName}"/>
    </navPoint>`;

      const chapterTitle = `${chapter.volumeTitle ? chapter.volumeTitle + ' - ' : ''}${chapter.actTitle ? chapter.actTitle + ' - ' : ''}${chapter.title}`;
      const chapterContent = chapter.content.replace(/\n/g, '<br/>');
      
      const xhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <title>${chapterTitle}</title>
    <style type="text/css">
      body { font-family: serif; line-height: 1.8; margin: 5%; }
      h1 { font-size: 1.8em; font-weight: bold; margin-bottom: 1em; }
    </style>
  </head>
  <body>
    <h1>${chapterTitle}</h1>
    <p>${chapterContent}</p>
  </body>
</html>`;

      allXhtml += `--boundary
Content-Type: application/xhtml+xml
Content-Location: OEBPS/${fileName}

${xhtml}
`;
    }

    contentOpf += `
  </manifest>
${spine}
  </spine>
</package>`;

    tocNcx += navPoints + `
  </navMap>
</ncx>`;

    const titlePage = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <title>${bookTitle}</title>
    <style type="text/css">
      body { font-family: serif; text-align: center; margin-top: 30%; }
      h1 { font-size: 2em; font-weight: bold; }
    </style>
  </head>
  <body>
    <h1>${bookTitle}</h1>
    <p>${date}</p>
  </body>
</html>`;

    const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

    const mimetype = 'application/epub+zip';

    const epubContent = `--boundary
Content-Type: application/octet-stream
Content-Location: mimetype

${mimetype}
--boundary
Content-Type: application/xml
Content-Location: META-INF/container.xml

${containerXml}
--boundary
Content-Type: application/oebps-package+xml
Content-Location: OEBPS/content.opf

${contentOpf}
--boundary
Content-Type: application/x-dtbncx+xml
Content-Location: OEBPS/toc.ncx

${tocNcx}
--boundary
Content-Type: application/xhtml+xml
Content-Location: OEBPS/titlepage.xhtml

${titlePage}
${allXhtml}
--boundary--`;

    const parts = epubContent.split('--boundary');
    const files: { path: string; content: string | Blob }[] = [];
    
    files.push({ path: 'mimetype', content: mimetype });
    
    for (const part of parts) {
      if (!part.trim()) continue;
      
      const headersMatch = part.match(/Content-Type: ([^\n]+)\s+Content-Location: ([^\n]+)/);
      if (headersMatch) {
        const path = headersMatch[2].trim();
        const content = part.substring(part.indexOf('\n\n') + 2).trim();
        files.push({ path, content });
      }
    }

    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      
      for (const file of files) {
        zip.file(file.path, file.content);
      }
      
      const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectTitle || '我的小说'}_${date.replace(/\//g, '-')}.epub`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('请安装jszip库以支持EPUB导出');
    }
  };

  const exportToTXT = async (chapters: ChapterData[], date: string) => {
    let txtContent = '';
    
    txtContent += '='.repeat(50) + '\n';
    txtContent += (projectTitle || '我的小说') + '\n';
    txtContent += date + '\n';
    txtContent += '='.repeat(50) + '\n\n';
    
    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];
      
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
    
    const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectTitle || '我的小说'}_${date.replace(/\//g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportToDOCX = async (chapters: ChapterData[], date: string) => {
    const docChildren: any[] = [];
    
    docChildren.push(
      new Paragraph({
        text: projectTitle || '我的小说',
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      })
    );
    
    docChildren.push(
      new Paragraph({
        text: date,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      })
    );
    
    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];
      
      if (chapter.volumeTitle) {
        docChildren.push(
          new Paragraph({
            text: chapter.volumeTitle,
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 200, after: 200 },
          })
        );
      }
      
      if (chapter.actTitle) {
        docChildren.push(
          new Paragraph({
            text: chapter.actTitle,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 200 },
          })
        );
      }
      
      docChildren.push(
        new Paragraph({
          text: chapter.title,
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 200 },
        })
      );
      
      const contentParagraphs = chapter.content.split(/\n+/);
      for (const para of contentParagraphs) {
        if (para.trim()) {
          docChildren.push(
            new Paragraph({
              children: [new TextRun(para)],
              spacing: { after: 200 },
            })
          );
        }
      }
      
      if (i < chapters.length - 1) {
        docChildren.push(
          new Paragraph({
            children: [new PageBreak()],
          })
        );
      }
    }
    
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: docChildren,
        },
      ],
    });
    
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectTitle || '我的小说'}_${date.replace(/\//g, '-')}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExport = async (format: ExportFormat) => {
    setIsExporting(true);
    setShowMenu(false);
    try {
      const chapters = collectAllChapters(tree);
      
      for (const chapter of chapters) {
        const note = await api.get<any>(`/projects/${projectId}/notes/${chapter.id}`);
        chapter.content = htmlToPlainText(note.content || '');
      }

      const date = new Date().toLocaleDateString('zh-CN');

      if (format === 'pdf') {
        await exportToPDF(chapters, date);
      } else if (format === 'epub') {
        await generateEPUB(chapters, date);
      } else if (format === 'txt') {
        await exportToTXT(chapters, date);
      } else if (format === 'docx') {
        await exportToDOCX(chapters, date);
      }
    } catch (error) {
      console.error('导出失败:', error);
      alert('导出失败，请重试');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="relative w-20">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={isExporting}
        className="w-full flex items-center justify-center gap-1 py-2.5 text-xs text-sky-600/80 hover:text-sky-700 hover:bg-sky-100/50 rounded-lg transition-all duration-200 disabled:opacity-50"
      >
        {isExporting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>导出中...</span>
          </>
        ) : (
          <>
            <FileDown className="h-4 w-4" />
            <span>导出</span>
            <ChevronDown className="h-3 w-3" />
          </>
        )}
      </button>

      {showMenu && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute bottom-full left-0 mb-2 w-32 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden p-1">
            <button
              onClick={() => handleExport('pdf')}
              className="w-full px-3 py-2 text-sm text-left rounded-md transition-all duration-200 hover:bg-primary/5 hover:text-primary"
            >
              <span>PDF格式</span>
            </button>
            <button
              onClick={() => handleExport('epub')}
              className="w-full px-3 py-2 text-sm text-left rounded-md transition-all duration-200 hover:bg-primary/5 hover:text-primary"
            >
              <span>EPUB格式</span>
            </button>
            <button
              onClick={() => handleExport('txt')}
              className="w-full px-3 py-2 text-sm text-left rounded-md transition-all duration-200 hover:bg-primary/5 hover:text-primary"
            >
              <span>TXT格式</span>
            </button>
            <button
              onClick={() => handleExport('docx')}
              className="w-full px-3 py-2 text-sm text-left rounded-md transition-all duration-200 hover:bg-primary/5 hover:text-primary"
            >
              <span>DOCX格式</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};
