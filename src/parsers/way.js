// Clean-room WAY parser.
// Spec: https://github.com/OpenVietcong/vc-spec/blob/master/doc/way.md
// count u32 + count*(x f32, y f32). No Z (cars/ships collide with terrain).

export function parseWay(u8) {
  const b = u8 instanceof Uint8Array ? u8 : new Uint8Array(u8);
  if (b.length < 4) throw new Error('WAY: too short');
  const dv = new DataView(b.buffer, b.byteOffset, b.length);
  const count = dv.getUint32(0, true);
  if (4 + count * 8 !== b.length) throw new Error(`WAY: size mismatch count=${count} len=${b.length}`);
  const points = [];
  for (let i = 0; i < count; i++) {
    points.push({ x: dv.getFloat32(4 + i * 8, true), y: dv.getFloat32(8 + i * 8, true) });
  }
  return { count, points };
}

export function buildWay(points) {
  const buf = new ArrayBuffer(4 + points.length * 8);
  const dv = new DataView(buf);
  dv.setUint32(0, points.length, true);
  points.forEach((p, i) => { dv.setFloat32(4 + i * 8, p.x, true); dv.setFloat32(8 + i * 8, p.y, true); });
  return new Uint8Array(buf);
}
