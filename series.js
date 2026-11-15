/* ===================== Multi-date change: auto-aligned time series ===================== */
G.series = []; G.tl = 0; G.sv = null;
const yearFrom = name => { const m = String(name || "").match(/(?:^|[^0-9])((?:19|20)\d{2})(?:[^0-9]|$)/); return m ? +m[1] : null; };
/** detect phone/map chrome in any RGBA image → valid mask (1 = usable) */
function chromeValid(rgba, w, h){
  const v = new Uint8Array(w*h).fill(1), ui = new Uint8Array(w*h), rowF = new Float32Array(h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){ const i = y*w+x, r = rgba[i*4], g = rgba[i*4+1], b = rgba[i*4+2], mx = Math.max(r,g,b), mn = Math.min(r,g,b); if (mx-mn <= 12 && mx >= 12 && mx <= 62){ ui[i] = 1; rowF[y]++; } if (!rgba[i*4+3]) v[i] = 0; }
  let top = 0, bot = h; for (let y = 0; y < Math.floor(h*.22); y++) if (rowF[y]/w > UIROW) top = y+1; for (let y = h-1; y > Math.floor(h*.7); y--) if (rowF[y]/w > UIROW) bot = y;
  if (top) top = Math.min(h-10, top + Math.round(h*.004) + 2); if (bot < h) bot = Math.max(top+10, bot - Math.round(h*.004) - 2);
  for (let y = 0; y < h; y++) if (y < top || y >= bot) for (let x = 0; x < w; x++) v[y*w+x] = 0;
  const {comps} = label(ui, w, h), amin = (w*.03)**2, amax = (w*.22)**2;
  for (const cp of comps){ const bw = cp.x1-cp.x0+1, bh = cp.y1-cp.y0+1, cx = cp.sx/cp.area, cy = cp.sy/cp.area;
    if (cp.area < amin*.5 || bw*bh > amax || cy < top || cy > bot || cp.area/(bw*bh) < .45 || Math.max(bw, bh)/Math.min(bw, bh) > 2.2 || !(cx > w*.78 || cx < w*.22)) continue;
    const pad = Math.round(Math.max(bw, bh)*.15) + 2; for (let y = Math.max(0, cp.y0-pad); y <= Math.min(h-1, cp.y1+pad); y++) for (let x = Math.max(0, cp.x0-pad); x <= Math.min(w-1, cp.x1+pad); x++) v[y*w+x] = 0; }
  return v;
}
function refValid(){
  const w = G.w, h = G.h, r = roiOrFull(), v = new Uint8Array(w*h);
  for (let y = r.y0; y < r.y1; y++) for (let x = r.x0; x < r.x1; x++){ const i = y*w+x; v[i] = G.excl[i] || !G.D.rgba[i*4+3] ? 0 : 1; }
  return v;
}
async function addSeriesFiles(files){
  if (!G.D) return toast("Open the first image first");
  if (G.D.kind === "dem") return toast("Change over time needs imagery, not a DEM");
  await busy("Aligning " + files.length + " image" + (files.length > 1 ? "s" : "") + "…", async () => {
    for (const f of files){
      let src;
      if (/\.tiff?$/i.test(f.name)){ const T = await readTIFF(await f.arrayBuffer()); src = fromTiffImagery(T, f.name); }
      else { const img = await loadImg(f); src = fromBitmap(img); src.name = f.name; }
      const it = {id: Math.random().toString(36).slice(2, 8), name: f.name, src, year: yearFrom(f.name), adj: {dx:0, dy:0, ds:0, dr:0}};
      it.validB = chromeValid(src.rgba, src.w, src.h);
      await tick(); alignItem(it); G.series.push(it);
    }
    G.sv = null; renderSeries(); setTimeline(G.series.length);
    if (G._fromReport){ G._fromReport = false; try { analyzeSeries(); } catch(e){ toast(e.message); } renderReportChange(); }
  });
}
function alignItem(it){
  const src = it.src, A = G.D;
  let M = null, info = {};
  if (A.geo && A.geo.tie && src.geo && src.geo.tie && A.geo.scale && src.geo.scale && (!A.geo.epsg || A.geo.epsg === src.geo.epsg)){
    // both georeferenced: exact mapping from coordinates
    const fa = A.f, fb = src.f, sxA = A.geo.scale[0]*fa, syA = A.geo.scale[1]*fa, sxB = src.geo.scale[0]*fb, syB = src.geo.scale[1]*fb;
    const a = sxB/sxA, d = syB/syA, e = (src.geo.tie[3] - A.geo.tie[3])/sxA, f = (A.geo.tie[4] - src.geo.tie[4])/syA;
    M = [a, 0, 0, d, e, f]; info = {method:"georeference", conf:1, scale:a, rot:0, overlapFrac:NaN};
  } else {
    const gA = alGrad(A.rgba, G.w, G.h, refValid()), gB = alGrad(src.rgba, src.w, src.h, it.validB);
    const r = alignSimilarity(gA, G.w, G.h, gB, src.w, src.h);
    M = r.M; info = {method:"image matching", conf:r.conf, scale:r.scale, rot:r.rot, overlapFrac:r.overlapFrac};
  }
  it.M0 = M; it.info = info; warpItem(it);
}
function composeAdj(M, adj){
  // manual tweak about the image centre: x' = Rθ·S·(x − c) + c + d
  const c = [G.w/2, G.h/2], s = 1 + adj.ds/100, th = adj.dr*Math.PI/180, ca = Math.cos(th)*s, sa = Math.sin(th)*s;
  const [a, b, cc, d, e, f] = M;
  const na = ca*a - sa*b, nb = sa*a + ca*b, nc = ca*cc - sa*d, nd = sa*cc + ca*d;
  const ne = ca*(e - c[0]) - sa*(f - c[1]) + c[0] + adj.dx, nf = sa*(e - c[0]) + ca*(f - c[1]) + c[1] + adj.dy;
  return [na, nb, nc, nd, ne, nf];
}
function warpItem(it){
  const src = it.src, w = G.w, h = G.h, M = composeAdj(it.M0, it.adj);
  const cB = document.createElement("canvas"); cB.width = src.w; cB.height = src.h; cB.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(src.rgba), src.w, src.h), 0, 0);
  const vB = document.createElement("canvas"); vB.width = src.w; vB.height = src.h; const vctxB = vB.getContext("2d"), vid = vctxB.createImageData(src.w, src.h);
  for (let i = 0; i < src.w*src.h; i++){ const o = it.validB[i] ? 255 : 0; vid.data[i*4] = vid.data[i*4+1] = vid.data[i*4+2] = 255; vid.data[i*4+3] = o; }
  vctxB.putImageData(vid, 0, 0);
  const out = document.createElement("canvas"); out.width = w; out.height = h; const oc = out.getContext("2d", {willReadFrequently:true});
  oc.imageSmoothingQuality = "high"; oc.setTransform(...M); oc.drawImage(cB, 0, 0); oc.setTransform(1,0,0,1,0,0);
  const rgba = oc.getImageData(0, 0, w, h).data;
  oc.clearRect(0, 0, w, h); oc.setTransform(...M); oc.drawImage(vB, 0, 0); oc.setTransform(1,0,0,1,0,0);
  const vd = oc.getImageData(0, 0, w, h).data, valid = new Uint8Array(w*h), rv = refValid();
  let nv = 0; for (let i = 0; i < w*h; i++){ valid[i] = vd[i*4+3] > 200 && rv[i] ? 1 : 0; nv += valid[i]; if (!valid[i]) rgba[i*4+3] = rgba[i*4+3] && vd[i*4+3] > 20 ? rgba[i*4+3] : 0; }
  it.M = M; it.D = {w, h, rgba, kind:"image", name: it.name}; it.valid = valid; it.overlap = nv/Math.max(1, rv.reduce((s, v) => s+v, 0));
  // alignment quality on the final warp
  const gA = alGrad(G.D.rgba, w, h, rv), gB = alGrad(rgba, w, h, valid); let sa = 0, sb = 0, n = 0;
  for (let i = 0; i < w*h; i += 2) if (valid[i]){ sa += gA[i]; sb += gB[i]; n++; }
  const ma = sa/n, mb = sb/n; let ab = 0, aa = 0, bb = 0; for (let i = 0; i < w*h; i += 2) if (valid[i]){ const p = gA[i]-ma, q = gB[i]-mb; ab += p*q; aa += p*p; bb += q*q; }
  it.conf = n > 100 ? ab/Math.sqrt(aa*bb + 1e-12) : 0;
}
function confLabel(c){ return c > .45 ? ["good", "#5bd17a"] : c > .25 ? ["fair", "#e8c547"] : ["poor: check this is the same place", "#ff6b6b"]; }
function renderSeries(){
  const el = $("serList"); if (!el) return;
  if (!G.series.length){ el.innerHTML = '<p class="note">No other dates yet.</p>'; return; }
  el.innerHTML = G.series.map((it, i) => { const [cl, col] = confLabel(it.conf); return `<div class="seri${G.tl === i+1 ? " on" : ""}" data-i="${i}">
    <div class="sh"><b>${it.name}</b><button class="sm" data-rm="${i}">✕</button></div>
    <div class="row" style="margin:4px 0"><label>Year</label><input type="number" step="any" data-yr="${i}" value="${it.year ?? ""}" placeholder="e.g. 2019"></div>
    <div class="note" style="margin:0">Aligned by ${it.info.method}: scale ×${(it.info.scale || 1).toFixed(3)}, rotation ${fx(it.info.rot || 0, 1)}°, overlap ${(it.overlap*100).toFixed(0)}% · match <span style="color:${col}">${fx(it.conf, 2)} ${cl}</span></div>
    <div class="btns" style="margin:4px 0 0"><button class="sm" data-show="${i}">Show</button><button class="sm" data-tune="${i}">Fine-tune</button></div></div>`; }).join("");
  el.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { G.series.splice(+b.dataset.rm, 1); G.sv = null; renderSeries(); setTimeline(0); });
  el.querySelectorAll("[data-yr]").forEach(b => b.oninput = () => { G.series[+b.dataset.yr].year = parseFloat(b.value); setTimeline(G.tl); });
  el.querySelectorAll("[data-show]").forEach(b => b.onclick = () => setTimeline(+b.dataset.show + 1));
  el.querySelectorAll("[data-tune]").forEach(b => b.onclick = () => { G.tuneI = +b.dataset.tune; const a = G.series[G.tuneI].adj; ["dx","dy","ds","dr"].forEach(k => { $("adj_" + k).value = a[k]; $("adj_" + k + "O").textContent = a[k]; }); $("tuneBox").style.display = "block"; $("tuneName").textContent = G.series[G.tuneI].name; setTimeline(G.tuneI + 1); });
  $("tlIdx").max = G.series.length;
}
function setTimeline(i){
  G.tl = clamp(i, 0, G.series.length); $("tlIdx").value = G.tl;
  const it = G.tl ? G.series[G.tl-1] : null;
  $("tlIdxO").textContent = it ? (it.year || it.name) : ($("yrRef").value || "reference");
  paintBase(); renderSeriesHighlight();
}
function renderSeriesHighlight(){ document.querySelectorAll(".seri").forEach(e => e.classList.toggle("on", +e.dataset.i === G.tl-1)); }
["dx","dy","ds","dr"].forEach(k => {
  const el = $("adj_" + k); if (!el) return;
  el.oninput = () => { $("adj_" + k + "O").textContent = el.value; const it = G.series[G.tuneI]; if (!it) return; it.adj[k] = +el.value; clearTimeout(el._t); el._t = setTimeout(() => { warpItem(it); paintBase(); renderSeries(); }, 120); };
});

