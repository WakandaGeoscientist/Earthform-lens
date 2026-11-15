/* ===================== Explanations: what, how, your numbers, how to read ===================== */
// entry: [what it is, how it is calculated, how to read it, map highlight (optional), calc() → your numbers (optional)]
const Lf = v => U.L(v).s, Af = v => U.A(v).s;
const GL = {
"branches:Tributaries (join the main channel)":["Branches that flow into the main channel.","Skeleton branches attached to the main centreline are followed from the junction. A branch pointing back upstream (angle to the downstream direction over 90°) is a tributary. On seafloor images the depth cue decides: a far end that is lighter (shallower) blue flows in. Branches whose colour differs from the main channel, or that form hairy networks through clearings, are dropped.","More tributaries on one bank can reflect regional slope or tilting. Barbed tributaries (entering against the flow) can record river capture or a reversed drainage.","branches"],
"branches:Distributaries (leave the main channel)":["Branches that carry flow away from the main channel.","Same test as tributaries: the branch points downstream from the junction, ends in open water, or (seafloor) reaches deeper water.","Common on deltas, alluvial fans and the lower ends of submarine channels. On a single-thread river a few may be side channels whose other end was not detected.","branches"],
"branches:Side channels (split and rejoin)":["Branches attached to the main channel at two places.","Skeleton pieces touching the main-channel corridor at points more than 4 channel widths apart along it.","Many side channels mean an anabranching or island-braided river.","branches"],
"branches:Largest tributary":["The longest branch that flows in.","Longest route along the branch's skeleton from the junction (geodesic distance).","Compare its width ratio: near 1 means a confluence of equals.","branches"],
"branches:Median tributary length":["Typical tributary length.","Median of the geodesic lengths.","","branches"],
"branches:Median width ÷ main width":["How big tributaries are relative to the main channel.","Median of (tributary median width ÷ main channel median width). Width = 2 × distance from centreline to bank.","","branches"],
"branches:Median junction angle":["The angle at which tributaries meet the main channel.","Directions measured about 3 channel widths away from the junction; angle between the tributary and the main channel upstream of it.","Humid, low-gradient landscapes average about 72°; steeper or drier ones give narrower angles. Over 90° = barbed.","branches"],
"branches:Spacing between confluences":["How far apart tributaries join.","Median gap along the main centreline between successive tributary junctions.","Regular spacing often reflects valley-side slope length.","branches"],
"branches:Largest distributary":["The longest branch that flows out.","Geodesic length from where it leaves the main channel.","","branches"],
"water:Separate channel systems":["Seafloor mode: how many unconnected incised channel networks were traced.","Valley filter → hysteresis threshold → gap bridging → components longer than 7% of the image.","","mask"],
"water:Detection scales":["Seafloor mode: trough widths the valley filter looks for.","Hessian of the smoothed brightness at three scales; the largest eigenvalue (positive for dark troughs) minus any blob response, scaled by σ².","","mask"],
/* ---- water ---- */
"water:Water area":["Total area of pixels classed as water (or wet sediment) inside the analysis area.","Count of mask pixels × pixel area (scale²). Without a scale it stays in px².","Silty channels, mudflats and shallow water may or may not count, depending on the method. Check the blue overlay.","mask"],
"water:Share of analysis area":["Fraction of the analysis area covered by water.","water pixels ÷ analysis-area pixels.","High values (over 30%) mean a wetland, delta or coast. Near 0 means dry land or that water was missed.","mask",()=>{const r=G.results.water;return r?`${disp("water","Water area")} ÷ ${disp("water","Analysis area")}`:""}],
"water:Separate water bodies":["How many unconnected patches of water there are.","8-connected component labelling: pixels touching edge-to-edge or corner-to-corner belong to the same body.","Many small bodies point to ponds or lakes; one dominant body points to a connected river, tidal network or sea.","mask"],
"water:Largest body":["Area of the biggest single connected water body.","Largest component from the labelling step.","If it holds most of the water, the network is well connected.","mask"],
"water:Analysis area":["Size of the area being analysed.","The box you drew with ⬚ Area (or the automatic crop that trims phone toolbars), otherwise the whole image.","All densities and shares are relative to this area.","roi"],
/* ---- channel ---- */
"channel:Channel length":["Distance along the channel's centreline from the outlet to the head.","The centreline is the water mask thinned to a one-pixel skeleton (Zhang–Suen). The shortest skeleton path between outlet and head is found (Dijkstra), and its steps are summed (1 for straight steps, √2 for diagonal).","Depends on where outlet and head are placed. It is not the river's full length unless the whole river is in view.","path"],
"channel:Straight-line distance":["Straight distance between the two ends of the measured channel.","√(Δx² + Δy²) between the outlet and head points.","The 'as the crow flies' baseline for sinuosity.","straight"],
"channel:Sinuosity":["How much the channel winds: its length divided by the straight-line distance.","S = L ÷ D, where L is the channel length and D the straight-line distance.","1.0 = straight; 1.05–1.5 = sinuous; over 1.5 = meandering. Very high values (over 2.5) mean tight loops close to cutting off.","straight",()=>G.chan?`${Lf(G.chan.len)} ÷ ${Lf(G.chan.straight)} = ${(G.chan.len/G.chan.straight).toFixed(2)}`:""],
"channel:Meander-belt sinuosity":["Winding measured against the smoothed course of the meander belt rather than a straight line.","The centreline is smoothed heavily (Gaussian, σ ≈ 0.6 meander wavelengths) to give the belt axis. Belt sinuosity = channel length ÷ belt-axis length.","Separates true meandering from a valley that is simply curved. Usually lower than plain sinuosity.","belt",()=>G.chan&&G.chan.axisLen?`${Lf(G.chan.len)} ÷ ${Lf(G.chan.axisLen)} = ${G.chan.beltSin.toFixed(2)}`:""],
"channel:Meander belt width":["Width of the zone the channel sweeps across.","Twice the 95th percentile of the distance between the centreline and the belt axis.","Gives the floodplain zone the river actively reworks. Often about 5–10× the channel width.","belt"],
"channel:Downstream direction":["Compass bearing from the head to the outlet.","atan2(Δx, −Δy) between the end points, plus your north offset.","Assumes north is up, as in Google Earth and Maps defaults."],
"channel:Median width":["Typical channel width.","At every centreline pixel, the Euclidean distance transform gives the distance d to the nearest bank, so the width there is about 2d − 1. This is the median over the whole path.","Robust to occasional wide pools or junctions. Under about 5 px it is unreliable.","width",()=>G.chan?`median of ${G.chan.w.length} centreline widths = ${Lf(G.chan.W)}`:""],
"channel:Mean width":["Average width along the path.","Mean of the 2d − 1 widths.","Pulled up by wide junctions and bays, so the median is usually more representative.","width"],
"channel:Width range (5–95%)":["Narrowest and widest typical widths.","5th and 95th percentiles of the width series.","A big spread suggests tidal widening, confluences or pools."],
"channel:Width near outlet / near head":["Width at the downstream end compared with the upstream end.","Median width of the first and last 8% of the path.","Ratios above about 2 indicate strong downstream widening, typical of estuaries and tidal creeks."],
"channel:Width convergence length":["How quickly the channel widens toward the sea.","Fit ln(width) = a + b·distance. The convergence (e-folding) length is −1/b: the distance over which width changes by a factor e ≈ 2.7.","Short convergence lengths (a few channel widths) are typical of tide-dominated channels. Rivers rarely show it.","width",()=>G.chan&&G.chan.Lb?`slope b = ${(-1/G.chan.Lb).toExponential(2)} per px → Lb = ${Lf(G.chan.Lb)} (R² ${G.chan.convR2.toFixed(2)})`:""],
"channel:Width convergence":["Whether the channel widens toward the outlet.","The same exponential fit gave no widening (b ≥ 0).","Typical of rivers, or of a path that does not reach the sea."],
"channel:Network area ÷ centreline length":["Average width of the whole connected network.","Water area of the network ÷ total skeleton length.","A quick check that does not depend on the chosen path."],
"channel:Bends between inflections":["Number of complete meander bends along the path.","The centreline is smoothed (σ ≈ 0.75 widths) and its curvature κ computed. Inflection points are where κ changes sign; runs shorter than one channel width are ignored as noise. Each pair of consecutive inflections bounds one bend.","Count them on the map (white dots).","bends"],
"channel:Meander wavelength":["Distance spanned by one full meander wave (a left bend plus a right bend).","λ = median of (chord of bend i + chord of bend i+1), where a chord is the straight distance between a bend's two inflection points.","Wavelength scales with channel width and discharge.","bends"],
"channel:Wavelength ÷ width":["Meander wavelength expressed in channel widths.","λ ÷ median width.","Many rivers fall around 10–14 (Leopold & Wolman). Tidal meanders and channels with resistant banks often sit lower.","bends",()=>G.chan?`${Lf(G.chan.lambda)} ÷ ${Lf(G.chan.W)} = ${(G.chan.lambda/G.chan.W).toFixed(1)}`:""],
"channel:Bend radius of curvature (median)":["How tight a typical bend is.","At each bend's apex (maximum |κ|), the radius is Rc = 1/|κ|. This is the median over all bends.","Smaller radius = tighter bend.","bends"],
"channel:Radius ÷ width":["Bend tightness relative to channel size.","Rc ÷ median width.","Bank erosion and migration tend to be fastest around 2–3. Below 2 bends are tight and may cut off. Above 4 they are gentle.","bends",()=>G.chan?`${Lf(G.chan.Rc)} ÷ ${Lf(G.chan.W)} = ${(G.chan.Rc/G.chan.W).toFixed(2)}`:""],
"channel:Bend amplitude (median)":["How far a bend bulges out from its chord.","Maximum perpendicular distance from the smoothed centreline to the straight chord joining the bend's inflection points.","Larger amplitudes relative to wavelength mean more developed loops.","bends"],
"channel:Bend sinuosity (median)":["Sinuosity of individual bends.","Arc length ÷ chord for each bend; median over all bends.","Values above about 2 are near cut-off."],
"channel:Channel count index":["How many separate wet channels a cross-section meets: a braiding index.","Every 2 widths along the path, a transect perpendicular to the centreline (± your transect length) counts how many times it enters water. This is the average over all transects.","1 = single thread; over 1.5 = braided or anabranching. Long transects can also catch neighbouring meander loops, so shorten them for tight meanders.","transects",()=>G.chan?`${G.chan.nT} transects, mean ${G.chan.cci.toFixed(2)} wet crossings`:""],
/* ---- network ---- */
"network:Highest Strahler order":["Rank of the biggest channel in the hierarchy.","Strahler ordering: fingertip channels are order 1. When two channels of the same order meet, the result is one order higher (1+1→2, 2+2→3). When different orders meet, the higher one continues (2+1→2).","Large rivers reach order 6–12. A screenshot shows only part of a network.","network",()=>G.net?`highest order ${G.net.maxO}`:""],
"network:Sources (channel heads)":["Number of fingertip channels, also called the Shreve magnitude.","Count of skeleton end points other than the outlet.","More heads = more finely branched (higher drainage density)."],
"network:Junctions":["Places where channels split or join.","Clusters of skeleton pixels with three or more neighbours."],
"network:Links":["Channel segments between junctions or ends.","Edges of the skeleton graph."],
"network:Loops (cycles)":["Closed loops in the network, where water can go round islands.","links − (nodes − 1) among the connected nodes (the cyclomatic number).","0 = tree-like (dendritic, typical of rivers). Many loops = braided, anastomosing, deltaic or tidal networks.","network"],
"network:Bifurcation ratio Rb":["How many smaller streams feed each larger one.","Count streams of each order (Nᵤ), then Rb = geometric mean of Nᵤ ÷ Nᵤ₊₁ (Horton's law).","Natural networks usually give 3–5. Values near 2 mean elongated basins or a structural control.","network",()=>G.net?G.net.N.slice(1).map((n,i)=>`N${i+1}=${n}`).join(", ")+` → Rb ${fx(G.net.Rb,2)}`:""],
"network:Length ratio RL":["How much longer streams of each higher order are.","Mean length of order u+1 streams ÷ mean length of order u streams; geometric mean over orders.","Typically 1.5–3.5."],
"network:Total channel length":["Sum of all centreline lengths in the connected network.","Sum of link lengths."],
"network:Mean link length":["Average segment length between junctions.","Total length ÷ number of links.","Short links = dense branching."],
"network:Channel (drainage) density":["Channel length per unit area: how finely the land is dissected.","Total channel length ÷ analysis area.","Under 2 km/km² is coarse; 2–10 is moderate; over 20 km/km² is badlands-like or tidal marsh.",null,()=>G.net?`${Lf(G.net.totalLen)} ÷ ${Af(roiArea())}`:""],
"network:Network water area":["Water area of the connected network that was analysed.","Pixel count of the chosen component × pixel area.","","network"],
"network:Mean":["Average distance from any land pixel to the nearest channel (the unchanneled flow length).","A Euclidean distance transform of the network gives every land pixel's distance to the nearest channel; this is the mean over land in the analysis area.","For salt marshes and tidal flats this sets how well the surface drains. Values under about 50–100 m indicate efficient tidal drainage (Marani et al. 2003)."],
"network:Median":["Typical distance from land to the nearest channel.","Median of the same distance map."],
"network:90th percentile":["Distance that 90% of land lies within.","90th percentile of the distance map."],
"network:Maximum":["The point farthest from any channel.","Maximum of the distance map.","Shows the size of the largest unchannelled area."],
/* ---- lakes ---- */
"lakes:Water bodies":["Number of separate lakes or ponds measured.","Connected water components larger than the minimum area. The channel network and bodies cut by the edge are excluded if those boxes are ticked.","","lakes"],
"lakes:Total lake area":["Combined area of all measured lakes.","Sum of component areas."],
"lakes:Lake cover (limnicity)":["Fraction of the landscape covered by lakes.","Total lake area ÷ analysis area.","Thaw-lake plains (Alaska, Siberia) often have 10–40% lake cover.","lakes",()=>G.lakes&&G.lakes.tot?`${Af(G.lakes.tot)} ÷ ${Af(G.lakes.ra)}`:""],
"lakes:Density":["Lakes per unit area.","Count ÷ analysis area."],
"lakes:Median area":["Size of the typical lake.","Median of lake areas."],
"lakes:Mean area":["Average lake size.","Total area ÷ count.","Pulled up by a few large lakes."],
"lakes:Largest":["Area of the biggest lake.",""],
"lakes:Size–frequency exponent":["How the number of lakes falls off with size.","Plot log N(>A), the number of lakes larger than A, against log A for the larger half of lakes. The exponent is the negative slope.","Natural lake populations often follow power laws with exponents around 1. Steeper means many small lakes and few big ones."],
"lakes:Median circularity":["How round lakes are.","4πA ÷ P², where P is the perimeter (boundary pixel edges × π/4 to correct for the pixel staircase).","1 = perfect circle; lower = irregular or elongated.","lakes"],
"lakes:Median elongation":["Long axis ÷ short axis of a lake's best-fit ellipse.","From the second moments (covariance) of each lake's pixels: axis lengths = 4√eigenvalue.","Oriented thaw lakes in the Arctic often reach 2–4.","lakes"],
"lakes:Elongated lakes (≥1.5)":["Lakes long enough to have a meaningful orientation.","Lakes whose elongation is at least 1.5."],
"lakes:Preferred long-axis bearing":["The direction elongated lakes tend to point.","Axial (doubled-angle) circular mean of long-axis bearings, weighted by elongation − 1. R measures the strength of alignment (0 = random, 1 = all parallel).","Oriented thaw lakes usually lie perpendicular to the prevailing summer wind (waves erode the lake ends). Glacial lakes follow ice-flow direction.","lakes"],
"lakes:Fractal dimension":["How convoluted all shorelines and banks are.","Box counting: cover the shoreline pixels with grids of box size s = 2, 4, 8… and count occupied boxes N(s). D = slope of log N against log(1/s).","1.0 = smooth line; 1.2–1.3 = typical coastline; toward 1.5 and above = very intricate, like a marsh or fjords."],
/* ---- pattern ---- */
"pattern:Spacing (wavelength)":["Distance between repeating crests: dunes, ripples, ridges, field strips.","The window is detrended, tapered (Hann window) and transformed with a 2‑D Fast Fourier Transform. A regular pattern creates a bright spot in the spectrum at radius r. Spacing λ = window size ÷ r. Peaks are found on the 'whitened' spectrum (power ÷ average power at that radius) so broad landscape shading does not dominate.","Dune spacing grows with dune size and sand supply. For field strips it reflects land-ownership patterns.","pattern",()=>G.pattern&&G.pattern.S?`window ${Lf(G.pattern.S)} ÷ peak radius ${G.pattern.r.toFixed(1)} = ${Lf(G.pattern.spacing)}`:""],
"pattern:Crest trend":["Direction the crests or stripes run.","Perpendicular to the direction of the spectral peak (the wave vector).","Transverse dunes form perpendicular to the formative wind; linear dunes run roughly parallel to the resultant wind.","pattern"],
"pattern:Spacing direction":["Direction across the crests, in which the pattern repeats.","Bearing of the spectral peak's wave vector.","For transverse dunes this is the wind axis; slip faces show which way the wind blew."],
"pattern:Peak prominence":["How regular the pattern is.","Peak power ÷ typical power at the same radius.","Over 12 = strong; 5–12 = moderate; under 5 = irregular, so treat the spacing with caution. Very short spacings in screenshots can come from JPEG compression."],
"pattern:Crests per km":["Crest density.","1000 ÷ spacing in metres."],
"pattern:Secondary pattern spacing":["A second, differently oriented pattern.","The next strongest spectral peak, at least 35% away from the first.","Crossing dune sets, or fractures cutting bedding."],
"pattern:Dominant lineament trend":["Average direction of linear edges.","Structure tensor: Sobel gradients (gx, gy) are summed as gx², gy² and gx·gy. The dominant gradient angle is ½·atan2(2Σgxgy, Σgx² − Σgy²), and lineaments run perpendicular to it.","Works for ridges, faults, roads and field boundaries."],
"pattern:Coherence":["How parallel the edges are.","√((Σgx² − Σgy²)² + 4(Σgxgy)²) ÷ (Σgx² + Σgy²).","0 = no preferred direction; above 0.4 = strongly aligned."],
"pattern:Analysed window":["Size of the square analysed.","The largest square inside your ▦ Pattern box, resampled to 64–512 samples. In automatic mode, the most regular of several overlapping tiles.","","pattern"],
/* ---- cover ---- */
"cover:Classes":["Number of colour classes.","k-means clustering in CIELAB colour space (a perceptual colour space) on up to 30,000 sampled pixels; every pixel is then assigned to its nearest class centre.","Classes are colours, not land-cover types. The names are guesses, so check them on the map."],
"cover:Shannon diversity H′":["How mixed the landscape is.","H′ = −Σ pᵢ ln pᵢ, where pᵢ is each class's share of the area.","0 = one class everywhere; ln k = all classes equally common.",null,()=>G.cover?G.cover.ps.map(p=>p.toFixed(2)).join(", ")+" → H′ "+(-G.cover.ps.reduce((s,p)=>s+(p>0?p*Math.log(p):0),0)).toFixed(3):""],
"cover:Evenness":["Diversity scaled from 0 to 1.","H′ ÷ ln k (Pielou's evenness).","1 = perfectly even mix."],
/* ---- terrain ---- */
"terrain:Minimum":["Lowest elevation in the analysis area.",""],"terrain:Maximum":["Highest elevation.",""],"terrain:Mean":["Average elevation.",""],"terrain:Std. deviation":["Spread of elevations.","√(mean of (z − mean)²)."],
"terrain:Relief":["Vertical range: maximum minus minimum elevation.","zmax − zmin.","Under 50 m = plains; 50–500 m = hills; over 1000 m = mountains."],
"terrain:Hypsometric integral":["How much of the land mass remains above the base level, an index of erosional maturity.","HI = (mean − min) ÷ (max − min); equal to the area under the hypsometric curve.","Over 0.6 = youthful, little-eroded uplands (convex curve); 0.35–0.6 = equilibrium; under 0.35 = old, deeply eroded (concave curve). Tectonically active areas tend to be high.",null,()=>G.terr?`(${G.terr.zmean.toFixed(1)} − ${G.terr.zmin.toFixed(1)}) ÷ (${G.terr.zmax.toFixed(1)} − ${G.terr.zmin.toFixed(1)}) = ${G.terr.HI.toFixed(3)}`:""],
"terrain:Mean slope":["Average steepness.","Horn's method: weighted 3×3 differences give ∂z/∂x and ∂z/∂y, and slope = atan(√(p² + q²)).","Depends on DEM resolution: coarser DEMs give gentler slopes."],
"terrain:Median slope":["Typical steepness.",""],"terrain:90th percentile":["Slope that 90% of the area is gentler than.",""],
"terrain:Area steeper than 15°":["Share of land steeper than 15°.",""],
"terrain:Area steeper than 30°":["Share of land steeper than 30°.","","Landslide- and rockfall-prone; near the angle of repose for loose material (about 33–35°)."],
"terrain:Terrain ruggedness (TRI)":["Local bumpiness.","Riley TRI: √(sum of squared elevation differences to the 8 neighbours), averaged.","Under 10 m = smooth; over 50 m = rugged (at 30 m DEM cells)."],
"terrain:Surface area ÷ planimetric area":["How much extra surface area the slopes add.","Mean of 1/cos(slope).","1.0 = flat."],
/* ---- hydrology ---- */
"hydro:Drainage area":["Area that drains to the outlet (the catchment).","Pits are filled (priority-flood), then every cell sends flow to its steepest downhill neighbour (D8). Every cell whose flow path reaches the outlet belongs to the basin.","Drainage area is the main control on river discharge.","basin"],
"hydro:Perimeter":["Basin boundary length.","Boundary cell edges × π/4."],
"hydro:Basin length":["Distance from the outlet to the farthest point of the basin.",""],
"hydro:Relief":["Highest minus lowest point of the basin.",""],
"hydro:Relief ratio":["Overall steepness of the basin.","Relief ÷ basin length.","Higher = steeper basin, faster runoff and more sediment yield."],
"hydro:Hypsometric integral":["Erosional maturity of the basin.","(mean − min) ÷ (max − min) of basin elevations."],
"hydro:Elongation ratio":["Basin shape.","Diameter of a circle with the same area (2√(A/π)) ÷ basin length.","1 = circular; under 0.7 = elongated (often tectonically controlled).",null,()=>G.hydro&&G.hydro.Lmax?`2√(${(G.hydro.area/1e6).toFixed(2)} km²/π) ÷ ${(G.hydro.Lmax/1000).toFixed(2)} km`:""],
"hydro:Circularity ratio":["Another basin-shape measure.","4πA ÷ P².","1 = circle."],
"hydro:Stream threshold":["Minimum upstream area needed to start a channel.","Set with the slider. Cells with more accumulated area become streams.","This choice sets drainage density, so compare basins with the same threshold."],
"hydro:Highest Strahler order":["Order of the main stream.","Strahler ordering on the D8 stream network.","","streams"],
"hydro:Total stream length":["Sum of all stream cell lengths in the basin.",""],
"hydro:Drainage density":["Stream length per area.","Total stream length ÷ basin area.","Depends on the threshold. Higher in weak rocks and arid, sparsely vegetated land."],
"hydro:Bifurcation ratio Rb":["Horton bifurcation ratio of the extracted network.","Geometric mean of Nᵤ ÷ Nᵤ₊₁."],
"hydro:Length ratio RL":["Horton length ratio.",""],
"hydro:Main stem length":["Length of the main river, traced upstream from the outlet along the largest tributary at each junction.","","","stem"],
"hydro:Main stem drop":["Elevation fall along the main stem.",""],
"hydro:Mean channel gradient":["Average slope of the main stem.","Drop ÷ length."],
"hydro:Concavity θ":["How quickly river slope decreases downstream.","Flint's law: S = kₛ·A^(−θ). Local slope S (over 6 cells) and drainage area A are binned by log A, and log S is regressed on log A; θ = −slope.","Most bedrock rivers have θ around 0.35–0.6. Low values can signal knickpoints, rock-strength changes or a too-small area.",null,()=>G.hydro&&G.hydro.nb?`fit over ${G.hydro.nb} area bins → θ ${G.hydro.theta.toFixed(3)}`:""],
"hydro:Steepness kₛ":["The constant in S = kₛ·A^(−θ).","10^intercept of the same fit.","Not comparable between basins unless θ is fixed. Use kₛₙ."],
"hydro:Normalised steepness kₛₙ (θref 0.45)":["River steepness with drainage area factored out.","kₛₙ = median of S·A^0.45 over stream cells.","Higher kₛₙ = faster rock uplift or harder rock. Widely used in tectonic geomorphology (Wobus et al. 2006)."],
/* ---- change ---- */

/* ---- channel+ ---- */
"channelx:Neck candidates":["Places where a meander loop comes back close to itself: future cutoff points.","Along the smoothed centreline, every pair of points more than 6 channel widths apart along the channel but less than 3 widths apart across land (bank to bank) is a candidate. Overlapping candidates are merged and the narrowest kept.","Necks narrow as bends grow. When the gap closes, usually in a flood, the river cuts through and abandons the loop as an oxbow lake.","necks",()=>G.chx?`${G.chx.necks.length} necks; narrowest ${G.chx.necks[0]?U.L(G.chx.necks[0].gap).s:"–"}`:""],
"channelx:Critical necks (gap ≤ 0.5 W)":["Necks where the land between two parts of the channel is under half a channel width.","gap = centreline distance − average local width; critical if gap ÷ W ≤ 0.5.","Very likely to cut off soon. Worth checking against older imagery in Change.","necks"],
"channelx:Narrow necks (gap ≤ 1.5 W)":["Necks with a gap of 0.5–1.5 channel widths.","","Developing cutoffs.","necks"],
"channelx:Narrowest neck gap":["The thinnest strip of land separating two parts of the channel.","Minimum bank-to-bank gap among necks. The loop length is the along-channel distance the river would skip if it cut through.","Loop length ÷ gap measures how much channel a cutoff would remove.","necks"],
"channelx:Oxbow candidates":["Lakes that look like abandoned river loops.","Water bodies not connected to the main network that lie within the meander belt, are about as wide as the channel (0.3–2.5 W) and are elongated (length over 3× width). Crescent shape (solidity under 0.7) adds confidence.","Oxbows record past cutoffs; their number and age show how active the river has been.","oxbows"],
"channelx:Crescent-shaped":["Oxbow candidates with a curved, crescent outline.","Solidity = lake area ÷ convex-hull area under 0.7.","","oxbows"],
"channelx:Downstream-skewed bends":["Bends whose sharpest point lies in their downstream half.","For each bend, the position of the maximum curvature between its two inflection points (0 = upstream end, 1 = downstream end); over 0.55 counts as downstream-skewed.","Skew reflects how flow and bank erosion deform the loop as it grows. Systematic skew in one direction suggests loops are migrating rather than just expanding."],
"channelx:Upstream-skewed bends":["Bends whose sharpest point lies in their upstream half.","Apex position under 0.45.",""],
"channelx:Median apex position":["Where the sharpest point of a typical bend sits.","Median apex position over all bends.","0.5 = symmetric."],
"channelx:Compound bends":["Bends with more than one lobe.","Counts curvature peaks within a bend that exceed half its maximum and are more than one width apart; two or more = compound.","Compound bends develop when a bend's apex migrates unevenly; they often precede complex cutoffs."],
"channelx:Window length":["Length of the moving window used for local sinuosity.","10 channel widths or 2 meander wavelengths, whichever is larger.",""],
"channelx:Most sinuous reach":["The most tortuous stretch of channel.","Local sinuosity = channel length within the window ÷ straight distance across the window, computed at every point.","Highly sinuous reaches are where necks and cutoffs concentrate.","localsin"],
"channelx:Median local sinuosity":["Typical sinuosity at the scale of a few bends.","Median of the local sinuosity series.","","localsin"],
/* ---- network+ ---- */
"networkx:Junctions measured":["Junctions where the angle could be measured.","Junctions with two upstream tributaries, each long enough to measure (over 3 local half-widths).","","junctions"],
"networkx:Median junction angle":["The typical angle at which tributaries meet.","For each junction, vectors are drawn from the junction to a point about 3 half-widths up each of the two largest tributaries; the angle between them is measured.","Seybold et al. (2017) found river junctions average about 45° in arid climates and about 72° in humid ones, reflecting whether overland flow or groundwater shapes the valleys. Tidal and deltaic networks follow different rules.","junctions",()=>G.netx?`${G.netx.angles.length} junctions → median ${fx(median(G.netx.angles.map(a=>a.ang)),0)}°`:""],
"networkx:Interquartile range":["Spread of junction angles (25th–75th percentile).","",""],
"networkx:Width ratio Rw":["How channel width grows with stream order.","Median width of each Strahler order; Rw = geometric mean of W(u+1) ÷ W(u).","Reflects hydraulic geometry: width scales roughly with the square root of discharge.",null,()=>G.netx?G.netx.orders.map((o,i)=>`order ${o}: ${U.L(G.netx.wo[i]).s}`).join(", "):""],
"networkx:Median width, order":["Typical width of channels of this Strahler order.","Median of each link's median width (2d − 1 from the distance transform).",""],
/* ---- delta ---- */
"delta:Mouths":["Where distributary channels reach open water.","Open water is found by morphological opening of the water mask with a radius of 2.5 channel widths (only wide water survives), keeping the largest body touching the image edge. Channel skeleton pixels within 4 px of it are grouped into mouths.","More mouths = more distributaries. River-dominated deltas often have many, wave-dominated deltas few.","delta"],
"delta:Bifurcations below the apex":["How many times the channel splits between the apex and the sea.","The channel skeleton becomes a tree rooted at its most landward end. Counts nodes below the apex with two or more branches leading to mouths.","","delta"],
"delta:Distributary links":["Channel segments in the distributary network that lead to the sea.","",""],
"delta:Apex to mouth (median)":["Typical length of the distributaries.","Straight distance from the apex to each mouth; median.","Together with the opening angle this describes delta size.","delta"],
"delta:Apex to farthest mouth":["Delta radius.","Maximum apex–mouth distance.",""],
"delta:Opening angle":["How widely the distributaries fan out.","Angular spread of mouth directions seen from the apex: 360° minus the largest empty gap.","Fan-shaped deltas open 60–120°; elongate (bird's-foot) deltas are narrower; deltas on straight coasts can exceed 150°.","delta"],
"delta:Delta area":["Area of the delta plain.","Pixels inside the convex hull of the apex and mouths, excluding open water.","A simple geometric estimate; the true delta may extend beyond the mouths.","delta"],
"delta:Land fraction":["How much of the delta plain is land rather than channel.","Land pixels ÷ non-sea pixels inside the hull.",""],
"delta:Shoreline length":["Length of the delta's edge against open water.","Boundary pixels of the open water inside the hull × π/4.",""],
"delta:Shoreline fractal dimension":["Roughness of the delta shoreline.","Box-counting on the shoreline pixels.","Smooth (near 1) suggests wave reworking; rough, lobate shorelines suggest river-dominated deposition."],
"delta:Channel width used":["Channel width that sets the open-water search radius.",""],
/* ---- braid ---- */
"braid:Channel count index (full braidplain)":["Average number of wet channels across the whole braidplain.","Transects every 2 widths along the main channel, each long enough to span the braidplain at that point (from its distance transform); wet crossings are counted and averaged.","1 = single thread; 2–4 = moderately braided; over 4 = highly braided (Egozi & Ashmore 2008 use a similar index).","braid"],
"braid:Total sinuosity":["Total channel length per unit valley length.","Sum of all channel centreline lengths in the braidplain ÷ braidplain axis length.","Single-thread rivers sit near their sinuosity; braided rivers commonly reach 2–6.","braid"],
"braid:Median braidplain width":["Width of the active channel belt.","The connected water is closed (radius 1.5 W) and all holes filled to give the braidplain; width = 2 × distance to its edge at each centreline point.","","braid"],
"braid:Braidplain width ÷ main channel width":["Braidplain width relative to the main channel.","",""],
"braid:Wetted fraction":["How much of the braidplain is under water.","Water area ÷ braidplain area.","Changes with discharge, so compare images taken at similar flow."],
"braid:Bars":["Number of bars and islands within the braidplain.","Land patches inside the braidplain larger than half a channel width squared.","","braid"],
"braid:Bars per km of braidplain":["Bar density along the river.","Bars ÷ braidplain axis length.",""],
"braid:Median bar area":["Size of a typical bar.","",""],
"braid:Median bar elongation":["Bar shape.","Long ÷ short axis of each bar's best-fit ellipse.","Elongated bars aligned with flow are typical of high-energy gravel rivers."],
"braid:Bar axis vs flow (median)":["How bars are oriented relative to the flow.","Angle between each elongated bar's long axis and the local main-channel direction.","Near 0° = flow-parallel (longitudinal bars); large angles suggest diagonal or transverse bars."],
/* ---- pattern field ---- */
"field:Tiles analysed":["Number of overlapping tiles analysed across the image.","Square tiles (about a third of the image wide, 75% step) each get their own Fourier analysis.","","field"],
"field:Tiles with a clear pattern":["Tiles with a regular pattern.","Peak prominence over 5.","","field"],
"field:Mean crest trend":["Overall crest direction.","Axial (doubled-angle) mean of tile crest trends, weighted by prominence.","For dunes, crests are perpendicular to the formative wind (transverse) or parallel to the resultant wind (linear).","field"],
"field:Alignment strength":["How consistently crests point the same way.","Mean resultant length R of the axial mean (0–1).","Near 1 = one dominant wind regime; low = curving, star or multi-directional dunes.","field"],
"field:Crest-trend spread":["Variability of crest direction between tiles.","Axial circular standard deviation: √(−2 ln R) converted to degrees.",""],
"field:Median spacing":["Typical crest spacing across the image.","Median of tile spacings with prominence over 5.","Spacing increases with dune height and sand supply."],
"field:Spacing range (10–90%)":["Range of crest spacing.","",""],
/* ---- multi-date change ---- */
"change:Dates analysed":["Images in the time series, in date order.","Each added image is aligned to the first: gradient (edge) images are compared with a Fourier–Mellin transform to estimate scale and rotation, then phase correlation finds the shift, and a local search refines it. GeoTIFFs with coordinates are aligned exactly from their georeferencing.","Check each image's match score; below about 0.25 the images may not show the same place."],
"change:Time span":["Years between the first and last image.",""],
"change:Common footprint":["Area visible in every image.","Intersection of each aligned image's footprint (minus screen buttons and erased areas).","Area comparisons use only this footprint, so different crops don't create false change."],
"change:Mean migration rate":["How fast the main channel moves sideways.","For each interval, the median distance between the two centrelines (both directions averaged); the rate is the sum of shifts ÷ the sum of years.","Includes any residual alignment error, so check with Flicker.","migration"],
"change:Migration ÷ channel width":["Migration rate in channel widths per year.","rate ÷ median channel width.","Most meandering rivers move 0.01–0.1 widths per year; above that, banks are very erodible or the river is reorganising.","migration"],
"change:Bend expansion rate (median)":["How fast bends grow outward.","Each migration vector (from points on the earlier centreline to the nearest point on the later one) is projected onto the outward normal, pointing away from the centre of curvature; median over bends, per year.","Expansion grows bend amplitude toward neck cutoff.","migration"],
"change:Downstream translation rate (median)":["How fast bends slide down-valley.","The same vectors projected onto the downstream direction.","Translation dominates where the outer banks are confined (valley walls, resistant clays).","migration"],
"change:Bends mainly translating":["Share of bends that move more down-valley than outward.","|translation| > |expansion| per bend.",""],
"change:Cutoffs detected":["Loops the river abandoned between two dates.","A neck in the earlier image (gap ≤ 1.5 W) through which the later centreline passes, while the old loop lies more than 2 widths from the new channel.","Each cutoff shortens the river and often leaves an oxbow lake.","migration"],
/* ---- measure ---- */
"measure:Length":["Length of your line.","Sum of segment lengths × scale."],"measure:Straight distance":["Distance between the first and last point.",""],
"measure:Sinuosity":["Line length ÷ straight distance.",""],"measure:Bearing start → end":["Compass direction from the first to the last point.",""],
"measure:Relief along line":["Highest minus lowest elevation along the line (DEM only).",""],"measure:Mean gradient":["Elevation change ÷ horizontal distance, in %.",""],
"measure:Area":["Polygon area (shoelace formula).",""],"measure:Perimeter":["Polygon boundary length.",""],"measure:Circularity":["4πA ÷ P².","","1 = circle."],"measure:Equivalent diameter":["Diameter of a circle with the same area.","2√(A/π)."],
};
function glossFor(mod, k){ return GL[mod + ":" + k] || GL["hydro:" + k] || (k.startsWith("Median width, order") ? GL["networkx:Median width, order"] : null); }
function explainHTML(mod, r){
  const g = glossFor(mod, r.k); if (!g) return `<div class="ex"><p class="note">No explanation for this measurement yet.</p></div>`;
  let calc = ""; try { calc = g[4] ? g[4]() : ""; } catch(e){}
  return `<div class="ex">
    <div><span class="exh">What</span>${g[0]}</div>
    ${g[1] ? `<div><span class="exh">How it's calculated</span>${g[1]}</div>` : ""}
    ${calc ? `<div><span class="exh">Your numbers</span><span class="mono">${calc}</span></div>` : ""}
    ${g[2] ? `<div><span class="exh">How to read it</span>${g[2]}</div>` : ""}
    ${g[3] ? `<button class="sm" data-hl="${g[3]}">Show on map</button>` : ""}
  </div>`;
}
// delegated: tap a result row to expand its explanation
document.addEventListener("click", e => {
  const hb = e.target.closest("[data-hl]");
  if (hb){ G.hl = hb.dataset.hl; if (!$("app-lab").classList.contains("on")) showApp("lab"); requestDraw(); rebuildOverlay(); toast(HLN[G.hl] || "Highlighted on the map"); window.scrollTo({top:0, behavior:"smooth"}); return; }
  const tr = e.target.closest("tr[data-gk]"); if (!tr) return;
  const nx = tr.nextElementSibling;
  if (nx && nx.classList.contains("exrow")){ nx.remove(); tr.classList.remove("open"); return; }
  const [mod, idx] = tr.dataset.gk.split("|"); const r = (G.results[mod] || [])[+idx]; if (!r) return;
  const row = document.createElement("tr"); row.className = "exrow"; row.innerHTML = `<td colspan="2">${explainHTML(mod, r)}</td>`;
  tr.after(row); tr.classList.add("open");
});
const HLN = {straight:"Dashed line: the straight-line distance", path:"Orange: the measured centreline", belt:"Cyan: the smoothed meander-belt axis", width:"Circles: inscribed circles whose diameters give the width", bends:"Numbered dots: inflection points bounding each bend", transects:"White lines: cross-section transects", network:"Colours: Strahler order", lakes:"Magenta: lakes, with their long axes", pattern:"Lines: measured crest spacing and trend", mask:"Blue: the water mask", roi:"White box: analysis area", basin:"Yellow: drainage basin", streams:"Coloured streams by order", stem:"Orange: main stem", change:"Red = became water, green = became land", necks:"Necks: red = critical, orange = narrow, yellow = developing", oxbows:"Purple rings: oxbow-lake candidates", localsin:"Centreline coloured by local sinuosity (blue = straight, red = tortuous)", junctions:"Dots: junction angles (green = wide, red = narrow)", delta:"Red: apex; blue: mouths; dashed: delta outline", braid:"Green: braidplain; yellow: bars", field:"Crest directions per tile (longer = wider spacing)", dates:"Centrelines from oldest (blue) to newest (red)", migration:"Arrows: centreline movement (exaggerated); red dots: cutoffs"};

/* ---------- module explainers ---------- */
const svgW = (inner, h = 150) => `<svg viewBox="0 0 320 ${h}" class="dg" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
const T = (x, y, t, c = "#cfd4d9", s = 10, a = "start") => `<text x="${x}" y="${y}" fill="${c}" font-size="${s}" text-anchor="${a}" font-family="Space Grotesk, sans-serif">${t}</text>`;
const MODX = {
  water: {t:"How the water mask is made", d: svgW(
    [0,1,2,3,4,5].map(i => [0,1,2,3,4,5].map(j => { const w = (i+j) % 5 === 1 || (i === 2 && j < 4) || (j === 3 && i > 1); return `<rect x="${10+i*14}" y="${25+j*14}" width="13" height="13" fill="${w ? "#7fb7c9" : ["#5a6b3a","#7a6a45","#4f5e33"][(i*j) % 3]}"/>`; }).join("")).join("") +
    T(10, 18, "1 · pixels") + `<path d="M100 65 h22" stroke="#8b929a" marker-end="url(#ar)"/>` +
    `<circle cx="150" cy="50" r="12" fill="#7fb7c9"/><circle cx="178" cy="78" r="12" fill="#5a6b3a"/><circle cx="150" cy="100" r="12" fill="#7a6a45"/>` + T(130, 18, "2 · colour classes") + T(166, 54, "smooth, connected → water", "#3fc1d3", 8) +
    `<path d="M215 65 h22" stroke="#8b929a"/>` + [0,1,2,3,4,5].map(i => [0,1,2,3,4,5].map(j => { const w = (i+j) % 5 === 1 || (i === 2 && j < 4) || (j === 3 && i > 1); return w ? `<rect x="${240+i*12}" y="${30+j*12}" width="12" height="12" fill="#2a8cff" opacity=".7"/>` : ""; }).join("")).join("") + T(240, 18, "3 · mask") +
    T(10, 140, "Then: open/close smoothing, fill small gaps, drop specks.", "#8b929a", 9)),
    s:["Automatic, step 1 (clustering): pixels are grouped into 8 colour classes (k-means in CIELAB). Each class is scored as water by smoothness, blueness, pale low-chroma colour (silty water) and how connected it is. In deserts, only blue classes may count.",
      "Step 2 (spreading): a second k-means on colour and texture finds classes that are smooth, similar in colour and spatially joined to the water already found, such as near-shore sea leading into a lagoon. The label spreads through them, with a cap so it can't drift into land.",
      "Step 3 (machine learning): a logistic-regression classifier is trained on this image's own confident water and land pixels, using 10 features: lightness, colour, fine and coarse texture, brightness relative to the surroundings, blueness, saturation, and bright- and dark-line detectors for narrow channels. It runs twice (self-training), then classifies every uncertain pixel. Its result is accepted only if it scores over 85% on held-out seed pixels and doesn't balloon the water area. Anything it adds must be smooth, and new detached patches must be channel- or oxbow-shaped.","Manual: tap samples (colour distance ΔE under a tolerance), or threshold an index such as brightness, blueness, NDWI (green vs near-infrared, needs a satellite band) or elevation (to map flooding).","Clean-up: morphological opening and closing, filling small gaps, and removing specks. You can paint out errors with 🧽 Erase.","Everything in Channel, Network, Lakes and Change depends on this mask, so check it first."]},
  channel: {t:"How channel form is measured", d: svgW(
    `<path d="M20 120 C 60 120, 50 40, 95 45 S 130 120, 170 110 S 200 30, 245 40 S 290 110, 300 100" fill="none" stroke="#ff7a45" stroke-width="3"/>` +
    `<path d="M20 120 L300 100" stroke="#fff" stroke-dasharray="5 4"/>` + T(160, 132, "D (straight-line distance)", "#fff", 9, "middle") + T(60, 30, "L (along the channel)", "#ff7a45", 9) +
    `<circle cx="73" cy="82" r="3.5" fill="#fff"/><circle cx="141" cy="96" r="3.5" fill="#fff"/><circle cx="207" cy="62" r="3.5" fill="#fff"/><circle cx="273" cy="80" r="3.5" fill="#fff"/>` +
    `<circle cx="95" cy="60" r="16" fill="none" stroke="#3fc1d3" stroke-dasharray="3 2"/>` + T(115, 66, "Rc", "#3fc1d3", 9) +
    `<path d="M73 140 L207 140" stroke="#e8c547"/><path d="M73 136 v8 M207 136 v8" stroke="#e8c547"/>` + T(140, 150, "λ (one full wave)", "#e8c547", 9, "middle") +
    T(5, 12, "Sinuosity = L ÷ D · white dots = inflections", "#cfd4d9", 9), 155),
    s:["The water body is thinned to a one-pixel centreline (skeleton), and short side spurs are pruned.","The main channel is the shortest centreline path from ⊙ outlet to ◎ head. By default these are the widest end and the farthest point.","Width at each point = 2 × the distance to the nearest bank (distance transform) − 1.","The path is smoothed and its curvature calculated. Inflection points (where the curve flips from left to right) split it into bends, and each bend gives a chord, amplitude and radius.","Transects across the channel count how many wet threads there are (braiding)."]},
  network: {t:"How the network is ordered", d: svgW(
    `<g stroke-width="2.5" fill="none"><path d="M40 20 L80 60" stroke="#9ecae1"/><path d="M120 20 L80 60" stroke="#9ecae1"/><path d="M80 60 L140 100" stroke="#4fb3d9"/><path d="M220 20 L200 60" stroke="#9ecae1"/><path d="M180 20 L200 60" stroke="#9ecae1"/><path d="M200 60 L140 100" stroke="#4fb3d9"/><path d="M140 100 L160 140" stroke="#2b8cbe" stroke-width="4"/><path d="M270 60 L220 120" stroke="#9ecae1"/><path d="M220 120 L160 140" stroke="#9ecae1"/></g>` +
    T(52, 35, "1") + T(105, 35, "1") + T(100, 85, "2") + T(178, 85, "2") + T(147, 128, "3") + T(250, 90, "1") +
    T(190, 140, "3 + 1 → stays 3", "#8b929a", 9) + T(5, 12, "Strahler: 1 + 1 → 2,  2 + 2 → 3", "#cfd4d9", 9)),
    s:["The centreline skeleton becomes a graph: junctions are nodes, channel segments are links.","Starting from the outlet, a tree is built through the network. Any extra links (alternative paths round islands) are counted as loops.","Strahler orders are assigned from the fingertips downstream, and Horton's laws compare the number and length of streams of each order.","A distance transform from the network gives every land pixel's distance to its nearest channel."]},
  lakes: {t:"How lakes are measured", d: svgW(
    `<path d="M70 40 C 120 20, 200 30, 240 60 S 230 120, 170 120 S 60 110, 55 80 S 50 50, 70 40Z" fill="#c86bff" opacity=".45"/>` +
    `<ellipse cx="150" cy="75" rx="95" ry="40" fill="none" stroke="#fff" stroke-dasharray="4 3" transform="rotate(8 150 75)"/>` +
    `<path d="M56 62 L244 88" stroke="#fff"/><path d="M155 35 L145 115" stroke="#e8c547"/>` + T(250, 92, "long axis", "#fff", 9) + T(160, 130, "short axis", "#e8c547", 9) +
    T(5, 12, "Elongation = long ÷ short · circularity = 4πA/P²", "#cfd4d9", 9)),
    s:["Each separate water body is labelled. The channel network and bodies cut by the image edge can be excluded.","Area = pixel count; perimeter = boundary edges, corrected for the pixel staircase.","A best-fit ellipse (from the pixels' second moments) gives the long and short axes and the orientation.","Orientations are averaged as axial data (a lake pointing 10° is the same as one pointing 190°)."]},
  pattern: {t:"How repeating patterns are found", d: svgW(
    [0,1,2,3,4,5,6].map(i => `<path d="M${20+i*22} 30 l40 100" stroke="#ff9a5c" stroke-width="5" opacity=".8"/>`).join("") +
    `<path d="M40 80 l21 -9" stroke="#fff"/>` + T(30, 145, "λ = spacing between crests", "#fff", 9) +
    `<rect x="200" y="30" width="100" height="100" fill="#000" stroke="#2a2e33"/><circle cx="250" cy="80" r="4" fill="#fff"/><circle cx="270" cy="72" r="5" fill="#fcffa4"/><circle cx="230" cy="88" r="5" fill="#fcffa4"/><path d="M250 80 L270 72" stroke="#3fc1d3"/>` +
    T(250, 145, "spectrum: bright spot at radius r", "#cfd4d9", 9, "middle") + T(5, 12, "λ = window ÷ r · crests run ⟂ to the spot's direction", "#cfd4d9", 9)),
    s:["A square window is taken from your ▦ Pattern box. In automatic mode it is the most regular of several overlapping tiles.","Broad slopes are removed (plane fit), and the edges are faded (Hann window) so they don't create false patterns.","A 2‑D Fourier transform turns repeating stripes into bright spots. The distance of a spot from the centre gives the spacing, and its direction gives the crest orientation.","A structure tensor (average edge direction) gives an independent check on orientation."]},
  cover: {t:"How surface cover is classified", d: svgW(
    Array.from({length:60}, (_, i) => { const g = i % 3, cx = [70,160,250][g] + Math.cos(i*2.4)*(18 + (i % 5)*4), cy = [70,95,60][g] + Math.sin(i*1.7)*(16 + (i % 4)*4); return `<circle cx="${cx}" cy="${cy}" r="3" fill="${["#4f7d3a","#c9b48a","#2a8cff"][g]}"/>`; }).join("") +
    [70,160,250].map((x, g) => `<circle cx="${x}" cy="${[70,95,60][g]}" r="6" fill="none" stroke="#fff" stroke-width="2"/>`).join("") +
    T(5, 12, "pixels in colour space → k groups (white = class centres)", "#cfd4d9", 9)),
    s:["Pixels are converted to CIELAB, a colour space where distances match perceived colour difference.","k-means finds k colour centres and assigns every pixel to the nearest one.","Area shares give the landscape mix; the Shannon index summarises diversity; patch counts show fragmentation."]},
  terrain: {t:"How terrain and drainage are computed", d: svgW(
    [[0,0,9],[1,0,8],[2,0,7],[0,1,8],[1,1,6],[2,1,5],[0,2,7],[1,2,4],[2,2,2]].map(([i,j,z]) => `<rect x="${20+i*34}" y="${25+j*34}" width="33" height="33" fill="rgb(${60+z*18},${70+z*15},${50+z*10})"/>` + T(36+i*34, 46+j*34, z, "#fff", 11, "middle")).join("") +
    `<path d="M37 42 L64 69 M71 42 L98 69 M105 42 L105 69 M37 76 L64 103 M71 76 L98 103 M105 76 L105 103 M37 110 L64 110 M71 110 L98 110" stroke="#3fc1d3" stroke-width="1.5"/>` +
    T(140, 40, "D8: each cell drains to its", "#cfd4d9", 9) + T(140, 54, "steepest downhill neighbour", "#cfd4d9", 9) + T(140, 78, "Accumulation = number of cells", "#cfd4d9", 9) + T(140, 92, "upstream → streams above a threshold", "#cfd4d9", 9) +
    `<path d="M150 145 Q 200 118 230 136 T 300 126" fill="none" stroke="#ff7a45"/>` + T(140, 112, "Hypsometry: area above each height", "#ff7a45", 9) + T(5, 12, "Pits are filled first so water can always flow out", "#cfd4d9", 9)),
    s:["Slope and aspect use Horn's 3×3 method; TRI sums the elevation differences to the neighbours.","The hypsometric curve plots the share of area above each relative height. Its integral (HI) indexes erosional maturity.","Hydrology: priority-flood pit filling → D8 flow directions → flow accumulation → streams above the area threshold → Strahler orders.","The basin is every cell draining to the outlet. The main stem follows the largest tributary upstream, and slope–area regression on its streams gives concavity θ and steepness kₛₙ."]},
  change: {t:"How images are aligned and compared", d: svgW(
    `<rect x="20" y="25" width="120" height="100" fill="none" stroke="#3fc1d3" stroke-width="2"/><g transform="translate(175 30) rotate(6) scale(.8)"><rect x="0" y="0" width="150" height="120" fill="none" stroke="#ff7a45" stroke-width="2"/></g>` +
    `<path d="M40 100 C 60 60, 90 110, 120 50" fill="none" stroke="#3fc1d3" stroke-width="3"/><g transform="translate(175 30) rotate(6) scale(.8)"><path d="M25 95 C 50 45, 90 115, 125 40" fill="none" stroke="#ff7a45" stroke-width="3"/></g>` +
    T(80, 140, "reference", "#3fc1d3", 9, "middle") + T(240, 140, "other date: zoomed, shifted, rotated", "#ff7a45", 9, "middle") + T(5, 12, "Scale + rotation from the spectrum, then shift → overlay", "#cfd4d9", 9)),
    s:["Each image's edges are extracted (gradient magnitude) so that colour, season and lighting differences matter less. Phone toolbars and buttons are masked out.","A Fourier–Mellin transform turns scale and rotation into simple shifts in log-polar space, where phase correlation finds them. A second phase correlation then finds the translation, and a local search refines all three.","The image is warped into the reference frame. Only the footprint visible in every image is compared.","For each date: water is detected (optionally with its own colour classes), and the main channel is traced between the same end points.","Two comparison modes. For rivers, centrelines are traced and compared. For coasts, lagoons, estuaries and lakes (or when the river traces disagree), the water's edge in each year is compared instead. Every patch of new land or new water is listed as a numbered change event (E1, E2…), largest first.","Shoreline movement: from each point on the later water's edge to the nearest point on the earlier edge, signed: built out into the water (+) or cut back (−).","For rivers, change is counted only inside the main-river corridor (± 6 channel widths of either date's centreline). Thin strips along the banks, up to about half the difference in apparent width plus a pixel, are ignored, because they come from blur or water level rather than erosion.","Each later trace is guided to stay near the first image's course, so both dates follow the same river. Where the old course is now dry land and the river runs far away, it is reported as a course change (cutoff or channel switch). Where both courses still hold water it is treated as a detection difference and left out of the rates.","The five largest remaining movements are numbered on the map with a Zoom button each, and the Before / after slider shows the two images side by side.","Migration is plotted against bend tightness (R/W). Many rivers migrate fastest around R/W ≈ 2–3 (Hickin & Nanson)."]},
  chx: {t:"How necks, oxbows and bend shape are found", d: svgW(
    `<path d="M20 120 C 40 40, 120 30, 150 70 S 140 130, 175 128 S 215 40, 260 70 S 290 130, 305 110" fill="none" stroke="#ff7a45" stroke-width="5"/>` +
    `<path d="M150 70 L175 128" stroke="#ff4d5e" stroke-width="2.5" stroke-dasharray="4 3"/>` + T(118, 104, "neck gap", "#ff4d5e", 9) +
    `<path d="M60 30 C 90 10, 120 20, 110 45" fill="none" stroke="#c86bff" stroke-width="6" opacity=".8"/>` + T(125, 30, "oxbow (old loop)", "#c86bff", 9) +
    T(5, 12, "neck: far along the channel, close across land", "#cfd4d9", 9)),
    s:["Necks: every pair of centreline points more than 6 widths apart along the channel but less than 3 widths apart across land is checked; the narrowest are kept and classed as critical, narrow or developing.","Oxbows: detached lakes inside the meander belt that are about as wide as the channel and elongated; crescent shapes score higher.","Bend shape: the position of each bend's sharpest point shows its skew; two or more curvature peaks make it compound.","Local sinuosity: sinuosity in a moving window shows which reaches are most tortuous."]},
  delta: {t:"How a delta is analysed", d: svgW(
    `<rect x="0" y="105" width="320" height="45" fill="#2a8cff" opacity=".45"/>` +
    `<g fill="none" stroke="#3fc1d3" stroke-width="3"><path d="M160 10 L160 50"/><path d="M160 50 L110 80 L80 110"/><path d="M160 50 L170 85 L150 110"/><path d="M170 85 L215 110"/><path d="M110 80 L120 110"/></g>` +
    `<circle cx="160" cy="50" r="6" fill="#ff4d5e"/>` + T(170, 48, "apex", "#ff4d5e", 9) + [80,120,150,215].map(x => `<circle cx="${x}" cy="110" r="4" fill="#fff"/>`).join("") + T(230, 125, "mouths", "#fff", 9) +
    `<path d="M160 50 L80 110 L215 110 Z" fill="none" stroke="#ffd27a" stroke-dasharray="5 4"/>` + T(5, 12, "open water found by morphological opening", "#cfd4d9", 9)),
    s:["Open water: the water mask is 'opened' with a radius of 2.5 channel widths, so only wide water survives; the largest body touching the image edge is the sea or lake.","Distributaries: the remaining channels connected to it are skeletonised into a tree rooted at the most landward end.","Mouths are where the skeleton reaches open water. The apex is the most upstream split from which at least two branches reach mouths.","The delta outline is the hull of the apex and mouths; the opening angle, distributary lengths and shoreline roughness are measured from it."]},
  braid: {t:"How braiding is measured", d: svgW(
    `<path d="M10 40 C 100 20, 220 60, 310 35 L310 115 C 220 135, 100 100, 10 120 Z" fill="#5bd17a" opacity=".15"/>` +
    `<g fill="#ffd27a" opacity=".8"><ellipse cx="80" cy="75" rx="30" ry="9"/><ellipse cx="170" cy="70" rx="40" ry="10"/><ellipse cx="250" cy="85" rx="28" ry="8"/></g>` +
    `<g fill="none" stroke="#3fc1d3" stroke-width="3"><path d="M10 60 C 60 55, 110 60, 140 55 S 220 50, 310 60"/><path d="M10 95 C 60 90, 120 92, 150 90 S 230 105, 310 95"/><path d="M110 60 C 130 75, 140 85, 150 90"/></g>` +
    `<path d="M200 30 L200 125" stroke="#fff" stroke-dasharray="3 3"/>` + T(205, 140, "transect spans the braidplain", "#fff", 9) + T(5, 12, "green: braidplain · yellow: bars", "#cfd4d9", 9)),
    s:["Braidplain: the connected channel network is closed and its holes filled, giving the active channel belt.","Bars: land patches inside the braidplain.","Channel count: transects across the full braidplain width count wet channels.","Total sinuosity: all channel length ÷ braidplain axis length."]},
};
const ARROW = `<svg width="0" height="0" style="position:absolute"><defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10z" fill="#cfd4d9"/></marker></defs></svg>`;
document.body.insertAdjacentHTML("beforeend", ARROW);
function modxHTML(k, open){ const m = MODX[k]; return m ? `<details class="how"${open ? " open" : ""}><summary>ⓘ ${m.t}</summary>${m.d}<ol>${m.s.map(x => `<li>${x}</li>`).join("")}</ol><p class="note">Tap any result row for its formula and your numbers.</p></details>` : ""; }
[["water","water"],["channel","channel"],["network","network"],["lakes","lakes"],["pattern","pattern"],["cover","cover"],["terrain","terrain"],["change","change"]].forEach(([p, k]) => {
  const panel = $("p-" + p); if (!panel) return; const h3 = panel.querySelector("h3");
  h3.insertAdjacentHTML("afterend", modxHTML(k));
});
$("res-channelx").insertAdjacentHTML("beforebegin", modxHTML("chx"));
$("res-delta").insertAdjacentHTML("beforebegin", modxHTML("delta"));
$("res-braid").insertAdjacentHTML("beforebegin", modxHTML("braid"));
function renderLearn(){
  const q = ($("glSearch").value || "").toLowerCase();
  const MODN = {channelx:"Channel+", networkx:"Junctions", delta:"Delta", braid:"Braided", field:"Pattern map", water:"Water", channel:"Channel", network:"Network", lakes:"Lakes", pattern:"Pattern", cover:"Cover", terrain:"Terrain", hydro:"Flow & drainage", change:"Change", measure:"Measure"};
  const items = Object.entries(GL).filter(([k, g]) => !q || (k + g[0] + g[1] + g[2]).toLowerCase().includes(q));
  $("glList").innerHTML = items.map(([k, g]) => { const [m, n] = k.split(":"); return `<details class="gl"><summary>${n} <small>${MODN[m]}</small></summary><div class="ex"><div><span class="exh">What</span>${g[0]}</div>${g[1] ? `<div><span class="exh">How it's calculated</span>${g[1]}</div>` : ""}${g[2] ? `<div><span class="exh">How to read it</span>${g[2]}</div>` : ""}</div></details>`; }).join("");
}
$("learnMods").innerHTML = Object.keys(MODX).map(k => modxHTML(k)).join("");
$("glSearch").oninput = renderLearn; renderLearn();
