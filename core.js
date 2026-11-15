/* ===================== Earthform Lens — core algorithms ===================== */
const INF = 1e20;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const SQ2 = Math.SQRT2;
const NB8 = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];

/* ---------- Euclidean distance transform (Felzenszwalb) ---------- */
function dt1d(f, n, d, v, z){
  let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
  for (let q = 1; q < n; q++){
    let s = ((f[q] + q*q) - (f[v[k]] + v[k]*v[k])) / (2*q - 2*v[k]);
    while (s <= z[k]){ k--; s = ((f[q] + q*q) - (f[v[k]] + v[k]*v[k])) / (2*q - 2*v[k]); }
    k++; v[k] = q; z[k] = s; z[k+1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++){ while (z[k+1] < q) k++; const t = q - v[k]; d[q] = t*t + f[v[k]]; }
}
/** distance from every pixel to the nearest pixel where feat[i] != 0 */
function edtTo(feat, w, h){
  const n = Math.max(w, h);
  const f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n+1);
  const g = new Float64Array(w*h);
  for (let x = 0; x < w; x++){
    for (let y = 0; y < h; y++) f[y] = feat[y*w+x] ? 0 : INF;
    dt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) g[y*w+x] = d[y];
  }
  const out = new Float32Array(w*h);
  for (let y = 0; y < h; y++){
    const o = y*w;
    for (let x = 0; x < w; x++) f[x] = g[o+x];
    dt1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) out[o+x] = Math.sqrt(d[x]);
  }
  return out;
}
function notMask(m){ const o = new Uint8Array(m.length); for (let i = 0; i < m.length; i++) o[i] = m[i] ? 0 : 1; return o; }
function erode(m, w, h, r){ const d = edtTo(notMask(m), w, h); const o = new Uint8Array(m.length); for (let i = 0; i < o.length; i++) o[i] = d[i] > r ? 1 : 0; return o; }
function dilate(m, w, h, r){ const d = edtTo(m, w, h); const o = new Uint8Array(m.length); for (let i = 0; i < o.length; i++) o[i] = d[i] <= r ? 1 : 0; return o; }
function opening(m, w, h, r){ return dilate(erode(m, w, h, r), w, h, r); }
function closing(m, w, h, r){ return erode(dilate(m, w, h, r), w, h, r); }

/* ---------- connected components ---------- */
function label(m, w, h, roi){
  const N = w*h, L = new Int32Array(N), st = new Int32Array(N), comps = [];
  const rx0 = roi ? roi.x0 : 0, ry0 = roi ? roi.y0 : 0, rx1 = roi ? roi.x1-1 : w-1, ry1 = roi ? roi.y1-1 : h-1;
  let id = 0;
  for (let i = 0; i < N; i++){
    if (!m[i] || L[i]) continue;
    id++; let sp = 0; st[sp++] = i; L[i] = id;
    const c = {id, area:0, sx:0, sy:0, sxx:0, syy:0, sxy:0, x0:w, y0:h, x1:0, y1:0, border:false, perim:0, seed:i};
    while (sp){
      const p = st[--sp], x = p % w, y = (p / w) | 0;
      c.area++; c.sx += x; c.sy += y; c.sxx += x*x; c.syy += y*y; c.sxy += x*y;
      if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
      if (x <= rx0 || y <= ry0 || x >= rx1 || y >= ry1) c.border = true;
      for (let k = 0; k < 8; k++){
        const nx = x + NB8[k][0], ny = y + NB8[k][1];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny*w + nx;
        if (m[q] && !L[q]){ L[q] = id; st[sp++] = q; }
      }
    }
    comps.push(c);
  }
  // perimeters (4-neighbour boundary edges)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
    const p = y*w+x; if (!L[p]) continue;
    let e = 0;
    if (x === 0 || !m[p-1]) e++; if (x === w-1 || !m[p+1]) e++;
    if (y === 0 || !m[p-w]) e++; if (y === h-1 || !m[p+w]) e++;
    comps[L[p]-1].perim += e;
  }
  return {L, comps};
}
function removeSmall(m, w, h, minArea){
  const {L, comps} = label(m, w, h);
  const keep = new Uint8Array(comps.length+1);
  comps.forEach(c => keep[c.id] = c.area >= minArea ? 1 : 0);
  const o = new Uint8Array(m.length); for (let i = 0; i < o.length; i++) o[i] = keep[L[i]];
  return o;
}
function fillHoles(m, w, h, maxArea){
  const inv = notMask(m);
  const {L, comps} = label(inv, w, h);
  const fill = new Uint8Array(comps.length+1);
  comps.forEach(c => fill[c.id] = (!c.border && c.area <= maxArea) ? 1 : 0);
  const o = new Uint8Array(m); for (let i = 0; i < o.length; i++) if (fill[L[i]]) o[i] = 1;
  return o;
}

