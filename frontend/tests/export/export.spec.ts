import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import JSZip from 'jszip';
import { HARNESS_PATH, buildHarness } from './bundle.mjs';

/** 读取 ZIP 中央目录（顺序与压缩方式），用于校验 EPUB 的存储策略 */
const readCentralDirectory = (buffer: Buffer): { name: string; method: number }[] => {
  let eocd = -1;
  for (let i = buffer.length - 22; i >= 0 && i > buffer.length - 22 - 65536; i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('不是合法的 ZIP：找不到 EOCD');

  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries: { name: string; method: number }[] = [];

  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('中央目录损坏');
    const method = buffer.readUInt16LE(offset + 10);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    entries.push({ name, method });
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
};

const styleIdsOf = (documentXml: string) =>
  [...documentXml.matchAll(/<w:pStyle w:val="([^"]+)"/g)].map((match) => match[1]);

test.describe('导出管道回归', () => {
  test.beforeAll(async () => {
    await buildHarness();
    expect(fs.existsSync(HARNESS_PATH), `用例打包失败：${HARNESS_PATH}`).toBe(true);
  });

  test('解析、目录与各格式产物都符合预期', async ({ page }, testInfo) => {
    test.setTimeout(300_000);

    const downloads: { name: string; path: string }[] = [];
    const pending: Promise<void>[] = [];
    page.on('download', (download) => {
      const target = testInfo.outputPath(download.suggestedFilename());
      pending.push(
        download
          .saveAs(target)
          .then(() => {
            downloads.push({ name: download.suggestedFilename(), path: target });
          })
          .catch(() => undefined)
      );
    });

    await page.setContent('<!doctype html><html><body><div id="app"></div></body></html>');
    await page.addScriptTag({ path: HARNESS_PATH, type: 'text/javascript' });
    await page.waitForFunction(
      () => (window as unknown as Record<string, any>).__EXPORT_TESTS__?.done === true,
      null,
      { timeout: 240_000 }
    );

    const report = await page.evaluate(
      () => (window as unknown as Record<string, any>).__EXPORT_TESTS__ as
        | { checks: { name: string; ok: boolean; detail?: unknown }[]; fixture?: { chapters: number } }
        | undefined
    );
    expect(report, '用例未产出结果').toBeTruthy();

    const failures = (report?.checks ?? []).filter((check) => !check.ok);
    expect(
      failures,
      `失败的检查：\n${failures.map((failure) => `- ${failure.name}：${JSON.stringify(failure.detail)}`).join('\n')}`
    ).toEqual([]);
    expect((report?.checks ?? []).length).toBeGreaterThanOrEqual(20);

    await page.waitForTimeout(3000);
    await Promise.all(pending);

    const byExtension = (extension: string) => downloads.find((file) => file.name.endsWith(extension));
    const txtFile = byExtension('.txt');
    const epubFile = byExtension('.epub');
    const docxFile = byExtension('.docx');
    // PDF 由后端浏览器打印，不在浏览器侧下载，改由 backend/tests/test_pdf_export.py 覆盖
    expect(downloads.map((file) => file.name).sort()).toEqual(
      ['导出回归_2024-3-25.txt', '导出回归_2024-3-25.epub', '导出回归_2024-3-25.docx'].sort()
    );
    expect([txtFile, epubFile, docxFile].every(Boolean), '三种前端格式都应触发下载').toBe(true);

    // ---- TXT ----
    const txt = fs.readFileSync(txtFile!.path, 'utf8');
    expect(txt.startsWith('\uFEFF'), 'TXT 不应带 BOM').toBe(false);
    expect(txt).toContain('导出回归');
    expect(txt).toContain('目 录');
    expect(txt).toContain('第一章 起点');
    expect(txt, 'TXT 标题不应带 markdown 前缀').not.toMatch(/^#{1,3} /m);
    expect(txt).toContain('\u3000\u3000第一段');

    // ---- EPUB：mimetype 必须是第一条物理条目且不压缩，其余用 DEFLATE ----
    const epubBuffer = fs.readFileSync(epubFile!.path);
    expect(epubBuffer.readUInt32LE(0), 'EPUB 第一个本地文件头').toBe(0x04034b50);
    expect(epubBuffer.readUInt16LE(8), 'mimetype 必须 STORE（method 0）').toBe(0);
    const mimetypeNameLength = epubBuffer.readUInt16LE(26);
    expect(epubBuffer.subarray(30, 30 + mimetypeNameLength).toString('utf8')).toBe('mimetype');

    const epubEntries = readCentralDirectory(epubBuffer);
    const epubNames = epubEntries.map((entry) => entry.name);
    expect(epubNames).toEqual(
      expect.arrayContaining([
        'mimetype',
        'META-INF/container.xml',
        'OEBPS/content.opf',
        'OEBPS/nav.xhtml',
        'OEBPS/toc.ncx',
        'OEBPS/chapter-1.xhtml',
      ])
    );
    const mimetypeEntry = epubEntries.find((entry) => entry.name === 'mimetype');
    expect(mimetypeEntry?.method).toBe(0);
    expect(
      epubEntries.filter((entry) => entry.name.endsWith('/')).map((entry) => entry.name),
      'EPUB 不应包含多余的目录条目'
    ).toEqual([]);
    expect(
      epubEntries.filter((entry) => !entry.name.endsWith('/') && entry.name !== 'mimetype').every((entry) => entry.method === 8),
      `除 mimetype 外都应 DEFLATE 压缩：${JSON.stringify(epubEntries)}`
    ).toBe(true);

    // ---- DOCX：有序列表编号、字号跟随设置、样式引用完整 ----
    const docxZip = await JSZip.loadAsync(fs.readFileSync(docxFile!.path));
    const documentXml = (await docxZip.file('word/document.xml')!.async('string')) ?? '';
    const stylesXml = (await docxZip.file('word/styles.xml')!.async('string')) ?? '';
    const numberingXml = (await docxZip.file('word/numbering.xml')!.async('string')) ?? '';

    expect(numberingXml, '有序列表需要 decimal 编号定义').toContain('<w:numFmt w:val="decimal"/>');
    const numIds = new Set([...documentXml.matchAll(/<w:numId w:val="(\d+)"/g)].map((match) => match[1]));
    expect(numIds.size, '有序与无序列表应使用不同的 numId').toBeGreaterThanOrEqual(2);
    expect((documentXml.match(/<w:numPr>/g) ?? []).length, '列表项都应带编号属性').toBeGreaterThanOrEqual(5);
    expect(stylesXml, '正文字号应为 18px × 0.75 × 2 = 27（半磅）').toContain('<w:sz w:val="27"/>');

    const definedStyleIds = new Set(
      [...stylesXml.matchAll(/<w:style [^>]*w:styleId="([^"]+)"/g)].map((match) => match[1])
    );
    const usedStyleIds = [...new Set(styleIdsOf(documentXml))];
    expect(usedStyleIds.filter((id) => !definedStyleIds.has(id)), '所有引用的样式都必须已定义').toEqual([]);
    expect(documentXml).toContain('<w:u ');
    expect(documentXml).toContain('<w:strike');
    expect(documentXml).toContain('Consolas');
    expect(documentXml).toContain('目 录');
  });
});
