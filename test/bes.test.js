import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseBesHeader, splitChunks, parseVertices, parseFaces,
  parseTransformation, parseInfo, parseBes, Block, BES_PREVIEW_SIZE,
} from '../src/parsers/bes.js';

function chunk(label, payload) {
  const buf = new ArrayBuffer(8 + payload.length);
  const dv = new DataView(buf);
  dv.setUint32(0, label, true);
  dv.setUint32(4, 8 + payload.length, true);
  new Uint8Array(buf).set(payload, 8);
  return new Uint8Array(buf);
}
function u32(v) { const b = new ArrayBuffer(4); new DataView(b).setUint32(0, v, true); return new Uint8Array(b); }
function f32(v) { const b = new ArrayBuffer(4); new DataView(b).setFloat32(0, v, true); return new Uint8Array(b); }
function cat(...arrs) { const n = arrs.reduce((a, c) => a + c.length, 0); const o = new Uint8Array(n); let p = 0; for (const a of arrs) { o.set(a, p); p += a.length; } return o; }

function verticesPayloadOne() {
  // count=1, vsize=32 (1 uv), flags XYZ|NORMAL|TEX1
  const flags = 0x002 | 0x010 | 0x100;
  const hdr = cat(u32(1), u32(32), u32(flags));
  const body = cat(f32(1), f32(2), f32(3), f32(0), f32(1), f32(0), f32(0.5), f32(0.25));
  return cat(hdr, body);
}

test('BES header parses version 0100 (bes.md Header)', () => {
  const b = new Uint8Array(16);
  b.set(new TextEncoder().encode('BES\0'), 0);
  b.set(new TextEncoder().encode('0100'), 4);
  const h = parseBesHeader(b);
  assert.equal(h.version, '0100');
  assert.equal(h.supported, true);
});

test('BES header rejects bad sig', () => {
  assert.throws(() => parseBesHeader(new Uint8Array(16)));
});

test('BES Vertices parses 1 vert + 1 uv (bes.md Vertices)', () => {
  const p = parseVertices(verticesPayloadOne());
  assert.equal(p.count, 1);
  assert.equal(p.texCount, 1);
  assert.deepEqual(p.verts[0].pos, [1, 2, 3]);
  assert.deepEqual(p.verts[0].uv, [[0.5, 0.25]]);
});

test('BES Faces parses (bes.md Faces)', () => {
  const payload = cat(u32(1), u32(0), u32(1), u32(2));
  const f = parseFaces(payload);
  assert.deepEqual(f.faces, [[0, 1, 2]]);
});

test('BES Transformation parses 100B (bes.md Transformation)', () => {
  const payload = new Uint8Array(100);
  const dv = new DataView(payload.buffer);
  dv.setFloat32(0, 1, true); // tx
  dv.setFloat32(24, 2, true); // sx
  const t = parseTransformation(payload);
  assert.deepEqual(t.translation, [1, 0, 0]);
  assert.deepEqual(t.scale, [2, 0, 0]);
  assert.equal(t.matrix.length, 16);
});

test('BES Info parses (bes.md Info)', () => {
  const author = new TextEncoder().encode('me\0');
  const comment = new TextEncoder().encode('hi\0');
  const head = cat(u32(author.length), u32(comment.length), u32(7));
  const name64 = new Uint8Array(64); name64.set(author);
  const payload = cat(head, name64, comment);
  const info = parseInfo(payload);
  assert.equal(info.author, 'me');
  assert.equal(info.comment, 'hi');
  assert.equal(info.faces, 7);
});

test('BES splitChunks round-trips sizes include header (bes.md Data)', () => {
  const c1 = chunk(Block.Unk36, u32(5));
  const c2 = chunk(Block.Unk38, new Uint8Array([9, 9]));
  const parts = splitChunks(cat(c1, c2));
  assert.equal(parts.length, 2);
  assert.equal(parts[0].label, Block.Unk36);
  assert.equal(parts[1].size, 10);
});

test('BES full file parses header+preview+chunks', () => {
  const hdr = new Uint8Array(16);
  hdr.set(new TextEncoder().encode('BES\0'), 0);
  hdr.set(new TextEncoder().encode('0100'), 4);
  const preview = new Uint8Array(BES_PREVIEW_SIZE);
  const v = chunk(Block.Vertices, verticesPayloadOne());
  const data = cat(v);
  const file = cat(hdr, preview, data);
  const parsed = parseBes(file);
  assert.equal(parsed.header.version, '0100');
  assert.equal(parsed.preview.length, BES_PREVIEW_SIZE);
  assert.equal(parsed.chunks.length, 1);
});
