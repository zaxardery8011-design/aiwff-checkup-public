#!/usr/bin/env node
// 架構健檢 v1.2.3。零依賴。Windows、macOS、Linux 都能跑。
// Linux 與 macOS 不查行程擁有者。沒有 --tasklist-file 時，行程名稱是空的。
// 第 2 關在這兩個系統上不靠行程名稱判斷「作業系統自己的埠」，主要靠固定埠表。
// 固定埠表（含 22、445、3389，以及 135、139、5040、5357、7680、49664–49670、631、5000、7000）。
// loopback 與 tailnet 先記入；固定埠表只丟掉這兩類以外的列。
// tailnet_ports 可以出現表內號碼。all_interfaces_ports 與 os_owned_ports 不會出現表內號碼。
// 沒出現不代表沒在聽。
// 三個埠陣列最多各 30 筆。all_interfaces_non_os、tailnet_only、os_owned_count 是截斷前的個數。
// 第 2 關 evidence 的 os_owned 用 os_owned_count。
// Windows 才用 pid 對行程名稱；名稱屬於系統行程的埠記入 os_owned_ports。
// 用法：node aiwff_checkup.js [--root <目錄>] [--answers <checkup_answers.json>] [--out <輸出目錄>] [--report] [--no-machine] [--tasklist-file <csv>] [--netstat-file <文字>]
// 沒有 --root 時掃目前目錄。沒有 --out 時，LOG 寫進目前工作目錄。
// --netstat-file 用檔案代替 netstat。--tasklist-file 用 csv 代替 tasklist。
// 寫出前只做通用去識別：整段路徑或句中路徑只留檔名（路徑中間的空白、最後一段裡帶副檔名的空白、非 ASCII 相對路徑也含進去；最後一段無副檔名或空白後接 CJK 時，會在該空白停下）；IPv4、IPv6、file://、秘密前綴改成 <redacted>。
// 秘密前綴是 sk-、ghp_、xox、bot 加數字、AKIA、私鑰開頭。不套稱呼表，不改主機別名。
// 只讀不寫（唯一留下的檔是 LOG；寫入時先寫同名 .tmp 再改名）。埠號維持數字。
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');

const SCHEMA = 'aiwff_checkup_log/v1';
const LOG_NAME = 'aiwff_checkup_log.json';

