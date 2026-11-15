/* ===================== Seafloor channels · tributaries & distributaries ===================== */

/** Google Earth's ocean floor is a single blue shaded-relief layer: almost every pixel is blue */
function isBathymetry(D){
  if (!D || D.kind !== "image") return false;
  const L = ensureLab(D), N = D.w*D.h, st = Math.max(1, Math.floor(N/40000)); let n = 0, blue = 0;
  for (let i = 0; i < N; i += st){ if (!D.rgba[i*4+3]) continue; const a = L[i*3+1], b = L[i*3+2]; n++; if (b < -15 && a > -12 && a < 40) blue++; }
  return n > 0 && blue/n > .85;
}

/** relative depth: in Google Earth's ocean shading, lighter blue = shallower. Returns 0 (deep) … 1 (shallow) */
function depthProxy(D){
  const w = D.w, h = D.h, L = ensureLab(D), f = Math.max(2, Math.ceil(Math.min(w, h)/90)), gw = Math.ceil(w/f), gh = Math.ceil(h/f);
  const g = new Float32Array(gw*gh), n = new Float32Array(gw*gh);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){ const k = ((y/f)|0)*gw + ((x/f)|0); g[k] += L[(y*w+x)*3]; n[k]++; }
  for (let k = 0; k < g.length; k++) g[k] /= n[k] || 1;
  let s = boxBlurF(g, gw, gh, 4); s = boxBlurF(s, gw, gh, 4);
  let mn = Infinity, mx = -Infinity; for (const v of s){ if (v < mn) mn = v; if (v > mx) mx = v; }
  const out = new Float32Array(w*h);
  for (let y = 0; y < h; y++){ const gy = clamp(y/f - .5, 0, gh-1), y0 = Math.floor(gy), y1 = Math.min(gh-1, y0+1), ty = gy - y0;
    for (let x = 0; x < w; x++){ const gx = clamp(x/f - .5, 0, gw-1), x0 = Math.floor(gx), x1 = Math.min(gw-1, x0+1), tx = gx - x0;
      const v = (s[y0*gw+x0]*(1-tx) + s[y0*gw+x1]*tx)*(1-ty) + (s[y1*gw+x0]*(1-tx) + s[y1*gw+x1]*tx)*ty;
      out[y*w+x] = (v - mn)/((mx - mn) || 1); } }
  return out;
}

/** trace incised valleys (canyons, channels, gullies) as dark, line-like troughs in the shaded relief:
    multi-scale Hessian "valley" filter → hysteresis → gap bridging */
