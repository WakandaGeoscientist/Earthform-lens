/* ===================== Minimal GeoTIFF reader ===================== */
// Supports: classic TIFF (II/MM), strips & tiles, chunky/planar, uint8/16/32, int8/16/32, float32/64,
// compression none / LZW / Deflate / PackBits, predictor 2 & 3, GeoTIFF scale/tiepoint/transform, GDAL nodata.
async function readTIFF(buf){
  const dv = new DataView(buf), u8 = new Uint8Array(buf);
  const bo = String.fromCharCode(u8[0], u8[1]); if (bo !== "II" && bo !== "MM") throw new Error("Not a TIFF file");
  const le = bo === "II";
  const magic = dv.getUint16(2, le);
  if (magic === 43) throw new Error("BigTIFF is not supported — export a regular GeoTIFF (under 4 GB)");
  if (magic !== 42) throw new Error("Not a TIFF file");
  const ifdOff = dv.getUint32(4, le);
  const TS = {1:1,2:1,3:2,4:4,5:8,6:1,7:1,8:2,9:4,10:8,11:4,12:8};
  const n = dv.getUint16(ifdOff, le), tags = {};
  for (let i = 0; i < n; i++){
    const e = ifdOff + 2 + i*12, tag = dv.getUint16(e, le), type = dv.getUint16(e+2, le), cnt = dv.getUint32(e+4, le);
    const sz = (TS[type] || 1)*cnt, off = sz <= 4 ? e+8 : dv.getUint32(e+8, le);
    const vals = [];
    if (type === 2){ let s = ""; for (let k = 0; k < cnt; k++){ const c = u8[off+k]; if (c) s += String.fromCharCode(c); } tags[tag] = s; continue; }
    for (let k = 0; k < cnt; k++){
      const o = off + k*(TS[type]||1);
      switch (type){
        case 1: case 7: vals.push(u8[o]); break; case 6: vals.push(dv.getInt8(o)); break;
        case 3: vals.push(dv.getUint16(o, le)); break; case 8: vals.push(dv.getInt16(o, le)); break;
        case 4: vals.push(dv.getUint32(o, le)); break; case 9: vals.push(dv.getInt32(o, le)); break;
        case 5: vals.push(dv.getUint32(o, le)/dv.getUint32(o+4, le)); break;
        case 10: vals.push(dv.getInt32(o, le)/dv.getInt32(o+4, le)); break;
        case 11: vals.push(dv.getFloat32(o, le)); break; case 12: vals.push(dv.getFloat64(o, le)); break;
        default: vals.push(0);
      }
    }
    tags[tag] = vals;
  }
  const W = tags[256][0], H = tags[257][0], spp = tags[277] ? tags[277][0] : 1;
  const bps = tags[258] ? tags[258][0] : 1, comp = tags[259] ? tags[259][0] : 1;
  const sf = tags[339] ? tags[339][0] : 1, pred = tags[317] ? tags[317][0] : 1, planar = tags[284] ? tags[284][0] : 1;
  if (![8,16,32,64].includes(bps)) throw new Error("Unsupported bit depth: " + bps);
  if (![1,5,8,32946,32773].includes(comp)) throw new Error("Unsupported compression (code " + comp + "). Re-export as LZW, Deflate or uncompressed.");
  const tiled = !!tags[322];
  const tw = tiled ? tags[322][0] : W, th = tiled ? tags[323][0] : (tags[278] ? tags[278][0] : H);
  const offs = tiled ? tags[324] : tags[273], cnts = tiled ? tags[325] : tags[279];
  const B = bps/8, bands = []; for (let b = 0; b < spp; b++) bands.push(new Float32Array(W*H));
  const tilesAcross = Math.ceil(W/tw), tilesDown = Math.ceil(H/th), perPlane = tilesAcross*tilesDown;
  const spc = planar === 1 ? spp : 1; // samples per chunk pixel

  async function inflate(bytes){
    const ds = new DecompressionStream("deflate");
    const out = await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer();
    return new Uint8Array(out);
  }
  function lzw(src, expected){
    const out = new Uint8Array(expected); let op = 0;
    let dict = [], bitPos = 0, codeLen = 9, prev = null;
    const reset = () => { dict = []; for (let i = 0; i < 256; i++) dict.push([i]); dict.push(null, null); codeLen = 9; };
    const read = () => { let v = 0; for (let i = 0; i < codeLen; i++){ const byte = src[(bitPos >> 3)]; if (byte === undefined) return 257; v = (v << 1) | ((byte >> (7 - (bitPos & 7))) & 1); bitPos++; } return v; };
    reset();
    for (;;){
      const code = read();
      if (code === 257) break;
      if (code === 256){ reset(); prev = null; continue; }
      let entry;
      if (code < dict.length && dict[code]) entry = dict[code];
      else if (prev) entry = prev.concat([prev[0]]);
      else break;
      for (let i = 0; i < entry.length && op < expected; i++) out[op++] = entry[i];
      if (prev) dict.push(prev.concat([entry[0]]));
      prev = entry;
      if (dict.length + 1 >= (1 << codeLen) && codeLen < 12) codeLen++;
      if (op >= expected) break;
    }
    return out;
  }
  function packbits(src, expected){
    const out = new Uint8Array(expected); let i = 0, o = 0;
    while (i < src.length && o < expected){ const n = (src[i] << 24) >> 24; i++;
      if (n >= 0){ for (let k = 0; k <= n; k++) out[o++] = src[i++]; } else if (n !== -128){ const v = src[i++]; for (let k = 0; k < 1-n; k++) out[o++] = v; } }
    return out;
  }
  for (let c = 0; c < offs.length; c++){
    const plane = planar === 2 ? Math.floor(c / perPlane) : 0, ci = c % perPlane;
    const tx = ci % tilesAcross, ty = Math.floor(ci / tilesAcross);
    const cw = tw, ch = tiled ? th : Math.min(th, H - ty*th);
    const expected = cw*ch*spc*B;
    let raw = u8.subarray(offs[c], offs[c] + cnts[c]);
    if (comp === 5) raw = lzw(raw, expected);
    else if (comp === 8 || comp === 32946) raw = await inflate(raw);
    else if (comp === 32773) raw = packbits(raw, expected);
    let bytes = new Uint8Array(expected); bytes.set(raw.subarray(0, expected));
    let rowLE = le;
    if (pred === 2){
      const rdv = new DataView(bytes.buffer);
      for (let y = 0; y < ch; y++) for (let x = 1; x < cw; x++) for (let s = 0; s < spc; s++){
        const i = ((y*cw + x)*spc + s)*B, p = ((y*cw + x - 1)*spc + s)*B;
        if (B === 1) bytes[i] = (bytes[i] + bytes[p]) & 255;
        else if (B === 2) rdv.setUint16(i, (rdv.getUint16(i, le) + rdv.getUint16(p, le)) & 65535, le);
        else if (B === 4) rdv.setUint32(i, (rdv.getUint32(i, le) + rdv.getUint32(p, le)) >>> 0, le);
      }
    } else if (pred === 3){
      const wc = cw*spc, rowB = wc*B, out = new Uint8Array(expected);
      for (let y = 0; y < ch; y++){
        const r = bytes.subarray(y*rowB, (y+1)*rowB);
        for (let i = 1; i < rowB; i++) r[i] = (r[i] + r[i-1]) & 255;
        for (let i = 0; i < wc; i++) for (let b = 0; b < B; b++) out[y*rowB + i*B + (B-1-b)] = r[b*wc + i];
      }
      bytes = out; rowLE = true;
    }
    const cdv = new DataView(bytes.buffer);
    const get = (o) => {
      if (sf === 3) return B === 4 ? cdv.getFloat32(o, rowLE) : cdv.getFloat64(o, rowLE);
      if (sf === 2) return B === 1 ? cdv.getInt8(o) : B === 2 ? cdv.getInt16(o, rowLE) : cdv.getInt32(o, rowLE);
      return B === 1 ? bytes[o] : B === 2 ? cdv.getUint16(o, rowLE) : cdv.getUint32(o, rowLE);
    };
    for (let y = 0; y < ch; y++){
      const gy = ty*th + y; if (gy >= H) break;
      for (let x = 0; x < cw; x++){
        const gx = tx*tw + x; if (gx >= W) continue;
        for (let s = 0; s < spc; s++){
          const band = planar === 2 ? plane : s;
          bands[band][gy*W + gx] = get(((y*cw + x)*spc + s)*B);
        }
      }
    }
  }
  // georeferencing
  const geo = {};
  if (tags[33550]) geo.scale = tags[33550];
  if (tags[33922]) geo.tie = tags[33922];
  if (tags[34264]){ const t = tags[34264]; geo.scale = [Math.hypot(t[0], t[4]), Math.hypot(t[1], t[5])]; geo.tie = [0,0,0,t[3],t[7],0]; }
  if (tags[34735]){
    const k = tags[34735], keys = {};
    for (let i = 4; i + 3 < k.length; i += 4) keys[k[i]] = k[i+3];
    geo.model = keys[1024]; geo.epsg = keys[3072] || keys[2048]; geo.linUnit = keys[3076];
  }
  geo.geographic = geo.model === 2 || (geo.scale && geo.scale[0] < 0.1 && !geo.model);
  if (geo.scale){
    if (geo.geographic){
      const lat = geo.tie ? geo.tie[4] - geo.scale[1]*H/2 : 0;
      geo.dx = geo.scale[0]*111320*Math.cos(lat*Math.PI/180); geo.dy = geo.scale[1]*110574; geo.lat = lat;
      geo.lon = geo.tie ? geo.tie[3] + geo.scale[0]*W/2 : null;
    } else {
      const f = geo.linUnit === 9002 ? .3048 : geo.linUnit === 9003 ? 1200/3937 : 1;
      geo.dx = geo.scale[0]*f; geo.dy = geo.scale[1]*f;
    }
  }
  let nodata = null;
  if (tags[42113] !== undefined){ const v = parseFloat(String(tags[42113]).trim()); if (Number.isFinite(v)) nodata = v; }
  if (nodata !== null) for (const b of bands) for (let i = 0; i < b.length; i++) if (b[i] === nodata) b[i] = NaN;
  for (const b of bands) for (let i = 0; i < b.length; i++) if (b[i] <= -1e30 || b[i] >= 1e30) b[i] = NaN;
  return {width: W, height: H, bands, spp, bps, sampleFormat: sf, geo, nodata};
}
