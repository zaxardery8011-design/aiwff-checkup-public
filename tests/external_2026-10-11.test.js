'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const { buildReport } = require('../report');
const script = path.resolve(__dirname, '../aiwff_checkup.js');
function fixture() { return fs.mkdtempSync(path.join(os.tmpdir(), 'checkup-external-')); }
function write(root, name, body) { const p = path.join(root, name); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, body); }
function run(root, extra = [], machine = false) {
  const out = fixture();
  const env = { ...process.env }; delete env.CLAUDE_CONFIG_DIR;
  const r = cp.spawnSync(process.execPath, [script, '--root', root, '--out', out, ...(machine ? [] : ['--no-machine']), ...extra], { env, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(fs.readFileSync(path.join(out, 'aiwff_checkup_log.json')));
}
function configured(root) {
  write(root, 'settings.json', JSON.stringify({ hooks: { PreToolUse: [{ hooks: [{ type: 'command', command: 'echo fixture' }] }] } }));
  write(root, 'CLAUDE.md', 'fixture rules');
  write(root, 'projects/demo/memory/MEMORY.md', 'fixture memory');
  write(root, '.claude/settings.local.json', '{}');
}
test('ROOT 本身為設定目錄：root_self、hooks 與記憶非零', () => {
  const root = fixture(); configured(root);
  const log = run(root);
  assert.equal(log.brain_type.config_dir_source, 'root_self');
  assert.ok(log.memory_rules.memory_file_count > 0);
  assert.equal(log.gates[2].auto, 'pass'); assert.equal(log.gates[6].auto, 'pass');
  assert.match(log.gates[6].evidence, /root_PreToolUse_event_present=1/);
  assert.match(log.gates[6].evidence, /deprecated/);
});
test('只有 local settings 的候選不可單選', () => {
  const root = fixture(); write(root, '.claude/settings.local.json', '{}');
  write(root, '.claude_home/settings.json', '{}');
  assert.equal(run(root).brain_type.config_dir_source, 'root_dot_claude_home');
});
test('走訪截斷：缺項 fail 變 unknown，獨立近期 log 仍看得到', () => {
  const root = fixture();
  for (let i = 0; i < 5001; i++) write(root, 'a-filler/' + i + '.txt', '');
  const absent = run(root);
  assert.equal(absent.gates[3].auto, 'unknown');
  assert.match(absent.gates[3].evidence, /未找到不代表沒有/);
  write(root, 'z-telemetry/recent.jsonl', '{}');
  const log = run(root);
  assert.equal(log.scan_truncated, true);
  for (const n of [1, 2, 3, 5, 6, 7]) {
    assert.equal(log.gates[n - 1].auto, 'unknown', 'gate ' + n);
    assert.match(log.gates[n - 1].evidence, /未找到不代表沒有/);
  }
  assert.equal(log.gates[3].auto, 'unknown');
  assert.match(log.gates[3].evidence, /log\/jsonl=1/);
  assert.match(buildReport(log), /走訪已截斷/);
});
test('截斷仍保留已找到的 pass，歷史目錄略過', () => {
  const root = fixture(); configured(root);
  for (let i = 0; i < 5001; i++) write(root, 'a-filler/' + i + '.txt', '');
  write(root, 'file-history/not-memory.txt', '');
  const log = run(root);
  assert.equal(log.scan_truncated, true);
  assert.equal(log.gates[0].auto, 'pass');
  assert.equal(log.gates[2].auto, 'pass'); assert.equal(log.gates[6].auto, 'pass');
  const skipped = fixture(); write(skipped, 'file-history/memory/fake.md', '');
  assert.equal(run(skipped).memory_rules.memory_file_count, 0);
});
test('第 2 關子判定分離：AI pass／機器 unknown、fail、pass', () => {
  const root = fixture(); configured(root);
  let log = run(root);
  assert.deepEqual(log.gates[1].subchecks, { ai_boundary: { auto: 'pass' }, machine_exposure: { auto: 'unknown' } });
  assert.equal(log.gates[1].auto, 'unknown');
  const ports = fixture(); write(ports, 'netstat.txt', 'TCP 0.0.0.0:45678 0.0.0.0:0 LISTENING 999999\n');
  write(ports, 'tasks.csv', '"fixture.exe","999999"\n');
  const extra = ['--netstat-file', path.join(ports, 'netstat.txt'), '--tasklist-file', path.join(ports, 'tasks.csv')];
  log = run(root, extra, true);
  assert.equal(log.gates[1].subchecks.ai_boundary.auto, 'pass');
  assert.equal(log.gates[1].subchecks.machine_exposure.auto, 'fail'); assert.equal(log.gates[1].auto, 'fail');
  assert.match(buildReport(log), /AI 邊界（規則／deny／hook）：過；機器暴露面（埠）：沒過/);
  write(ports, 'netstat.txt', 'TCP 127.0.0.1:45678 0.0.0.0:0 LISTENING 999999\n');
  assert.equal(run(root, extra, true).gates[1].auto, 'pass');
});

test('HOME/.claude 的旗標與報告提示（只隔離子行程）', () => {
  const caseHome = fixture(); const root = path.join(caseHome, '.claude'); configured(root);
  const out = fixture();
  const env = { ...process.env, USERPROFILE: caseHome, HOME: caseHome }; delete env.CLAUDE_CONFIG_DIR;
  const r = cp.spawnSync(process.execPath, [script, '--root', root, '--out', out, '--no-machine', '--report'], { env, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const log = JSON.parse(fs.readFileSync(path.join(out, 'aiwff_checkup_log.json')));
  assert.equal(log.brain_type.config_dir_is_nested_project_dir, true);
  assert.match(fs.readFileSync(path.join(out, 'aiwff_checkup_report.md'), 'utf8'), /ROOT 是家目錄的/);
});