/* ---------- per-date and per-interval analysis ---------- */
/** learn this date's water colours from the reference mask (robust to colour, season and lighting shifts) */
function transferModel(D, valid){
  const w = G.w, h = G.h, L = ensureLab(D), r = roiOrFull(), ref = G.mask;
  const ok = i => valid[i] && !G.excl[i] && D.rgba[i*4+3];
  const tot = (r.x1-r.x0)*(r.y1-r.y0), st = Math.max(1, Math.floor(Math.sqrt(tot/30000))), smp = [];
  for (let y = r.y0; y < r.y1; y += st) for (let x = r.x0; x < r.x1; x += st){ const i = y*w+x; if (ok(i)) smp.push(L[i*3], L[i*3+1], L[i*3+2]); }
  if (smp.length < 300) return null;
  const K = 10, C = kmeans(Float64Array.from(smp), K, 16), wn = new Float64Array(K), nn = new Float64Array(K);
  for (let y = r.y0; y < r.y1; y++) for (let x = r.x0; x < r.x1; x++){
    const i = y*w+x; if (!ok(i)) continue; let bb = 0, bd = Infinity;
    for (let c = 0; c < K; c++){ const d = (L[i*3]-C[c*3])**2*.5 + (L[i*3+1]-C[c*3+1])**2 + (L[i*3+2]-C[c*3+2])**2; if (d < bd){ bd = d; bb = c; } }
    nn[bb]++; if (ref[i]) wn[bb]++;
  }
  const water = Array.from(wn, (v, c) => nn[c] > 0 && v/nn[c] > .5);
  if (!water.some(Boolean)) return null;
  return {C, water};
}
function maskForDate(D, valid){
  const w = G.w, h = G.h;
  if ($("bAuto").checked){
    const model = transferModel(D, valid) || G.autoC;
    if (model){
      const P = waterProb(D, {mode:"clusters", model});
      let m = hysteresis(P, w, h, +$("wHyst").value/100, $("wRidge").checked);
      const r = roiOrFull(); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){ const i = y*w+x; if (x < r.x0 || x >= r.x1 || y < r.y0 || y >= r.y1 || G.excl[i] || !valid[i]) m[i] = 0; }
      m = cleanMask(m, w, h); m = dropTowns(D, m, w, h); const bm = bridgeGaps(m, w, h, +$("wBridge").value, P).m; return +$("wBridge").value > 0 ? connectToMain(bm, w, h, P, 18*+$("wBridge").value).m : bm;
    }
  }
  const md = waterModel(D, valid); if (!md.skip) return classify(D, {valid, mode: "clusters", model: md});
  return classify(D, {valid});
}
function skeletonForDate(mask, refNet){
  const w = G.w, h = G.h, {L, comps} = label(mask, w, h);
  let cid = 0;
  if (refNet){ const ov = new Float64Array(comps.length+1); for (let i = 0; i < L.length; i++) if (L[i] && refNet[i]) ov[L[i]]++; let b = 0; for (let k = 1; k < ov.length; k++) if (ov[k] > b){ b = ov[k]; cid = k; } }
  if (!cid && comps.length) cid = comps.reduce((a, b) => b.area > a.area ? b : a).id;
  if (!cid) return null;
  const net = new Uint8Array(w*h); for (let i = 0; i < net.length; i++) net[i] = L[i] === cid ? 1 : 0;
  const hw = edtTo(notMask(net), w, h); const sk = pruneSkeleton(thin(net, w, h), w, h, hw, +$("pruneK").value/10 || 1.5, []);
  return {net, hw, sk};
}
/** reference-path indices from each end where every date has a centreline nearby (inside the common footprint) */
function commonEnds(dates, refPath, cv){
  const w = G.w, h = G.h, P = refPath.pts, n = P.length, rad = Math.max(8, Math.round(3*refPath.W)), st = Math.max(1, Math.round(refPath.W/2));
  const ok = p => { const i = Math.round(p[1])*w + Math.round(p[0]); if (!cv[i]) return false; return dates.every(d => d.skel && nearestOn(d.skel.sk, w, h, p[0], p[1], rad) >= 0); };
  let ta = -1, tb = -1;
  for (let t = 0; t < n*.45; t += st) if (ok(P[t])){ ta = t; break; }
  for (let t = n-1; t > n*.55; t -= st) if (ok(P[t])){ tb = t; break; }
  return ta >= 0 && tb >= 0 ? {a: P[ta], b: P[tb], rad} : null;
}
/** route that prefers the wide channel AND stays close to the reference centreline, so every date follows the same river course */
function guidedPath(s, w, h, src, dst, halfW, dRef, W){
  const N = w*h, dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), hp = new Heap(1024);
  dist[src] = 0; hp.push(0, src);
  while (hp.n){
    const p = hp.pop(), d = hp.topKey; if (d > dist[p]) continue; if (p === dst) break;
    const x = p % w, y = (p/w)|0;
    for (const [dx,dy] of NB8){
      const nx = x+dx, ny = y+dy; if (nx<0||ny<0||nx>=w||ny>=h) continue;
      const q = ny*w+nx; if (!s[q]) continue; const off = dRef ? dRef[q]/(3*W) : 0;
      const nd = d + (dx && dy ? SQ2 : 1)/Math.max(1, halfW[q])*(1 + off*off);
      if (nd < dist[q]){ dist[q] = nd; prev[q] = p; hp.push(nd, q); }
    }
  }
  if (!Number.isFinite(dist[dst])) return null;
  const path = []; for (let p = dst; p >= 0; p = prev[p]) path.push(p); return path.reverse();
}
function centrelineForDate(skel, ends, dRef, W){
  const w = G.w, h = G.h; if (!skel || !ends) return null;
  const {sk, hw} = skel, a = nearestOn(sk, w, h, ends.a[0], ends.a[1], ends.rad), b = nearestOn(sk, w, h, ends.b[0], ends.b[1], ends.rad);
  if (a < 0 || b < 0) return null;
  let path = dRef ? guidedPath(sk, w, h, a, b, hw, dRef, W) : widestPath(sk, w, h, a, b, hw);
  if (!path || path.length < 20){ const {prev} = skelDijkstra(sk, w, h, a); path = []; for (let p = b; p >= 0; p = prev[p]) path.push(p); path.reverse(); }
  if (path.length < 20) return null;
  return path;
}
function nearestIdx(ptsB){
  const cell = 8, grid = new Map();
  ptsB.forEach((p, i) => { const k = Math.floor(p[0]/cell) + "," + Math.floor(p[1]/cell); (grid.get(k) || grid.set(k, []).get(k)).push(i); });
  return (x, y, maxR) => { let best = -1, bd = Infinity; const R = Math.ceil(maxR/cell), cx = Math.floor(x/cell), cy = Math.floor(y/cell);
    for (let r = 0; r <= R; r++){ for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++){ if (Math.max(Math.abs(a), Math.abs(b)) !== r) continue; const L = grid.get((cx+a) + "," + (cy+b)); if (!L) continue; for (const i of L){ const d = (ptsB[i][0]-x)**2 + (ptsB[i][1]-y)**2; if (d < bd){ bd = d; best = i; } } } if (best >= 0 && Math.sqrt(bd) < (r)*cell) break; }
    return best >= 0 ? {i: best, d: Math.sqrt(bd)} : null; };
}
function analyzeSeries(){
  if (!G.mask) throw new Error("Detect water on the first image first");
  if (!G.series.length) throw new Error("Add at least one image from another date");
  const w = G.w, h = G.h, yr0 = parseFloat($("yrRef").value);
  const ref = {name: G.D.name, year: Number.isFinite(yr0) ? yr0 : null, D: G.D, valid: refValid(), ref:true};
  let dates = [ref, ...G.series.map(it => ({name: it.name, year: Number.isFinite(it.year) ? it.year : null, D: it.D, valid: it.valid, it}))];
  const haveYears = dates.every(d => d.year !== null);
  if (haveYears) dates.sort((a, b) => a.year - b.year);
  if (!G.chan && !G.autoLog){ try { analyzeChannel(); } catch(e){} }
  const refNet = G.prep ? G.prep.net : null, refPath = G.chan;
  // common footprint across all dates
  const cv = new Uint8Array(w*h); for (let i = 0; i < cv.length; i++){ let ok = 1; for (const d of dates) if (!d.valid[i]){ ok = 0; break; } cv[i] = ok; }
  let cvN = 0; for (const v of cv) cvN += v;
  for (const d of dates){
    d.mask = d.ref ? G.mask : maskForDate(d.D, d.valid);
    let a = 0; for (let i = 0; i < cv.length; i++) if (cv[i] && d.mask[i]) a++; d.waterCommon = a;
    d.skel = skeletonForDate(d.mask, refNet);
  }
  const ends = refPath ? commonEnds(dates, refPath, cv) : null;
  let dRef = null; if (refPath){ const mk = new Uint8Array(w*h); refPath.pts.forEach(p => mk[Math.round(p[1])*w + Math.round(p[0])] = 1); dRef = edtTo(mk, w, h); }
  for (const d of dates){
    const path = centrelineForDate(d.skel, ends, d.ref ? null : dRef, refPath ? refPath.W : 4); d.path = null;
    if (path){ const m0 = G.mask; G.mask = d.mask; d.path = analyzePath(path, d.skel.hw); G.mask = m0; d.path.necks = findNecks(d.path); }
  }
  // comparison mode: follow a river centreline only when the scene is a river traced in every date; otherwise compare shorelines and areas
  let riverMode = !!refPath && dates.every(d => d.path) && !["lakes","delta","coast"].includes(G.focusEff) && refPath.W < .035*Math.min(w, h), routeBad = false, intervals = [];
  for (let pass = 0; pass < 2; pass++){
  intervals = [];
  for (let k = 0; k+1 < dates.length; k++){
    const A = dates[k], B = dates[k+1], yrs = haveYears ? B.year - A.year : null, iv = {a:k, b:k+1, yrs};
    // if a date has no centreline, compare paths with the nearest earlier date that has one
    let Ap = A; for (let q = k; q >= 0 && !Ap.path; q--) Ap = dates[q];
    iv.pathFrom = Ap; iv.pathYrs = haveYears ? B.year - Ap.year : null;
    // raw pixel differences, then keep only real change: thin bank-edge slivers (≤ 1–2 px, from blur/alignment) and specks are dropped
    const eM = new Uint8Array(w*h), dM = new Uint8Array(w*h); let both = 0, eroRaw = 0, depRaw = 0;
    for (let i = 0; i < eM.length; i++){ if (!A.valid[i] || !B.valid[i]) continue; both++; if (B.mask[i] && !A.mask[i]){ eM[i] = 1; eroRaw++; } else if (A.mask[i] && !B.mask[i]){ dM[i] = 1; depRaw++; } }
    const Wc = G.chan ? G.chan.W : 6, minA = Math.max(12, .5*Wc*Wc);
    // if the river simply looks wider in one image (water level, blur), each bank gets a uniform strip of half the width difference: ignore strips that thin
    const wA = (A.path || {}).W, wB = (B.path || {}).W, dW = wA && wB ? Math.abs(wA - wB)/2 : 0, rr = Math.max(Wc > 8 ? 1.5 : 1, .9*dW + .75);
    iv.stripIgnored = rr;
    // only count change in the corridor of the main river (both dates' centrelines ± 6 channel widths): tributaries or towns detected in one image only would otherwise swamp it
    if (riverMode && (Ap.path || B.path)){ const mk = new Uint8Array(w*h); [Ap.path, B.path].forEach(pth => pth && pth.pts.forEach(p => mk[Math.round(p[1])*w + Math.round(p[0])] = 1)); const cor = dilate(mk, w, h, 6*Wc);
      for (let i = 0; i < eM.length; i++) if (!cor[i]){ eM[i] = 0; dM[i] = 0; } iv.corridor = true; eroRaw = eM.reduce((a, v) => a + v, 0); depRaw = dM.reduce((a, v) => a + v, 0); }
    const eF = removeSmall(opening(eM, w, h, rr), w, h, minA), dF = removeSmall(opening(dM, w, h, rr), w, h, minA);
    const map = new Uint8Array(w*h); let ero = 0, dep = 0;
    for (let i = 0; i < map.length; i++){ if (eF[i]){ map[i] = 1; ero++; } else if (dF[i]){ map[i] = 2; dep++; } }
    Object.assign(iv, {map, ero, dep, eroRaw, depRaw, area: both});
    iv.events = changeEvents(eF, dF, cvN);
    iv.shore = shoreStats(A, B, cv);
    if (Ap.path && B.path){
      const pa = Ap.path, pb = B.path, W = pa.W; iv.yrs = iv.pathYrs;
      const mkA = new Uint8Array(w*h), mkB = new Uint8Array(w*h);
      pa.pts.forEach(p => mkA[Math.round(p[1])*w + Math.round(p[0])] = 1); pb.pts.forEach(p => mkB[Math.round(p[1])*w + Math.round(p[0])] = 1);
      const dA = edtTo(mkA, w, h), dB = edtTo(mkB, w, h), s1 = [], s2 = [];
      pb.pts.forEach(p => { const i = Math.round(p[1])*w + Math.round(p[0]); if (Ap.valid[i] && B.valid[i]) s1.push(dA[i]); });
      pa.pts.forEach(p => { const i = Math.round(p[1])*w + Math.round(p[0]); if (Ap.valid[i] && B.valid[i]) s2.push(dB[i]); });
      const capS = 4*W, f1 = s1.filter(v => v <= capS), f2 = s2.filter(v => v <= capS);
      iv.shift = (median(f1) + median(f2))/2; iv.p90 = quantile(f1.concat(f2), .9); iv.W = W;
      // migration vectors along the earlier centreline, decomposed per bend
      const near = nearestIdx(pb.pts), vecs = [], stepI = Math.max(2, Math.round(W)), maxR = Math.max(20, 15*W);
      for (let i = 2; i < pa.pts.length-2; i += stepI){
        const p = pa.pts[i], q = near(p[0], p[1], maxR); if (!q || q.d > maxR) continue;
        const ii = Math.round(p[1])*w + Math.round(p[0]); if (!(Ap.valid[ii] && B.valid[ii])) continue;
        const t0 = [pa.xs[Math.min(i+2, pa.xs.length-1)] - pa.xs[i-2], pa.ys[Math.min(i+2, pa.ys.length-1)] - pa.ys[i-2]], tl = Math.hypot(...t0) || 1, t = [t0[0]/tl, t0[1]/tl], nrm = [-t[1], t[0]];
        const v = [pb.pts[q.i][0] - p[0], pb.pts[q.i][1] - p[1]], kk = pa.k[i] || 0;
        const out = kk >= 0 ? [-nrm[0], -nrm[1]] : nrm; // outer bank is away from the centre of curvature
        vecs.push({i, p, v, d: q.d, exp: v[0]*out[0] + v[1]*out[1], tr: -(v[0]*t[0] + v[1]*t[1]), k: Math.abs(kk)});
      }
      iv.vecs = vecs;
      // hotspots: largest movements, at least 12 channel widths apart along the channel
      const hs = [], cap = 4*W;
      // big moves: was the old course abandoned (no longer water) → a real cutoff / avulsion; still water → the traces just took different branches
      const big = vecs.filter(m => m.d > cap), aband = big.filter(m => { const i = Math.round(m.p[1])*w + Math.round(m.p[0]); return !B.mask[i]; });
      iv.routeDiff = (big.length - aband.length)/Math.max(1, vecs.length); iv.abandoned = aband.length/Math.max(1, vecs.length);
      { const seen = []; for (const m of aband.sort((p, q) => q.d - p.d)){ if (seen.some(x => Math.abs(pa.s[x.i] - pa.s[m.i]) < 25*W)) continue; seen.push(m); if (seen.length >= 3) break; }
        iv.reroutes = seen.map(m => ({i: m.i, p: m.p, d: m.d, v: m.v, sAlong: pa.s[m.i]})); }
      const nearRR = i => (iv.reroutes || []).some(r => Math.abs(pa.s[r.i] - pa.s[i]) < 40*W) || aband.some(a => Math.abs(pa.s[a.i] - pa.s[i]) < 10*W);
      for (const m of vecs.slice().sort((p, q) => q.d - p.d)){
        if (m.d > cap || nearRR(m.i)) continue;
        if (m.d < Math.max(2, .5*W) || hs.length >= 5) break;
        if (hs.some(x => Math.abs(pa.s[x.i] - pa.s[m.i]) < 12*W)) continue;
        hs.push({i: m.i, p: m.p, d: m.d, v: m.v, exp: m.exp, tr: m.tr, sAlong: pa.s[m.i]});
      }
      iv.hot = hs;
      const bendRows = [];
      for (const bd of pa.bends){
        const vs = vecs.filter(x => x.i >= bd.i0 && x.i <= bd.i1); if (vs.length < 2) continue;
        bendRows.push({RW: bd.Rc/W, mig: mean(vs.map(x => x.d)), exp: mean(vs.map(x => x.exp)), tr: mean(vs.map(x => x.tr))});
      }
      iv.bends = bendRows;
      // cutoffs: an earlier neck that the later channel now passes straight through
      iv.cutoffs = (pa.necks || []).filter(nk => nk.ratio <= 1.5).filter(nk => {
        const mid = [(nk.a[0]+nk.b[0])/2, (nk.a[1]+nk.b[1])/2], q = near(mid[0], mid[1], 3*W); if (!q || q.d > Math.max(1.2*W, 3)) return false;
        const loopPts = pa.pts.slice(nk.i, nk.j).filter((_, t) => t % 4 === 0); const dd = loopPts.map(p => { const r = near(p[0], p[1], 20*W); return r ? r.d : 1e9; });
        return median(dd) > 2*W;
      }).map(nk => ({mid: [(nk.a[0]+nk.b[0])/2, (nk.a[1]+nk.b[1])/2], loop: nk.loop}));
    }
    intervals.push(iv);
  }
  if (riverMode && intervals.some(x => (x.routeDiff || 0) > .3)){ routeBad = true; riverMode = false; continue; }
  break;
  }
  G.sv = {dates, intervals, cv, cvN, haveYears, sel: Math.max(0, intervals.length - 1), mode: riverMode ? "river" : "shore", routeBad};
  G.hl = "compare"; G.swipe = null;
  renderSeriesResults();
  G.lay.change = true; document.querySelector('.lay[data-k="change"]').classList.add("on");
  rebuildOverlay();
}
function renderSeriesResults(){
  const S = G.sv, sc = G.pxm || 1, un = lenUnit(), dates = S.dates, iv = S.intervals;
  const lab = d => d.year !== null ? String(d.year) : d.name.slice(0, 12);
  const totalYrs = S.haveYears ? dates[dates.length-1].year - dates[0].year : null;
  const allShift = iv.filter(x => Number.isFinite(x.shift));
  const rate = allShift.length && S.haveYears ? allShift.reduce((s, x) => s + x.shift, 0)/allShift.reduce((s, x) => s + x.yrs, 0) : NaN;
  const W = G.chan ? G.chan.W : NaN;
  const cut = iv.reduce((s, x) => s + (x.cutoffs ? x.cutoffs.length : 0), 0);
  const allB = iv.flatMap(x => (x.bends || []).map(b => ({...b, yrs: x.yrs})));
  const expR = S.haveYears ? median(allB.map(b => b.exp/b.yrs)) : NaN, trR = S.haveYears ? median(allB.map(b => b.tr/b.yrs)) : NaN;
  const fTr = allB.length ? allB.filter(b => Math.abs(b.tr) > Math.abs(b.exp)).length/allB.length : NaN;
  const ivS = iv[S.sel] || iv[0], dA = ivS ? dates[ivS.a] : null, dB = ivS ? dates[ivS.b] : null;
  const dirName = a => ["north","north-east","east","south-east","south","south-west","west","north-west"][Math.round(((a % 360) + 360) % 360/45) % 8];
  let story = "";
  const compass = (x, y) => { const dx = x - G.w/2, dy = y - G.h/2; if (Math.hypot(dx, dy) < .12*Math.min(G.w, G.h)) return "near the centre"; return "in the " + dirName(AZ(dx, dy)); };
  const evHTML = ivS && ivS.events && ivS.events.length ? `<p><b>Biggest changes in area</b> (E markers on the map):</p><ol class="hot">${ivS.events.map((e, k) => `<li><button class="sm" data-ev="${k}">Zoom</button> <span style="color:${e.type === "land" ? "#4cd17a" : "#ff4d5e"}">■</span> <b>${U.A(e.area).s}</b> ${e.type === "land" ? "of water became land" : "of land became water"} ${compass(e.cx, e.cy)}</li>`).join("")}</ol>` : "";
  if (ivS && S.mode === "shore"){
    const sh = ivS.shore || {}, yrs = ivS.yrs, net = ivS.dep - ivS.ero;
    story = `<div class="card story"><b>${lab(dA)} → ${lab(dB)}${yrs ? ` · ${fx(yrs, 0)} years` : ""}</b>
      <p class="big">${net >= 0 ? `<span style="color:#4cd17a">+${U.A(net).s} of land</span>` : `<span style="color:#ff4d5e">${U.A(-net).s} of land lost</span>`} overall</p>
      <p><b>${U.A(ivS.dep).s}</b> of water became land and <b>${U.A(ivS.ero).s}</b> of land became water.${S.routeBad ? " The river traces disagreed too much between dates, so this compares water areas and shorelines instead." : ""}</p>
      ${sh.n ? `<p>The water's edge moved a median of <b>${U.L(sh.medAbs).s}</b>; ${(sh.stable*100).toFixed(0)}% of it stayed put (within about a pixel). Where it moved, it built out into the water by up to <b>${U.L(sh.maxAdv).s}</b> and cut back by up to <b>${U.L(sh.maxRet).s}</b>${yrs ? ` (${U.L(sh.maxAdv/yrs).s}/yr and ${U.L(sh.maxRet/yrs).s}/yr)` : ""}.</p>` : ""}
      ${evHTML}
      <p class="note">Map key: <span style="color:#3d8bff">■ ${lab(dA)} shoreline</span> <span style="color:#ffd23f">■ ${lab(dB)} shoreline</span> <span style="color:#4cd17a">■ new land</span> <span style="color:#ff4d5e">■ new water</span>. Drag <b>Before / after</b> to compare the photos.</p></div>`;
  } else if (ivS){
    const yrs = ivS.yrs, pf = ivS.pathFrom || dA;
    story = `<div class="card story"><b>Comparing ${lab(dA)} → ${lab(dB)}${yrs ? ` (${fx(yrs, 0)} years)` : ""}</b>
      <p>Both images were lined up automatically, then the river was detected in each and its centreline traced between the same two points. On the map: <span style="color:#3d8bff">■ blue line = ${lab(pf)}</span>, <span style="color:#ffd23f">■ yellow line = ${lab(dB)}</span>, <span style="color:#ff4d5e">■ red = land that became water</span> (bank erosion or a new channel), <span style="color:#4cd17a">■ green = water that became land</span> (bar growth or abandoned channel). Slide <b>Before / after</b> to compare the two images directly.</p>`;
    if (Number.isFinite(ivS.shift)) story += `<p>The centreline moved a median of <b>${U.L(ivS.shift).s}</b>${yrs ? ` (${U.L(ivS.shift/yrs).s}/yr)` : ""}; 10% of it moved more than ${U.L(ivS.p90).s}. ${ivS.cutoffs && ivS.cutoffs.length ? `<b>${ivS.cutoffs.length} meander cutoff${ivS.cutoffs.length > 1 ? "s" : ""}</b> happened.` : "No meander cutoffs were detected."}</p>`;
    if (ivS.reroutes && ivS.reroutes.length) story += `<p><b>Course changes:</b> in ${ivS.reroutes.length} place${ivS.reroutes.length > 1 ? "s" : ""} the ${lab(ivS.pathFrom || dA)} channel is now dry land and the river runs up to ${U.L(Math.max(...ivS.reroutes.map(r => r.d))).s} away. That's a meander cutoff or channel switch, marked <b>C</b> on the map. ${ivS.reroutes.map((r, k) => `<button class="sm" data-rr="${k}">Zoom to C${k+1}</button>`).join(" ")}</p>`;
    if (ivS.routeDiff > .02) story += `<p class="warn">On ${(ivS.routeDiff*100).toFixed(0)}% of the channel the two traces are more than 4 channel widths apart while both courses still hold water. That's usually a detection difference (one trace went through a side channel), not migration, so those stretches are left out of the rates.</p>`;
    story += `<p>Within the main river corridor, after ignoring thin edge slivers up to ${U.L(2*ivS.stripIgnored).s} thick (${U.A(ivS.eroRaw - ivS.ero + ivS.depRaw - ivS.dep).s} of the raw difference, mostly blur and water-level differences along the banks), <b>${U.A(ivS.ero).s}</b> became water and <b>${U.A(ivS.dep).s}</b> became land.</p>`;
    story += evHTML;
    if (ivS.hot && ivS.hot.length) story += `<p><b>Biggest channel movements</b> (numbered on the map):</p><ol class="hot">${ivS.hot.map((hh, k) => `<li><button class="sm" data-hot="${k}">Zoom</button> moved <b>${U.L(hh.d).s}</b> toward the ${dirName(AZ(hh.v[0], hh.v[1]))}, ${U.L(hh.sAlong).s} along the channel from its downstream end · ${Math.abs(hh.exp) >= Math.abs(hh.tr) ? (hh.exp > 0 ? "outer bank eroding: bend growing" : "bend straightening") : "bend shifting down- or up-valley"}</li>`).join("")}</ol>`;
    story += `</div>`;
  }
  const rows = [
    SEC("Series"),
    R("Dates analysed", U.N(dates.length, 0), dates.map(lab).join(" → ")),
    totalYrs !== null ? R("Time span", U.N(totalYrs, 1, "years")) : R("Years", {v:NaN, u:"", s:"enter years for rates"}),
    R("Common footprint", U.A(S.cvN), "area visible in every image; areas below are compared within it"),
    SEC("Channel migration"),
    R("Mean migration rate", Number.isFinite(rate) ? {v:rate*sc, u:un + "/yr", s:U.L(rate).s + "/yr"} : {v:NaN, u:"", s:"–"}, "centreline shift ÷ years, over all intervals"),
    Number.isFinite(rate) && W ? R("Migration ÷ channel width", U.N(rate/W, 3, "widths/yr")) : null,
    R("Bend expansion rate (median)", Number.isFinite(expR) ? {v:expR*sc, u:un + "/yr", s:U.L(expR).s + "/yr"} : {v:NaN, u:"", s:"–"}, "movement toward the outer bank"),
    R("Downstream translation rate (median)", Number.isFinite(trR) ? {v:trR*sc, u:un + "/yr", s:(trR < 0 ? "−" : "") + U.L(Math.abs(trR)).s + "/yr"} : {v:NaN, u:"", s:"–"}, "positive = bends sliding downstream"),
    R("Bends mainly translating", Number.isFinite(fTr) ? U.P(fTr) : {v:NaN, u:"", s:"–"}, "share of bends moving more along the valley than outward"),
    R("Cutoffs detected", U.N(cut, 0), "earlier necks that the later channel passes straight through"),
    S.haveYears && totalYrs ? R("Alignment uncertainty", {v: (G.pxm || 1)/totalYrs, u: un + "/yr", s: "± " + U.L(1).s + " → ± " + U.L(1/totalYrs).s + "/yr"}, "about 1 pixel of residual misalignment; migration rates smaller than this are not distinguishable from zero") : null,
  ];
  const ws = dates.filter(d => d.path).map(d => d.path.W), wr = ws.length > 1 ? Math.max(...ws)/Math.min(...ws) : 1;
  if (wr > 1.3) rows.push(R("⚠ Water extent differs between dates", U.N(wr, 2, "× width ratio"), "river stage, season or image sharpness differ; area changes are less reliable than centreline migration"));
  const tbl1 = `<h4>By date</h4><div style="overflow:auto"><table class="grid"><tr><th>date</th><th>water</th><th>length</th><th>sinuosity</th><th>width</th><th>bends</th><th>necks</th></tr>${dates.map(d => `<tr><td>${lab(d)}</td><td>${U.A(d.waterCommon).s}</td><td>${d.path ? U.L(d.path.len).s : "–"}</td><td>${d.path ? (d.path.len/d.path.straight).toFixed(2) : "–"}</td><td>${d.path ? U.L(d.path.W).s : "–"}</td><td>${d.path ? d.path.bends.length : "–"}</td><td>${d.path ? d.path.necks.filter(n => n.ratio <= 1.5).length : "–"}</td></tr>`).join("")}</table></div>`;
  const tbl2 = `<h4>By interval</h4><div style="overflow:auto"><table class="grid"><tr><th>interval</th><th>eroded</th><th>deposited</th><th>shift</th><th>rate</th><th>cutoffs</th></tr>${iv.map((x, i) => `<tr><td><button class="sm" data-iv="${i}">${lab(dates[x.a])}→${lab(dates[x.b])}</button></td><td>${U.A(x.ero).s}</td><td>${U.A(x.dep).s}</td><td>${Number.isFinite(x.shift) ? U.L(x.shift).s : "–"}</td><td>${Number.isFinite(x.shift) && x.yrs ? U.L(x.shift/x.yrs).s + "/yr" : "–"}</td><td>${x.cutoffs ? x.cutoffs.length : "–"}</td></tr>`).join("")}</table></div><p class="note">Tap an interval to map its erosion (red), deposition (green) and migration arrows.</p>`;
  S.storyHTML = story;
  if (typeof renderReportChange === "function") renderReportChange();
  showRes("change", rows, tbl1 + tbl2 + `<canvas class="chart" id="chTS"></canvas><canvas class="chart" id="chSin"></canvas><canvas class="chart" id="chCM"></canvas>`);
  $("res-change").insertAdjacentHTML("afterbegin", story);
  $("res-change").querySelectorAll("[data-iv]").forEach(b => b.onclick = () => { G.sv.sel = +b.dataset.iv; G.hl = "compare"; renderSeriesResults(); rebuildOverlay(); toast("Showing " + b.textContent); window.scrollTo({top:0, behavior:"smooth"}); });
  $("res-change").querySelectorAll("[data-rr]").forEach(b => b.onclick = () => { const hh = ivS.reroutes[+b.dataset.rr]; zoomTo(hh.p[0], hh.p[1], 30*(ivS.W || 6)); G.hl = "compare"; requestDraw(); window.scrollTo({top:0, behavior:"smooth"}); });
  $("res-change").querySelectorAll("[data-ev]").forEach(b => b.onclick = () => { const e = ivS.events[+b.dataset.ev]; zoomTo(e.cx, e.cy, 1.8*Math.max(e.x1 - e.x0, e.y1 - e.y0, 40)); G.hl = "compare"; requestDraw(); window.scrollTo({top:0, behavior:"smooth"}); });
  $("res-change").querySelectorAll("[data-hot]").forEach(b => b.onclick = () => { const hh = ivS.hot[+b.dataset.hot]; zoomTo(hh.p[0], hh.p[1], 18*(ivS.W || 6)); G.hl = "compare"; requestDraw(); window.scrollTo({top:0, behavior:"smooth"}); });
  const xs = dates.map((d, i) => d.year !== null ? d.year : i);
  const sc2 = G.pxm ? G.pxm*G.pxm/1e6 : 1;
  chart($("chTS"), {title:"Water area in the common footprint", xlab: S.haveYears ? "year" : "image", ylab: G.pxm ? "km²" : "px²", series:[{x:xs, y:dates.map(d => d.waterCommon*sc2), color:"#3fc1d3", dots:true}, {x:xs, y:dates.map(d => d.waterCommon*sc2), color:"#3fc1d3"}]});
  chart($("chSin"), {title:"Main-channel sinuosity", xlab: S.haveYears ? "year" : "image", ylab:"sinuosity", series:[{x:xs, y:dates.map(d => d.path ? d.path.len/d.path.straight : NaN), color:"#ff7a45", dots:true}, {x:xs, y:dates.map(d => d.path ? d.path.len/d.path.straight : NaN), color:"#ff7a45"}]});
  if (allB.length && S.haveYears){
    const pts = allB.filter(b => Number.isFinite(b.RW) && b.RW > 0).map(b => [b.RW, b.mig/b.yrs/W]);
    const edges = [.5, 1, 1.5, 2, 2.5, 3, 4, 5, 7, 10, 20], bx = [], by = [];
    for (let i = 0; i+1 < edges.length; i++){ const v = pts.filter(p => p[0] >= edges[i] && p[0] < edges[i+1]).map(p => p[1]); if (v.length >= 2){ bx.push(Math.sqrt(edges[i]*edges[i+1])); by.push(median(v)); } }
    G.sv.cm = {bx, by}; const pk = by.length ? bx[by.indexOf(Math.max(...by))] : NaN; G.sv.cmPeak = pk;
    chart($("chCM"), {title:"Migration vs bend tightness" + (Number.isFinite(pk) ? ` (peak near R/W ≈ ${pk.toFixed(1)})` : ""), xlab:"bend radius ÷ width (R/W)", ylab:"migration (widths/yr)", logx:true,
      series:[{x:pts.map(p => p[0]), y:pts.map(p => p[1]), color:"rgba(158,202,225,.5)", dots:true, r:2.5}, {x:bx, y:by, color:"#ff7a45"}]});
  }
  G.tables.seriesDates = dates.map(d => ({date: lab(d), water_common: d.waterCommon*(G.pxm ? G.pxm**2 : 1), channel_length: d.path ? d.path.len*sc : "", sinuosity: d.path ? d.path.len/d.path.straight : "", median_width: d.path ? d.path.W*sc : "", bends: d.path ? d.path.bends.length : "", necks_narrow: d.path ? d.path.necks.filter(n => n.ratio <= 1.5).length : ""}));
  G.tables.seriesIntervals = iv.map(x => ({from: lab(dates[x.a]), to: lab(dates[x.b]), years: x.yrs ?? "", eroded: x.ero*(G.pxm ? G.pxm**2 : 1), deposited: x.dep*(G.pxm ? G.pxm**2 : 1), centreline_shift: Number.isFinite(x.shift) ? x.shift*sc : "", rate_per_yr: Number.isFinite(x.shift) && x.yrs ? x.shift*sc/x.yrs : "", cutoffs: x.cutoffs ? x.cutoffs.length : ""}));
}
$("btnAddDates").onclick = () => { if (!G.D) return toast("Open the first image first"); $("fileB").click(); };
$("fileB").onchange = e => { const fs = [...e.target.files]; if (fs.length) addSeriesFiles(fs); e.target.value = ""; };
$("tlIdx").oninput = () => setTimeline(+$("tlIdx").value);
$("yrRef").oninput = () => setTimeline(G.tl);
let flick = null;
$("btnFlicker").onclick = () => {
  if (flick){ clearInterval(flick); flick = null; $("btnFlicker").textContent = "Flicker"; setTimeline(G.tl); return; }
  if (!G.series.length) return toast("Add another date first");
  const other = G.tl || 1; let on = false; $("btnFlicker").textContent = "Stop";
  flick = setInterval(() => { on = !on; G.tl = on ? other : 0; paintBase(); }, 600);
};
$("btnRealign").onclick = () => { const it = G.series[G.tuneI]; if (!it) return; it.adj = {dx:0, dy:0, ds:0, dr:0}; busy("Re-aligning…", () => { alignItem(it); renderSeries(); paintBase(); $("tuneBox").style.display = "none"; }); };
$("btnChange").onclick = () => busy("Analysing every date…", () => { analyzeSeries(); });
$("arrowX").oninput = () => { $("arrowXO").textContent = "×" + $("arrowX").value; requestDraw(); };

