// Clean-room BES parser.
// Spec: https://github.com/OpenVietcong/vc-spec/blob/master/doc/bes.md
// Reference: vc-spec/scripts/bes.py + blender-plugin-vietcong/import_bes.py
// Scope: header(16) + preview(0x3000) + chunk walker + Vertices/Faces/Transformation/Info.
// Unknown chunks (0x36/0x38) and partially-known materials are passed through + flagged.

export const BES_SIG = 'BES\0';
export const BES_SUPPORTED = ['0100'];
export const BES_KNOWN_VERSIONS = ['0004','0005','0006','0007','0008','0100'];
export const BES_PREVIEW_SIZE = 0x3000;

export const Block = {
  Object: 0x0001,
  Model: 0x0030,
  Mesh: 0x0031,
  Vertices: 0x0032,
  Faces: 0x0033,
  Properties: 0x0034,
  Transformation: 0x0035,
  Unk36: 0x0036,
  Unk38: 0x0038,
  Info: 0x0070,
  Material: 0x1000,
  Standard: 0x1001, // aka Bitmap
  PteroMat: 0x1002,
};

export const FVF = { XYZ: 0x002, NORMAL: 0x010, TEXMASK: 0xF00, TEXSHIFT: 8, TEXMAX: 8 };

export function parseBesHeader(u8) {
  // vc-spec bes.md "Header", total 16
  if (u8.length < 16) throw new Error('BES: too short for header');
  const sig = String.fromCharCode(u8[0], u8[1], u8[2], u8[3]);
  if (sig !== BES_SIG) throw new Error(`BES: bad signature ${JSON.stringify(sig)}`);
  const version = String.fromCharCode(u8[4], u8[5], u8[6], u8[7]);
  const dv = new DataView(u8.buffer, u8.byteOffset);
  const exporter = dv.getUint32(8, true);
  const unknown = dv.getUint32(12, true);
  return { sig, version, exporter, unknown, supported: BES_SUPPORTED.includes(version), known: BES_KNOWN_VERSIONS.includes(version) };
}

// Generic chunk splitter: each chunk = label u32 + size u32 (size includes 8B header) + payload.
// vc-spec bes.md "Data": "Size of this sub-block (including this field and label)"
export function splitChunks(u8) {
  const chunks = [];
  let pos = 0;
  while (pos + 8 <= u8.length) {
    const dv = new DataView(u8.buffer, u8.byteOffset + pos, 8);
    const label = dv.getUint32(0, true);
    const size = dv.getUint32(4, true);
    if (size < 8) throw new Error(`BES: bad chunk size ${size} for label ${label.toString(16)}`);
    if (pos + size > u8.length) throw new Error('BES: truncated chunk');
    chunks.push({ label, size, payload: u8.slice(pos + 8, pos + size) });
    pos += size;
  }
  if (pos !== u8.length) throw new Error('BES: trailing bytes after chunks');
  return chunks;
}

// vc-spec bes.md "Vertices" — D3DFVF-inspired, size = 24 + 8*texCount
export function parseVertices(payload) {
  if (payload.length < 12) throw new Error('BES Vertices: too short');
  const dv = new DataView(payload.buffer, payload.byteOffset, payload.length);
  const count = dv.getUint32(0, true);
  const vsize = dv.getUint32(4, true);
  const flags = dv.getUint32(8, true);
  const texCount = (flags & FVF.TEXMASK) >> FVF.TEXSHIFT;
  if ((flags & (FVF.XYZ | FVF.NORMAL)) !== (FVF.XYZ | FVF.NORMAL)) throw new Error(`BES Vertices: missing XYZ/NORMAL flags ${flags.toString(16)}`);
  if (texCount > FVF.TEXMAX) throw new Error(`BES Vertices: texCount ${texCount} over limit`);
  if (24 + 8 * texCount !== vsize) throw new Error(`BES Vertices: vsize ${vsize} mismatch texCount ${texCount}`);
  if (count * vsize !== payload.length - 12) throw new Error('BES Vertices: block size mismatch');
  const verts = [];
  let p = 12;
  for (let i = 0; i < count; i++) {
    const x = dv.getFloat32(p, true), y = dv.getFloat32(p+4, true), z = dv.getFloat32(p+8, true);
    const nx = dv.getFloat32(p+12, true), ny = dv.getFloat32(p+16, true), nz = dv.getFloat32(p+20, true);
    p += 24;
    const uv = [];
    for (let t = 0; t < texCount; t++) {
      uv.push([dv.getFloat32(p, true), dv.getFloat32(p+4, true)]);
      p += 8;
    }
    verts.push({ pos: [x,y,z], normal: [nx,ny,nz], uv });
  }
  return { count, vsize, flags, texCount, verts };
}