/* ---------- Otsu threshold ---------- */
function otsu(vals, mask){
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < vals.length; i++){ if (mask && !mask[i]) continue; const v = vals[i]; if (!isFinite(v)) continue; if (v < mn) mn = v; if (v > mx) mx = v; }
  if (!(mx > mn)) return mn;
  const B = 256, hist = new Float64Array(B); let tot = 0;
  for (let i = 0; i < vals.length; i++){ if (mask && !mask[i]) continue; const v = vals[i]; if (!isFinite(v)) continue; hist[Math.min(B-1, ((v-mn)/(mx-mn)*B)|0)]++; tot++; }
  let sum = 0; for (let i = 0; i < B; i++) sum += i*hist[i];
  let sB = 0, wB = 0, best = 0, bt = 0;
  for (let i = 0; i < B; i++){
    wB += hist[i]; if (!wB) continue; const wF = tot - wB; if (!wF) break;
    sB += i*hist[i]; const mB = sB/wB, mF = (sum-sB)/wF, between = wB*wF*(mB-mF)*(mB-mF);
    if (between > best){ best = between; bt = i; }
  }
  return mn + (bt+1)/B*(mx-mn);
}

/* ---------- colour ---------- */
function rgb2lab(r, g, b){
  r /= 255; g /= 255; b /= 255;
  r = r > .04045 ? Math.pow((r+.055)/1.055, 2.4) : r/12.92;
  g = g > .04045 ? Math.pow((g+.055)/1.055, 2.4) : g/12.92;
  b = b > .04045 ? Math.pow((b+.055)/1.055, 2.4) : b/12.92;
  let x = (r*.4124 + g*.3576 + b*.1805)/.95047, y = r*.2126 + g*.7152 + b*.0722, z = (r*.0193 + g*.1192 + b*.9505)/1.08883;
  const f = t => t > .008856 ? Math.cbrt(t) : 7.787*t + 16/116;
  x = f(x); y = f(y); z = f(z);
  return [116*y - 16, 500*(x - y), 200*(y - z)];
}
function lab2rgb(L, a, b){
  let y = (L+16)/116, x = a/500 + y, z = y - b/200;
  const f = t => t*t*t > .008856 ? t*t*t : (t - 16/116)/7.787;
  x = f(x)*.95047; y = f(y); z = f(z)*1.08883;
  let r = x*3.2406 + y*-1.5372 + z*-.4986, g = x*-.9689 + y*1.8758 + z*.0415, bb = x*.0557 + y*-.204 + z*1.057;
  const c = t => 255*clamp(t > .0031308 ? 1.055*Math.pow(t, 1/2.4) - .055 : 12.92*t, 0, 1);
  return [c(r), c(g), c(bb)];
}

