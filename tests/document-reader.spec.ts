import { test, expect } from "@playwright/test";

function twoPagePDF() {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ...['First page', 'Second page'].map(t => {
      const body = `BT /F1 20 Tf 30 240 Td (${t}) Tj ET\n`;
      return `<< /Length ${body.length} >>\nstream\n${body}endstream`;
    }),
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 8\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

test.beforeEach(async ({ page }) => {
  // A reader must not require any external service or CDN.
  await page.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
  await page.route('**/api/conversations**', r => r.fulfill({ json: r.request().method() === 'PUT'
    ? { id: r.request().url().split('/').at(-1), revision: 1, updated: new Date().toISOString() } : { chats: [] } }));
  await page.route('**/api/research?*', r => r.fulfill({json: {collections: ['Test'],limited:false,files:[
    {id:1,name:'Guide.pdf',mime:'application/pdf',collection:'Test'},
    {id:2,name:'Water.txt',mime:'text/plain',collection:'Test'},
  ]}}));
  await page.route('**/api/research/1', r => {
    expect(r.request().headers()['x-klinekraft-client']).toBe('local-ui');
    return r.fulfill({ contentType:'application/pdf',body:twoPagePDF() });
  });
  await page.route('**/api/research/2', r => r.fulfill({contentType:'text/plain',body:'Offline water reference. <script>not executable</script>'}));
});

test('Library opens PDF and text immediately without a popup', async ({page,context}) => {
  await page.goto('/');
  await page.getByRole('button',{name:/^05 Library/}).click();
  await page.getByRole('button',{name:'Guide.pdf',exact:true}).click();
  const reader=page.getByRole('dialog');
  await expect(reader).toBeVisible();
  await expect(reader.getByText('Page 1 of 2')).toBeVisible();
  await expect(reader.getByRole('status')).toHaveCount(0);
  await reader.getByRole('button',{name:'Next page'}).click();
  await expect(reader.getByText('Page 2 of 2')).toBeVisible();
  await expect(reader.getByRole('status')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(reader).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Guide.pdf',exact:true})).toBeFocused();
  await page.getByRole('button',{name:'Water.txt',exact:true}).click();
  await expect(reader.locator('pre')).toContainText('<script>not executable</script>');
  expect(context.pages()).toHaveLength(1);
});

test('AI citation opens directly on its cited PDF page', async ({page,context}) => {
  await page.route('**/api/ai/status',r=>r.fulfill({json:{configured:true,model:'test'}}));
  await page.route('**/api/ai/ask',r=>r.fulfill({json:{answer:'See the guide [1].',notice:'',images:[],sources:[
    {id:1,fileId:1,title:'Guide.pdf',page:2,path:'/api/research/1'},
  ]}}));
  await page.goto('/');
  await page.getByRole('button',{name:/^03 AI assistant/}).click();
  await page.getByLabel('Your question',{exact:true}).fill('Show my guide.');
  await page.getByRole('button',{name:'Send message',exact:true}).click();
  await page.getByText('1 source',{exact:true}).click();
  await page.getByRole('button',{name:'[1] Guide.pdf · page 2',exact:true}).click();
  const reader=page.getByRole('dialog');
  await expect(reader.getByText('Page 2 of 2')).toBeVisible();
  await expect(reader.getByRole('status')).toHaveCount(0);
  expect(context.pages()).toHaveLength(1);
});
