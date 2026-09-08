export const MAX_STATEMENT_PDF_BYTES = 20 * 1024 * 1024;
export const MAX_STATEMENT_PDF_PAGES = 50;
export type StatementPdf = { pageCount: number; renderPage: (page: number, signal?: AbortSignal) => Promise<File>; close: () => Promise<void> };
export function assertStatementPdfLimits(bytes: number, pages?: number): void {
  if (bytes <= 0) throw new Error('That PDF is empty. Choose a complete statement.');
  if (bytes > MAX_STATEMENT_PDF_BYTES) throw new Error('Choose a PDF of 20 MB or less. Split larger statements without omitting transaction pages.');
  if (pages !== undefined && (!Number.isInteger(pages) || pages < 1 || pages > MAX_STATEMENT_PDF_PAGES)) throw new Error('Choose a PDF with 1–50 pages. Split larger statements and include every transaction page.');
}
export function selectedStatementPages(value: string, pageCount: number): number[] {
  if (!value.trim()) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const pages = new Set<number>();
  for (const part of value.split(',')) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error('Use page numbers or ranges, such as 1–3, 5.');
    const first = Number(match[1]), last = Number(match[2] ?? match[1]);
    if (first < 1 || last < first || last > pageCount) throw new Error(`Choose pages between 1 and ${pageCount}.`);
    for (let page = first; page <= last; page += 1) pages.add(page);
  }
  return [...pages].sort((left, right) => left - right);
}
export async function openStatementPdf(file: File): Promise<StatementPdf> {
  assertStatementPdfLimits(file.size);
  const pdfjs = await import('pdfjs-dist');
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const loading = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), stopAtErrors: true, useWasm: false });
  let encrypted = false;
  let rejectPassword: (error: Error) => void = () => {};
  const passwordFailure = new Promise<never>((_resolve, reject) => { rejectPassword = reject; });
  loading.onPassword = () => { encrypted = true; rejectPassword(new Error('Locked PDF')); };
  let pdf: Awaited<typeof loading.promise>;
  try { pdf = await Promise.race([loading.promise, passwordFailure]); assertStatementPdfLimits(file.size, pdf.numPages); }
  catch (error) {
    await loading.destroy();
    if (encrypted || (error instanceof Error && error.name === 'PasswordException')) throw new Error('This PDF is locked. Save an unlocked copy from your bank or PDF app, then attach it again.');
    throw new Error(error instanceof Error ? `The PDF could not open: ${error.message}` : 'The PDF is damaged or incomplete. Download a fresh copy.');
  }
  return {
    pageCount: pdf.numPages,
    async renderPage(pageNumber, signal) {
      signal?.throwIfAborted();
      if (pageNumber < 1 || pageNumber > pdf.numPages) throw new Error('That page is outside the statement.');
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const scale = Math.min(2, 2000 / Math.max(viewport.width, viewport.height));
      const scaled = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(scaled.width); canvas.height = Math.ceil(scaled.height);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('This browser could not display the PDF page.');
      const render = page.render({ canvas, canvasContext: context, viewport: scaled });
      const abort = () => render.cancel();
      signal?.addEventListener('abort', abort, { once: true });
      try {
        await render.promise; signal?.throwIfAborted();
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('The statement page could not be read.')), 'image/jpeg', 0.92));
        return new File([blob], `statement-page-${pageNumber}.jpg`, { type: 'image/jpeg' });
      } finally { signal?.removeEventListener('abort', abort); canvas.width = 0; canvas.height = 0; page.cleanup(); }
    },
    close: () => loading.destroy(),
  };
}
