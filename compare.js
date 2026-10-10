#!/usr/bin/env node
// 兩次健檢 log 的 auto 比較。零依賴、只讀兩份 log、在新 log 所在目錄寫 compare.md。
// 用法：node compare.js <舊 log> <新 log>
// 明確路徑先照工作目錄找，找不到再照這支腳本所在目錄找。
// 不讀 evidence。不把路徑、主機欄寫進 md。checkup_version 字串不同只加警告，不改寫 auto。
'use strict';
const fs = require('fs');
const path = require('path');

function resolveInput(arg) {
  const fromCwd = path.resolve(arg);
  if (fs.existsSync(fromCwd)) return fromCwd;
  const fromScript = path.resolve(__dirname, arg);
  if (fs.existsSync(fromScript)) return fromScript;
  return fromCwd;
}

function parseInputs(argv) {
  const oldArg = argv[2];
  const newArg = argv[3];
  if (!oldArg || !newArg) return null;
  if (String(oldArg).startsWith('--') || String(newArg).startsWith('--')) return null;
  return [resolveInput(oldArg), resolveInput(newArg)];
}

function cell(v) {
  return String(v == null ? '' : v).replace(/\r?\n/g, ' ').replace(/\|/g, '｜').trim();
}

function safeText(v) {
  const s = cell(v);
  if (!s || /[\\/]/.test(s)) return '';
  return s;
}

function versionOf(doc) {
  if (!doc || doc.checkup_version == null) return '（缺）';
  const s = String(doc.checkup_version);
  if (!/^\d+(?:\.\d+){1,2}$/.test(s)) return '（缺）';
  return s || '（缺）';
}

function autoKey(v) {
  return ['pass', 'fail', 'unknown', 'manual_only'].includes(v) ? v : 'unknown';
}

// pass 是過，fail 是沒過。unknown 與 manual_only 不是過，兩者同階。
// 來源沒有把這四個字做成分數；這裡只用來產出「變好／變差／不變」。
function rankAuto(auto) {
  if (auto === 'pass') return 2;
  if (auto === 'unknown' || auto === 'manual_only') return 1;
  if (auto === 'fail') return 0;
  return null;
}

function changeOf(prev, next) {
  if (prev === 'fail' && (next === 'unknown' || next === 'manual_only')) return '不變（仍卡）';
  if (prev === next) return '不變';
  const left = rankAuto(prev);
  const right = rankAuto(next);
  if (left == null || right == null) return '不變';
  if (right > left) return '變好';
  if (right < left) return '變差';
  return '不變';
}

function indexGates(gates) {
  const by = new Map();
  if (!Array.isArray(gates)) return by;
  for (let i = 0; i < gates.length; i++) {
    const g = gates[i];
    const n = Number(g && g.gate);
    if (Number.isInteger(n) && n >= 1 && n <= 8 && !by.has(n)) by.set(n, g);
  }
  return by;
}

function firstGap(doc) {
  const by = indexGates(doc && doc.gates);
  for (let n = 1; n <= 8; n++) {
    const g = by.get(n);
    if (g && autoKey(g.auto) === 'fail') return n;
  }
  return null;
}

function gapText(n) {
  return n == null ? '無' : String(n);
}

const NAMES = ['能跑工具', '有邊界', '有記憶', '有活路徑', '會驗證不吃自報', '會派工給副腦', '治理閘上線', '會員／對外平台'];
function gateLabel(n) { return n + ' ' + NAMES[n - 1]; }

function showAuto(v) {
  const key = autoKey(v);
  if (key == null) return '（缺）';
  return cell(key);
}

function buildCompareMarkdown(prevDoc, nextDoc) {
  const prevBy = indexGates(prevDoc && prevDoc.gates);
  const nextBy = indexGates(nextDoc && nextDoc.gates);
  const prevVersion = versionOf(prevDoc);
  const nextVersion = versionOf(nextDoc);
  const rows = [];
  rows.push('# 兩次健檢比較');
  rows.push('');
  rows.push('checkup_version：' + prevVersion + ' → ' + nextVersion + '。');
  rows.push('');
  if ((prevDoc && prevDoc.checkup_version) !== (nextDoc && nextDoc.checkup_version)) {
    rows.push('版本不同，判準可能不同。');
    rows.push('');
  }
  rows.push('上次第一個缺口關號：' + gapText(firstGap(prevDoc)) + '。這次第一個缺口關號：' + gapText(firstGap(nextDoc)) + '。');
  rows.push('');
  rows.push('| 關名 | 上次 auto | 這次 auto | 變化 |');
  rows.push('| --- | --- | --- | --- |');
  let better = 0;
  let worse = 0;
  for (let n = 1; n <= 8; n++) {
    const prev = prevBy.get(n);
    const next = nextBy.get(n);
    const prevAuto = prev ? autoKey(prev.auto) : null;
    const nextAuto = next ? autoKey(next.auto) : null;
    const change = changeOf(prevAuto, nextAuto);
    if (change === '變好') better += 1;
    else if (change === '變差') worse += 1;
    rows.push('| ' + gateLabel(n, prev, next) + ' | ' + showAuto(prev && prev.auto) + ' | ' + showAuto(next && next.auto) + ' | ' + change + ' |');
  }
  rows.push('');
  if ([prevDoc, nextDoc].some(doc => Array.from(indexGates(doc && doc.gates).values()).some(g => !['pass', 'fail', 'unknown', 'manual_only'].includes(g.auto)))) {
    rows.push('非標準 auto 值已當作 unknown；原值不輸出。', '');
  }
  rows.push('有 ' + better + ' 關變好、' + worse + ' 關變差。');
  rows.push('');
  return rows.join('\n');
}

function readLog(filePath) {
  const text = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const doc = JSON.parse(text);
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw new Error('shape');
  return doc;
}

if (require.main === module) {
  const inputs = parseInputs(process.argv);
  if (!inputs) {
    console.error('COMPARE_USAGE');
    process.exit(1);
  }
  let prevDoc;
  let nextDoc;
  try {
    prevDoc = readLog(inputs[0]);
    nextDoc = readLog(inputs[1]);
  } catch (e) {
    // 不印 e.message，裡面可能有路徑。
    console.error('COMPARE_READ');
    process.exit(1);
  }
  const out = path.join(path.dirname(inputs[1]), 'compare.md');
  const body = buildCompareMarkdown(prevDoc, nextDoc);
  try {
    fs.writeFileSync(out, body, 'utf8');
  } catch (e) {
    console.error('COMPARE_WRITE compare.md');
    process.exit(1);
  }
  console.log('COMPARE_OK compare.md');
}

module.exports = { buildCompareMarkdown, changeOf, firstGap, parseInputs, indexGates };