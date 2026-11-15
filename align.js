/* ===================== Automatic co-registration (Fourier–Mellin + phase correlation) ===================== */
const AL_N = 512, AL_FIT = 360;
function alFFT2(re, im, N, inv){
  if (inv) for (let i = 0; i < im.length; i++) im[i] = -im[i];
  fft2(re, im, N);
  if (inv){ const n = N*N; for (let i = 0; i < re.length; i++){ re[i] /= n; im[i] = -im[i]/n; } }
}
/** luminance gradient magnitude, tapered at image/valid edges */
function alGrad(rgba, w, h, valid){
  const L = new Float32Array(w*h);
  for (let i = 0; i < w*h; i++) L[i] = .2126*rgba[i*4] + .7152*rgba[i*4+1] + .0722*rgba[i*4+2];
  const S = boxBlurF(boxBlurF(L, w, h, 1), w, h, 1), g = new Float32Array(w*h);
  for (let y = 1; y < h-1; y++) for (let x = 1; x < w-1; x++){
    const i = y*w+x; if (valid && (!valid[i] || !valid[i-1] || !valid[i+1] || !valid[i-w] || !valid[i+w])) continue;
    g[i] = Math.hypot(S[i+1]-S[i-1], S[i+w]-S[i-w]);
  }
  // compress dynamic range so a few strong edges don't dominate
  let m = 0; for (const v of g) m += v; m = m/g.length || 1;
  for (let i = 0; i < g.length; i++) g[i] = Math.log1p(g[i]/m);
  return g;
}
/** place an image (w×h) scaled to fit AL_FIT inside an N×N frame, centred, with a cosine edge taper */
function alFrame(g, w, h){
  const N = AL_N, k = AL_FIT/Math.max(w, h), fw = Math.max(2, Math.round(w*k)), fh = Math.max(2, Math.round(h*k));
  const ox = Math.floor((N - fw)/2), oy = Math.floor((N - fh)/2), out = new Float64Array(N*N), tap = 12;
  for (let y = 0; y < fh; y++){
    const sy = Math.min(h-1, y/k), wy = Math.min(1, Math.min(y, fh-1-y)/tap);
    for (let x = 0; x < fw; x++){
      const sx = Math.min(w-1, x/k), x0 = sx|0, y0 = sy|0, x1 = Math.min(w-1, x0+1), y1 = Math.min(h-1, y0+1), fx2 = sx-x0, fy2 = sy-y0;
      const v = g[y0*w+x0]*(1-fx2)*(1-fy2) + g[y0*w+x1]*fx2*(1-fy2) + g[y1*w+x0]*(1-fx2)*fy2 + g[y1*w+x1]*fx2*fy2;
      const wx = Math.min(1, Math.min(x, fw-1-x)/tap), wt = .5 - .5*Math.cos(Math.PI*Math.min(wx, wy));
      out[(y+oy)*N + x+ox] = v*wt;
    }
  }
  // zero-mean inside content
  let s = 0, n = 0; for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++){ s += out[(y+oy)*N+x+ox]; n++; }
  const mu = s/n; for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) out[(y+oy)*N+x+ox] -= mu;
  return {img: out, k, ox, oy, fw, fh};
}
function alMag(img){
  const N = AL_N, re = Float64Array.from(img), im = new Float64Array(N*N); alFFT2(re, im, N);
  const M = new Float64Array(N*N), h = N/2;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++){
    const sx = (x+h)%N, sy = (y+h)%N, fxn = (sx-h)/N, fyn = (sy-h)/N, c = Math.cos(Math.PI*fxn)*Math.cos(Math.PI*fyn), hp = (1-c)*(2-c);
    M[sy*N+sx] = Math.log1p(Math.hypot(re[y*N+x], im[y*N+x]))*hp;
  }
  return M;
}
const LP_T = 256, LP_R = 256;
function alLogPolar(M){
  const N = AL_N, c = N/2, rmax = N/2 - 2, out = new Float64Array(LP_T*LP_R), lb = Math.log(rmax)/LP_R;
  for (let t = 0; t < LP_T; t++){
    const th = Math.PI*t/LP_T, ct = Math.cos(th), st = Math.sin(th);
    for (let j = 0; j < LP_R; j++){
      const r = Math.exp(j*lb), x = c + r*ct, y = c - r*st, x0 = Math.floor(x), y0 = Math.floor(y), fx2 = x-x0, fy2 = y-y0;
      if (x0 < 0 || y0 < 0 || x0+1 >= N || y0+1 >= N) continue;
      out[t*LP_R + j] = M[y0*N+x0]*(1-fx2)*(1-fy2) + M[y0*N+x0+1]*fx2*(1-fy2) + M[(y0+1)*N+x0]*(1-fx2)*fy2 + M[(y0+1)*N+x0+1]*fx2*fy2;
    }
  }
  return {lp: out, lb};
}
/** phase correlation of two equal-size square arrays → integer+subpixel shift (b shifted by d ≈ a) and peak height */
function alPC(a, b, N){
  const ar = Float64Array.from(a), ai = new Float64Array(N*N), br = Float64Array.from(b), bi = new Float64Array(N*N);
  alFFT2(ar, ai, N); alFFT2(br, bi, N);
  for (let i = 0; i < N*N; i++){
    const r = ar[i]*br[i] + ai[i]*bi[i], im = ai[i]*br[i] - ar[i]*bi[i], m = Math.hypot(r, im) + 1e-12;
    ar[i] = r/m; ai[i] = im/m;
  }
  alFFT2(ar, ai, N, true);
  let best = -Infinity, bx = 0, by = 0;
  for (let i = 0; i < N*N; i++) if (ar[i] > best){ best = ar[i]; bx = i % N; by = (i/N)|0; }
  const at = (x, y) => ar[((y+N)%N)*N + (x+N)%N];
  const sub = (m, c, p) => { const d = m - 2*c + p; return d ? .5*(m - p)/d : 0; };
  let dx = bx + sub(at(bx-1, by), best, at(bx+1, by)), dy = by + sub(at(bx, by-1), best, at(bx, by+1));
  if (dx > N/2) dx -= N; if (dy > N/2) dy -= N;
  return {dx, dy, peak: best};
}
/** warp an N×N frame: out(x) = img(M⁻¹(x − c − d) + c), with M = s·R(θ) */
function alWarp(img, s, thDeg, dx, dy){
  const N = AL_N, c = N/2, th = thDeg*Math.PI/180, ct = Math.cos(th)/s, st = Math.sin(th)/s, out = new Float64Array(N*N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++){
    const u = x - c - dx, v = y - c - dy, sx = ct*u + st*v + c, sy = -st*u + ct*v + c;
    const x0 = Math.floor(sx), y0 = Math.floor(sy); if (x0 < 0 || y0 < 0 || x0+1 >= N || y0+1 >= N) continue;
    const fx2 = sx-x0, fy2 = sy-y0;
    out[y*N+x] = img[y0*N+x0]*(1-fx2)*(1-fy2) + img[y0*N+x0+1]*fx2*(1-fy2) + img[(y0+1)*N+x0]*(1-fx2)*fy2 + img[(y0+1)*N+x0+1]*fx2*fy2;
  }
  return out;
}
function alNCC(a, b){
  let sa = 0, sb = 0, n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] && b[i]){ sa += a[i]; sb += b[i]; n++; }
  if (n < 500) return {ncc: -1, overlap: n};
  const ma = sa/n, mb = sb/n; let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < a.length; i++) if (a[i] && b[i]){ const p = a[i]-ma, q = b[i]-mb; sab += p*q; saa += p*p; sbb += q*q; }
  return {ncc: sab/Math.sqrt(saa*sbb + 1e-12), overlap: n};
}
/**
 * Estimate similarity transform mapping B pixels → A pixels.
 * gA, gB: gradient images (Float32) of A (w×h) and B (wb×hb).
 * Returns {M:[a,b,c,d,e,f]} such that xA = a·xB + c·yB + e, yA = b·xB + d·yB + f; plus scale, rot, conf, overlap.
 */