/* ---------- skeletonisation (Zhang–Suen + staircase clean-up) ---------- */
function thin(m, w, h){
  const s = new Uint8Array(m);
  for (let x = 0; x < w; x++){ s[x] = 0; s[(h-1)*w+x] = 0; }
  for (let y = 0; y < h; y++){ s[y*w] = 0; s[y*w+w-1] = 0; }
  let pts = []; for (let i = 0; i < s.length; i++) if (s[i]) pts.push(i);
  const del = [];
  let changed = true;
  while (changed){
    changed = false;
    for (let pass = 0; pass < 2; pass++){
      del.length = 0;
      for (let t = 0; t < pts.length; t++){
        const p = pts[t]; if (!s[p]) continue;
        const P2=s[p-w],P3=s[p-w+1],P4=s[p+1],P5=s[p+w+1],P6=s[p+w],P7=s[p+w-1],P8=s[p-1],P9=s[p-w-1];
        const B = P2+P3+P4+P5+P6+P7+P8+P9; if (B < 2 || B > 6) continue;
        const A = (!P2&&P3?1:0)+(!P3&&P4?1:0)+(!P4&&P5?1:0)+(!P5&&P6?1:0)+(!P6&&P7?1:0)+(!P7&&P8?1:0)+(!P8&&P9?1:0)+(!P9&&P2?1:0);
        if (A !== 1) continue;
        if (pass === 0){ if (P2&&P4&&P6) continue; if (P4&&P6&&P8) continue; }
        else { if (P2&&P4&&P8) continue; if (P2&&P6&&P8) continue; }
        del.push(p);
      }
      for (let t = 0; t < del.length; t++) s[del[t]] = 0;
      if (del.length) changed = true;
    }
    pts = pts.filter(p => s[p]);
  }
  // remove redundant staircase corner pixels while preserving 8-connectivity
  for (const p of pts){
    if (!s[p]) continue;
    const n = [s[p-w], s[p+1], s[p+w], s[p-1]];
    const corner = (n[0]&&n[1]) || (n[1]&&n[2]) || (n[2]&&n[3]) || (n[3]&&n[0]);
    if (!corner) continue;
    const ring = [];
    for (let k = 0; k < 8; k++){ const q = p + NB8[k][1]*w + NB8[k][0]; if (s[q]) ring.push(NB8[k]); }
    if (ring.length < 2 || ring.length > 4) continue;
    // count 8-connected groups among ring pixels
    const seen = new Array(ring.length).fill(false); let groups = 0;
    for (let i = 0; i < ring.length; i++){
      if (seen[i]) continue; groups++; const st = [i]; seen[i] = true;
      while (st.length){ const a = st.pop(); for (let j = 0; j < ring.length; j++) if (!seen[j] && Math.abs(ring[a][0]-ring[j][0]) <= 1 && Math.abs(ring[a][1]-ring[j][1]) <= 1){ seen[j] = true; st.push(j); } }
    }
    if (groups === 1) s[p] = 0;
  }
  return s;
}
function nbCount(s, w, h, p){
  const x = p % w, y = (p / w) | 0; let c = 0;
  for (let k = 0; k < 8; k++){ const nx = x+NB8[k][0], ny = y+NB8[k][1]; if (nx>=0&&ny>=0&&nx<w&&ny<h && s[ny*w+nx]) c++; }
  return c;
}