const SECRET_RES = [
  /sk-[A-Za-z0-9_-]{12,}/g,
  /ghp_[A-Za-z0-9_]{12,}/g,
  /xox[a-zA-Z]-[A-Za-z0-9-]{10,}/g,
  /bot\d+:[A-Za-z0-9_-]{10,}/g,
  /AKIA[0-9A-Z]{12,}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/g
];
const IPV4_RE = /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g;
const TAILNET_RE = /(^|[^0-9])100\.\d{1,3}(?:\.\d{1,3}){1,2}/g;
const LAN_RE = /192\.168\.\d{1,3}(?:\.\d{1,3})?/g;
// 至少三個冒號，或含 ::。避開時鐘 17:00:23。
const IPV6_RE = /(?:[A-Fa-f0-9]{1,4}:){3,7}[A-Fa-f0-9]{1,4}|::(?:[A-Fa-f0-9]{1,4})?(?::[A-Fa-f0-9]{1,4}){0,6}|(?:[A-Fa-f0-9]{1,4}:){1,6}:[A-Fa-f0-9]{1,4}/g;
function baseNameOnly(s) {
  const parts = String(s).replace(/\\/g, '/').split('/').filter(function (p) { return p.length > 0; });
  return parts.length ? parts[parts.length - 1] : String(s);
}
function hasNonAscii(s) {
  return /[^\x00-\x7F]/.test(s);
}
function isCjk(ch) {
  const c = ch.codePointAt(0);
  return (c >= 0x3400 && c <= 0x9FFF) || (c >= 0xF900 && c <= 0xFAFF);
}
function isFsPath(s) {
  if (typeof s !== 'string' || !s) return false;
  if (/^aiwff_checkup_log\/v\d+$/.test(s)) return false;
  if (/^[A-Za-z]:[\\/]/.test(s)) return true;
  if (s.startsWith('\\\\') || s.startsWith('//')) return true;
  if (s.startsWith('~/') || s.startsWith('~\\')) return true;
  if (s.startsWith('/') && s.length > 1) return true;
  if (/^[A-Za-z0-9._@+-]+(?:[\\/][A-Za-z0-9._@+-]+)+$/.test(s)) return true;
  if (/[\s"']/.test(s) || s.indexOf('://') !== -1) return false;
  const backs = (s.match(/\\/g) || []).length;
  const slashes = (s.match(/\//g) || []).length;
  if (backs >= 1 && /^[^\\/]+(?:\\[^\\/]+)+$/.test(s)) return true;
  if (slashes >= 2 && /^[^\\/]+(?:\/[^\\/]+)+$/.test(s)) return true;
  if (slashes === 1 && hasNonAscii(s) && /^[^\\/]+\/[^\\/]+$/.test(s)) return true;
  return false;
}
function isPathStop(ch) {
  return ch === '\r' || ch === '\n' || ch === '"' || ch === "'" || ch === '<' || ch === '>' ||
    ch === '|' || ch === '?' || ch === '*' || ch === '(' || ch === '（' ||
    '。！？；，,）)'.indexOf(ch) !== -1;
}
function filenameTailEnd(s, k) {
  let i = k;
  const n = s.length;
  while (i < n) {
    while (i < n && (s[i] === ' ' || s[i] === '\t')) i++;
    if (i >= n || isPathStop(s[i]) || isCjk(s[i])) return -1;
    let j = i;
    let hasDot = false;
    while (j < n && s[j] !== ' ' && s[j] !== '\t' && !isPathStop(s[j])) {
      if (isCjk(s[j]) || s[j] === '\\' || s[j] === '/') return -1;
      if (s[j] === '.') hasDot = true;
      j++;
    }
    if (hasDot) return j;
    i = j;
  }
  return -1;
}
function pathEnd(s, start) {
  let i = start;
  const n = s.length;
  let sawSep = false;
  while (i < n) {
    const ch = s[i];
    if (isPathStop(ch)) break;
    if (ch === '\\' || ch === '/') sawSep = true;
    if (ch === ' ' || ch === '\t') {
      let k = i + 1;
      while (k < n && (s[k] === ' ' || s[k] === '\t')) k++;
      let sepAhead = false;
      let j = k;
      while (j < n && !isPathStop(s[j]) && s[j] !== ' ' && s[j] !== '\t') {
        if (s[j] === '\\' || s[j] === '/') { sepAhead = true; break; }
        j++;
      }
      if (sepAhead) { i++; continue; }
      if (sawSep) {
        const tail = filenameTailEnd(s, k);
        if (tail > i) return tail;
      }
      break;
    }
    i++;
  }
  return i;
}
function findPathStart(s, from) {
  for (let i = from; i < s.length; i++) {
    if (/[A-Za-z]/.test(s[i]) && s[i + 1] === ':' && (s[i + 2] === '\\' || s[i + 2] === '/')) return i;
    if (s[i] === '\\' && s[i + 1] === '\\') return i;
    if (s[i] === '~' && (s[i + 1] === '\\' || s[i + 1] === '/') && (i === 0 || /[\s"'（(]/.test(s[i - 1]))) return i;
    if (s[i] === '/' && (i === 0 || /[\s"'（(]/.test(s[i - 1]))) {
      const chunk = s.slice(i, pathEnd(s, i));
      if ((chunk.match(/\//g) || []).length >= 2) return i;
    }
    if (s[i] === '\\' || s[i] === '/') {
      if (s[i] === '\\' && s[i + 1] === '\\') continue;
      let st = i;
      while (st > from) {
        const prev = s[st - 1];
        if (prev === ' ' || prev === '\t' || prev === '"' || prev === "'" || isPathStop(prev)) break;
        st--;
      }
      if (s.slice(st, i).indexOf(':') !== -1 && s[i] === '/') continue;
      const end = pathEnd(s, st);
      const chunk = s.slice(st, end);
      if (chunk.indexOf('://') !== -1 || chunk.indexOf('=') !== -1) continue;
      const slashes = (chunk.match(/\//g) || []).length;
      const backs = (chunk.match(/\\/g) || []).length;
      if (backs >= 1 || slashes >= 2 || (slashes === 1 && hasNonAscii(chunk))) return st;
    }
  }
  return -1;
}
function maskFileUrls(s) {
  const re = /file:\/\//ig;
  let out = '';
  let last = 0;
  let m;
  while ((m = re.exec(s))) {
    out += s.slice(last, m.index);
    const end = pathEnd(s, m.index);
    out += '<redacted>';
    last = end > m.index ? end : m.index + m[0].length;
    re.lastIndex = last;
  }
  return out + s.slice(last);
}
function maskInlinePaths(s) {
  let out = '';
  let i = 0;
  while (i < s.length) {
    const start = findPathStart(s, i);
    if (start < 0) return out + s.slice(i);
    out += s.slice(i, start);
    const end = pathEnd(s, start);
    out += baseNameOnly(s.slice(start, end));
    i = end;
  }
  return out;
}
function scrubString(s) {
  if (typeof s !== 'string') return s;
  if (/^aiwff_checkup_log\/v\d+$/.test(s)) return s;
  if (isFsPath(s)) return baseNameOnly(s);
  let out = s;
  for (let i = 0; i < SECRET_RES.length; i++) out = out.replace(SECRET_RES[i], '<redacted>');
  out = maskFileUrls(out);
  out = out.replace(IPV4_RE, '<redacted>');
  out = out.replace(TAILNET_RE, function (m, pre) { return pre + '<redacted>'; });
  out = out.replace(LAN_RE, '<redacted>');
  out = out.replace(IPV6_RE, '<redacted>');
  out = maskInlinePaths(out);
  return out;
}
function deidentifyString(s) {
  return scrubString(s);
}
function deidentify(v) {
  if (typeof v === 'string') return deidentifyString(v);
  if (Array.isArray(v)) return v.map(deidentify);
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v)) o[k] = deidentify(v[k]);
    return o;
  }
  return v;
}
function gateFieldProblems(before, after) {
  const problems = [];
  const pb = (before && before.ports) || {};
  const pa = (after && after.ports) || {};
  const keys = ['all_interfaces_ports', 'tailnet_ports', 'os_owned_ports'];
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (pb[k] === undefined && pa[k] === undefined) continue;
    if (JSON.stringify(pb[k]) !== JSON.stringify(pa[k])) problems.push('ports.' + k);
  }
  const rb = (before && before.memory_rules && before.memory_rules.rules_files) || [];
  const ra = (after && after.memory_rules && after.memory_rules.rules_files) || [];
  if (rb.length !== ra.length) problems.push('memory_rules.rules_files.length');
  const n = Math.min(rb.length, ra.length);
  for (let i = 0; i < n; i++) {
    const expect = baseNameOnly(String(rb[i]));
    const got = ra[i];
    if (got !== expect || got === '<redacted>' || /[\\/]/.test(String(got))) {
      problems.push('memory_rules.rules_files[' + i + ']');
    }
  }
  return problems;
}

function runCheckup() {
  const t0 = Date.now();
  function arg(name, dflt) {
    const i = process.argv.indexOf('--' + name);
    return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
  }
  const ROOT = path.resolve(arg('root', process.cwd()));
  const OUT_DIR = path.resolve(arg('out', process.cwd()));
  const ANSWERS = path.resolve(arg('answers', path.join(ROOT, 'checkup_answers.json')));
  const HOME = os.homedir();
  const noMachine = process.argv.includes('--no-machine');

  function exists(p) { try { fs.statSync(p); return true; } catch (e) { return false; } }
  function isDir(p) { try { return fs.statSync(p).isDirectory(); } catch (e) { return false; } }
  // 打錯 --root 時不要掃一個不存在的目錄、印出八關 fail 當結果。
  const rootIdx = process.argv.indexOf('--root');
  const rootArg = rootIdx > 0 ? process.argv[rootIdx + 1] : undefined;
  if (rootIdx > 0 && (!rootArg || rootArg.startsWith('--') || !isDir(ROOT))) {
    console.error('ROOT_NOT_FOUND ' + (rootArg && !rootArg.startsWith('--') ? baseNameOnly(rootArg) : '(缺少目錄)'));
    console.error('--root 後面要接一個存在的資料夾，例如：node aiwff_checkup.js --root fixture_blank --report');
    process.exit(1);
  }
  function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '')); } catch (e) { return null; } }
  function countFiles(dir, re) {
    try { return fs.readdirSync(dir).filter(n => re.test(n)).length; } catch (e) { return 0; }
  }
  function which(cmd) {
    const r = cp.spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { encoding: 'utf8', timeout: 5000 });
    return r.status === 0 && String(r.stdout).trim() ? true : false;
  }
  function short(p) { return p.startsWith(HOME) ? '~' + p.slice(HOME.length).replace(/\\/g, '/') : p.replace(/\\/g, '/'); }

  const SCAN_SKIP = new Set(['file-history', 'cache', 'archive', 'backups', 'worktrees', '.hypothesis', 'node_modules', '.git']);
  function walk(root, maxDepth, cap) {
    const out = []; let truncated = false;
    (function rec(d, depth) {
      if (depth > maxDepth || out.length >= cap) { if (out.length >= cap) truncated = true; return; }
      let ents; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
      for (const e of ents) {
        if (out.length >= cap) { truncated = true; return; }
        if (SCAN_SKIP.has(e.name.toLowerCase())) continue;
        const p = path.join(d, e.name);
        out.push({ p, dir: e.isDirectory() });
        if (e.isDirectory()) rec(p, depth + 1);
      }
    })(root, 0);
    return { entries: out, truncated };
  }
  function findNamedDirs(root, maxDepth, names) {
    const out = [];
    (function rec(d, depth) {
      if (depth > maxDepth) return;
      let ents; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
      for (const e of ents) {
        if (!e.isDirectory() || e.name === 'node_modules' || e.name === '.git') continue;
        const p = path.join(d, e.name);
        if (names.has(e.name.toLowerCase())) out.push(p);
        if (depth < maxDepth) rec(p, depth + 1);
      }
    })(root, 0);
    return out;
  }
  function walkFiles(root, onFile) {
    (function rec(d) {
      let ents; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
      for (const e of ents) {
        if (e.name === 'node_modules' || e.name === '.git') continue;
        const p = path.join(d, e.name);
        if (e.isDirectory()) rec(p);
        else onFile(p);
      }
    })(root);
  }

  const machine = {
    os: process.platform, os_release: os.release(), arch: os.arch(),
    cpu_count: os.cpus().length, mem_gb: Math.round(os.totalmem() / 1073741824),
    node_version: process.version,
    host_id: crypto.createHash('sha256').update(os.hostname()).digest('hex').slice(0, 12),
    root_scanned: short(ROOT)
  };

  const configChoices = [
    ...(!noMachine ? [{ source: 'env', scope: 'machine', dir: process.env.CLAUDE_CONFIG_DIR }] : []),
    ...((exists(path.join(ROOT, 'settings.json')) || (isDir(path.join(ROOT, 'projects')) && exists(path.join(ROOT, 'CLAUDE.md'))))
      ? [{ source: 'root_self', scope: 'root', dir: ROOT }] : []),
    { source: 'root_dot_claude', scope: 'root', dir: path.join(ROOT, '.claude') },
    { source: 'root_dot_claude_home', scope: 'root', dir: path.join(ROOT, '.claude_home') },
    ...(!noMachine ? [{ source: 'home_dot_claude', scope: 'machine', dir: path.join(HOME, '.claude') }] : [])
  ];
  const configChoice = configChoices.find(c => c.dir && isDir(c.dir) && !(exists(path.join(c.dir, 'settings.local.json')) && !exists(path.join(c.dir, 'settings.json'))));
  const configDir = configChoice ? path.resolve(configChoice.dir) : null;
  const configDirSource = configChoice ? configChoice.source : 'none';
  const configScope = configChoice ? configChoice.scope : 'none';
  const desktopCfg = process.platform === 'win32'
    ? path.join(process.env.APPDATA || '', 'Claude', 'claude_desktop_config.json')
    : process.platform === 'darwin'
      ? path.join(HOME, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
      : path.join(HOME, '.config', 'Claude', 'claude_desktop_config.json');
  const brain = {
    claude_code_cli_on_path: !noMachine && which('claude'),
    claude_home_dir: !!configDir,
    config_dir_source: configDirSource,
    config_scope: configScope,
    config_dir_is_nested_project_dir: path.resolve(ROOT).toLowerCase() === path.resolve(HOME, '.claude').toLowerCase(),
    machine_config_enabled: !noMachine,
    claude_desktop_config: !noMachine && exists(desktopCfg),
    other_engines_on_path: noMachine ? [] : ['codex', 'gemini', 'ollama', 'aider', 'cursor'].filter(which),
  };
  brain.type = brain.claude_code_cli_on_path || brain['claude_home_dir']
    ? (brain.other_engines_on_path.length ? 'claude_code+multi_engine' : 'claude_code_only')
    : (brain.claude_desktop_config ? 'claude_desktop_only' : (brain.other_engines_on_path.length ? 'non_claude_cli' : 'none_detected'));

  const settingsFiles = configDir ? [
    path.join(configDir, 'settings.json'),
    path.join(configDir, 'settings.local.json')
  ].filter(exists) : [];
  const hookEvents = new Set(); let denyCount = 0, allowCount = 0;
  for (const f of settingsFiles) {
    const j = readJson(f); if (!j) continue;
    if (j.hooks && typeof j.hooks === 'object') Object.keys(j.hooks).forEach(k => hookEvents.add(k));
    if (j.permissions) {
      denyCount += Array.isArray(j.permissions.deny) ? j.permissions.deny.length : 0;
      allowCount += Array.isArray(j.permissions.allow) ? j.permissions.allow.length : 0;
    }
  }
  const scopedCounts = (root, machine) => ({
    root: { scope: 'root', count: root },
    machine: { scope: 'machine', count: machine },
    total: root + machine
  });
  const rootDenyCount = configScope === 'root' ? denyCount : 0;
  const machineDenyCount = configScope === 'machine' ? denyCount : 0;
  const rootAllowCount = configScope === 'root' ? allowCount : 0;
  const machineAllowCount = configScope === 'machine' ? allowCount : 0;
  const rootPreToolUseCount = configScope === 'root' && hookEvents.has('PreToolUse') ? 1 : 0;
  const machinePreToolUseCount = configScope === 'machine' && hookEvents.has('PreToolUse') ? 1 : 0;

  const RULE_NAMES = ['CLAUDE.md', 'AGENTS.md', 'GEMINI.md', 'SOUL.md', '.cursorrules'];
  const isRuleName = n => RULE_NAMES.includes(n) || /^SOUL.*\.md$/i.test(n);
  const isRuleBackup = n => /_\d{4}-\d{2}-\d{2}|_\d{8}_/.test(n);
  const ruleScan = walk(ROOT, 1, 5000);
  const ruleCandidates = ruleScan.entries
    .filter(e => !e.dir && isRuleName(path.basename(e.p)));
  const rules_backup_count = ruleCandidates.filter(e => isRuleBackup(path.basename(e.p))).length;
  const rules_files = ruleCandidates
    .filter(e => !isRuleBackup(path.basename(e.p)))
    .map(e => path.relative(ROOT, e.p).replace(/\\/g, '/')).sort().slice(0, 20);
  const rootRulesFiles = rules_files.slice();
  const machineRulesFiles = [];
  if (configDir && exists(path.join(configDir, 'CLAUDE.md'))) {
    (configScope === 'machine' ? machineRulesFiles : rootRulesFiles).push('config/CLAUDE.md');
  }
  const allRulesFiles = rootRulesFiles.concat(machineRulesFiles);
  const MEMORY_EXTENSIONS = ['.md', '.json'];
  const rootMemoryFiles = new Set();
  const machineMemoryFiles = new Set();
  function memoryFileId(p) {
    try { return fs.realpathSync(p).toLowerCase(); } catch (e) { return path.resolve(p).toLowerCase(); }
  }
  function addMemoryFiles(dir, target) {
    let ents;
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of ents) {
      if (e.isFile() && MEMORY_EXTENSIONS.includes(path.extname(e.name).toLowerCase())) {
        target.add(memoryFileId(path.join(dir, e.name)));
      }
    }
  }
  let rootMemDirsFromConfig = 0, machineMemDirs = 0;
  const projDir = configDir ? path.join(configDir, 'projects') : '';
  try {
    for (const p of fs.readdirSync(projDir)) {
      const m = path.join(projDir, p, 'memory');
      if (isDir(m)) {
        if (configScope === 'machine') { machineMemDirs++; addMemoryFiles(m, machineMemoryFiles); }
        else { rootMemDirsFromConfig++; addMemoryFiles(m, rootMemoryFiles); }
      }
    }
  } catch (e) { /* 沒有 projects 目錄 */ }
  const scan = walk(ROOT, 3, 5000);
  const rootMemDirs = scan.entries.filter(e => e.dir && /^(memory|memories|brain|knowledge)$/i.test(path.basename(e.p)));
  for (const d of rootMemDirs) addMemoryFiles(d.p, rootMemoryFiles);
  const memoryFiles = new Set([...rootMemoryFiles, ...machineMemoryFiles]);
  const memory_count_basis = {
    directory_classes: [
      { name: 'selected_config_project_memory', directory_name: 'memory', parent_directory_class: 'selected_config_projects' },
      { name: 'root_named_memory_dirs', names: ['memory', 'memories', 'brain', 'knowledge'], max_depth: 3 }
    ],
    file_extensions: MEMORY_EXTENSIONS,
    count_scope: 'direct_files',
    duplicate_files_removed: true
  };
  const memory_rules = {
    rules_files: allRulesFiles, rules_file_count: allRulesFiles.length,
    rules_file_counts: scopedCounts(rootRulesFiles.length, machineRulesFiles.length),
    rules_backup_count,
    rules_backup_counts: scopedCounts(rules_backup_count, 0),
    claude_auto_memory_dirs: rootMemDirsFromConfig + machineMemDirs,
    claude_auto_memory_dir_counts: scopedCounts(rootMemDirsFromConfig, machineMemDirs),
    project_memory_dirs: rootMemDirs.map(d => short(d.p)).slice(0, 10),
    memory_file_count: memoryFiles.size,
    memory_file_counts: scopedCounts(rootMemoryFiles.size, machineMemoryFiles.size),
    memory_count_basis
  };

  const agentsDir = configDir ? path.join(configDir, 'agents') : '';
  const subagent_defs = countFiles(agentsDir, /\.md$/i);
  const skillsDir = configDir ? path.join(configDir, 'skills') : '';
  const skills = countFiles(skillsDir, /./);
  const QUEUE_RE = /^(tasks|inbox|outbox|queue|coordination|jobs|dispatch)$/i;
  const queueDirs = scan.entries.filter(e => e.dir && QUEUE_RE.test(path.basename(e.p))).map(e => short(e.p));
  const rootSubagentDefs = configScope === 'root' ? subagent_defs : 0;
  const machineSubagentDefs = configScope === 'machine' ? subagent_defs : 0;
  const rootSkills = configScope === 'root' ? skills : 0;
  const machineSkills = configScope === 'machine' ? skills : 0;
  const dispatch = {
    subagent_definitions: subagent_defs, skills_installed: skills,
    subagent_definition_counts: scopedCounts(rootSubagentDefs, machineSubagentDefs),
    skill_counts: scopedCounts(rootSkills, machineSkills),
    file_queue_dirs: queueDirs.slice(0, 10), file_queue_dir_count: queueDirs.length,
    file_queue_dir_counts: scopedCounts(queueDirs.length, 0),
    other_engine_counts: scopedCounts(0, brain.other_engines_on_path.length),
    other_engines_on_path: brain.other_engines_on_path
  };

  const DAY = 86400000;
  const recentLogScan = walk(ROOT, 3, Infinity);
  const recentLogs = recentLogScan.entries.filter(e => !e.dir && /\.(log|jsonl)$/i.test(e.p))
    .filter(e => { try { return Date.now() - fs.statSync(e.p).mtimeMs < 2 * DAY; } catch (x) { return false; } });
  const resultFiles = scan.entries.filter(e => !e.dir && /(result|report|done|out)\.(md|json)$/i.test(path.basename(e.p))).length;
  const TEST_FILE_RE = /(^test[-_]|\.test\.|_test\.|\.spec\.)/i;
  const testPaths = new Set(scan.entries
    .filter(e => !e.dir && TEST_FILE_RE.test(path.basename(e.p)))
    .map(e => path.resolve(e.p)));
  const testDirs = findNamedDirs(ROOT, 3, new Set(['tests', 'test', '__tests__', 'spec']));
  for (const d of testDirs) walkFiles(d, p => {
    if (TEST_FILE_RE.test(path.basename(p))) testPaths.add(path.resolve(p));
  });
  const testFiles = testPaths.size;

  function readOr(file, cmd, args) {
    if (file) { try { return fs.readFileSync(path.resolve(file), 'utf8'); } catch (e) { return null; } }
    const r = cp.spawnSync(cmd, args, { encoding: 'utf8', timeout: 8000 });
    return r.status === 0 && r.stdout ? r.stdout : null;
  }
  function pidNames() {
    if (process.platform !== 'win32' && !arg('tasklist-file')) return new Map();
    const out = readOr(arg('tasklist-file'), 'tasklist', ['/fo', 'csv', '/nh']) || '';
    const m = new Map();
    for (const rowText of out.split(/\r?\n/)) {
      const c = rowText.match(/^"([^"]*)","(\d+)"/);
      if (c) m.set(Number(c[2]), c[1].toLowerCase());
    }
    return m;
  }
  function isTailnet(addr) {
    const a = addr.replace(/^\[|\]$/g, '').toLowerCase();
    const v4 = a.match(/^100\.(\d+)\.\d+\.\d+$/);
    if (v4) return Number(v4[1]) >= 64 && Number(v4[1]) <= 127;
    return /^fd7a:115c:a1e0:/.test(a);
  }
  const OS_OWNERS = new Set(['system', 'services.exe', 'wininit.exe', 'lsass.exe']);
  function listenCounts() {
    const nsFile = arg('netstat-file');
    const win = process.platform === 'win32' || !!nsFile;
    const out = readOr(nsFile, 'netstat', process.platform === 'win32' ? ['-ano'] : ['-an']);
    if (!out) return { available: false };
    const names = pidNames();
    const OS_PORTS = new Set([135, 139, 445, 3389, 5040, 5357, 7680, 49664, 49665, 49666, 49667, 49668, 49669, 49670, 22, 631, 5000, 7000]);
    const all = new Set(), local = new Set(), tailnet = new Set(), osOwned = new Set();
    for (const rowText of out.split(/\r?\n/)) {
      if (!/LISTEN/i.test(rowText) || !/tcp/i.test(rowText)) continue;
      const cols = rowText.trim().split(/\s+/);
      const tok = cols.find(t => /[:.]\d+$/.test(t));
      if (!tok) continue;
      const m = tok.match(/^(.*)[:.](\d+)$/);
      const port = Number(m[2]);
      const pid = win && /^\d+$/.test(cols[cols.length - 1]) ? Number(cols[cols.length - 1]) : null;
      const owner = pid === 4 ? 'system' : (pid !== null ? names.get(pid) : undefined);
      if (/^(127\.|\[::1\]|::1$)/.test(m[1])) local.add(port);
      else if (isTailnet(m[1])) tailnet.add(port);
      else if (OS_PORTS.has(port)) continue;
      else if (owner && OS_OWNERS.has(owner)) osOwned.add(port);
      else all.add(port);
    }
    const allSorted = [...all].sort((a, b) => a - b);
    const tailSorted = [...tailnet].sort((a, b) => a - b);
    const osSorted = [...osOwned].sort((a, b) => a - b);
    return {
      scope: 'machine',
      available: true, all_interfaces_non_os: allSorted.length, all_interfaces_ports: allSorted.slice(0, 30), loopback_only: local.size,
      tailnet_only: tailSorted.length, tailnet_ports: tailSorted.slice(0, 30),
      os_owned_count: osSorted.length, os_owned_ports: osSorted.slice(0, 30),
      owner_lookup: win ? (names.size ? 'pid' : 'pid_unavailable') : 'none'
    };
  }
  const ports = noMachine ? { scope: 'machine', available: false } : listenCounts();

  const answers = readJson(ANSWERS) || {};
  function A(n) { const v = answers[String(n)] || answers['gate' + n]; return v ? String(v).slice(0, 600) : 'not_answered'; }
  function G(n, name, auto, evidence) { return { gate: n, name, auto, evidence, self_answer: A(n) }; }
  const scanTruncated = scan.truncated || ruleScan.truncated;
  const aiBoundary = !allRulesFiles.length ? (scanTruncated ? 'unknown' : 'fail')
    : (denyCount || hookEvents.has('PreToolUse')) ? 'pass' : 'unknown';
  const machineExposure = !ports.available ? 'unknown' : ports.all_interfaces_non_os > 0 ? 'fail' : 'pass';
  const boundaryAuto = [aiBoundary, machineExposure].includes('fail') ? 'fail'
    : aiBoundary === 'pass' && machineExposure === 'pass' ? 'pass' : 'unknown';
  const gates = [
    G(1, '能跑工具', brain.type === 'none_detected' ? 'fail' : 'pass',
      `brain.type=${brain.type}`),
    G(2, '有邊界', boundaryAuto,
      `AI 邊界（規則／deny／hook）=${aiBoundary} 機器暴露面（埠）=${machineExposure} root_rules=${rootRulesFiles.length} machine_rules=${machineRulesFiles.length} root_deny=${rootDenyCount} machine_deny=${machineDenyCount} root_PreToolUse_event_present=${rootPreToolUseCount} root_PreToolUse_hook=${rootPreToolUseCount} machine_PreToolUse_event_present=${machinePreToolUseCount} machine_PreToolUse_hook=${machinePreToolUseCount} root_listen_all_if_non_os=0 machine_listen_all_if_non_os=${ports.available ? ports.all_interfaces_non_os : 'n/a'} root_tailnet=0 machine_tailnet=${ports.available ? ports.tailnet_only : 'n/a'} root_os_owned=0 machine_os_owned=${ports.available ? ports.os_owned_count : 'n/a'}`),
    G(3, '有記憶', memoryFiles.size > 0 ? 'pass' : 'fail',
      `root_memory_files=${rootMemoryFiles.size} machine_memory_files=${machineMemoryFiles.size} root_auto_memory_dirs=${rootMemDirsFromConfig} machine_auto_memory_dirs=${machineMemDirs}`),
    G(4, '有活路徑', recentLogs.length ? 'unknown' : 'fail',
      `近 48h 有更新的 log/jsonl=${recentLogs.length}（有 log 只代表有東西在跑，主路徑要看 self_answer）`),
    G(5, '會驗證不吃自報', testFiles ? 'unknown' : 'fail',
      `test_files=${testFiles}（自動偵測不判過，需人看讀回證據${scan.truncated ? '；總走訪已截斷，計數可能是下限' : ''}）`),
    G(6, '會派工給副腦', subagent_defs || queueDirs.length || brain.other_engines_on_path.length ? 'unknown' : 'fail',
      `root_subagents=${rootSubagentDefs} machine_subagents=${machineSubagentDefs} root_queue_dirs=${queueDirs.length} machine_queue_dirs=0 root_engines=0 machine_engines=${brain.other_engines_on_path.length} root_result_files=${resultFiles} machine_result_files=0`),
    G(7, '治理閘上線', hookEvents.has('PreToolUse') || denyCount ? 'pass' : 'fail',
      `root_PreToolUse_event_present=${rootPreToolUseCount} root_PreToolUse_hook=${rootPreToolUseCount} machine_PreToolUse_event_present=${machinePreToolUseCount} machine_PreToolUse_hook=${machinePreToolUseCount} root_deny=${rootDenyCount} machine_deny=${machineDenyCount} root_allow=${rootAllowCount} machine_allow=${machineAllowCount}`),
    G(8, '會員／對外平台', 'manual_only', '自動偵測不涵蓋，只看 self_answer')
  ];

  gates[1].subchecks = { ai_boundary: { auto: aiBoundary }, machine_exposure: { auto: machineExposure } };
  for (const g of gates) {
    if (scanTruncated && g.auto === 'fail' && !(g.gate === 2 && machineExposure === 'fail')) {
      g.auto = 'unknown';
      g.evidence += '；scan_truncated=true，走訪截斷，未找到不代表沒有';
    }
  }
  if (scanTruncated && !allRulesFiles.length) gates[1].evidence += '；scan_truncated=true，規則未找到不代表沒有';
  for (const g of [gates[1], gates[6]]) g.evidence += '；PreToolUse_event_present 是事件鍵有無（0/1），舊 PreToolUse_hook deprecated，非 hook 數量';

  const log = {
    schema: SCHEMA, checkup_version: '1.2.3', generated_at: new Date().toISOString(), elapsed_ms: 0,
    machine, brain_type: brain, memory_rules, dispatch, ports, gates,
    first_auto_gap: (gates.find(g => g.auto === 'fail') || {}).gate || null,
    scan_truncated: scanTruncated, scanned_entries: scan.entries.length,
    answers_file: exists(ANSWERS) ? short(ANSWERS) : null,
    note: '本 LOG 只描述現況，不判階段。階段與下一步看同目錄的對照表。'
  };
  log.elapsed_ms = Date.now() - t0;

  const clean = deidentify(log);
  const problems = gateFieldProblems(log, clean);
  if (problems.length) {
    console.error('STOP ' + problems.join(','));
    process.exit(2);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, LOG_NAME);
  const body = JSON.stringify(clean, null, 2) + '\n';
  fs.writeFileSync(outPath + '.tmp', body, 'utf8');
  fs.renameSync(outPath + '.tmp', outPath);
  if (process.argv.indexOf('--report') > 0) {
    const report = require('./report');
    report.writeReport(clean, OUT_DIR);
  }
  const sha = crypto.createHash('sha256').update(body).digest('hex');

  console.log('健檢完成');
  console.log('LOG ' + LOG_NAME);
  console.log('sha256 ' + sha);
  console.log('bytes ' + Buffer.byteLength(body));
  console.log(gates.map(g => g.gate + ':' + g.auto).join(' '));
}

if (require.main === module) {
  if (process.argv.indexOf('--wash') > 0) {
    console.error('NO_WASH');
    process.exit(1);
  }
  runCheckup();
}

module.exports = { deidentify, deidentifyString, gateFieldProblems, baseNameOnly, isFsPath };
