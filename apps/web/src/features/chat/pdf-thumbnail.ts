import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
// The worker is served from our own origin, never from a CDN.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * A PDF's first page, at most `height` CSS pixels high (P-28). Loaded on demand, since pdf.js is large. Answers with
 * a canvas of its own, because pdf.js refuses two renders on one canvas and shows half-drawn pages in between.
 */
export async function renderFirstPage(pdf: Blob, height: number): Promise<HTMLCanvasElement> {
  const loading = getDocument({ data: await pdf.arrayBuffer() });
  try {
    const document_ = await loading.promise;
    const page = await document_.getPage(1);
    const pixelRatio = window.devicePixelRatio;
    const scale = (height / page.getViewport({ scale: 1 }).height) * pixelRatio;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = `${String(viewport.width / pixelRatio)}px`;
    canvas.style.height = `${String(viewport.height / pixelRatio)}px`;
    await page.render({ canvas, viewport }).promise;
    return canvas;
  } finally {
    await loading.destroy();
  }
}
