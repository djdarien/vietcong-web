// Clean-room SCO parser — PARTIAL (vc-spec sco.md documents ~1%).
// Spec: https://github.com/OpenVietcong/vc-spec/blob/master/doc/sco.md
// Known: at offset 0x64: count u32 + list of (len u32 + non-NUL-terminated name).
// Everything else is UNKNOWN and preserved opaquely. Do not guess.

export const SCO_KNOWN_OFFSET = 0x64;

export function parseSco(u8) {
  const b = u8 instanceof Uint8Array ? u8 : new Uint8Array(u8);
  if (b.length < SCO_KNOWN_OFFSET + 4) throw new Error('SCO: too short for known header');
  const dv = new DataView(b.buffer, b.byteOffset, b.length);
  const headUnknown = b.slice(0, SCO_KNOWN_OFFSET); // opaque, purpose unknown
  const count = dv.getUint32(SCO_KNOWN_OFFSET, true);
  let pos = SCO_KNOWN_OFFSET + 4;
  const besFiles = [];
  const dec = new TextDecoder('windows-1250');
  for (let i = 0; i < count; i++) {
    if (pos + 4 > b.length) throw new Error('SCO: truncated name length');
    const len = dv.getUint32(pos, true);
    pos += 4;
    if (pos + len > b.length) throw new Error('SCO: truncated name');
    besFiles.push(dec.decode(b.slice(pos, pos + len)));
    pos += len;
  }
  // Remainder: unknown TLV-ish per-mesh data (undocumented) — keep opaque.
  const restUnknown = b.slice(pos);
  return { headUnknown, count, besFiles, restUnknown, namesEnd: pos, unknown: true };
}
