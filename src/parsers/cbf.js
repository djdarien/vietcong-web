// Clean-room CBF parser.
// Spec: https://github.com/OpenVietcong/vc-spec/blob/master/doc/cbf.md
// Reference impl: vc-spec/scripts/cbf.py (CBFArchive, LZW, decrypt), libvc/lib/cbf.*
// Scope: header + table + descriptor/file decrypt + LZW decompress.
// Does NOT fetch or embed original game files. Operates on user-supplied bytes only.

export const CBF_SIG = 'BIGF';
export const CBF_VERSIONS = {
  ZBL0: 0x004c425a, // '\0ZBL' LE bytes: 00 5A 42 4C
  ZBL1: 0x014c425a, // '\1ZBL'
};
export const CBF_LUT = [0x32,0xF3,0x1E,0x06,0x45,0x70,0x32,0xAA,0x55,0x3F,0xF1,0xDE,0xA3,0x44,0x21,0xB4];
export const CBF_FILE_SALT = 0xA6;
export const LZW_SIG = '[..]';

function text(bytes) {
  return String.fromCharCode(...bytes);
}

export function parseCbfHeader(view, offset = 0) {
  // vc-spec cbf.md "Header", total 52 or bigger
  if (view.byteLength < offset + 52) throw new Error('CBF: too short for header');
  const dv = new DataView(view.buffer, view.byteOffset + offset, view.byteLength - offset);
  const sig = text(new Uint8Array(view.buffer, view.byteOffset + offset, 4));
  const verBytes = new Uint8Array(view.buffer, view.byteOffset + offset + 4, 4);
  const version = dv.getUint8(4) === 0 ? 'ZBL0' : dv.getUint8(4) === 1 ? 'ZBL1' : 'UNKNOWN';
  const archiveSize = dv.getUint32(8, true);
  const fileCount = dv.getUint32(16, true);
  const tableOffset = dv.getUint32(20, true);
  const tableSize = dv.getUint32(28, true);
  const headerSize = dv.getUint32(36, true);
  const mode = version === 'ZBL1' && headerSize === 0 ? 'classic' : 'extended';
  const result = { sig, verBytes, version, archiveSize, fileCount, tableOffset, tableSize, headerSize, mode, headerEnd: 52 };
  if (sig !== CBF_SIG) throw new Error(`CBF: bad signature ${JSON.stringify(sig)}`);
  if (version === 'UNKNOWN') throw new Error('CBF: unknown version');

  let end = 52;
  if (headerSize !== 0) {
    // extended: FILETIME at 44 (8B), reserved[3] at 52 if headerSize>=64
    end = Math.max(52, headerSize);
    if (headerSize >= 70) {
      if (view.byteLength < offset + 70) throw new Error('CBF: truncated extended header');
      const label = dv.getUint16(64, true);
      const commentSize = dv.getUint32(66, true);
      const commentBytes = new Uint8Array(view.buffer, view.byteOffset + offset + 70, commentSize);
      result.label = label;
      result.commentSize = commentSize;
      // windows-1250 ≈ latin1 for ASCII range; keep bytes + best-effort string
      result.commentBytes = commentBytes;
      result.comment = new TextDecoder('windows-1250').decode(commentBytes).replace(/\0.*$/, '');
      end = 70 + commentSize;
    }
    result.headerEnd = end;
  }
  return result;
}

// vc-spec cbf.md "Encryption of file descriptor (ZBL1 only)"
export function decryptDescriptor(encBytes) {
  const out = new Uint8Array(encBytes.length);
  let key = encBytes.length;
  for (let i = 0; i < encBytes.length; i++) {
    const e = encBytes[i];
    out[i] = e ^ CBF_LUT[key & 0xF];
    key = e;
  }
  return out;
}

export function encryptDescriptor(decBytes) {
  // inverse of above: e = d ^ LUT[key&F]; key=e. Since key depends on e, encryption == same loop.
  const out = new Uint8Array(decBytes.length);
  let key = decBytes.length;
  for (let i = 0; i < decBytes.length; i++) {
    const e = decBytes[i] ^ CBF_LUT[key & 0xF];
    out[i] = e;
    key = e;
  }
  return out;
}

// vc-spec cbf.md "Encrypted files (ZBL1 only)": dec = (enc + salt + key) ^ key
export function decryptFileData(encBytes) {
  const out = new Uint8Array(encBytes.length);
  const key = encBytes.length & 0xFF;
  for (let i = 0; i < encBytes.length; i++) {
    out[i] = ((encBytes[i] + CBF_FILE_SALT + key) & 0xFF) ^ key;
  }
  return out;
}

export function encryptFileData(decBytes) {
  const out = new Uint8Array(decBytes.length);
  const key = decBytes.length & 0xFF;
  for (let i = 0; i < decBytes.length; i++) {
    out[i] = ((decBytes[i] ^ key) - CBF_FILE_SALT - key) & 0xFF;
  }
  return out;
}

// Parse one 40-byte fixed part of a (decrypted) descriptor.
// vc-spec cbf.md "File descriptor"
export function parseDescriptorFixed(bytes, offset = 0) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset + offset);
  return {
    fileOffset: dv.getUint32(0, true),
    unknown1: dv.getUint32(8, true),
    dateTimeLow: dv.getUint32(12, true),
    dateTimeHigh: dv.getUint32(16, true),
    fileSize: dv.getUint32(20, true),
    compressedSize: dv.getUint32(28, true),
    encoding: dv.getUint32(32, true),
    unknown2: dv.getUint32(36, true),
  };
}