function zoomTo(x, y, span){
  const r = view.getBoundingClientRect(), s = clamp(Math.min(r.width, r.height)/Math.max(20, span), .05, 40);
  G.view = {s, x: r.width/2 - x*s, y: r.height/2 - y*s}; requestDraw();
}
/* before/after swipe */
function dateCanvas(d){
  if (d._cv) return d._cv; const c = document.createElement("canvas"); c.width = G.w; c.height = G.h;
  c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(d.D.rgba), G.w, G.h), 0, 0); return d._cv = c;
}
$("swipe").oninput = () => { if (!G.sv) { $("swipe").value = 0; return toast("Analyse change first"); } const v = +$("swipe").value; G.swipe = v > 0 && v < 100 ? v/100 : (v >= 100 ? 1 : null); requestDraw(); };

/** distinct patches of change, largest first */
function changeEvents(eF, dF, cvN){
  const w = G.w, h = G.h, minEv = Math.max(30, .0006*cvN), out = [];
  for (const [m, type] of [[dF, "land"], [eF, "water"]]){
    const {comps} = label(m, w, h);
    for (const c of comps) if (c.area >= minEv) out.push({type, area: c.area, cx: c.sx/c.area, cy: c.sy/c.area, x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1});
  }
  out.sort((a, b) => b.area - a.area);
  return out.slice(0, 8);
}
/** shoreline (water edge) movement: from every later-date edge pixel to the nearest earlier-date edge */
function shoreStats(A, B, cv){
  const w = G.w, h = G.h, N = w*h, inner = erode(cv, w, h, 2);
  const eA = boundary(A.mask, w, h), eB = boundary(B.mask, w, h);
  for (let i = 0; i < N; i++){ if (!inner[i]){ eA[i] = 0; eB[i] = 0; } }
  const dA = edtTo(eA, w, h), cap = .15*Math.min(w, h), sg = [];
  for (let i = 0; i < N; i++) if (eB[i] && dA[i] <= cap) sg.push(A.mask[i] ? dA[i] : -dA[i]);
  if (sg.length < 50) return {edgeA: eA, edgeB: eB, n: 0};
  const ab = sg.map(Math.abs), adv = sg.filter(v => v > 0), ret = sg.filter(v => v < 0).map(v => -v);
  return {edgeA: eA, edgeB: eB, n: sg.length, medAbs: median(ab), net: mean(sg), p90: quantile(ab, .9),
    advFrac: adv.length/sg.length, retFrac: ret.length/sg.length, maxAdv: adv.length ? quantile(adv, .98) : 0, maxRet: ret.length ? quantile(ret, .98) : 0, stable: ab.filter(v => v <= 1.5).length/sg.length};
}