function seafloorChannels(){
  const D = G.D, w = G.w, h = G.h, N = w*h, Lab = ensureLab(D);
  const L = new Float32Array(N); for (let i = 0; i < N; i++) L[i] = Lab[i*3];
  const s0 = Math.max(1, Math.min(w, h)/650), Rv = new Float32Array(N), scl = new Float32Array(N);
  for (const sg of [1.5*s0, 3*s0, 6*s0]){
    const r = Math.max(1, Math.round(sg*.9)), S = boxBlurF(boxBlurF(L, w, h, r), w, h, r), d = Math.max(1, Math.round(sg*.7)), d2 = d*d;
    for (let y = d; y < h-d; y++) for (let x = d; x < w-d; x++){
      const i = y*w+x;
      const xx = (S[i+d] - 2*S[i] + S[i-d])/d2, yy = (S[i+d*w] - 2*S[i] + S[i-d*w])/d2, xy = (S[i+d*w+d] - S[i+d*w-d] - S[i-d*w+d] + S[i-d*w-d])/(4*d2);
      const tr = (xx+yy)/2, ds = Math.sqrt(((xx-yy)/2)**2 + xy*xy), l1 = tr + ds, l2 = tr - ds;
      const v = sg*sg*Math.max(0, l1 - 2*Math.max(0, l2));
      if (v > Rv[i]){ Rv[i] = v; scl[i] = sg; }
    }
  }
  if (G.excl) for (let i = 0; i < N; i++) if (G.excl[i]) Rv[i] = 0;
  if (G.labelMask) for (let i = 0; i < N; i++) if (G.labelMask[i]) Rv[i] *= .3;
  if (G.scaleBar){ const sb = G.scaleBar; for (let y = Math.max(0, sb.y - 40); y < Math.min(h, sb.y + 24); y++) for (let x = Math.max(0, sb.x0 - 12); x < Math.min(w, sb.x0 + sb.px + 12); x++) Rv[y*w+x] = 0; }
  const smp = []; for (let i = 0; i < N; i += 7) smp.push(Rv[i]);
  const hi = quantile(smp, .985), lo = quantile(smp, .935);
  if (!(hi > 0)) return {skip:"no incised channels found in the seafloor shading"};
  const m = new Uint8Array(N), st = new Int32Array(N); let sp = 0;
  for (let i = 0; i < N; i++) if (Rv[i] >= hi){ m[i] = 1; st[sp++] = i; }
  while (sp){ const p = st[--sp], x = p % w, y = (p/w)|0;
    for (const [dx, dy] of NB8){ const nx = x+dx, ny = y+dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; const q = ny*w+nx; if (!m[q] && Rv[q] >= lo){ m[q] = 1; st[sp++] = q; } } }
  // join fragments (labels, watermarks, noisy tracks) then drop short pieces
  const P = new Float32Array(N); for (let i = 0; i < N; i++) P[i] = clamp(Rv[i]/hi, 0, 1);
  let mm = m; try { const b = bridgeGaps(m, w, h, Math.max(6, .04*Math.min(w, h)), P); mm = b.m || m; } catch(e){ console.error(e); }
  const lb = label(mm, w, h), minSpan = .07*Math.min(w, h), keep = new Set();
  for (const c of lb.comps){ const span = Math.hypot(c.x1-c.x0, c.y1-c.y0); if (span >= minSpan && c.area/Math.max(1, span) < .06*Math.min(w, h)) keep.add(c.id); }
  const out = new Uint8Array(N); let area = 0; for (let i = 0; i < N; i++) if (keep.has(lb.L[i])){ out[i] = 1; area++; }
  if (!area) return {skip:"no channel long enough to trace"};
  G.mask = out; G.maskV++; G.prep = null; G.depth = depthProxy(D);
  // main system: the longest single route (skeleton diameter) through strongly incised troughs that runs downslope,
  // across the depth contours, rather than along them as the foot of an escarpment or a band of shelf-edge gullies does
  const skA = thin(out, w, h), md = Math.min(w, h), dp = G.depth, at = (x, y) => dp[clamp(Math.round(y), 0, h-1)*w + clamp(Math.round(x), 0, w-1)];
  const stamp = new Int32Array(N), dist = new Float32Array(N), q = new Int32Array(N); let tag = 0;
  const bfs = (s0) => { tag++; let qh = 0, qt = 0, far = s0; q[qt++] = s0; stamp[s0] = tag; dist[s0] = 0;
    while (qh < qt){ const p = q[qh++], x = p % w, y = (p/w)|0; for (const [dx, dy] of NB8){ const nx = x+dx, ny = y+dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; const r = ny*w+nx; if (!skA[r] || stamp[r] === tag) continue; stamp[r] = tag; dist[r] = dist[p] + (dx && dy ? SQ2 : 1); if (dist[r] > dist[far]) far = r; q[qt++] = r; } }
    return {far, D: dist[far], n: qt}; };
  const seen = new Uint8Array(lb.comps.length + 2); let big = null, bs = -1; G._sfc = [];
  for (let i = 0; i < N; i++){ if (!skA[i]) continue; const id = lb.L[i]; if (!keep.has(id) || seen[id]) continue; seen[id] = 1;
    const r1 = bfs(i), r2 = bfs(r1.far); let sr = 0; for (let t = 0; t < r2.n; t++) sr += Math.min(3, Rv[q[t]]/hi);
    const a = r1.far, b2 = r2.far, ax = a % w, ay = (a/w)|0, bx = b2 % w, by = (b2/w)|0, ch = [bx - ax, by - ay], cl = Math.hypot(...ch) || 1;
    const mx = (ax + bx)/2, my = (ay + by)/2, rr = .08*md, gx = at(mx + rr, my) - at(mx - rr, my), gy = at(mx, my + rr) - at(mx, my - rr), gl = Math.hypot(gx, gy);
    const cosA = gl > .02 ? Math.abs(ch[0]*gx + ch[1]*gy)/(cl*gl) : 1, sc = r2.D*(sr/Math.max(1, r2.n))*(.2 + .8*cosA);
    const cc = lb.comps.find(c => c.id === id); G._sfc.push({sc: Math.round(sc), D: Math.round(r2.D), str: +(sr/r2.n).toFixed(2), cosA: +cosA.toFixed(2), bb: [cc.x0, cc.y0, cc.x1, cc.y1]});
    if (sc > bs){ bs = sc; big = cc; } }
  let best = -1, bd = Infinity;
  for (let i = 0; i < N; i++) if (skA[i] && lb.L[i] === big.id && nbCount(skA, w, h, i) === 1 && G.depth[i] < bd){ bd = G.depth[i]; best = i; }
  if (best >= 0) G.outlet = [best % w, (best/w)|0];
  const ra = roiArea();
  G.seafloor = {systems: keep.size, area, hi, lo};
  showRes("water", [
    SEC("Seafloor channels (bathymetry)"),
    R("Share of analysis area", U.P(area/ra*100), "pixels traced as incised channel or canyon floor"),
    R("Separate channel systems", U.N(keep.size, 0), "after joining gaps up to " + U.L(Math.max(6, .04*Math.min(w, h))).s),
    R("Detection scales", {v:NaN, u:"", s:[1.5, 3, 6].map(k => U.L(k*s0).s).join(" · ")}, "widths of trough the valley filter looks for"),
  ]);
  rebuildOverlay();
  return {ok:true, share: area/ra, largest: Math.max(big.area, ra*.005), msg:`${keep.size} channel system${keep.size > 1 ? "s" : ""} traced from the seafloor shading; downslope = toward darker (deeper) blue`};
}
$("btnSeafloor") && ($("btnSeafloor").onclick = () => busy("Tracing seafloor channels…", () => { const r = seafloorChannels(); if (r.skip) toast(r.skip); }));

