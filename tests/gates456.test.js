'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { inspectEvidence } = require('../evidence');
function fixture(entries) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiwff-v13-'));
  for (const [name, body, age = 0] of entries) {
    const p = path.join(dir, name); fs.mkdirSync(path.dirname(p), {recursive:true});
    fs.writeFileSync(p, body);
    const time = new Date(Date.now() - age * 86400000); fs.utimesSync(p, time, time);
  }
  return inspectEvidence(dir);
}
for (const [gate, pass, unknown, fail] of [
  [4, [['cron/tick.ps1','runner'],['logs/tick.log','output']], [['logs/random.log','output']], [['cron/tick.ps1','runner'],['logs/tick.log','']]],
  [5, [['tests/a.test.js','test'],['test-results.json','result']], [['tests/a.test.js','test']], [['tests/a.test.js','test'],['test-results.json','']]],
  [6, [['codex_bus/to_codex/job.md','request'],['codex_bus/to_brain/job_reply.md','reply']], [['codex_bus/to_codex/job.md','request']], [['codex_bus/to_codex/job.md','request'],['codex_bus/to_brain/job_reply.md','']]]
]) {
  for (const [state, entries] of [['pass',pass],['unknown',unknown],['fail',fail]]) test(`gate ${gate} ${state} filesystem fixture`, () => {
    const g = fixture(entries).find(g => g.gate === gate);
    assert.equal(g.auto, state); assert.doesNotMatch(g.evidence, /[\\/]|job|tick/);
  });
}
test('stale, future, unmatched and fixture artifacts cannot pass', () => {
  const gates = fixture([
    ['cron/tick.ps1','runner'],['logs/tick.log','out',3],
    ['tests/a.test.js','test'],['test-results.json','out',15],
    ['codex_bus/to_codex/job.md','request'],['codex_bus/to_brain/other_reply.md','reply'],
    ['fixtures/codex_bus/to_codex/demo.md','request'],['fixtures/codex_bus/to_brain/demo_reply.md','reply']
  ]);
  assert.ok(gates.every(g => g.auto === 'unknown'));
});
test('blank directory stays unknown for all three gates', () => assert.ok(fixture([]).every(g => g.auto === 'unknown')));
test('recent CI with tests counts; CI alone cannot pass', () => {
  assert.equal(fixture([['tests/a.test.js','test'],['.github/workflows/test.yml','ci']])[1].auto,'pass');
  assert.equal(fixture([['.github/workflows/test.yml','ci']])[1].auto,'unknown');
});

test('future outputs do not pass', () => assert.equal(fixture([['cron/tick.ps1','runner'],['logs/tick.log','out',-1]])[0].auto,'unknown'));
test('CLI wires evidence and no-machine keeps root evidence', () => {
  const cp = require('child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiwff-v13-cli-'));
  fs.mkdirSync(path.join(dir,'cron')); fs.writeFileSync(path.join(dir,'cron/tick.ps1'),'runner');
  fs.writeFileSync(path.join(dir,'cron/tick.log'),'output');
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'aiwff-v13-out-'));
  const r = cp.spawnSync(process.execPath,[path.join(__dirname,'../aiwff_checkup.js'),'--root',dir,'--out',out,'--no-machine','--report'],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
  const log=JSON.parse(fs.readFileSync(path.join(out,'aiwff_checkup_log.json'),'utf8'));
  assert.equal(log.checkup_version,'1.3.0'); assert.equal(log.gates[3].auto,'pass');
  assert.equal(log.brain_type.machine_config_enabled,false);
  assert.match(fs.readFileSync(path.join(out,'aiwff_checkup_report.md'),'utf8'),/找到近兩天與 runner 同名的非空產出/);
});

test('CLI merge keeps evidence pass and conservatively downgrades empty outputs when old scan truncates', () => {
  const cp = require('child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiwff-v13-merge-'));
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'aiwff-v13-merge-out-'));
  const write = (name, body) => {
    const p = path.join(dir, name);
    fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, body);
    const time = new Date(Date.now() - 1000); fs.utimesSync(p, time, time);
  };
  for (let i = 0; i < 5001; i++) write('a-filler/' + i + '.txt', '');
  write('cron/tick.ps1', 'runner'); write('tests/a.test.js', 'test');
  write('codex_bus/to_codex/job.md', 'request');
  const outputs = ['logs/tick.log', 'test-results.json', 'codex_bus/to_brain/job_reply.md'];
  function run() {
    const r = cp.spawnSync(process.execPath, [path.join(__dirname, '../aiwff_checkup.js'), '--root', dir, '--out', out, '--no-machine'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const log = JSON.parse(fs.readFileSync(path.join(out, 'aiwff_checkup_log.json'), 'utf8'));
    assert.equal(log.scan_truncated, true);
    return log.gates.slice(3, 6);
  }
  for (const name of outputs) write(name, 'output');
  assert.ok(run().every(g => g.auto === 'pass' && /incomplete=0/.test(g.evidence)));
  for (const name of outputs) write(name, '');
  assert.ok(inspectEvidence(dir).every(g => g.auto === 'fail'));
  assert.ok(run().every(g => g.auto === 'unknown' && /未找到不代表沒有/.test(g.evidence)));
});
