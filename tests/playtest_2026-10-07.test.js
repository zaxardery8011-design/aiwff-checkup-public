'use strict';
// 2026-10-07 新手試玩修正的回歸測試。執行：node --test（在 repo 根目錄）
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const { buildReport } = require('../report');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'aiwff_checkup.js');

function gates(selfAnswers) {
  const names = ['能跑工具', '有邊界', '有記憶', '有活路徑', '會驗證不吃自報', '會派工給副腦', '治理閘上線', '會員／對外平台'];
  return names.map((name, i) => ({
    gate: i + 1, name, auto: i === 7 ? 'manual_only' : 'fail', evidence: '',
    self_answer: (selfAnswers && selfAnswers[i]) || 'not_answered'
  }));
}

test('報告表格有「你的自答」欄，填了自答會顯示出來', () => {
  const md = buildReport({ gates: gates(['pass 主程式在', 'fail 還有埠|有']), brain_type: { machine_config_enabled: true } });
  assert.match(md, /\| 關名 \| 判定 \| 白話理由 \| 你的自答 \|/);
  assert.match(md, /\| 1 能跑工具 \| 沒過 \| .* \| pass 主程式在 \|/);
  assert.match(md, /fail 還有埠｜有 \|/, '自答裡的 | 要換掉才不會弄壞表格');
  assert.match(md, /\| 3 有記憶 \| 沒過 \| .* \| （沒填） \|/);
});

test('報告不再說填自答能讓第 4～6 關「判得出來」', () => {
  const md = buildReport({ gates: gates(), brain_type: { machine_config_enabled: true } });
  assert.doesNotMatch(md, /判得出來/);
  assert.match(md, /自答不會改變上表的「判定」/);
});

test('--no-machine 時第 1 關的白話理由說明是沒查，不是沒裝', () => {
  const off = buildReport({ gates: gates(), brain_type: { machine_config_enabled: false } });
  assert.match(off, /1 能跑工具 \| 沒過 \| 這次加了 --no-machine/);
  const on = buildReport({ gates: gates(), brain_type: { machine_config_enabled: true } });
  assert.match(on, /1 能跑工具 \| 沒過 \| 沒有找到可用的主程式或相關工具。/);
});

test('第一個缺口只指第一個 fail，走到第幾關仍停在第一個非 pass', () => {
  const names = ['能跑工具', '有邊界', '有記憶', '有活路徑', '會驗證不吃自報', '會派工給副腦', '治理閘上線', '會員／對外平台'];
  const autos = ['pass', 'unknown', 'pass', 'pass', 'fail', 'unknown', 'pass', 'manual_only'];
  const mixed = names.map((name, i) => ({ gate: i + 1, name, auto: autos[i], evidence: '', self_answer: 'not_answered' }));
  const md = buildReport({ gates: mixed, brain_type: { machine_config_enabled: true } });
  assert.match(md, /走到第 1 關/);
  assert.match(md, /卡在第 5 關/);
  assert.doesNotMatch(md, /卡在第 2 關/);
  const noFail = names.map((name, i) => ({ gate: i + 1, name, auto: i === 7 ? 'manual_only' : 'pass', evidence: '', self_answer: 'not_answered' }));
  const md2 = buildReport({ gates: noFail, brain_type: { machine_config_enabled: true } });
  assert.match(md2, /走到第 7 關/);
  assert.match(md2, /沒有自動判定為沒過的關/);
  assert.doesNotMatch(md2, /卡在第 8 關/);
});

test('--root 指到不存在的資料夾會停下，不寫 LOG', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'aiwff-'));
  const r = cp.spawnSync(process.execPath, [SCRIPT, '--root', path.join(out, 'nope'), '--out', out, '--no-machine'], { encoding: 'utf8' });
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /^ROOT_NOT_FOUND nope/);
  assert.ok(!fs.existsSync(path.join(out, 'aiwff_checkup_log.json')));
});

test('--root 後面忘了接資料夾（直接接 --report）會停下', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'aiwff-'));
  const r = cp.spawnSync(process.execPath, [SCRIPT, '--root', '--report', '--out', out, '--no-machine'], { encoding: 'utf8' });
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /ROOT_NOT_FOUND \(缺少目錄\)/);
  assert.ok(!fs.existsSync(path.join(out, 'aiwff_checkup_report.md')));
});

test('--root 指到 fixture_blank 照常跑完', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'aiwff-'));
  const r = cp.spawnSync(process.execPath, [SCRIPT, '--root', path.join(ROOT, 'fixture_blank'), '--out', out, '--no-machine', '--report'], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(fs.readFileSync(path.join(out, 'aiwff_checkup_report.md'), 'utf8'), /這次加了 --no-machine/);
});
