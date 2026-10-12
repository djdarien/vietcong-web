# Format notes (which OpenVietcong docs were used)

All parsers in `src/parsers/` are clean-room implementations from public specs.
No original Vietcong files are included or required.

| Module | vc-spec doc | Coverage | Reference impl |
|---|---|---|---|
| `cbf.js` | [doc/cbf.md](https://github.com/OpenVietcong/vc-spec/blob/master/doc/cbf.md) Header 52B+, Table of Files, descriptor LUT crypt, file salt crypt, LZW blocks `[..]` | ~95% per spec (ZBL0+ZBL1, classic/extended) | `vc-spec/scripts/cbf.py`, `libvc/lib/cbf.*` |
| `bes.js` | [doc/bes.md](https://github.com/OpenVietcong/vc-spec/blob/master/doc/bes.md) Header 16B, preview 0x3000, chunk labels 0x0001/0030-0038/0070/1000-1002, Vertices D3DFVF flags, Faces, Transformation 100B, Object, Info, Properties | ~90% of v0100 per spec; Standard/PteroMat texture ordering noted but not fully reimplemented | `vc-spec/scripts/bes.py`, `blender-plugin-vietcong/import_bes.py` |
| `ctr.js` | [doc/ctr.md](https://github.com/OpenVietcong/vc-spec/blob/master/doc/ctr.md) SRTC header, count+24B controls, 0x28-0x2B exceptions, `cfhx` inventory | full per spec | — |
| `way.js` | [doc/way.md](https://github.com/OpenVietcong/vc-spec/blob/master/doc/way.md) count + x/y f32, no Z | full per spec | — |
| `sco.js` | [doc/sco.md](https://github.com/OpenVietcong/vc-spec/blob/master/doc/sco.md) offset 0x64 count + len+name list | ~1% — rest kept opaque, marked `unknown:true` | — |
| `manm.js` | [doc/manm.md](https://github.com/OpenVietcong/vc-spec/blob/master/doc/manm.md) MANM header, trans/rot/unk3 track layouts | ~40% — object-name length encoding ambiguous, flagged `partial` | — |

Additional note: `vietcong-unpacker` (Romop5) is cited by vc-spec as partial basis for CBF;
we prefer vc-spec + libvc where they disagree.

## Testing
`npm test` runs `node --test` against **synthetic** buffers built in `test/`
(no game files). Each test cites the spec section it covers.