function alignSimilarity(gA, wA, hA, gB, wB, hB, opts = {}){
  const FA = alFrame(gA, wA, hA), FB = alFrame(gB, wB, hB), N = AL_N, c = N/2;
  const LA = alLogPolar(alMag(FA.img)), LB = alLogPolar(alMag(FB.img));
  const pc = alPC(LA.lp, LB.lp, LP_T); // LP_T == LP_R == 256
  // pc: shift (dx along ρ, dy along θ) that maps LB onto LA
  const dRho = pc.dx, dTh = pc.dy;
  const rot0 = dTh*180/LP_T, s0 = Math.exp(dRho*LA.lb);
  const cands = [];
  const rots = opts.noRotation ? [0] : [rot0, -rot0, rot0+180, -rot0+180, 0];
  const scales = [s0, 1/s0, 1];
  for (const r of rots) for (const s of scales){ if (s < .2 || s > 5) continue; cands.push([s, r]); }
  let best = null;
  const seen = new Set();
  const sweep = []; for (let e = -1; e <= 1.0001; e += .125) sweep.push([Math.pow(2, e), 0]);
  const evalSet = list => { for (const [s, r] of list){
    const key = s.toFixed(3) + "," + (((r % 360) + 360) % 360).toFixed(1); if (seen.has(key)) continue; seen.add(key);
    const W0 = alWarp(FB.img, s, r, 0, 0), t = alPC(FA.img, W0, N);
    const W1 = alWarp(FB.img, s, r, t.dx, t.dy), q = alNCC(FA.img, W1);
    const sc = q.ncc*Math.min(1, q.overlap/(FA.fw*FA.fh*.25));
    if (!best || sc > best.sc) best = {s, r, dx:t.dx, dy:t.dy, ncc:q.ncc, overlap:q.overlap, sc};
  } };
  evalSet(cands);
  // coarse scale sweep at zero rotation only if the spectral estimate was not convincing
  if (!best || best.ncc < .35) evalSet(sweep);
  // local refinement around the best candidate
  for (const ds of [.97, .985, 1.015, 1.03]) for (const dr of [-1, 0, 1]){
    const s = best.s*ds, r = best.r + dr, W0 = alWarp(FB.img, s, r, 0, 0), t = alPC(FA.img, W0, N);
    const q = alNCC(FA.img, alWarp(FB.img, s, r, t.dx, t.dy)), sc = q.ncc*Math.min(1, q.overlap/(FA.fw*FA.fh*.25));
    if (sc > best.sc) best = {s, r, dx:t.dx, dy:t.dy, ncc:q.ncc, overlap:q.overlap, sc};
  }
  // compose: frame coords. xFA = sR(xFB − c) + c + d ; xFB = kB·xB + oB ; xA = (xFA − oA)/kA
  const th = best.r*Math.PI/180, a = best.s*Math.cos(th), b = best.s*Math.sin(th);
  // sR = [[a, −b],[b, a]]
  const m00 = a*FB.k/FA.k, m01 = -b*FB.k/FA.k, m10 = b*FB.k/FA.k, m11 = a*FB.k/FA.k;
  const oBx = FB.ox - c, oBy = FB.oy - c;
  const tx = (a*oBx - b*oBy + c + best.dx - FA.ox)/FA.k, ty = (b*oBx + a*oBy + c + best.dy - FA.oy)/FA.k;
  return {M:[m00, m10, m01, m11, tx, ty], scale: best.s*FB.k/FA.k, rot: ((best.r % 360) + 540) % 360 - 180, conf: best.ncc, overlapFrac: best.overlap/(FA.fw*FA.fh)};
}