/* ---------- skeleton graph ---------- */
function buildGraph(s, w, h){
  const N = w*h, nb = new Uint8Array(N), skel = [];
  for (let p = 0; p < N; p++) if (s[p]){ nb[p] = nbCount(s, w, h, p); skel.push(p); }
  const nodeId = new Int32Array(N).fill(-1), nodes = [];
  for (const p of skel){
    if (nb[p] === 2 || nodeId[p] >= 0) continue;
    const id = nodes.length;
    if (nb[p] >= 3){
      const pix = [], st = [p]; nodeId[p] = id;
      while (st.length){
        const q = st.pop(); pix.push(q); const x = q % w, y = (q / w) | 0;
        for (const [dx,dy] of NB8){ const nx=x+dx, ny=y+dy; if (nx<0||ny<0||nx>=w||ny>=h) continue; const r = ny*w+nx; if (s[r] && nb[r] >= 3 && nodeId[r] < 0){ nodeId[r] = id; st.push(r); } }
      }
      let sx = 0, sy = 0; pix.forEach(q => { sx += q % w; sy += (q / w) | 0; });
      nodes.push({id, pix, x: sx/pix.length, y: sy/pix.length, type:"junction", links:[]});
    } else {
      nodeId[p] = id; nodes.push({id, pix:[p], x: p % w, y: (p / w) | 0, type: nb[p] === 1 ? "end" : "iso", links:[]});
    }
  }
  const visited = new Uint8Array(N), links = [], direct = new Set();
  const stepLen = (a, b) => ((a % w) !== (b % w) && ((a / w) | 0) !== ((b / w) | 0)) ? SQ2 : 1;
  for (const nd of nodes){
    for (const q of nd.pix){
      const qx = q % w, qy = (q / w) | 0;
      for (const [dx,dy] of NB8){
        const nx = qx+dx, ny = qy+dy; if (nx<0||ny<0||nx>=w||ny>=h) continue;
        const r = ny*w+nx; if (!s[r]) continue;
        if (nodeId[r] >= 0){
          const o = nodeId[r]; if (o === nd.id) continue;
          const key = Math.min(o, nd.id) + ":" + Math.max(o, nd.id);
          if (direct.has(key)) continue; direct.add(key);
          links.push({a: nd.id, b: o, pix: [q, r], len: stepLen(q, r)});
          continue;
        }
        if (visited[r]) continue;
        const path = [q, r]; visited[r] = 1; let prev = q, cur = r, len = stepLen(q, r), end = -1;
        for (;;){
          const cx = cur % w, cy = (cur / w) | 0; let next = -1;
          for (const [ex,ey] of NB8){
            const mx = cx+ex, my = cy+ey; if (mx<0||my<0||mx>=w||my>=h) continue;
            const t = my*w+mx; if (!s[t] || t === prev || t === q && path.length === 2) continue;
            if (nodeId[t] >= 0 && t !== q){ next = t; break; }
            if (nodeId[t] < 0 && !visited[t]){ next = t; }
          }
          if (next < 0){ end = -1; break; }
          len += stepLen(cur, next); path.push(next);
          if (nodeId[next] >= 0){ end = nodeId[next]; break; }
          visited[next] = 1; prev = cur; cur = next;
        }
        if (end < 0 || (end === nd.id && len < 3)) continue;
        links.push({a: nd.id, b: end, pix: path, len});
      }
    }
  }
  links.forEach((l, i) => { l.id = i; nodes[l.a].links.push(i); if (l.b !== l.a) nodes[l.b].links.push(i); });
  return {nodes, links, nodeId};
}
/** iteratively remove short end-spurs (length < k × local channel width) */
function pruneSkeleton(s, w, h, halfWidth, k, protect){
  s = new Uint8Array(s);
  for (let iter = 0; iter < 6; iter++){
    const G = buildGraph(s, w, h); let removed = 0;
    for (const l of G.links){
      const A = G.nodes[l.a], B = G.nodes[l.b];
      let endN = null, jN = null;
      if (A.type === "end" && B.type === "junction"){ endN = A; jN = B; }
      else if (B.type === "end" && A.type === "junction"){ endN = B; jN = A; }
      if (!endN) continue;
      if (protect && protect.some(p => l.pix.includes(p) || endN.pix.includes(p))) continue;
      const jw = halfWidth[jN.pix[0]] * 2;
      if (l.len < k * Math.max(jw, 3)){
        for (const p of l.pix) if (G.nodeId[p] < 0 || G.nodeId[p] === endN.id) s[p] = 0;
        removed++;
      }
    }
    if (!removed) break;
    s = thin(s, w, h);
  }
  return s;
}

