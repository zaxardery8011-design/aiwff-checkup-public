'use strict';
// 三組 fixture：全變好、部分變差、版本不同。執行：node compare.test.js
// 只呼叫 buildCompareMarkdown，不寫 compare.md。
const assert = require('assert');
const { buildCompareMarkdown } = require('../compare.js');

const NAMES = ['能跑工具', '有邊界', '有記憶', '有活路徑', '會驗證不吃自報', '會派工給副腦', '治理閘上線', '會員／對外平台'];

function doc(version, autos) {
  return {
    schema: 'aiwff_checkup_log/v1',
    checkup_version: version,
    first_auto_gap: 99,
    answers_file: 'C:\\secret\\host\\box\\checkup_answers.json',
    machine: { host_id: 'evilhost', root_scanned: 'C:\\secret\\host\\box' },
    note: 'evilhost',
    gates: NAMES.map(function (name, i) {
      return {
        gate: i + 1,
        name: name,
        auto: autos[i],
        evidence: 'EVIDENCE_SENTINEL test_files=45 C:\\secret\\host\\box evilhost',
        self_answer: 'not_answered'
      };
    })
  };
}

function assertClean(md) {
  assert.ok(!md.includes('EVIDENCE_SENTINEL'));
  assert.ok(!md.includes('test_files'));
  assert.ok(!md.includes('evilhost'));
  assert.ok(!md.includes('secret'));
  assert.ok(!md.includes('C:\\'));
  assert.ok(!md.includes('answers_file'));
  assert.ok(!md.includes('host_id'));
  assert.ok(!md.includes('self_answer'));
  assert.ok(!md.includes('not_answered'));
  assert.ok(!md.includes('99'));
}

function assertRow(md, gateLabel, prevAuto, nextAuto, change) {
  assert.ok(md.includes('| ' + gateLabel + ' | ' + prevAuto + ' | ' + nextAuto + ' | ' + change + ' |'));
}

function allBetter() {
  const autos = [];
  for (let i = 0; i < 8; i++) autos.push('fail');
  const nextAutos = [];
  for (let i = 0; i < 8; i++) nextAutos.push('pass');
  const md = buildCompareMarkdown(doc('1.3.0', autos), doc('1.3.0', nextAutos));
  assert.ok(!md.includes('版本不同'));
  assert.ok(md.includes('checkup_version：1.3.0 → 1.3.0。'));
  assert.ok(md.includes('上次第一個缺口關號：1。這次第一個缺口關號：無。'));
  assert.ok(md.includes('有 8 關變好、0 關變差。'));
  for (let i = 0; i < 8; i++) assertRow(md, (i + 1) + ' ' + NAMES[i], 'fail', 'pass', '變好');
  assertClean(md);
}

function someWorse() {
  const prev = ['fail', 'pass', 'pass', 'unknown', 'fail', 'unknown', 'manual_only', 'pass'];
  const next = ['pass', 'fail', 'pass', 'fail', 'unknown', 'manual_only', 'pass', 'manual_only'];
  const md = buildCompareMarkdown(doc('1.3.0', prev), doc('1.3.0', next));
  assert.ok(!md.includes('版本不同'));
  assert.ok(md.includes('上次第一個缺口關號：1。這次第一個缺口關號：2。'));
  assert.ok(md.includes('有 2 關變好、3 關變差。'));
  assertRow(md, '1 能跑工具', 'fail', 'pass', '變好');
  assertRow(md, '2 有邊界', 'pass', 'fail', '變差');
  assertRow(md, '3 有記憶', 'pass', 'pass', '不變');
  assertRow(md, '4 有活路徑', 'unknown', 'fail', '變差');
  assertRow(md, '5 會驗證不吃自報', 'fail', 'unknown', '不變（仍卡）');
  assertRow(md, '6 會派工給副腦', 'unknown', 'manual_only', '不變');
  assertRow(md, '7 治理閘上線', 'manual_only', 'pass', '變好');
  assertRow(md, '8 會員／對外平台', 'pass', 'manual_only', '變差');
  assertClean(md);
}

function versionDiff() {
  const prev = ['pass', 'pass', 'pass', 'unknown', 'unknown', 'unknown', 'pass', 'manual_only'];
  const next = ['pass', 'pass', 'pass', 'pass', 'unknown', 'unknown', 'pass', 'manual_only'];
  const md = buildCompareMarkdown(doc('1.1', prev), doc('1.3.0', next));
  assert.ok(md.includes('版本不同，判準可能不同。'));
  assert.ok(md.includes('checkup_version：1.1 → 1.3.0。'));
  assert.ok(!md.includes('1.1.0'));
  assert.ok(md.includes('上次第一個缺口關號：無。這次第一個缺口關號：無。'));
  assert.ok(md.includes('有 1 關變好、0 關變差。'));
  assertRow(md, '4 有活路徑', 'unknown', 'pass', '變好');
  assertRow(md, '5 會驗證不吃自報', 'unknown', 'unknown', '不變');
  assertRow(md, '8 會員／對外平台', 'manual_only', 'manual_only', '不變');
  assertClean(md);
}

allBetter();
someWorse();
versionDiff();

const unsafe = doc('evilhost', ['evilhost', 'fail', 'fail', 'fail', 'fail', 'fail', 'fail', 'fail']);
unsafe.gates[0].name = 'evilhost';
const clean = buildCompareMarkdown(unsafe, doc('1.3.1', ['pass', 'manual_only', 'unknown', 'pass', 'pass', 'pass', 'pass', 'pass']));
assertClean(clean);
assert.ok(clean.includes('非標準 auto 值已當作 unknown'));
assertRow(clean, '2 有邊界', 'fail', 'manual_only', '不變（仍卡）');

const fs = require('fs');
const path = require('path');
const { buildReport } = require('../report');
const promptRows = fs.readFileSync(path.join(__dirname, '../NEXT_STEPS_FOR_AI.md'), 'utf8').split(/\r?\n/).filter(line => /^\| [1-8] /.test(line));
for (let n = 1; n <= 8; n++) {
  const report = buildReport({ gates: [{gate:n, name:NAMES[n-1], auto:'fail', self_answer:'not_answered'}] });
  assert.ok(report.includes('最小的下一步：' + promptRows[n-1].split('|')[3].trim()));
}
console.log('COMPARE_TEST_OK');
