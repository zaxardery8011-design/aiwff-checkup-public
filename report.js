#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const REPORT_NAME = 'aiwff_checkup_report.md';
const STATUS = { pass: '過', fail: '沒過', unknown: '看不出來', manual_only: '只能自己答' };

function countFromEvidence(gate, label) {
  const m = String(gate.evidence || '').match(new RegExp('(?:^|\\s)' + label + '=(\\d+)'));
  return m ? Number(m[1]) : null;
}

function machineCount(gate, names) {
  const wanted = names || [];
  if (!wanted.length) return false;
  const re = /(?:^|\s)(machine_[^=\s]+)=([0-9]+)/g;
  let match;
  while ((match = re.exec(String(gate.evidence || '')))) {
    if (wanted.includes(match[1]) && Number(match[2]) > 0) return true;
  }
  return false;
}

function machineNote(gate, names) {
  return machineCount(gate, names) ? '（來自這台電腦的共用設定）' : '';
}

function memoryBasisText(basis) {
  const names = basis && Array.isArray(basis.directory_classes) ? basis.directory_classes.map(c => c.name).filter(Boolean) : [];
  const labels = names.map(name => name === 'selected_config_project_memory'
    ? '設定專案的 memory'
    : name === 'root_named_memory_dirs'
      ? '根目錄的 memory／memories／brain／knowledge'
      : name);
  return labels.length ? labels.join('、') : '記憶類目錄';
}

function selfAnswerText(gate) {
  const s = gate.self_answer;
  if (s == null || s === 'not_answered') return '（沒填）';
  return String(s).replace(/\r?\n/g, ' ').replace(/\|/g, '｜').trim();
}

function plainReason(gate, memoryBasis, machineEnabled) {
  const n = Number(gate.gate);
  const state = gate.auto;
  if (n === 1) {
    if (state === 'pass') return '找到可用的主程式或相關工具。';
    return machineEnabled === false
      ? '這次加了 --no-machine，沒有查這台電腦裝了哪些 AI 程式；拿掉 --no-machine 再跑才看得出來。'
      : '沒有找到可用的主程式或相關工具。';
  }
  if (n === 2) {
    const note = machineNote(gate, ['machine_rules', 'machine_deny', 'machine_PreToolUse_hook']);
    return state === 'pass' ? `找到規則與基本限制。${note}` : state === 'fail' ? `缺少規則，或發現對外的非系統連線埠。${note}` : `有一些規則，但限制是否足夠看不出來。${note}`;
  }
  if (n === 3) {
    const root = countFromEvidence(gate, 'root_memory_files');
    const machine = countFromEvidence(gate, 'machine_memory_files');
    const total = (root == null ? 0 : root) + (machine == null ? 0 : machine);
    return state === 'pass'
      ? `找到 ${total || '一些'} 份記憶檔（.md／.json，含 ${memoryBasisText(memoryBasis)} 類目錄）。${machineNote(gate, ['machine_memory_files', 'machine_auto_memory_dirs'])}`
      : '沒有找到記憶檔。';
  }
  if (n >= 4 && n <= 6) {
    if (state === 'fail') return '找到近期空的對應產出；仍需人工確認失敗原因。';
    if (state === 'unknown') return '可讀的檔案中，沒有足夠的近期對應證據。';
    return ['找到近兩天與 runner 同名的非空產出。', '找到測試檔及近期結果、CI 設定或測試提交。', '找到第二引擎派工及近期對應回件。'][n - 4];
  }
  if (n === 7) return state === 'pass' ? `找到執行前攔截或拒絕規則。${machineNote(gate, ['machine_PreToolUse_hook', 'machine_deny'])}` : '沒有找到執行前攔截或拒絕規則。';
  return '這一關只能由你依實際對外情況回答。';
}

function nextStepFromPlan(gate) {
  let plan = '';
  try { plan = fs.readFileSync(path.join(__dirname, 'LOG_TO_PLAN.md'), 'utf8'); } catch (e) { return '請看同一包裡的下一步對照表。'; }
  const row = plan.split(/\r?\n/).find(line => new RegExp('^\\|\\s*' + gate + '\\s').test(line));
  if (!row) return '請看同一包裡的下一步對照表。';
  const cells = row.split('|').map(s => s.trim());
  return cells[cells.length - 2] || '請看同一包裡的下一步對照表。';
}