/* ---------- binary heap (min) ---------- */
class Heap {
  constructor(n){ this.k = new Float64Array(n+1); this.v = new Int32Array(n+1); this.n = 0; }
  push(key, val){
    if (this.n + 1 >= this.k.length){ const k2 = new Float64Array(this.k.length*2), v2 = new Int32Array(this.k.length*2); k2.set(this.k); v2.set(this.v); this.k = k2; this.v = v2; }
    let i = ++this.n; const K = this.k, V = this.v;
    while (i > 1 && K[i>>1] > key){ K[i] = K[i>>1]; V[i] = V[i>>1]; i >>= 1; }
    K[i] = key; V[i] = val;
  }
  pop(){
    const K = this.k, V = this.v; const topV = V[1]; this.topKey = K[1];
    const key = K[this.n], val = V[this.n--]; let i = 1;
    while (true){ let c = i*2; if (c > this.n) break; if (c+1 <= this.n && K[c+1] < K[c]) c++; if (K[c] >= key) break; K[i] = K[c]; V[i] = V[c]; i = c; }
    K[i] = key; V[i] = val; return topV;
  }
}
/** geodesic shortest paths over skeleton pixels */
function skelDijkstra(s, w, h, src){
  const N = w*h, dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), hp = new Heap(1024);
  dist[src] = 0; hp.push(0, src);
  while (hp.n){
    const p = hp.pop(), d = hp.topKey; if (d > dist[p]) continue;
    const x = p % w, y = (p / w) | 0;
    for (const [dx,dy] of NB8){
      const nx = x+dx, ny = y+dy; if (nx<0||ny<0||nx>=w||ny>=h) continue;
      const q = ny*w+nx; if (!s[q]) continue;
      const nd = d + (dx && dy ? SQ2 : 1);
      if (nd < dist[q]){ dist[q] = nd; prev[q] = p; hp.push(nd, q); }
    }
  }
  return {dist, prev};
}
function nearestOn(s, w, h, x, y, maxR){
  x = Math.round(x); y = Math.round(y);
  for (let r = 0; r <= maxR; r++){
    let best = -1, bd = Infinity;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++){
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const nx = x+dx, ny = y+dy; if (nx<0||ny<0||nx>=w||ny>=h) continue;
      const q = ny*w+nx; if (s[q]){ const d = dx*dx+dy*dy; if (d < bd){ bd = d; best = q; } }
    }
    if (best >= 0) return best;
  }
  return -1;
}

/* ---------- smoothing / fits ---------- */
function gauss1d(a, sigma){
  const n = a.length; if (sigma < .5 || n < 3) return Float64Array.from(a);
  const r = Math.ceil(sigma*3), k = []; let ks = 0;
  for (let i = -r; i <= r; i++){ const v = Math.exp(-i*i/(2*sigma*sigma)); k.push(v); ks += v; }
  const o = new Float64Array(n);
  for (let i = 0; i < n; i++){ let s = 0, ws = 0; for (let j = -r; j <= r; j++){ const t = i+j; if (t < 0 || t >= n) continue; s += a[t]*k[j+r]; ws += k[j+r]; } o[i] = s/ws; }
  return o;
}
function linfit(x, y){
  const n = x.length; if (n < 2) return {a:NaN, b:NaN, r2:NaN};
  let sx=0, sy=0, sxx=0, sxy=0, syy=0;
  for (let i = 0; i < n; i++){ sx+=x[i]; sy+=y[i]; sxx+=x[i]*x[i]; sxy+=x[i]*y[i]; syy+=y[i]*y[i]; }
  const b = (n*sxy - sx*sy)/(n*sxx - sx*sx), a = (sy - b*sx)/n;
  const r = (n*sxy - sx*sy)/Math.sqrt((n*sxx - sx*sx)*(n*syy - sy*sy));
  return {a, b, r2: r*r};
}
function quantile(arr, q){
  const a = Float64Array.from(arr).filter(Number.isFinite).sort(); if (!a.length) return NaN;
  const p = (a.length-1)*q, i = Math.floor(p), f = p - i;
  return i+1 < a.length ? a[i]*(1-f) + a[i+1]*f : a[i];
}
const median = a => quantile(a, .5);
const mean = a => { let s = 0, n = 0; for (const v of a) if (Number.isFinite(v)){ s += v; n++; } return n ? s/n : NaN; };
const geomean = a => { const b = a.filter(v => v > 0 && isFinite(v)); return b.length ? Math.exp(b.reduce((s,v)=>s+Math.log(v),0)/b.length) : NaN; };
/** azimuth (deg clockwise from image-up) of image vector */
const azOf = (dx, dy) => ((Math.atan2(dx, -dy)*180/Math.PI) + 360) % 360;

