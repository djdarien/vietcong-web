// Clean-room CTR parser.
// Spec: https://github.com/OpenVietcong/vc-spec/blob/master/doc/ctr.md
// Header 8B: 'SRTC' + unknown(0x0C). Then count u32 + count*24B controls + optional inventory.

export const CTR_SIG = 'SRTC';

export const CTR_DEVICES = { 0: 'Undefined', 1: 'Keyboard', 2: 'Mouse' };

export function parseCtr(u8) {
  const b = u8 instanceof Uint8Array ? u8 : new Uint8Array(u8);
  if (b.length < 12) throw new Error('CTR: too short');
  const sig = String.fromCharCode(b[0], b[1], b[2], b[3]);
  if (sig !== CTR_SIG) throw new Error(`CTR: bad signature ${JSON.stringify(sig)}`);
  const dv = new DataView(b.buffer, b.byteOffset);
  const unknown = dv.getUint32(4, true);
  const count = dv.getUint32(8, true);
  const controls = [];
  let pos = 12;
  for (let i = 0; i < count; i++) {
    if (pos + 24 > b.length) throw new Error('CTR: truncated control');
    const index = dv.getUint32(pos, true);
    const dev1 = dv.getUint32(pos + 4, true), key1 = dv.getUint32(pos + 8, true);
    const dev2 = dv.getUint32(pos + 12, true), key2 = dv.getUint32(pos + 16, true);
    const tail = dv.getUint32(pos + 20, true);
    const tailF = dv.getFloat32(pos + 20, true);
    // vc-spec ctr.md "Exceptions": 0x28/0x29 bool, 0x2A/0x2B float at offset 20
    let extra = null;
    if (index === 0x28 || index === 0x29) extra = { kind: 'bool', value: tail };
    else if (index === 0x2A || index === 0x2B) extra = { kind: 'float', value: tailF };
    controls.push({ index, primary: { device: dev1, key: key1 }, secondary: { device: dev2, key: key2 }, extra });
    pos += 24;
  }
  // Optional inventory block: label 'cfhx' (vc-spec ctr.md "Inventory")
  let inventory = null;
  if (pos + 16 <= b.length) {
    const label = String.fromCharCode(b[pos], b[pos+1], b[pos+2], b[pos+3]);
    if (label === 'cfhx') {
      const itemCount = dv.getUint32(pos + 12, true);
      if (itemCount > 10) throw new Error('CTR: bad inventory count');
      const order = [];
      for (let k = 0; k < itemCount; k++) order.push(dv.getUint32(pos + 16 + k * 4, true));
      inventory = { itemCount, order };
      pos += 16 + itemCount * 4;
    }
  }
  return { unknown, count, controls, inventory, bytesConsumed: pos };
}
