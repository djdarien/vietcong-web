// Clean-room MANM parser — PARTIAL (vc-spec manm.md documents ~40%).
// Spec: https://github.com/OpenVietcong/vc-spec/blob/master/doc/manm.md
// Header 16: 'MANM' + unk(1) + objectCount + unk(0).
// Object: label(1) + blockSize + transCnt + rotCnt + unk3Cnt + unk + duration + unk + name?
// NOTE: spec lists Name CHAR[] with no length prefix; treat as NUL-terminated trailing
// string before sub-blocks is AMBIGUOUS — we parse conservatively and flag unknown.

export const MANM_SIG = 'MANM';

export function parseManmHeader(u8) {
  const b = u8 instanceof Uint8Array ? u8 : new Uint8Array(u8);
  if (b.length < 16) throw new Error('MANM: too short');
  const sig = String.fromCharCode(b[0], b[1], b[2], b[3]);
  if (sig !== MANM_SIG) throw new Error(`MANM: bad signature ${JSON.stringify(sig)}`);
  const dv = new DataView(b.buffer, b.byteOffset);
  return {
    sig,
    unk1: dv.getUint32(4, true),
    objectCount: dv.getUint32(8, true),
    unk2: dv.getUint32(12, true),
    body: b.slice(16),
  };
}

// Parse Translation/Rotation/Unknown3 sub-records when laid out back-to-back.
// Each Translation = label(1)+startTime u32 + 3xf32 (20B); Rotation = label(2)+time+4xf32 (24B);
// Unknown3 = label(3)+time+3xf32 (20B). Best-effort; unknown floats kept opaque.
export function parseManmTracks(body, transCnt, rotCnt, unk3Cnt) {
  const dv = new DataView(body.buffer, body.byteOffset, body.length);
  let pos = 0;
  const translations = [], rotations = [], unknown3 = [];
  for (let i = 0; i < transCnt; i++) {
    if (pos + 20 > body.length) throw new Error('MANM: truncated translation');
    const label = dv.getUint32(pos, true);
    if (label !== 1) throw new Error('MANM: bad translation label');
    translations.push({ startTime: dv.getUint32(pos+4, true), pos: [dv.getFloat32(pos+8,true), dv.getFloat32(pos+12,true), dv.getFloat32(pos+16,true)] });
    pos += 20;
  }
  for (let i = 0; i < rotCnt; i++) {
    if (pos + 24 > body.length) throw new Error('MANM: truncated rotation');
    const label = dv.getUint32(pos, true);
    if (label !== 2) throw new Error('MANM: bad rotation label');
    rotations.push({ startTime: dv.getUint32(pos+4, true), q: [dv.getFloat32(pos+8,true), dv.getFloat32(pos+12,true), dv.getFloat32(pos+16,true), dv.getFloat32(pos+20,true)], unknown: true });
    pos += 24;
  }
  for (let i = 0; i < unk3Cnt; i++) {
    if (pos + 20 > body.length) throw new Error('MANM: truncated unknown3');
    const label = dv.getUint32(pos, true);
    if (label !== 3) throw new Error('MANM: bad unknown3 label');
    unknown3.push({ startTime: dv.getUint32(pos+4, true), v: [dv.getFloat32(pos+8,true), dv.getFloat32(pos+12,true), dv.getFloat32(pos+16,true)], unknown: true });
    pos += 20;
  }
  return { translations, rotations, unknown3, consumed: pos };
}

export function parseManm(u8) {
  const h = parseManmHeader(u8);
  // Do not over-parse object names until spec clarifies length encoding; expose body + counts.
  return { ...h, partial: true, note: 'MANM ~40% documented; object names/tracks need spec clarification' };
}