// Full table parse. Returns [{name, ...fixed, dataOffset, storedSize}]
export function parseCbfTable(u8, header) {
  const entries = [];
  let pos = header.tableOffset;
  const end = pos + header.tableSize;
  const dec = new TextDecoder('windows-1250');
  for (let i = 0; i < header.fileCount; i++) {
    if (header.version === 'ZBL1') {
      if (pos + 2 > end) throw new Error('CBF: truncated descriptor size');
      const dv = new DataView(u8.buffer, u8.byteOffset + pos, 2);
      const descSize = dv.getUint16(0, true);
      pos += 2;
      if (pos + descSize > u8.length) throw new Error('CBF: truncated descriptor');
      const enc = u8.slice(pos, pos + descSize);
      pos += descSize;
      const raw = decryptDescriptor(enc);
      const fixed = parseDescriptorFixed(raw, 0);
      const nameBytes = raw.slice(40);
      const name = dec.decode(nameBytes).replace(/\0.*$/, '');
      entries.push({ ...fixed, name, descriptorSize: descSize, storedSize: fixed.encoding === 1 ? fixed.compressedSize : fixed.fileSize });
    } else {
      // ZBL0: 40-byte fixed then NUL-terminated name inline in table
      if (pos + 40 > end) throw new Error('CBF: truncated ZBL0 descriptor');
      const fixed = parseDescriptorFixed(u8, pos);
      pos += 40;
      let nEnd = pos;
      while (nEnd < end && u8[nEnd] !== 0) nEnd++;
      if (nEnd >= end) throw new Error('CBF: unterminated ZBL0 name');
      const name = dec.decode(u8.slice(pos, nEnd));
      pos = nEnd + 1;
      entries.push({ ...fixed, name, descriptorSize: 40 + (nEnd - (pos - 1)) + 1, storedSize: fixed.encoding === 1 ? fixed.compressedSize : fixed.fileSize });
    }
  }
  return entries;
}

export function parseCbf(u8) {
  const bytes = u8 instanceof Uint8Array ? u8 : new Uint8Array(u8);
  const header = parseCbfHeader(bytes);
  const entries = parseCbfTable(bytes, header);
  return { header, entries };
}

// ---- LZW (vc-spec cbf.md "Compressed files") ----
// Port of vc-spec/scripts/cbf.py LZW class. Dictionary init 0..255 + end code 256, 9-bit start.
// Stream is LSB-first packed codes.
export function lzwDecompressBlock(compBytes) {
  const dict = [];
  const PTR_ROOT = 0xFFFFFFFF;
  for (let i = 0; i < 256; i++) dict.push({ ptr: PTR_ROOT, val: i });
  dict.push({ ptr: PTR_ROOT, val: 256 }); // end code row
  let dictWidth = 8;
  let codeEnd = 1 << dictWidth;
  let codeMax = (1 << dictWidth) - 1;
  let dataPos = 0; // bit position

  function getRowLen(key) {
    let len = 1;
    while (dict[key].ptr !== PTR_ROOT) { key = dict[key].ptr; len++; }
    return len;
  }
  function getVal(key, index) {
    const len = getRowLen(key);
    let pos = 0;
    while (pos < len - index) { var v = dict[key].val; key = dict[key].ptr; pos++; }
    return v;
  }
  function getKey() {
    const b0 = compBytes[(dataPos >> 3)] ?? 0;
    const b1 = compBytes[(dataPos >> 3) + 1] ?? 0;
    const b2 = compBytes[(dataPos >> 3) + 2] ?? 0;
    const b3 = compBytes[(dataPos >> 3) + 3] ?? 0;
    const word = (b0 | (b1 << 8) | (b2 << 16) | (b3 << 24)) >>> 0;
    const key = (word >>> (dataPos % 8)) & codeMax;
    dataPos += dictWidth;
    return key;
  }
  function appendRow(ptr, val) {
    dict.push({ ptr, val });
    if (dict.length >= codeMax) {
      dictWidth += 1;
      codeMax = (1 << dictWidth) - 1;
      if (dictWidth === 33) throw new Error('LZW: key width exceeded 32 bits');
    }
  }

  const out = [];
  let keyPrev = PTR_ROOT;
  let keyCurr = getKey();
  while (keyCurr !== codeEnd) {
    if (keyPrev !== PTR_ROOT) {
      let val;
      if (keyCurr < dict.length) val = getVal(keyCurr, 0);
      else if (keyCurr === dict.length) val = getVal(keyPrev, 0);
      else throw new Error('LZW: invalid key');
      appendRow(keyPrev, val);
    }
    const rowLen = getRowLen(keyCurr);
    for (let k = 0; k < rowLen; k++) out.push(getVal(keyCurr, k));
    keyPrev = keyCurr;
    keyCurr = getKey();
  }
  return new Uint8Array(out);
}

export function decompressCbfFile(storedBytes) {
  // stored = concat of blocks: sig[4] inputSize u32, outputSize u32, data[inputSize]
  const out = [];
  let pos = 0;
  const dv = (o) => new DataView(storedBytes.buffer, storedBytes.byteOffset + o);
  while (pos + 12 <= storedBytes.length) {
    const sig = String.fromCharCode(storedBytes[pos], storedBytes[pos+1], storedBytes[pos+2], storedBytes[pos+3]);
    if (sig !== LZW_SIG) throw new Error('LZW: invalid block signature');
    const inSize = dv(pos).getUint32(4, true);
    const outSize = dv(pos).getUint32(8, true);
    pos += 12;
    const block = storedBytes.slice(pos, pos + inSize);
    pos += inSize;
    const dec = lzwDecompressBlock(block);
    if (dec.length !== outSize) console.warn(`LZW: block size mismatch ${dec.length} vs ${outSize}`);
    out.push(...dec);
    if (pos >= storedBytes.length) break;
  }
  return new Uint8Array(out);
}
