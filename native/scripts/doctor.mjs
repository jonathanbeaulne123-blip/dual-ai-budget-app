import { spawnSync } from 'node:child_process';
const checks = [
  ['Node 22+', process.execPath, ['--version'], result => Number(result.stdout.trim().replace('v', '').split('.')[0]) >= 22],
  ['Xcode 26+', 'xcodebuild', ['-version'], result => /Xcode (2[6-9]|[3-9]\d)/.test(result.stdout)],
  ['iPhone SDK', 'xcrun', ['--sdk', 'iphoneos', '--show-sdk-path']],
  ['JDK 21+', 'java', ['-version'], result => /version "(2[1-9]|[3-9]\d)/.test(result.stderr)],
  ['Android SDK', 'adb', ['version']],
];
let blocked = false;
for (const [label, command, args, validate] of checks) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  const passed = result.status === 0 && (!validate || validate(result));
  blocked ||= !passed;
  console.log(`${passed ? 'PASS' : 'MISSING'} ${label}: ${(result.stdout || result.stderr || result.error?.message || '').split('\n')[0]}`);
}
process.exitCode = blocked ? 1 : 0;
