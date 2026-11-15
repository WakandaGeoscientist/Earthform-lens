/* ===================== ML: self-trained pixel classifier for water ===================== */
// Features per pixel (standardised): smoothed L, a, b; local texture at 3 and 7 px; brightness relative to the
// neighbourhood; blueness; saturation; bright-ridge and dark-ridge strength (line detectors for narrow channels).
const ML_NAMES = ["lightness","green–red","blue–yellow","texture (fine)","texture (coarse)","relative brightness","blueness","saturation","bright line","dark line"];
function pixelFeatures(D){
  if (D._feat) return D._feat;
  const w = D.w, h = D.h, N = w*h, Lab = ensureLab(D), c = D.rgba;
  const L = new Float32Array(N), A = new Float32Array(N), B = new Float32Array(N), sq = new Float32Array(N);
  for (let i = 0; i < N; i++){ L[i] = Lab[i*3]; A[i] = Lab[i*3+1]; B[i] = Lab[i*3+2]; sq[i] = L[i]*L[i]; }
  const Ls = boxBlurF(L, w, h, 1), As = boxBlurF(A, w, h, 1), Bs = boxBlurF(B, w, h, 1);
  const m2a = boxBlurF(sq, w, h, 1), m2b = boxBlurF(boxBlurF(sq, w, h, 3), w, h, 0 || 1), mb = boxBlurF(boxBlurF(L, w, h, 3), w, h, 1);
  let bg = L; for (let k = 0; k < 3; k++) bg = boxBlurF(bg, w, h, 12);
  const S2 = boxBlurF(Ls, w, h, 1);
  const K = 10, F = new Float32Array(N*K);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
    const i = y*w+x, r = c[i*4]/255, g = c[i*4+1]/255, b = c[i*4+2]/255, mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    let rb = 0, rd = 0;
    if (x > 0 && y > 0 && x < w-1 && y < h-1){
      const xx = S2[i+1] - 2*S2[i] + S2[i-1], yy = S2[i+w] - 2*S2[i] + S2[i-w], xy = (S2[i+w+1] - S2[i+w-1] - S2[i-w+1] + S2[i-w-1])/4;
      const tr = (xx+yy)/2, d = Math.sqrt(((xx-yy)/2)**2 + xy*xy), l1 = tr - d, l2 = tr + d;
      rb = Math.max(0, -l1 - Math.abs(l2)); rd = Math.max(0, l2 - Math.abs(l1));
    }
    const o = i*K;
    F[o] = Ls[i]; F[o+1] = As[i]; F[o+2] = Bs[i];
    F[o+3] = Math.sqrt(Math.max(0, m2a[i] - Ls[i]*Ls[i])); F[o+4] = Math.sqrt(Math.max(0, m2b[i] - mb[i]*mb[i]));
    F[o+5] = Ls[i] - bg[i]; F[o+6] = (b - r)/(b + r + .02); F[o+7] = mx ? (mx - mn)/mx : 0; F[o+8] = rb; F[o+9] = rd;
  }
  // standardise
  const mu = new Float64Array(K), sd = new Float64Array(K), st = Math.max(1, Math.floor(N/40000)); let n = 0;
  for (let i = 0; i < N; i += st){ n++; for (let k = 0; k < K; k++) mu[k] += F[i*K+k]; }
  for (let k = 0; k < K; k++) mu[k] /= n;
  for (let i = 0; i < N; i += st) for (let k = 0; k < K; k++) sd[k] += (F[i*K+k] - mu[k])**2;
  for (let k = 0; k < K; k++) sd[k] = Math.sqrt(sd[k]/n) || 1;
  for (let i = 0; i < N; i++) for (let k = 0; k < K; k++) F[i*K+k] = (F[i*K+k] - mu[k])/sd[k];
  return D._feat = {F, K, raw: {Ls, As, Bs, T3: (() => { const t = new Float32Array(N); for (let i = 0; i < N; i++) t[i] = Math.sqrt(Math.max(0, m2a[i] - Ls[i]*Ls[i])); return t; })(), T7: (() => { const t = new Float32Array(N); for (let i = 0; i < N; i++) t[i] = Math.sqrt(Math.max(0, m2b[i] - mb[i]*mb[i])); return t; })()}};
}
/** expand features with squares (lets a linear model learn bands, e.g. "medium lightness") */
const ML_D = 10*2 + 1;
function mlRow(F, i, K, out){ for (let k = 0; k < K; k++){ const v = clamp(F[i*K+k], -6, 6); out[k] = v; out[K+k] = v*v*.3; } out[2*K] = 1; return out; }
/** L2-regularised logistic regression trained with Adam */
function trainLogistic(X, y, n, d, iters){
  const wv = new Float64Array(d), m = new Float64Array(d), v = new Float64Array(d), g = new Float64Array(d), lam = 1e-3;
  for (let t = 1; t <= iters; t++){
    g.fill(0);
    for (let i = 0; i < n; i++){ let z = 0; const o = i*d; for (let k = 0; k < d; k++) z += wv[k]*X[o+k]; const p = 1/(1 + Math.exp(-z)), e = p - y[i]; for (let k = 0; k < d; k++) g[k] += e*X[o+k]; }
    for (let k = 0; k < d; k++){ g[k] = g[k]/n + lam*wv[k]; m[k] = .9*m[k] + .1*g[k]; v[k] = .999*v[k] + .001*g[k]*g[k]; wv[k] -= .08*(m[k]/(1 - Math.pow(.9, t)))/(Math.sqrt(v[k]/(1 - Math.pow(.999, t))) + 1e-8); }
  }
  return wv;
}
/** self-training: seeds from confident pixels of P, train, predict, repeat. Returns {P, info} */
function mlWater(D, P, rounds = 2){
  const w = D.w, h = D.h, N = w*h, {F, K} = pixelFeatures(D), d = ML_D;
  let cur = P, info = null;
  const ce = clusterExpand(D, P);
  if (ce && ce.mask){ cur = Float32Array.from(P); for (let i = 0; i < N; i++) if (ce.mask[i] && cur[i] < .8) cur[i] = .8; }
  const r0 = roiOrFull(), inR = i => { const x = i % w, y = (i/w)|0; return x >= r0.x0 && x < r0.x1 && y >= r0.y0 && y < r0.y1 && !G.excl[i] && D.rgba[i*4+3]; };
  for (let round = 0; round < rounds; round++){
    const wet = new Uint8Array(N); for (let i = 0; i < N; i++) wet[i] = cur[i] > .7 ? 1 : 0;
    const core = erode(wet, w, h, 1), far = edtTo(wet, w, h);
    const ws = [], ls = [];
    for (let i = 0; i < N; i++){ if (!inR(i)) continue; if (core[i]) ws.push(i); else if (cur[i] < .15 && far[i] > 3) ls.push(i); }
    if (ws.length < 150 || ls.length < 150) return {P, info: {skipped: true}};
    // balanced sample; stratified so narrow channels are represented (sample by rank in a random permutation)
    let seed = 99 + round; const rnd = () => (seed = (seed*1664525 + 1013904223) >>> 0)/4294967296;
    const pick = (arr, k) => { const out = []; const st = arr.length/k; for (let j = 0; j < k && j*st < arr.length; j++) out.push(arr[Math.min(arr.length-1, Math.floor(j*st + rnd()*st))]); return out; };
    const nPer = Math.min(6000, ws.length, ls.length), S = pick(ws, nPer).concat(pick(ls, nPer)), n = S.length;
    const X = new Float64Array(n*d), y = new Float64Array(n), row = new Float64Array(d);
    S.forEach((i, j) => { mlRow(F, i, K, row); X.set(row, j*d); y[j] = j < nPer ? 1 : 0; });
    const wv = trainLogistic(X, y, n, d, 220);
    // held-out check on the seeds (every 7th sample)
    let ok = 0, tot = 0; for (let j = 0; j < n; j += 7){ let z = 0; for (let k = 0; k < d; k++) z += wv[k]*X[j*d+k]; ok += (z > 0) === (y[j] > .5) ? 1 : 0; tot++; }
    const Pm = new Float32Array(N);
    for (let i = 0; i < N; i++){ mlRow(F, i, K, row); let z = 0; for (let k = 0; k < d; k++) z += wv[k]*row[k]; Pm[i] = 1/(1 + Math.exp(-z)); }
    // smooth the prediction a little and combine with the colour-cluster probability
    const Ps = boxBlurF(Pm, w, h, 1), out = new Float32Array(N);
    for (let i = 0; i < N; i++) out[i] = .4*cur[i] + .6*Ps[i];
    // feature importance: |weight| of linear + squared term
    const imp = ML_NAMES.map((nm, k) => [nm, Math.abs(wv[k]) + Math.abs(wv[K+k])]).sort((a, b) => b[1] - a[1]);
    info = {acc: ok/tot, nSeeds: n, waterSeeds: ws.length, landSeeds: ls.length, imp, rounds: round + 1, expanded: ce && ce.added ? ce.added.length : 0, ce};
    cur = out;
  }
  return {P: cur, info};
}

