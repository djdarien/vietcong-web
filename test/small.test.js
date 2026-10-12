import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCtr } from '../src/parsers/ctr.js';
import { parseWay, buildWay } from '../src/parsers/way.js';
import { parseSco, SCO_KNOWN_OFFSET } from '../src/parsers/sco.js';
import { parseManmHeader, parseManmTracks } from '../src/parsers/manm.js';

function buildCtr({ withInventory = false } = {}) {
  const count = 2;
  const buf = [];
  const hdr = new ArrayBuffer(12);
  const hdv = new DataView(hdr);
  new Uint8Array(hdr).set(new TextEncoder().encode('SRTC'), 0);
  hdv.setUint32(4, 0x0c, true);
  hdv.setUint32(8, count, true);
  buf.push(new Uint8Array(hdr));
  // control 0x01 forward: keyboard W primary
  const c1 = new ArrayBuffer(24); const d1 = new DataView(c1);
  d1.setUint32(0, 0x01, true); d1.setUint32(4, 1, true); d1.setUint32(8, 0x11, true);
  buf.push(new Uint8Array(c1));
  // control 0x2A mouse sensitivity float 0.5
  const c2 = new ArrayBuffer(24); const d2 = new DataView(c2);
  d2.setUint32(0, 0x2a, true); d2.setFloat32(20, 0.5, true);
  buf.push(new Uint8Array(c2));
  if (withInventory) {
    const inv = new ArrayBuffer(16 + 4);
    const idv = new DataView(inv);
    new Uint8Array(inv).set(new TextEncoder().encode('cfhx'), 0);
    idv.setUint32(4, 0x10, true); idv.setUint32(8, 1, true); idv.setUint32(12, 1, true);
    idv.setUint32(16, 2, true);
    buf.push(new Uint8Array(inv));
  }
  const n = buf.reduce((a, c) => a + c.length, 0);
  const out = new Uint8Array(n); let p = 0;
  for (const b of buf) { out.set(b, p); p += b.length; }
  return out;
}

test('CTR parses controls + float exception (ctr.md Controls/Exceptions)', () => {
  const b = buildCtr();
  const r = parseCtr(b);
  assert.equal(r.count, 2);
  assert.equal(r.controls[0].index, 1);
  assert.equal(r.controls[0].primary.key, 0x11);
  assert.equal(r.controls[1].extra.kind, 'float');
  assert.ok(Math.abs(r.controls[1].extra.value - 0.5) < 1e-6);
});

test('CTR parses inventory order (ctr.md Inventory)', () => {
  const r = parseCtr(buildCtr({ withInventory: true }));
  assert.deepEqual(r.inventory.order, [2]);
});

test('WAY round-trips (way.md)', () => {
  const pts = [{ x: 1.5, y: -2 }, { x: 0, y: 0 }];
  const b = buildWay(pts);
  const r = parseWay(b);
  assert.equal(r.count, 2);
  assert.ok(Math.abs(r.points[0].x - 1.5) < 1e-6);
});

test('SCO parses known BES list, rest opaque (sco.md ~1%)', () => {
  const name = new TextEncoder().encode('tree.bes');
  const buf = new ArrayBuffer(SCO_KNOWN_OFFSET + 4 + 4 + name.length + 3);
  const dv = new DataView(buf);
  dv.setUint32(SCO_KNOWN_OFFSET, 1, true);
  dv.setUint32(SCO_KNOWN_OFFSET + 4, name.length, true);
  new Uint8Array(buf).set(name, SCO_KNOWN_OFFSET + 8);
  new Uint8Array(buf).set([7, 8, 9], SCO_KNOWN_OFFSET + 8 + name.length);
  const r = parseSco(new Uint8Array(buf));
  assert.deepEqual(r.besFiles, ['tree.bes']);
  assert.equal(r.unknown, true);
  assert.equal(r.restUnknown.length, 3);
});

test('MANM header + tracks parse known parts (manm.md ~40%)', () => {
  const hdr = new ArrayBuffer(16); const dv = new DataView(hdr);
  new Uint8Array(hdr).set(new TextEncoder().encode('MANM'), 0);
  dv.setUint32(4, 1, true); dv.setUint32(8, 1, true);
  const h = parseManmHeader(new Uint8Array(hdr));
  assert.equal(h.objectCount, 1);
  // one translation record
  const body = new ArrayBuffer(20); const bdv = new DataView(body);
  bdv.setUint32(0, 1, true); bdv.setUint32(4, 100, true);
  bdv.setFloat32(8, 1, true); bdv.setFloat32(12, 2, true); bdv.setFloat32(16, 3, true);
  const t = parseManmTracks(new Uint8Array(body), 1, 0, 0);
  assert.deepEqual(t.translations[0].pos, [1, 2, 3]);
});
