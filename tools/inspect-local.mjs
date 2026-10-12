#!/usr/bin/env node
// inspect-local.mjs — inspect YOUR OWN legally-owned Vietcong files, locally only.
// Usage: node tools/inspect-local.mjs --format cbf|bes|ctr|way|sco|manm --file /path/to/file
// HARD RULE: never commit game files to this repo. Point at files OUTSIDE the repo.
// Prints a JSON summary (headers, counts) — never dumps full asset bytes.
import { readFileSync } from 'node:fs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith('--')) {
      const k = cur.slice(2);
      const v = arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : '1';
      acc.push([k, v]);
    }
    return acc;
  }, [])
);

if (!args.format || !args.file) {
  console.error('usage: node tools/inspect-local.mjs --format cbf|bes|ctr|way|sco|manm --file <path-outside-repo>');
  process.exit(2);
}
if (args.file.includes('vietcong-web/') || args.file.startsWith('./') || args.file.startsWith('assets/')) {
  console.error('refusing: keep game files outside the public repo. Use an absolute path elsewhere.');
  process.exit(3);
}

const bytes = new Uint8Array(readFileSync(args.file));
let out;
if (args.format === 'cbf') {
  const m = await import('../src/parsers/cbf.js');
  const parsed = m.parseCbf(bytes);
  out = { header: { ...parsed.header, verBytes: [...parsed.header.verBytes] }, files: parsed.entries.map((e) => ({ name: e.name, fileSize: e.fileSize, encoding: e.encoding })) };
} else if (args.format === 'bes') {
  const m = await import('../src/parsers/bes.js');
  const p = m.parseBes(bytes);
  out = { header: p.header, chunks: p.chunks.map((c) => ({ label: '0x' + c.label.toString(16), size: c.size })) };
} else if (args.format === 'ctr') {
  const m = await import('../src/parsers/ctr.js');
  out = m.parseCtr(bytes);
} else if (args.format === 'way') {
  const m = await import('../src/parsers/way.js');
  const r = m.parseWay(bytes);
  out = { count: r.count, first: r.points.slice(0, 5) };
} else if (args.format === 'sco') {
  const m = await import('../src/parsers/sco.js');
  const r = m.parseSco(bytes);
  out = { count: r.count, besFiles: r.besFiles, restBytes: r.restUnknown.length };
} else if (args.format === 'manm') {
  const m = await import('../src/parsers/manm.js');
  out = m.parseManm(bytes);
} else {
  console.error('unknown format');
  process.exit(2);
}
console.log(JSON.stringify(out, null, 2));
