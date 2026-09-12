import { getSandbox } from '@cloudflare/sandbox';
import type { WorkspaceEnv } from './env.ts';
import type { ArtifactVersion } from '../../src/workspace/contracts.ts';
export const FILE_LIMIT = 4 * 1024 * 1024;
export const EXPORT_SCRIPT = `import json,csv,io,sys
from pathlib import Path
a=json.loads(Path('/tmp/input.json').read_text())
fmt=a['exportFormat']; content=a['content']; title=a['title']
out='/tmp/result.'+fmt
if fmt=='docx':
 from docx import Document
 d=Document();d.add_heading(title,0)
 for line in content.splitlines():
  if line.startswith('#'): d.add_heading(line.lstrip('# ').strip(),min(3,len(line)-len(line.lstrip('#'))))
  else: d.add_paragraph(line)
 d.save(out)
elif fmt=='xlsx':
 from openpyxl import Workbook
 w=Workbook();s=w.active;s.title='Hercules work'
 for row in csv.reader(io.StringIO(content)):
  # All user/model strings are text: never turn exported content into formulas.
  s.append(row)
  for cell in s[s.max_row]: cell.data_type='s'
 w.save(out)
elif fmt=='pptx':
 from pptx import Presentation
 r=Presentation();slide=None
 for line in content.splitlines():
  if line.startswith('#') or slide is None:
   slide=r.slides.add_slide(r.slide_layouts[1]);slide.shapes.title.text=line.lstrip('# ') or title
  else:
   slide.placeholders[1].text_frame.add_paragraph().text=line
 r.save(out)
elif fmt=='pdf':
 from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer
 from reportlab.lib.styles import getSampleStyleSheet
 from xml.sax.saxutils import escape
 styles=getSampleStyleSheet();story=[Paragraph(escape(title),styles['Title'])]
 for line in content.splitlines(): story.extend([Paragraph(escape(line),styles['BodyText']),Spacer(1,6)])
 SimpleDocTemplate(out).build(story)
else: raise ValueError('Unsupported export')
print(out)
`;
const IMPORT_SCRIPT = `import sys,json,csv,io
from pathlib import Path
ext=sys.argv[1];f='/tmp/source.'+ext
if ext=='pdf':
 from pypdf import PdfReader
 print('\\n'.join(p.extract_text() or '' for p in PdfReader(f).pages))
elif ext=='docx':
 from docx import Document
 d=Document(f); print('\\n'.join(p.text for p in d.paragraphs))
 for t in d.tables:
  for r in t.rows: print(' | '.join(c.text for c in r.cells))
elif ext=='xlsx':
 from openpyxl import load_workbook
 w=load_workbook(f,read_only=True,data_only=False)
 for s in w:
  print('Sheet: '+s.title)
  for r in s.iter_rows(values_only=True): print(json.dumps(r,default=str))
elif ext=='pptx':
 from pptx import Presentation
 for slide in Presentation(f).slides:
  for shape in slide.shapes:
   if shape.has_text_frame: print(shape.text)
else: raise ValueError('Unsupported file')
`;
export async function importWorkspaceFile(env: WorkspaceEnv, id: string, filename: string, base64: string): Promise<{ content: string; format: ArtifactVersion['format'] }> {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || base64.length > FILE_LIMIT * 4 / 3 + 4) throw new Error('FILE_TOO_LARGE');
  const ext = filename.split('.').at(-1)?.toLowerCase() ?? '';
  if (['txt', 'md', 'csv', 'json', 'html', 'py'].includes(ext)) {
    const content = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(base64), c => c.charCodeAt(0)));
    if (content.length > 500000) throw new Error('ARTIFACT_TOO_LARGE');
    return { content, format: ext === 'csv' ? 'csv' : ext === 'json' ? 'json' : ext === 'html' ? 'html' : ext === 'py' ? 'python' : 'markdown' };
  }
  if (!['pdf', 'docx', 'xlsx', 'pptx'].includes(ext)) throw new Error('UNSUPPORTED_FILE');
  const sandbox = getSandbox(env.HERCULES_SANDBOX, `import-${id}`);
  try {
    await sandbox.writeFile(`/tmp/source.${ext}`, base64, { encoding: 'base64' });
    await sandbox.writeFile('/tmp/import.py', IMPORT_SCRIPT);
    const result = await sandbox.exec(`timeout 25s python3 -I /tmp/import.py ${ext}`, { timeout: 30000 });
    if (result.exitCode !== 0) throw new Error('DOCUMENT_COULD_NOT_BE_READ');
    if (!result.stdout.trim()) throw new Error('DOCUMENT_HAS_NO_EXTRACTABLE_TEXT');
    if (result.stdout.length > 500000) throw new Error('ARTIFACT_TOO_LARGE');
    return { content: result.stdout, format: 'markdown' };
  } finally { await sandbox.destroy(); }
}
export async function exportWorkspaceFile(env: WorkspaceEnv, id: string, artifact: ArtifactVersion, format: string) {
  if (!['docx', 'xlsx', 'pptx', 'pdf'].includes(format)) throw new Error('UNSUPPORTED_EXPORT');
  if (format === 'xlsx' && artifact.format !== 'csv') throw new Error('CSV_ARTIFACT_REQUIRED');
  const sandbox = getSandbox(env.HERCULES_SANDBOX, `export-${id}`);
  try {
    await sandbox.writeFile('/tmp/input.json', JSON.stringify({ ...artifact, exportFormat: format }));
    await sandbox.writeFile('/tmp/export.py', EXPORT_SCRIPT);
    const result = await sandbox.exec('timeout 25s python3 -I /tmp/export.py', { timeout: 30000 });
    if (result.exitCode !== 0) throw new Error('EXPORT_FAILED');
    const file = await sandbox.readFile(`/tmp/result.${format}`, { encoding: 'base64' });
    if (file.content.length > FILE_LIMIT * 4 / 3) throw new Error('EXPORT_TOO_LARGE');
    return { base64: file.content, filename: `${artifact.title.replace(/[^a-zA-Z0-9 _-]/g, '') || 'Hercules work'}.${format}` };
  } finally { await sandbox.destroy(); }
}
