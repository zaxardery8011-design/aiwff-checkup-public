'use strict';
// Evidence uses names/stat and git changed names only, never artifact contents.
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const DAY = 86400000;
const TEST = /(^test[-_]|\.test\.|_test\.|\.spec\.)/i;
function inspectEvidence(root, now = Date.now()) {
  const files = []; let incomplete = false;
  function walk(dir, depth) {
    if (depth > 6) { incomplete = true; return; }
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { incomplete = true; return; }
    for (const e of entries) {
      if (['node_modules', '.git', 'fixtures', 'fixture_blank', 'examples', '.claude_home', '.claude'].includes(e.name)) continue;
      if (files.length >= 30000) { incomplete = true; return; }
      const p = path.join(dir, e.name);
      if (e.isSymbolicLink()) { incomplete = true; continue; }
      if (e.isDirectory()) walk(p, depth + 1);
      else if (e.isFile()) {
        try { const s = fs.lstatSync(p); files.push({p, rel: path.relative(root, p).replace(/\\/g, '/'), size: s.size, time: s.mtimeMs}); }
        catch (_) { incomplete = true; }
      }
    }
  }
  walk(root, 0);
  const recent = (f, days) => now - f.time >= 0 && now - f.time <= days * DAY;
  const stem = p => path.basename(p).replace(/\.[^.]+$/, '').replace(/(?:[._-](?:out|err|stdout|stderr))$/i, '').toLowerCase();
  const runners = new Set(files.filter(f => /\.(ps1|js|py|sh|cmd|bat)$/i.test(f.p) && !/(^|\/)(tests?|__tests__|spec)\//i.test(f.rel)).map(f => stem(f.p)));
  const live = files.filter(f => /\.(log|jsonl)$/i.test(f.p) && recent(f, 2) && runners.has(stem(f.p)));
  const tests = files.filter(f => TEST.test(path.basename(f.p)));
  const results = files.filter(f => recent(f, 14) && /(?:test[-_]?results?|junit|coverage|tap|test[-_]?report).*\.(xml|json|log|md|txt)$/i.test(path.basename(f.p)));
  const ci = files.filter(f => recent(f, 14) && /(?:^\.github\/workflows\/.*\.ya?ml$|(?:^|\/)(?:\.gitlab-ci\.yml|Jenkinsfile|azure-pipelines\.yml)$)/i.test(f.rel) && f.size > 0);
  let gitTests = 0;
  // Reject parent repositories: project-only scans must not borrow their history.
  const top = cp.spawnSync('git', ['-C', root, 'rev-parse', '--show-toplevel'], {encoding:'utf8', timeout:5000});
  if (top.status === 0 && path.resolve(top.stdout.trim()).toLowerCase() === path.resolve(root).toLowerCase()) {
    const r = cp.spawnSync('git', ['-C', root, 'log', '--since=14 days ago', '--format=', '--name-only', '--no-renames'], {encoding:'utf8',timeout:5000,maxBuffer:1024*1024});
    if (r.status === 0) gitTests = new Set(r.stdout.split(/\r?\n/).filter(n => TEST.test(path.basename(n)) && tests.some(f => f.rel === n))).size;
  }
  const requests = files.filter(f => /(?:^|\/)(?:to_(?:codex|grok|gemini|ollama|aider|cursor))\/.*\.(md|json)$/i.test(f.rel));
  // Require engine identity in the queue name and a matching request ID.
  const replies = files.filter(f => recent(f, 14) && /\.(md|json|jsonl)$/i.test(f.p) && requests.some(q => {
    const engine = q.rel.match(/to_(codex|grok|gemini|ollama|aider|cursor)\//i)[1];
    const id = stem(q.p);
    const bus = q.rel.slice(0, q.rel.indexOf('to_' + engine));
    return f.rel.startsWith(bus) && /(?:^|\/)(to_brain|replies|results|_done)\//i.test(f.rel) && (stem(f.p) === id + '_reply' || stem(f.p) === id + '_result');
  }));
  const positive = list => list.filter(f => f.size > 0).length;
  const empty = list => list.filter(f => f.size === 0).length;
  const state = (yes, no) => yes ? 'pass' : no ? 'fail' : 'unknown';
  return [
    {gate:4,name:'有活路徑',auto:state(positive(live),empty(live)),evidence:`runner_names=${runners.size} matched_recent_outputs=${positive(live)} empty_recent_outputs=${empty(live)} incomplete=${Number(incomplete)}`},
    {gate:5,name:'會驗證不吃自報',auto:state(tests.length && (positive(results)+ci.length+gitTests), tests.length && empty(results)),evidence:`test_files=${tests.length} recent_test_results=${positive(results)} recent_ci_files=${ci.length} recent_git_test_files=${gitTests} empty_test_results=${empty(results)} incomplete=${Number(incomplete)}`},
    {gate:6,name:'會派工給副腦',auto:state(positive(replies),empty(replies)),evidence:`second_engine_requests=${requests.length} matched_recent_replies=${positive(replies)} empty_recent_replies=${empty(replies)} incomplete=${Number(incomplete)}`}
  ];
}
module.exports = { inspectEvidence };
