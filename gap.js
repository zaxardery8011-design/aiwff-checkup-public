#!/usr/bin/env node
// 自評 vs 掃描差距。零依賴、只讀 log、在 log 所在目錄寫 gap.md。不判關號，不計分。
// 用法：
//   node gap.js <aiwff_checkup_log.json>
//   node gap.js --root <log 所在目錄>
// 明確路徑先照工作目錄找，找不到再照這支腳本所在目錄找。
// --root 只讀該目錄裡的 aiwff_checkup_log.json。掃描有 --out 時，這個目錄是 --out，否則是掃描的 --root。
'use strict';
const fs = require('fs');
const path = require('path');

const LOG_NAME = 'aiwff_checkup_log.json';

function resolveInput(arg) {
  const fromCwd = path.resolve(arg);
  if (fs.existsSync(fromCwd)) return fromCwd;
  const fromScript = path.resolve(__dirname, arg);
  if (fs.existsSync(fromScript)) return fromScript;
  return fromCwd;
}

function parseInput(argv) {
  const rootIdx = argv.indexOf('--root');
  if (rootIdx > 0) {
    const dir = argv[rootIdx + 1];
    if (!dir || String(dir).startsWith('--')) return '';
    return path.join(path.resolve(dir), LOG_NAME);
  }
  const arg = argv[2];
  if (!arg || String(arg).startsWith('--')) return '';
  return resolveInput(arg);
}

function cell(v) {
  return String(v == null ? '' : v).replace(/\r?\n/g, ' ').replace(/\|/g, '｜').trim();
}

function selfStance(text) {
  if (text == null) return 'missing';
  const s = String(text).replace(/^\uFEFF/, '').trim();
  if (s === '' || s === 'not_answered') return 'missing';
  if (s === '<redacted>') return 'redacted';
  const m = s.match(/^(沒過|未過|不確定|不知道|unknown|pass|fail|過)(?=$|[\s。．.！!，,、：:])/i);
  if (!m) return 'prose';
  const w = m[1].toLowerCase();
  if (w === '不確定' || w === '不知道' || w === 'unknown') return 'unsure';
  if (w === '沒過' || w === '未過' || w === 'fail') return 'no';
  if (w === '過' || w === 'pass') return 'yes';
  return 'prose';
}

function noAnswerFile(doc) {
  if (!doc || doc.answers_file == null) return true;
  return String(doc.answers_file).trim() === '';
}

function relationOf(stance, auto, missingFile) {
  if (missingFile) return '無法比';
  if (stance !== 'yes' && stance !== 'no') return '無法比';
  if (auto !== 'pass' && auto !== 'fail') return '無法比';
  const selfYes = stance === 'yes';
  const autoYes = auto === 'pass';
  if (selfYes === autoYes) return '一致';
  if (selfYes && !autoYes) return '高估';
  return '低估';
}

function indexGates(gates) {
  const by = new Map();
  if (!Array.isArray(gates)) return by;
  for (let i = 0; i < gates.length; i++) {
    const g = gates[i];
    const n = Number(g && g.gate);
    if (n >= 1 && n <= 8 && !by.has(n)) by.set(n, g);
  }
  return by;
}

function buildGapMarkdown(doc, sourceName) {
  const missingFile = noAnswerFile(doc);
  const rows = [];
  rows.push('# 自評與掃描');
  rows.push('');
  rows.push('來源：' + sourceName + '。不判關號，不計分。');
  rows.push('');
  if (missingFile) {
    rows.push('沒有自答檔：answers_file 是 null 或沒有這個欄位。掃描結果仍列在「掃描 auto」。八關都無法比。');
  } else {
    rows.push('answers_file：' + cell(doc.answers_file) + '。自評開頭是「過」且 auto 是 fail，列高估。自評開頭是「沒過」且 auto 是 pass，列低估。兩邊同是過或同是沒過，列一致。其餘列無法比。');
  }
  rows.push('');
  rows.push('| 關 | 自評 | 掃描 auto | 一致／高估／低估／無法比 |');
  rows.push('| --- | --- | --- | --- |');
  const by = indexGates(doc && doc.gates);
  for (let n = 1; n <= 8; n++) {
    const g = by.get(n);
    const name = g && g.name ? cell(g.name) : '';
    const selfRaw = g && g.self_answer != null ? g.self_answer : 'not_answered';
    const autoRaw = g && g.auto != null ? g.auto : '（缺）';
    const rel = relationOf(selfStance(selfRaw), g && g.auto, missingFile);
    const gateCell = name ? (n + ' ' + name) : String(n);
    rows.push('| ' + gateCell + ' | ' + cell(selfRaw) + ' | ' + cell(autoRaw) + ' | ' + rel + ' |');
  }
  rows.push('');
  return rows.join('\n');
}

if (require.main === module) {
  const input = parseInput(process.argv);
  if (!input) {
    console.error('GAP_USAGE');
    process.exit(1);
  }
  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(input, 'utf8').replace(/^\uFEFF/, ''));
  } catch (e) {
    console.error('GAP_READ ' + path.basename(input));
    process.exit(1);
  }
  const out = path.join(path.dirname(input), 'gap.md');
  const body = buildGapMarkdown(doc, path.basename(input));
  fs.writeFileSync(out, body, 'utf8');
  console.log('GAP_OK ' + path.basename(out));
}

module.exports = { buildGapMarkdown, selfStance, relationOf, noAnswerFile, parseInput };