/* ---------- tributaries, distributaries and side channels along the main channel ---------- */
function analyzeBranches(quiet){
  if (!G.chan) analyzeChannel();
  const c = G.chan, P = prepNetwork(), w = G.w, h = G.h, N = w*h, W = c.W, n = c.pts.length;
  const mainPix = new Uint8Array(N); c.pts.forEach(p => mainPix[Math.round(p[1])*w + Math.round(p[0])] = 1);
  const nearMain = dilate(mainPix, w, h, Math.max(2, W*.6)), dMain = edtTo(mainPix, w, h);
  const sub = new Uint8Array(N); for (let i = 0; i < N; i++) sub[i] = P.sk[i] && !nearMain[i] ? 1 : 0;
  const lb = label(sub, w, h);
  // nearest main-stem index for a pixel (coarse scan then refine)
  const nearestIdx = (x, y) => { let bi = 0, bd = Infinity; for (let k = 0; k < n; k += 3){ const d = (c.pts[k][0]-x)**2 + (c.pts[k][1]-y)**2; if (d < bd){ bd = d; bi = k; } }
    for (let k = Math.max(0, bi-3); k <= Math.min(n-1, bi+3); k++){ const d = (c.pts[k][0]-x)**2 + (c.pts[k][1]-y)**2; if (d < bd){ bd = d; bi = k; } } return bi; };
  const sAt = k => c.s[k];
  const downVec = k => { let a = k, b = k; while (a > 0 && c.s[k] - c.s[a] < 3*W) a--; while (b < n-1 && c.s[b] - c.s[k] < 3*W) b++; const v = [c.pts[a][0]-c.pts[b][0], c.pts[a][1]-c.pts[b][1]], l = Math.hypot(...v) || 1; return [v[0]/l, v[1]/l]; };
  const depth = G.depth, sea = G.delta && G.delta.sea;
  // blob test (as for side channels): clearings, towns and fields detected as water form blobs, real channels are thin lines
  const mf = new Float32Array(N); for (let i = 0; i < N; i++) mf[i] = G.mask[i]; const r0 = Math.max(3, Math.round(1.2*W)); let fill = boxBlurF(mf, w, h, r0); fill = boxBlurF(fill, w, h, r0);
  const Lab = ensureLab(G.D), mainLab = [0, 0, 0]; c.pts.forEach(p => { const i = (Math.round(p[1])*w + Math.round(p[0]))*3; for (let k = 0; k < 3; k++) mainLab[k] += Lab[i+k]/n; });
  const blobby = pix => pix.filter(p => fill[p] > .5).length/pix.length > .4;
  const pixOf = new Map(); for (let i = 0; i < N; i++) if (lb.L[i]){ let a = pixOf.get(lb.L[i]); if (!a) pixOf.set(lb.L[i], a = []); a.push(i); }
  const items = [];
  const geo = (pix, start) => { // geodesic BFS inside a pixel set from one pixel
    const set = new Set(pix), dist = new Map([[start, 0]]), q = [start]; let far = start;
    for (let qi = 0; qi < q.length; qi++){ const p = q[qi], x = p % w, y = (p/w)|0, d = dist.get(p);
      for (const [dx, dy] of NB8){ const qx = x+dx, qy = y+dy; if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue; const r = qy*w+qx; if (!set.has(r) || dist.has(r)) continue; dist.set(r, d + (dx && dy ? SQ2 : 1)); q.push(r); if (dist.get(r) > dist.get(far)) far = r; } }
    return {dist, far, len: dist.get(far)}; };
  const describe = (pix, att, k, gap) => {
    const g = geo(pix, att), ax = att % w, ay = (att/w)|0, fx = g.far % w, fy = (g.far/w)|0;
    if (g.len < Math.max(3*W, 12) || (!G.seafloor && blobby(pix))) return null;
    if (!G.seafloor && !gap){ // same water as the main channel? (clearings and fields picked up as water differ in colour and form hairy networks)
      let l0 = 0, a0 = 0, b0 = 0; for (const p of pix){ l0 += Lab[p*3]; a0 += Lab[p*3+1]; b0 += Lab[p*3+2]; } const n0 = pix.length;
      const dE = Math.hypot((l0/n0 - mainLab[0])*.6, a0/n0 - mainLab[1], b0/n0 - mainLab[2]); if (dE > 10 || pix.length/g.len > 2.5) return null; }
    const ws = pix.map(p => 2*P.halfW[p] - 1).filter(v => v > 0), bw = ws.length ? median(ws) : 1;
    // direction a short way into the branch
    const want = Math.min(g.len*.5, Math.max(3*W, 10)); let bp = g.far, bdd = Infinity;
    for (const [p, d] of g.dist){ const e = Math.abs(d - want); if (e < bdd){ bdd = e; bp = p; } }
    const jx = c.pts[k][0], jy = c.pts[k][1];
    const bv = [bp % w - jx, ((bp/w)|0) - jy], bl = Math.hypot(...bv) || 1; bv[0] /= bl; bv[1] /= bl;
    const dv = downVec(k), cosT = bv[0]*dv[0] + bv[1]*dv[1], theta = Math.acos(clamp(cosT, -1, 1))*180/Math.PI;
    let type = theta > 95 ? "trib" : theta < 85 ? "dist" : "trib", cue = `it points ${theta > 90 ? "upstream" : "downstream"} at ${theta.toFixed(0)}° to the downstream direction`, conf = Math.abs(cosT);
    if (depth){ const dd = depth[g.far] - depth[att]; if (Math.abs(dd) > .02){ type = dd > 0 ? "trib" : "dist"; cue = dd > 0 ? "its far end is shallower (lighter), so it feeds the main channel" : "its far end is deeper (darker), so flow leaves the main channel"; conf = Math.min(1, Math.abs(dd)*8); } }
    else if (sea && sea[g.far] && !sea[att]){ type = "dist"; cue = "it ends in open water"; conf = 1; }
    const right = dv[0]*bv[1] - dv[1]*bv[0] > 0;
    const step = Math.max(1, Math.floor(pix.length/600)), pts = []; for (let t = 0; t < pix.length; t += step) pts.push([pix[t] % w, (pix[t]/w)|0]);
    return {type, k, s: sAt(k), x: jx, y: jy, fx, fy, len: g.len, total: pix.length, width: bw, theta, angle: type === "trib" ? 180 - theta : theta, bank: right ? "right" : "left", cue, conf, gap, pts};
  };
  for (const comp of lb.comps){
    const pix = pixOf.get(comp.id); if (!pix || pix.length < Math.max(3*W, 12)) continue;
    // attachment pixels: next to a skeleton pixel inside the main-stem corridor
    const att = []; for (const p of pix){ const x = p % w, y = (p/w)|0; for (const [dx, dy] of NB8){ const qx = x+dx, qy = y+dy; if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue; const q = qy*w+qx; if (P.sk[q] && nearMain[q]){ att.push(p); break; } } }
    if (!att.length) continue;
    const ks = att.map(p => ({p, k: nearestIdx(p % w, (p/w)|0)})).sort((a, b) => a.k - b.k);
    const groups = [[ks[0]]]; for (let t = 1; t < ks.length; t++){ if (c.s[ks[t].k] - c.s[groups[groups.length-1].slice(-1)[0].k] > 4*W) groups.push([]); groups[groups.length-1].push(ks[t]); }
    if (groups.length >= 2){ // rejoins the main channel: a side channel / anabranch around an island
      const a = groups[0][0], b = groups[groups.length-1][0], g = geo(pix, a.p);
      if (g.len < 3*W) continue;
      const ws = pix.map(p => 2*P.halfW[p] - 1).filter(v => v > 0);
      const step = Math.max(1, Math.floor(pix.length/600)), pts = []; for (let t = 0; t < pix.length; t += step) pts.push([pix[t] % w, (pix[t]/w)|0]);
      items.push({type:"side", k: a.k, k2: b.k, s: sAt(a.k), s2: sAt(b.k), x: c.pts[a.k][0], y: c.pts[a.k][1], fx: c.pts[b.k][0], fy: c.pts[b.k][1], len: pix.length*1.08, total: pix.length, width: ws.length ? median(ws) : 1, cue:"leaves and rejoins the main channel", conf: 1, pts, theta: NaN, angle: NaN, bank: ""});
      continue;
    }
    const a0 = groups[0][Math.floor(groups[0].length/2)], d = describe(pix, a0.p, a0.k, false); if (d){ if (d.type === "trib" && d.angle > 100) d.cue += "; it is barbed, entering against the flow"; items.push(d); }
  }
  // channels cut off from the network by a short detection gap (bridge, label, cloud): their nearest end lies close to the main stem
  { const {L, comps} = label(G.mask, w, h), gapMax = Math.max(4*W, .03*Math.min(w, h)), done = new Set();
    for (const cc of comps){
      if (cc.id === P.cid || cc.area < 20 || done.has(cc.id)) continue;
      const span = Math.hypot(cc.x1-cc.x0, cc.y1-cc.y0); if (span < 8*W) continue;
      const one = new Uint8Array(N); let any = false;
      for (let y = cc.y0; y <= cc.y1; y++) for (let x = cc.x0; x <= cc.x1; x++){ const i = y*w+x; if (L[i] === cc.id){ one[i] = 1; if (dMain[i] < gapMax) any = true; } }
      if (!any) continue;
      const sk = thin(one, w, h), pix = []; let ep = -1, ed = Infinity;
      for (let y = cc.y0; y <= cc.y1; y++) for (let x = cc.x0; x <= cc.x1; x++){ const i = y*w+x; if (!sk[i]) continue; pix.push(i); if (nbCount(sk, w, h, i) <= 1 && dMain[i] < ed){ ed = dMain[i]; ep = i; } }
      if (ep < 0 || ed > gapMax || pix.length < 8*W) continue;
      done.add(cc.id);
      const hw = edtTo(notMask(one), w, h), save = P.halfW; P.halfW = hw;
      const k = nearestIdx(ep % w, (ep/w)|0), d = describe(pix, ep, k, true); P.halfW = save;
      if (d){ d.gapLen = ed; items.push(d); }
    }
  }
  // names: largest first within each type
  const byType = t => items.filter(o => o.type === t).sort((a, b) => b.len - a.len);
  const tribs = byType("trib"), dists = byType("dist"), sides = byType("side");
  tribs.forEach((o, i) => o.id = "T" + (i+1)); dists.forEach((o, i) => o.id = "D" + (i+1)); sides.forEach((o, i) => o.id = "S" + (i+1));
  const sc = G.pxm || 1, tS = tribs.map(o => o.s).sort((a, b) => a-b), sp = []; for (let i = 1; i < tS.length; i++) sp.push(tS[i] - tS[i-1]);
  const left = tribs.filter(o => o.bank === "left").length, right = tribs.length - left;
  const res = {tribs, dists, sides, all: [...tribs, ...dists, ...sides], spacing: median(sp), left, right, W};
  G.branches = res;
  G.tables.branches = res.all.map(o => ({id:o.id, type: {trib:"tributary", dist:"distributary", side:"side channel"}[o.type], distance_from_outlet: o.s*sc, length: o.len*sc, width: o.width*sc, width_ratio: o.width/W, junction_angle: o.angle, bank: o.bank, detection_gap: o.gap ? "yes" : "no", reason: o.cue, x: o.x, y: o.y}));
  if (quiet) return res;
  const big = tribs[0], bigD = dists[0], A = tribs.map(o => o.angle).filter(Number.isFinite);
  showRes("branches", [
    SEC("Branches along the main channel"),
    R("Tributaries (join the main channel)", U.N(tribs.length, 0), `${left} from the left bank, ${right} from the right (looking downstream)`),
    R("Distributaries (leave the main channel)", U.N(dists.length, 0), dists.length ? "flow splits away; common on deltas, fans and the lower ends of submarine channels" : "none found"),
    R("Side channels (split and rejoin)", U.N(sides.length, 0), "anabranches around islands or bars"),
    SEC("Tributaries"),
    big ? R("Largest tributary", U.L(big.len), `${big.id}, joins ${U.L(big.s).s} from the outlet`) : null,
    tribs.length ? R("Median tributary length", U.L(median(tribs.map(o => o.len)))) : null,
    tribs.length ? R("Median width ÷ main width", U.N(median(tribs.map(o => o.width/W)), 2), "how big tributaries are compared with the main channel") : null,
    A.length ? R("Median junction angle", U.D(median(A)), "angle between a tributary and the main channel upstream of the junction; low-gradient, humid landscapes are often near 72°, steep or arid ones narrower") : null,
    sp.length ? R("Spacing between confluences", U.L(res.spacing), "median distance along the main channel between successive tributary junctions") : null,
    bigD ? SEC("Distributaries") : null,
    bigD ? R("Largest distributary", U.L(bigD.len), `${bigD.id}, leaves ${U.L(bigD.s).s} from the outlet at ${fx(bigD.angle, 0)}°`) : null,
  ].filter(Boolean), `<p class="note">How the type is decided: a branch that points back upstream from where it meets the main channel is a tributary; one that points downstream is a distributary${depth ? ". On the seafloor the depth cue wins: a branch whose far end is lighter (shallower) blue feeds the main channel" : ""}. Branches marked “gap” are separate in the water map but end within ${U.L(Math.max(4*W, .03*Math.min(w, h))).s} of the main channel.</p>
  <div style="max-height:240px;overflow:auto"><table class="grid"><tr><th>id</th><th>joins at</th><th>length</th><th>width</th><th>angle</th><th>bank</th></tr>${res.all.map(o => `<tr><td>${o.id}${o.gap ? " <small>gap</small>" : ""}</td><td>${U.L(o.s).s}</td><td>${U.L(o.len).s}</td><td>${U.L(o.width).s}</td><td>${Number.isFinite(o.angle) ? o.angle.toFixed(0) + "°" : "–"}</td><td>${o.bank}</td></tr>`).join("")}</table></div>
  <canvas class="chart" id="chBr"></canvas>`);
  if (res.all.length) chart($("chBr"), {title:"Where branches meet the main channel", xlab:"distance from outlet (" + lenUnit() + ")", ylab:"branch length (" + lenUnit() + ")",
    series:[{x: tribs.map(o => o.s*sc), y: tribs.map(o => o.len*sc), color:"#3fc1d3", dots:true, noline:true}, {x: dists.map(o => o.s*sc), y: dists.map(o => o.len*sc), color:"#ff6fae", dots:true, noline:true}]});
  rebuildOverlay(); requestDraw();
  return res;
}
$("btnBranches") && ($("btnBranches").onclick = () => busy("Finding tributaries and distributaries…", () => { analyzeBranches(); G.hl = "branches"; requestDraw(); }));

const BR_COL = {trib:"#3fc1d3", dist:"#ff6fae", side:"#b4f05a"};
function drawBranchesLab(ctx, P, v){
  const B = G.branches; if (!B) return;
  const all = B.all, show = G.hl === "branches";
  if (show) for (const o of all){ ctx.fillStyle = BR_COL[o.type]; for (const p of o.pts){ const q = P(p[0], p[1]); ctx.fillRect(q[0]-1.5, q[1]-1.5, 3, 3); } }
  ctx.font = "bold 10px Space Grotesk, sans-serif"; ctx.textAlign = "center";
  for (const o of all.slice(0, show ? 60 : 12)){ const q = P(o.x, o.y); ctx.beginPath(); ctx.arc(q[0], q[1], 9, 0, 7); ctx.fillStyle = BR_COL[o.type]; ctx.fill(); ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5; ctx.stroke(); ctx.fillStyle = "#000"; ctx.fillText(o.id, q[0], q[1]+3.5); }
  ctx.textAlign = "left";
}