/* ---------- compare view used in the Report ---------- */
function compareOverlay(iv){
  if (iv._ov) return iv._ov; const w = G.w, h = G.h, c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d"), id = x.createImageData(w, h), d = id.data, put = (i, r, g, b, a) => { d[i*4] = r; d[i*4+1] = g; d[i*4+2] = b; d[i*4+3] = a; };
  for (let i = 0; i < w*h; i++){ if (iv.map[i] === 2) put(i, 76, 209, 122, 150); else if (iv.map[i] === 1) put(i, 255, 77, 94, 150); }
  if (G.sv.mode === "shore" && iv.shore && iv.shore.edgeA){ const eA = dilate(iv.shore.edgeA, w, h, 1), eB = dilate(iv.shore.edgeB, w, h, 1); for (let i = 0; i < w*h; i++){ if (eA[i]) put(i, 61, 139, 255, 255); if (eB[i]) put(i, 255, 210, 63, 255); } }
  x.putImageData(id, 0, 0);
  if (G.sv.mode === "river"){ const A = iv.pathFrom || G.sv.dates[iv.a], B = G.sv.dates[iv.b];
    for (const [d2, col] of [[A, "#3d8bff"], [B, "#ffd23f"]]) if (d2.path){ x.beginPath(); d2.path.pts.forEach((p, k) => k ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.strokeStyle = "rgba(0,0,0,.6)"; x.lineWidth = Math.max(3, w/260); x.stroke(); x.strokeStyle = col; x.lineWidth = Math.max(2, w/400); x.stroke(); } }
  return iv._ov = c;
}
function drawCompare(cv, t, showChg){
  const S = G.sv, iv = S.intervals[S.sel], A = S.dates[iv.a], B = S.dates[iv.b], w = G.w, h = G.h, lab = d => String(d.year ?? "before");
  const k = Math.min(1, 1000/w); cv.width = Math.round(w*k); cv.height = Math.round(h*k);
  const c = cv.getContext("2d"); c.setTransform(k, 0, 0, k, 0, 0);
  c.drawImage(dateCanvas(A), 0, 0); const sx = t*w;
  c.save(); c.beginPath(); c.rect(sx, 0, w - sx, h); c.clip(); c.drawImage(dateCanvas(B), 0, 0); c.restore();
  if (showChg){ c.drawImage(compareOverlay(iv), 0, 0);
    (iv.events || []).forEach((e, j) => { const r = Math.max(10, w/55); c.beginPath(); c.arc(e.cx, e.cy, r, 0, 7); c.fillStyle = e.type === "land" ? "#1f8f4a" : "#c22b3b"; c.fill(); c.strokeStyle = "#fff"; c.lineWidth = r/5; c.stroke(); c.fillStyle = "#fff"; c.font = `bold ${r*.9}px Space Grotesk, sans-serif`; c.textAlign = "center"; c.fillText("E" + (j+1), e.cx, e.cy + r*.32); }); }
  const fs = Math.max(13, w/40); c.font = `bold ${fs}px Space Grotesk, sans-serif`; c.textAlign = "left";
  c.strokeStyle = "#fff"; c.lineWidth = Math.max(2, w/300); c.beginPath(); c.moveTo(sx, 0); c.lineTo(sx, h); c.stroke();
  const tA = "◀ " + lab(A), tB = (B.year ?? "after") + " ▶", wa = c.measureText(tA).width, wb = c.measureText(tB).width, y0 = fs*1.6;
  c.fillStyle = "rgba(0,0,0,.65)"; c.fillRect(sx - wa - fs*1.1, y0 - fs*1.15, wa + fs*.8, fs*1.5); c.fillRect(sx + fs*.3, y0 - fs*1.15, wb + fs*.8, fs*1.5);
  c.fillStyle = "#fff"; c.fillText(tA, sx - wa - fs*.7, y0); c.fillText(tB, sx + fs*.7, y0);
}
function renderReportChange(){
  const box = document.getElementById("repChange"); if (!box || !G.D) return;
  if (G.D.kind === "dem"){ box.innerHTML = '<p class="note" style="margin:0">Change over time needs imagery, not an elevation model.</p>'; return; }
  if (!G.sv){
    box.innerHTML = `<p style="margin:0 0 6px">See how this place has changed. Add a screenshot of the <b>same place from another year</b>, for example from Google Earth's history slider (clock icon). Zoom, crop and rotation can differ: images are lined up automatically.</p>
      <div class="btns"><button class="pri" id="repAddDate">＋ Add an image from another year</button></div>${G.series.length ? `<p class="note">${G.series.length} image(s) added. <button class="sm" id="repRunCmp">Compare now</button></p>` : ""}`;
    document.getElementById("repAddDate").onclick = () => { G._fromReport = true; $("fileB").click(); };
    const rc = document.getElementById("repRunCmp"); if (rc) rc.onclick = () => { try { analyzeSeries(); } catch(e){ toast(e.message); } renderReportChange(); };
    return;
  }
  const S = G.sv;
  box.innerHTML = `<div class="yrs">Years: <span>this image</span><input type="number" id="ryRef" value="${$("yrRef").value}">${G.series.map((it, i) => `<span>${it.name.slice(0, 14)}</span><input type="number" data-ry="${i}" value="${it.year ?? ""}">`).join("")}<button class="sm" id="ryGo">Update</button></div>
    ${S.intervals.length > 1 ? `<div class="chips" style="margin-top:6px">${S.intervals.map((iv, i) => `<button class="chip${i === S.sel ? " on" : ""}" data-riv="${i}">${S.dates[iv.a].year ?? "A"} → ${S.dates[iv.b].year ?? "B"}</button>`).join("")}</div>` : ""}
    <canvas class="cmpcv" id="repCmp"></canvas>
    <div class="row"><label>Before ◀ ▶ After</label><input type="range" id="repSwipe" min="0" max="100" value="50"></div>
    <div class="btns"><label class="note"><input type="checkbox" id="repShowChg" checked> show changes</label><button class="sm" id="repAddMore">＋ Add another year</button><button class="sm" id="repCmpLab">Open in Lab ›</button></div>
    ${S.storyHTML || ""}`;
  const cv = document.getElementById("repCmp"), draw = () => drawCompare(cv, +document.getElementById("repSwipe").value/100, document.getElementById("repShowChg").checked);
  draw();
  document.getElementById("repSwipe").oninput = draw; document.getElementById("repShowChg").onchange = draw;
  // drag directly on the image to move the divider
  const drag = e => { const r = cv.getBoundingClientRect(); document.getElementById("repSwipe").value = clamp((e.clientX - r.left)/r.width*100, 0, 100); draw(); };
  cv.onpointerdown = e => { cv.setPointerCapture(e.pointerId); drag(e); cv.onpointermove = drag; }; cv.onpointerup = () => { cv.onpointermove = null; };
  box.querySelectorAll("[data-riv]").forEach(b => b.onclick = () => { S.sel = +b.dataset.riv; renderSeriesResults(); });
  document.getElementById("repAddMore").onclick = () => { G._fromReport = true; $("fileB").click(); };
  document.getElementById("repCmpLab").onclick = () => { showApp("lab"); setTimeout(() => showTab("change"), 60); };
  document.getElementById("ryGo").onclick = () => { $("yrRef").value = document.getElementById("ryRef").value; box.querySelectorAll("[data-ry]").forEach(i => G.series[+i.dataset.ry].year = parseFloat(i.value)); try { analyzeSeries(); } catch(e){ toast(e.message); } };
  box.querySelectorAll("[data-ev]").forEach(b => b.onclick = () => { const e = S.intervals[S.sel].events[+b.dataset.ev]; showApp("lab"); setTimeout(() => { showTab("change"); zoomTo(e.cx, e.cy, 1.8*Math.max(e.x1 - e.x0, e.y1 - e.y0, 40)); G.hl = "compare"; requestDraw(); }, 80); });
  box.querySelectorAll("[data-hot],[data-rr]").forEach(b => b.style.display = "none");
}