/* ---------- FFT ---------- */
function fft1(re, im){
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++){
    let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
    if (i < j){ let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1){
    const ang = -2*Math.PI/len, wr = Math.cos(ang), wi = Math.sin(ang), h2 = len >> 1;
    for (let i = 0; i < n; i += len){
      let cr = 1, ci = 0;
      for (let k = 0; k < h2; k++){
        const a = i+k, b = a+h2, xr = re[b]*cr - im[b]*ci, xi = re[b]*ci + im[b]*cr;
        re[b] = re[a]-xr; im[b] = im[a]-xi; re[a] += xr; im[a] += xi;
        const t = cr*wr - ci*wi; ci = cr*wi + ci*wr; cr = t;
      }
    }
  }
}
function fft2(re, im, N){
  const r = new Float64Array(N), i2 = new Float64Array(N);
  for (let y = 0; y < N; y++){ for (let x = 0; x < N; x++){ r[x] = re[y*N+x]; i2[x] = im[y*N+x]; } fft1(r, i2); for (let x = 0; x < N; x++){ re[y*N+x] = r[x]; im[y*N+x] = i2[x]; } }
  for (let x = 0; x < N; x++){ for (let y = 0; y < N; y++){ r[y] = re[y*N+x]; i2[y] = im[y*N+x]; } fft1(r, i2); for (let y = 0; y < N; y++){ re[y*N+x] = r[y]; im[y*N+x] = i2[y]; } }
}

/* ---------- k-means (Lab) ---------- */
function kmeans(pts, k, iters){
  const n = pts.length/3, C = new Float64Array(k*3);
  // k-means++ init with deterministic seed
  let seed = 7; const rnd = () => (seed = (seed*1664525 + 1013904223) >>> 0)/4294967296;
  let first = Math.floor(rnd()*n); C.set(pts.subarray(first*3, first*3+3), 0);
  const D = new Float64Array(n).fill(Infinity);
  for (let c = 1; c < k; c++){
    let sum = 0;
    for (let i = 0; i < n; i++){ const dx=pts[i*3]-C[(c-1)*3], dy=pts[i*3+1]-C[(c-1)*3+1], dz=pts[i*3+2]-C[(c-1)*3+2]; const d = dx*dx+dy*dy+dz*dz; if (d < D[i]) D[i] = d; sum += D[i]; }
    let t = rnd()*sum, j = 0; while (j < n-1 && (t -= D[j]) > 0) j++;
    C.set(pts.subarray(j*3, j*3+3), c*3);
  }
  const A = new Int32Array(n);
  for (let it = 0; it < iters; it++){
    const S = new Float64Array(k*3), cnt = new Float64Array(k);
    for (let i = 0; i < n; i++){
      let b = 0, bd = Infinity;
      for (let c = 0; c < k; c++){ const dx=pts[i*3]-C[c*3], dy=pts[i*3+1]-C[c*3+1], dz=pts[i*3+2]-C[c*3+2]; const d = dx*dx+dy*dy+dz*dz; if (d < bd){ bd = d; b = c; } }
      A[i] = b; cnt[b]++; S[b*3]+=pts[i*3]; S[b*3+1]+=pts[i*3+1]; S[b*3+2]+=pts[i*3+2];
    }
    for (let c = 0; c < k; c++) if (cnt[c]) for (let j = 0; j < 3; j++) C[c*3+j] = S[c*3+j]/cnt[c];
  }
  return C;
}

