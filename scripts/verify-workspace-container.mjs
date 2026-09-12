import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import ts from 'typescript';

// Exercise the actual Worker export/import programs inside the deployable image.
// No Cloudflare credentials, model calls, or network access enter the test container.
const source = ts.createSourceFile('files.ts', readFileSync('workers/workspace/files.ts', 'utf8'), ts.ScriptTarget.Latest, true);
function program(name) {
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (declaration.name.getText(source) === name && declaration.initializer && ts.isNoSubstitutionTemplateLiteral(declaration.initializer)) {
        return declaration.initializer.text;
      }
    }
  }
  throw new Error(`Missing literal Python program: ${name}`);
}
function run(args, timeout) {
  const result = spawnSync('docker', args, { stdio: 'inherit', timeout });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Container verification failed (${result.status ?? result.signal}).`);
}
const directory = mkdtempSync(join(tmpdir(), 'hearth-container-proof-'));
const tag = 'hearth-workspace-verification:local';
try {
  writeFileSync(join(directory, 'export.py'), program('EXPORT_SCRIPT'));
  writeFileSync(join(directory, 'import.py'), program('IMPORT_SCRIPT'));
  writeFileSync(join(directory, 'verify.py'), `import json, shutil, subprocess, sys
from pathlib import Path
from openpyxl import load_workbook

for fmt in ['docx', 'xlsx', 'pptx', 'pdf']:
    content = 'Topic,Notes\\nStudy,Hercules export proof\\nFormula,=1+1' if fmt == 'xlsx' else '# Study plan\\nHercules export proof\\nA fictional learning exercise.'
    Path('/tmp/input.json').write_text(json.dumps({'title': 'Synthetic study plan', 'content': content, 'exportFormat': fmt}))
    subprocess.run([sys.executable, '-I', '/verify/export.py'], check=True, capture_output=True)
    result = Path('/tmp/result.' + fmt)
    assert result.stat().st_size > 100, fmt + ' empty export'
    if fmt == 'xlsx':
        workbook = load_workbook(result, data_only=False)
        assert workbook.active['B3'].value == '=1+1'
        assert workbook.active['B3'].data_type == 's', 'Formula-like content must remain text'
        workbook.close()
    shutil.copyfile(result, '/tmp/source.' + fmt)
    imported = subprocess.run([sys.executable, '-I', '/verify/import.py', fmt], check=True, capture_output=True, text=True).stdout
    assert 'Hercules export proof' in imported, fmt + ' content did not reopen'
    print(fmt + ': created and reopened successfully', flush=True)
`);
  run(['build', '--platform', 'linux/amd64', '-t', tag, '-f', 'workers/workspace/Dockerfile', 'workers/workspace'], 20 * 60 * 1000);
  run(['run', '--rm', '--network=none', '--memory=512m', '--cpus=1', '--mount', `type=bind,source=${resolve(directory)},target=/verify,readonly`, '--entrypoint', 'python3', tag, '-I', '/verify/verify.py'], 60 * 1000);
} finally {
  rmSync(directory, { recursive: true, force: true });
}