function buildReport(log) {
  const gates = Array.isArray(log.gates) ? log.gates.slice().sort((a, b) => a.gate - b.gate) : [];
  const memoryBasis = log.memory_rules && log.memory_rules.memory_count_basis;
  const machineEnabled = log.brain_type ? log.brain_type.machine_config_enabled : undefined;
  const firstNonPass = gates.find(g => g.auto !== 'pass');
  const firstFail = gates.find(g => g.auto === 'fail');
  const reached = firstNonPass ? Math.max(0, Number(firstNonPass.gate) - 1) : gates.length;
  const lines = [];
  lines.push('# 健檢白話報告', '', `你和你的腦目前走到第 ${reached} 關。`, '');
  lines.push('## 八關現在在哪裡', '', '| 關名 | 判定 | 白話理由 | 你的自答 |', '| --- | --- | --- | --- |');
  for (const g of gates) lines.push(`| ${g.gate} ${g.name || ''} | ${STATUS[g.auto] || '看不出來'} | ${plainReason(g, memoryBasis, machineEnabled)} | ${selfAnswerText(g)} |`);
  lines.push('', '## 第一個缺口', '');
  if (firstFail) {
    lines.push(`卡在第 ${firstFail.gate} 關「${firstFail.name}」：${plainReason(firstFail, memoryBasis, machineEnabled)}`);
    lines.push('', `最小的下一步：${nextStepFromPlan(firstFail.gate)}`);
  } else lines.push('沒有自動判定為沒過的關。unknown 與只能自己答不寫進這一節。');
  if (firstNonPass && (!firstFail || Number(firstNonPass.gate) !== Number(firstFail.gate))) {
    const label = STATUS[firstNonPass.auto] || firstNonPass.auto;
    lines.push('', `上面「走到第 ${reached} 關」停住，是因為第 ${firstNonPass.gate} 關是${label}，不是第一個沒過的關。`);
  }
  lines.push('', '## 這份報告看不到的', '');
  lines.push('- `root` 只算 `--root` 底下的檔案；`machine` 是這台電腦的共用設定（環境變數或家目錄）。要只看指定資料夾，請加 `--no-machine`。');
  const missingAnswers = gates.filter(g => g.self_answer === 'not_answered').length;
  if (log.scan_truncated) lines.push('- 總走訪已截斷；沒有直接列到的內容，計數可能只是下限。');
  if (missingAnswers) {
    lines.push(`- 有 ${missingAnswers} 關沒有自答；工具不能替你補上實際情況。`);
    lines.push('- 自答不會改變上表的「判定」；它會出現在「你的自答」欄，讓人和 AI 對照第 4～6 關的實際情況。做法：自評檔寫到輸出資料夾，不要寫進被掃的資料夾，檔名 checkup_answers.json。輸出資料夾要先存在。人留在健檢這包的資料夾，再跑 `node aiwff_checkup.js --root <要檢查的目錄> --out <輸出目錄> --answers <輸出目錄>/checkup_answers.json --report`。不讀共用設定時，同一條加上 `--no-machine`。要看自評和掃描差多少，人留在這包的資料夾，再跑 `node gap.js --root <輸出目錄>`。');
  }
  if (gates.some(g => g.auto === 'manual_only')) lines.push('- 會員／對外平台只能自己答，工具不會替你下結論。');
  if (!log.scan_truncated && !missingAnswers && !gates.some(g => g.auto === 'manual_only')) lines.push('- 這份報告只看本機可讀到的資料，不能替代人工核對。');
  lines.push('');
  return lines.join('\n');
}

function writeReport(log, outDir) {
  const out = path.join(outDir, REPORT_NAME);
  fs.writeFileSync(out, buildReport(log), 'utf8');
  return out;
}

module.exports = { buildReport, writeReport };