/* ---------- resampling ---------- */
function resampleBand(src, w, h, nw, nh){
  if (nw === w && nh === h) return Float32Array.from(src);
  const out = new Float32Array(nw*nh), fx = w/nw, fy = h/nh;
  for (let y = 0; y < nh; y++){
    const y0 = Math.floor(y*fy), y1 = Math.max(y0+1, Math.floor((y+1)*fy));
    for (let x = 0; x < nw; x++){
      const x0 = Math.floor(x*fx), x1 = Math.max(x0+1, Math.floor((x+1)*fx));
      let s = 0, n = 0;
      for (let yy = y0; yy < y1 && yy < h; yy++) for (let xx = x0; xx < x1 && xx < w; xx++){ const v = src[yy*w+xx]; if (Number.isFinite(v)){ s += v; n++; } }
      out[y*nw+x] = n ? s/n : NaN;
    }
  }
  return out;
}

/* ---------- DEM hydrology ---------- */
/** Priority-flood depression filling (Barnes 2014, epsilon variant). Returns filled DEM and ascending processing order. */
function priorityFlood(z, w, h){
  const N = w*h, F = new Float64Array(N), done = new Uint8Array(N), order = new Int32Array(N), hp = new Heap(w*2+h*2+16);
  let on = 0;
  for (let i = 0; i < N; i++){
    if (!Number.isFinite(z[i])){ done[i] = 1; F[i] = NaN; continue; }
    const x = i % w, y = (i / w) | 0; let edge = x === 0 || y === 0 || x === w-1 || y === h-1;
    if (!edge) for (const [dx,dy] of NB8){ if (!Number.isFinite(z[(y+dy)*w + x+dx])){ edge = true; break; } }
    if (edge){ F[i] = z[i]; done[i] = 1; hp.push(z[i], i); }
  }
  while (hp.n){
    const c = hp.pop(); order[on++] = c;
    const x = c % w, y = (c / w) | 0, fc = F[c];
    for (const [dx,dy] of NB8){
      const nx = x+dx, ny = y+dy; if (nx<0||ny<0||nx>=w||ny>=h) continue;
      const n = ny*w+nx; if (done[n]) continue; done[n] = 1;
      const zn = z[n], lim = fc + 1e-5*(Math.abs(fc)+1)*1e-1 + 1e-6;
      F[n] = zn > lim ? zn : lim;
      hp.push(F[n], n);
    }
  }
  return {F, order: order.subarray(0, on)};
}
function d8(F, w, h, dx, dy){
  const N = w*h, rcv = new Int32Array(N).fill(-1), rd = new Float32Array(N), dd = Math.hypot(dx, dy);
  for (let i = 0; i < N; i++){
    const fi = F[i]; if (!Number.isFinite(fi)) continue;
    const x = i % w, y = (i / w) | 0; let best = 0, bj = -1, bdist = 0;
    for (const [ex,ey] of NB8){
      const nx = x+ex, ny = y+ey; if (nx<0||ny<0||nx>=w||ny>=h) continue;
      const n = ny*w+nx, fn = F[n]; if (!Number.isFinite(fn)) continue;
      const dist = ex && ey ? dd : ex ? dx : dy, s = (fi - fn)/dist;
      if (s > best){ best = s; bj = n; bdist = dist; }
    }
    rcv[i] = bj; rd[i] = bdist;
  }
  return {rcv, rd};
}
