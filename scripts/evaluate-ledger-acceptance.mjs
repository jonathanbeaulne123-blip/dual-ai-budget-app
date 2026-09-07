import { readFile, writeFile } from 'node:fs/promises';
import { evaluateLedgerTrial } from './lib/ledger-acceptance.mjs';
const path = process.argv[2];
if (!path) throw new Error('Usage: node scripts/evaluate-ledger-acceptance.mjs <local-trial.json>');
const input = JSON.parse(await readFile(path, 'utf8'));
const result = evaluateLedgerTrial(input.trial ?? input);
await writeFile(`${path}.evaluation.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (!result.pass) process.exitCode = 1;
