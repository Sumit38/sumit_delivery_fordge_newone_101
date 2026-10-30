import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';

vi.mock('@/lib/require-user', () => ({
  requireUser: vi.fn(async () => ({ userId: 'test-user' })),
}));

import { POST as extractPdf } from '@/app/api/extract-pdf/route';
import { POST as extractDocx } from '@/app/api/extract-docx/route';
import { POST as exportExcel } from '@/app/api/export-excel/route';
import { buildFlowMermaid, buildPathTreeMermaid, findBranchNodes } from '@/lib/flow-diagram';
import { buildUseCaseHTML } from '@/lib/use-case-generator';
import { cleanExtractedText } from '@/lib/file-text-extract';

const REQUIREMENT =
  'User Registration: The user enters name, email and password. If the email already exists the system shows an error.';

function makePdf(lines: string[]): Buffer {
  const body = lines.map((l, i) => `${i === 0 ? '' : '0 -14 Td '}(${l}) Tj`).join(' ');
  const stream = `BT /F1 10 Tf 20 750 Td ${body} ET`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf +=
    `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` +
    offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('') +
    `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

async function makeDocx(paragraphs: string[]): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
  );
  zip.file(
    '_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
  );
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs
      .map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`)
      .join('')}</w:body></w:document>`
  );
  return zip.generateAsync({ type: 'nodebuffer' });
}

const binaryRequest = (url: string, body: Buffer) =>
  new NextRequest(url, { method: 'POST', body: new Uint8Array(body), headers: { authorization: 'Bearer x' } });

describe('requirement file upload (.pdf / .docx)', () => {
  it('extracts text from a PDF', async () => {
    const res = await extractPdf(binaryRequest('http://localhost/api/extract-pdf', makePdf(['Requirement from PDF', 'Login with email and password'])));
    expect(res.status).toBe(200);
    const { text } = await res.json();
    expect(text).toContain('Requirement from PDF');
    expect(text).toContain('Login with email and password');
  });

  it('extracts text from a Word .docx', async () => {
    const res = await extractDocx(binaryRequest('http://localhost/api/extract-docx', await makeDocx(['Requirement from Word', REQUIREMENT])));
    expect(res.status).toBe(200);
    const { text } = await res.json();
    expect(text).toContain('Requirement from Word');
    expect(text).toContain('email already exists');
  });

  it('rejects a file that is not a valid PDF / Word document', async () => {
    const junk = Buffer.from('this is not a pdf');
    expect((await extractPdf(binaryRequest('http://localhost/api/extract-pdf', junk))).status).toBe(422);
    expect((await extractDocx(binaryRequest('http://localhost/api/extract-docx', junk))).status).toBe(422);
  });

  it('rejects files larger than 4 MB', async () => {
    const big = Buffer.alloc(4 * 1024 * 1024 + 1, 1);
    expect((await extractPdf(binaryRequest('http://localhost/api/extract-pdf', big))).status).toBe(413);
  });

  it('cleans extra blank lines and spaces', () => {
    expect(cleanExtractedText('a  b \r\n\r\n\r\n\r\nc')).toBe('a b\n\nc');
  });
});

describe('test scenarios Excel export', () => {
  const scenarios = [
    {
      id: 1,
      name: 'Successful registration',
      description: 'User registers with valid data',
      complexity: 'Medium',
      actors: ['User', 'System'],
      preconditions: ['User is on the sign-up page'],
      steps: ['Enter details', 'Submit'],
      expectedResult: 'Account created',
      testCases: [
        { id: 'TC1', name: 'Valid data - Path 1', steps: ['Enter name', 'Enter email', 'Submit'], expectedResult: 'Account created' },
        { id: 'TC2', name: 'Duplicate email', steps: ['Enter existing email', 'Submit'], expectedResult: 'Error shown' },
      ],
    },
    { id: 2, name: 'Template scenario', complexity: 'High', isTemplate: true, actors: [], preconditions: [], testCases: [] },
  ];

  it('returns a real .xlsx with Summary, Test Scenarios and Test Cases sheets', async () => {
    const req = new NextRequest('http://localhost/api/export-excel', {
      method: 'POST',
      body: JSON.stringify({
        scenarios,
        requirementTitle: 'User Registration',
        requirementText: REQUIREMENT,
        complexity: { n: 6, e: 7, p: 2, complexityScore: 5 },
      }),
    });
    const res = await exportExcel(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('spreadsheetml');
    expect(res.headers.get('content-disposition')).toMatch(/User-Registration-test-scenarios-.*\.xlsx/);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await res.arrayBuffer());
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Summary', 'Test Scenarios', 'Test Cases']);

    const summary = wb.getWorksheet('Summary')!;
    const values = summary.getSheetValues().flat().map(String);
    // M = E - N + 2P = 7 - 6 + 4 = 5, unchanged app formula
    expect(values).toContain('M = E - N + 2P = 7 - 6 + 2(2) = 5');

    const scenarioSheet = wb.getWorksheet('Test Scenarios')!;
    expect(scenarioSheet.rowCount).toBe(3); // header + 2 scenarios
    expect(scenarioSheet.getRow(2).getCell(1).value).toBe('TS-001');
    expect(scenarioSheet.getRow(3).getCell(4).value).toBe('Template');

    const cases = wb.getWorksheet('Test Cases')!;
    expect(cases.rowCount).toBe(3); // header + 2 test cases
    expect(cases.getRow(2).getCell(1).value).toBe('TS-001-TC01');
    expect(cases.getRow(2).getCell(4).value).toBe('Valid data'); // " - Path 1" suffix removed
    expect(cases.getRow(2).getCell(7).value).toBe('1. Enter name\n2. Enter email\n3. Submit');
    expect(cases.getRow(2).getCell(9).value).toBe(6); // 3 steps x Medium(2)
  });

  it('rejects a request with no scenarios', async () => {
    const req = new NextRequest('http://localhost/api/export-excel', { method: 'POST', body: JSON.stringify({ scenarios: [] }) });
    expect((await exportExcel(req)).status).toBe(400);
  });
});

describe('flow diagram (Mermaid)', () => {
  const nodes = ['Start', 'Enter Details', 'Email Exists?', 'Show Error', 'Create Account', 'End'];
  const edges = [
    { from: 'Start', to: 'Enter Details' },
    { from: 'Enter Details', to: 'Email Exists?' },
    { from: 'Email Exists?', to: 'Show Error', condition: 'yes' },
    { from: 'Email Exists?', to: 'Create Account', condition: 'no' },
    { from: 'Show Error', to: 'End' },
    { from: 'Create Account', to: 'End', condition: 'default' },
  ];
  const paths = [
    ['Start', 'Enter Details', 'Email Exists?', 'Show Error', 'End'],
    ['Start', 'Enter Details', 'Email Exists?', 'Create Account', 'End'],
  ];

  it('draws every node and edge, with decision points as diamonds', () => {
    const code = buildFlowMermaid(nodes, edges);
    expect(code.startsWith('flowchart TD')).toBe(true);
    expect(code).toContain('N1(["Start"])');
    expect(code).toContain('N6(["End"])');
    expect(code).toContain('N3{"Email Exists?"}');
    expect(code).toContain('N3 -->|"yes"| N4');
    expect(code).toContain('N5 --> N6'); // "default" condition is not shown
    expect(code.match(/-->/g)?.length).toBe(edges.length);
  });

  it('escapes characters that would break Mermaid', () => {
    const code = buildFlowMermaid(['Start', 'Say "hi" <b>', 'End'], [
      { from: 'Start', to: 'Say "hi" <b>', condition: 'a|b' },
      { from: 'Say "hi" <b>', to: 'End' },
    ]);
    expect(code).toContain('N2["Say #quot;hi#quot; #lt;b#gt;"]');
    expect(code).toContain('-->|"a/b"|');
  });

  it('finds branch nodes from outgoing edges', () => {
    expect(findBranchNodes(edges)).toEqual(['Email Exists?']);
  });

  it('builds a path tree that forks where paths split', () => {
    const tree = buildPathTreeMermaid(paths)!;
    expect(tree.startsWith('flowchart LR')).toBe(true);
    expect(tree).toContain('{"Email Exists?"}');
    expect(tree).toContain('✓ P1');
    expect(tree).toContain('✓ P2');
    expect(buildPathTreeMermaid([])).toBeNull();
  });
});

describe('use case document', () => {
  it('includes Non-Functional Requirements and Field Validations sections', () => {
    const html = buildUseCaseHTML('Registration', {
      useCaseTitle: 'Registration',
      description: 'd',
      actors: [{ name: 'User', role: 'Registers' }],
      preconditions: ['p'],
      mainFlow: [{ step: 1, actor: 'User', action: 'Enter email' }],
      alternativeFlows: [],
      exceptionFlows: [],
      postconditions: ['done'],
      businessValue: 'v',
      kpis: [],
      nonFunctionalRequirements: [
        { category: 'Performance', requirement: 'Fast sign-up', measure: '< 2s for 95% of requests', priority: 'Must', source: 'Assumed' },
        { category: 'Security', requirement: 'Encrypt passwords', measure: 'bcrypt cost 12', priority: 'Must', source: 'Stated' },
      ],
      fieldValidations: [
        { screen: 'Sign-up', field: 'Email', type: 'Email', mandatory: true, rules: 'Valid format, unique', errorMessage: 'Please enter a valid email <x>', source: 'Stated' },
      ],
    });
    expect(html).toContain('10. Non-Functional Requirements');
    expect(html).toContain('NFR-01');
    expect(html).toContain('&lt; 2s for 95% of requests');
    expect(html).toContain('11. Field Validations');
    expect(html).toContain('FV-01');
    expect(html).toContain('Please enter a valid email &lt;x&gt;');
  });

  it('still renders older use cases that have no NFR / field data', () => {
    const html = buildUseCaseHTML('Old', {
      useCaseTitle: 'Old', description: 'd', actors: [], preconditions: [], mainFlow: [],
      alternativeFlows: [], exceptionFlows: [], postconditions: [], businessValue: 'v', kpis: [],
    });
    expect(html).toContain('9. Key Performance Indicators');
    expect(html).not.toContain('Non-Functional Requirements');
  });
});
