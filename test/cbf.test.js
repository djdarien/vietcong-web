import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCbfHeader, parseCbf, decryptDescriptor, encryptDescriptor,
  decryptFileData, encryptFileData, lzwDecompressBlock,
} from '../src/parsers/cbf.js';

function buildZbl0() {
  // 1 file "hello.txt", plain storage. Layout: header(64) + filedata + table
  const name = 'hello.txt\0';
  const fileData = new TextEncoder().encode('hello');
  const headerSize = 64;
  const fileOffset = headerSize;
  const tableOffset = fileOffset + fileData.length;
  // fixed 40B
  const fixed = new ArrayBuffer(40);
  const dv = new DataView(fixed);
  dv.setUint32(0, fileOffset, true);
  dv.setUint32(20, fileData.length, true); // fileSize
  dv.setUint32(28, 0, true); // compressedSize
  dv.setUint32(32, 0, true); // encoding plain
  const table = new Uint8Array(40 + name.length);
  table.set(new Uint8Array(fixed), 0);
  table.set(new TextEncoder().encode(name), 40);
  const archiveSize = tableOffset + table.length;
  const hdr = new ArrayBuffer(headerSize);
  const hdv = new DataView(hdr);
  new Uint8Array(hdr).set(new TextEncoder().encode('BIGF'), 0);
  new Uint8Array(hdr).set([0, 0x5A, 0x42, 0x4C], 4); // \0ZBL
  hdv.setUint32(8, archiveSize, true);
  hdv.setUint32(16, 1, true);
  hdv.setUint32(20, tableOffset, true);
  hdv.setUint32(28, table.length, true);
  hdv.setUint32(36, 64, true);
  const out = new Uint8Array(archiveSize);
  out.set(new Uint8Array(hdr), 0);
  out.set(fileData, fileOffset);
  out.set(table, tableOffset);
  return { out, fileData };
}

test('CBF header ZBL0 parses (cbf.md Header)', () => {
  const { out } = buildZbl0();
  const h = parseCbfHeader(out);
  assert.equal(h.sig, 'BIGF');
  assert.equal(h.version, 'ZBL0');
  assert.equal(h.fileCount, 1);
  assert.equal(h.mode, 'extended');
});

test('CBF table ZBL0 lists file (cbf.md Table of Files)', () => {
  const { out, fileData } = buildZbl0();
  const { entries } = parseCbf(out);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].name, 'hello.txt');
  assert.equal(entries[0].fileSize, fileData.length);
  assert.equal(entries[0].encoding, 0);
});

test('CBF ZBL1 descriptor crypt round-trips (cbf.md Encryption of file descriptor)', () => {
  const raw = new Uint8Array([1, 2, 3, 4, 5, 250, 0, 17, 33, 44]);
  const enc = encryptDescriptor(raw);
  const dec = decryptDescriptor(enc);
  assert.deepEqual([...dec], [...raw]);
});

test('CBF ZBL1 file crypt round-trips (cbf.md Encrypted files)', () => {
  const raw = new TextEncoder().encode('secret-data-123');
  const enc = encryptFileData(raw);
  const dec = decryptFileData(enc);
  assert.deepEqual([...dec], [...raw]);
  // encrypted must differ
  assert.notDeepEqual([...enc], [...raw]);
});

test('CBF rejects bad signature', () => {
  assert.throws(() => parseCbfHeader(new Uint8Array(64)));
});