// vc-spec bes.md "Faces" — count u32 + count*3 u32
export function parseFaces(payload) {
  if (payload.length < 4) throw new Error('BES Faces: too short');
  const dv = new DataView(payload.buffer, payload.byteOffset, payload.length);
  const count = dv.getUint32(0, true);
  if (count * 12 !== payload.length - 4) throw new Error('BES Faces: block size mismatch');
  const faces = [];
  for (let i = 0; i < count; i++) {
    faces.push([dv.getUint32(4+i*12, true), dv.getUint32(8+i*12, true), dv.getUint32(12+i*12, true)]);
  }
  return { count, faces };
}

// vc-spec bes.md "Transformation" — always 100B payload: T[3] R[3] S[3] M[16]
export function parseTransformation(payload) {
  if (payload.length !== 100) throw new Error(`BES Transformation: expected 100B got ${payload.length}`);
  const dv = new DataView(payload.buffer, payload.byteOffset, payload.length);
  const f3 = (o) => [dv.getFloat32(o,true), dv.getFloat32(o+4,true), dv.getFloat32(o+8,true)];
  const translation = f3(0), rotation = f3(12), scale = f3(24);
  const matrix = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) matrix.push(dv.getFloat32(36+(r*4+c)*4, true));
  return { translation, rotation, scale, matrix };
}

// vc-spec bes.md "Object": children u32 + nameLen u32 + name + sub-chunks
export function parseObject(payload) {
  if (payload.length < 8) throw new Error('BES Object: too short');
  const dv = new DataView(payload.buffer, payload.byteOffset, payload.length);
  const children = dv.getUint32(0, true);
  const nameLen = dv.getUint32(4, true);
  if (8 + nameLen > payload.length) throw new Error('BES Object: truncated name');
  const nameBytes = payload.slice(8, 8 + nameLen);
  const name = new TextDecoder('windows-1250').decode(nameBytes).replace(/\0.*$/, '');
  const rest = payload.slice(8 + nameLen);
  return { children, nameLen, name, rest, chunks: splitChunks(rest) };
}

// vc-spec bes.md "Info": authorLen, commentLen, faces, author[64], comment[]
export function parseInfo(payload) {
  if (payload.length < 12) throw new Error('BES Info: too short');
  const dv = new DataView(payload.buffer, payload.byteOffset, payload.length);
  const authorLen = dv.getUint32(0, true);
  const commentLen = dv.getUint32(4, true);
  const faces = dv.getUint32(8, true);
  if (authorLen > 64) throw new Error('BES Info: author too long');
  if (payload.length !== 76 + commentLen) throw new Error('BES Info: size mismatch');
  const dec = new TextDecoder('windows-1250');
  const author = dec.decode(payload.slice(12, 12 + authorLen)).replace(/\0.*$/, '');
  const comment = dec.decode(payload.slice(76, 76 + commentLen)).replace(/\0.*$/, '');
  return { authorLen, commentLen, faces, author, comment };
}

// vc-spec bes.md "Properties": textLen + text (user-defined, purpose unknown)
export function parseProperties(payload) {
  if (payload.length < 4) throw new Error('BES Properties: too short');
  const dv = new DataView(payload.buffer, payload.byteOffset, payload.length);
  const len = dv.getUint32(0, true);
  if (4 + len !== payload.length) throw new Error('BES Properties: size mismatch');
  return new TextDecoder('windows-1250').decode(payload.slice(4));
}

// vc-spec bes.md "Mesh": material u32 + Vertices + Faces
export function parseMesh(payload) {
  if (payload.length < 4) throw new Error('BES Mesh: too short');
  const dv = new DataView(payload.buffer, payload.byteOffset, payload.length);
  const material = dv.getUint32(0, true);
  const chunks = splitChunks(payload.slice(4));
  return { material, chunks };
}

// Top-level: header + preview + data chunks. Validates counts lightly (bes.py behavior).
export function parseBes(u8) {
  const bytes = u8 instanceof Uint8Array ? u8 : new Uint8Array(u8);
  const header = parseBesHeader(bytes);
  if (bytes.length < 16 + BES_PREVIEW_SIZE) throw new Error('BES: missing preview');
  const preview = bytes.slice(16, 16 + BES_PREVIEW_SIZE);
  const data = bytes.slice(16 + BES_PREVIEW_SIZE);
  const chunks = splitChunks(data);
  return { header, preview, chunks, data };
}

// Convert a parsed Mesh chunk pair into Three.js-friendly arrays (no three dependency here).
export function meshToArrays(verticesParsed, facesParsed) {
  const positions = [], normals = [], uvs = [], indices = [];
  for (const v of verticesParsed.verts) {
    positions.push(...v.pos);
    normals.push(...v.normal);
    if (v.uv.length) uvs.push(...v.uv[0]);
    else uvs.push(0, 0);
  }
  for (const f of facesParsed.faces) indices.push(...f);
  return { positions, normals, uvs, indices };
}
