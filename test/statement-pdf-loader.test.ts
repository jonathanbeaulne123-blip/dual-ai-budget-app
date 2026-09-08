import { afterEach, expect, it, vi } from 'vitest';
const state=vi.hoisted(()=>({mode:'valid',destroy:vi.fn(async()=>{})}));
vi.mock('pdfjs-dist',()=>({GlobalWorkerOptions:{workerSrc:''},getDocument:()=>{
 const task={onPassword:null as null|(()=>void),destroy:state.destroy,promise:state.mode==='locked'?new Promise(()=>{}):state.mode==='corrupt'?Promise.reject(new Error('Invalid PDF')):Promise.resolve({numPages:state.mode==='oversized'?51:2})};
 if(state.mode==='locked')queueMicrotask(()=>task.onPassword?.());
 return task;
}}));
import { openStatementPdf } from '../src/imports/statementSetup/pdf.ts';
afterEach(()=>{state.mode='valid';state.destroy.mockClear();});
it('rejects encrypted PDFs promptly with unlocked-copy instructions and destroys parser',async()=>{
 state.mode='locked';await expect(openStatementPdf(new File(['fake'],'locked.pdf'))).rejects.toThrow(/unlocked copy/);expect(state.destroy).toHaveBeenCalledTimes(1);
});
it('destroys over-page-limit and damaged PDFs instead of offering partial reading',async()=>{
 state.mode='oversized';await expect(openStatementPdf(new File(['fake'],'large.pdf'))).rejects.toThrow(/1–50/);
 state.mode='corrupt';await expect(openStatementPdf(new File(['fake'],'bad.pdf'))).rejects.toThrow(/Invalid PDF/);
 expect(state.destroy).toHaveBeenCalledTimes(2);
});
it('uses the bundled worker and exposes all valid pages',async()=>{
 const pdf=await openStatementPdf(new File(['fake'],'valid.pdf'));expect(pdf.pageCount).toBe(2);await pdf.close();expect(state.destroy).toHaveBeenCalledTimes(1);
});