/** k-means on colour + texture, then spread the water label through spatially adjacent, smooth, similar-coloured clusters.
    This lets water found in one place (e.g. open sea) reach water of a slightly different colour (lagoon, river) through the connections between them. */
function clusterExpand(D, cur){
  const w = D.w, h = D.h, N = w*h, {Ls, As, Bs, T7: T3} = pixelFeatures(D).raw, r0 = roiOrFull();
  const ok = i => !G.excl[i] && D.rgba[i*4+3];
  const st = Math.max(1, Math.floor(Math.sqrt((r0.x1-r0.x0)*(r0.y1-r0.y0)/30000))), smp = [];
  for (let y = r0.y0; y < r0.y1; y += st) for (let x = r0.x0; x < r0.x1; x += st){ const i = y*w+x; if (ok(i)) smp.push(Ls[i]*.7, As[i], Bs[i]); }
  if (smp.length < 900) return null;
  const K = 12, C = kmeans(Float64Array.from(smp), K, 14), cls = new Int8Array(N).fill(-1);
  const n = new Float64Array(K), nW = new Float64Array(K), sT = new Float64Array(K), sL = new Float64Array(K), sA = new Float64Array(K), sB = new Float64Array(K);
  const wetT = [], tS = Array.from({length: 12}, () => []);
  for (let y = r0.y0; y < r0.y1; y++) for (let x = r0.x0; x < r0.x1; x++){
    const i = y*w+x; if (!ok(i)) continue; let b = 0, bd = Infinity;
    for (let c = 0; c < K; c++){ const d = (Ls[i]*.7 - C[c*3])**2 + (As[i] - C[c*3+1])**2 + (Bs[i] - C[c*3+2])**2; if (d < bd){ bd = d; b = c; } }
    cls[i] = b; n[b]++; sT[b] += T3[i]; if (tS[b].length < 4000 && ((x + y) & 3) === 0) tS[b].push(T3[i]); sL[b] += Ls[i]; sA[b] += As[i]; sB[b] += Bs[i]; if (cur[i] > .5){ nW[b]++; if (wetT.length < 50000) wetT.push(T3[i]); }
  }
  if (wetT.length < 100) return null;
  const tq = Math.max(.5, 2.8*median(wetT));
  const adj = Array.from({length: K}, () => new Float64Array(K)), per = new Float64Array(K);
  for (let y = r0.y0; y < r0.y1 - 1; y++) for (let x = r0.x0; x < r0.x1 - 1; x++){
    const i = y*w+x, c0 = cls[i]; if (c0 < 0) continue;
    for (const j of [i+1, i+w]){ const c1 = cls[j]; if (c1 < 0 || c1 === c0) continue; adj[c0][c1]++; adj[c1][c0]++; per[c0]++; per[c1]++; }
  }
  const mean = c => [sL[c]/n[c], sA[c]/n[c], sB[c]/n[c], tS[c].length ? median(tS[c]) : sT[c]/n[c]];
  const water = new Set(); for (let c = 0; c < K; c++) if (n[c] && nW[c]/n[c] > .6) water.add(c);
  const added = [], base0 = [...water], dc = (p, q) => Math.sqrt(((p[0]-q[0])*.7)**2 + (p[1]-q[1])**2 + (p[2]-q[2])**2);
  let wf = base0.reduce((s, c) => s + n[c], 0)/Math.max(1, n.reduce((a, b) => a + b, 0));
  for (let changed = true; changed;){
    changed = false;
    for (let c = 0; c < K; c++){
      if (water.has(c) || !n[c]) continue; const mc = mean(c); if (mc[3] > tq) continue;
      for (const k of water){ const mk = mean(k), dist = Math.sqrt(((mc[0]-mk[0])*.7)**2 + (mc[1]-mk[1])**2 + (mc[2]-mk[2])**2);
        const dBase = Math.min(...base0.map(b0 => dc(mc, mean(b0))));
        if (per[c] && adj[c][k]/per[c] >= .1 && dist <= 5 && dBase <= 8 && wf + n[c]/Math.max(1, n.reduce((a, b) => a + b, 0)) <= .65){ wf += n[c]/Math.max(1, n.reduce((a, b) => a + b, 0)); water.add(c); added.push({c, from: k, dist: +dist.toFixed(2), frac: +(n[c]/N).toFixed(3), m: mc.map(v => +v.toFixed(1)), adj: +(adj[c][k]/per[c]).toFixed(2)}); changed = true; break; } }
    }
  }
  const base = [...water].filter(c => !added.some(a => a.c === c)).map(c => ({c, m: mean(c).map(v => +v.toFixed(1)), frac: +(n[c]/N).toFixed(3)}));
  const all = Array.from({length: K}, (_, c) => n[c] ? {c, m: mean(c).map(v => +v.toFixed(1)), frac: +(n[c]/N).toFixed(3), wet: +(nW[c]/n[c]).toFixed(2)} : null).filter(Boolean);
  if (!added.length) return {mask: null, added, tq, base, all};
  const mask = new Uint8Array(N); for (let i = 0; i < N; i++) if (cls[i] >= 0 && water.has(cls[i]) && T3[i] <= tq) mask[i] = 1;
  return {mask: opening(mask, w, h, 1), added, tq, base, all};
}
