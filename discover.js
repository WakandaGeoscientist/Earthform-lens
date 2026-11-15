/* ===================== Discover: curated places ===================== */
const PLACES = [
  // [name, caption, category, lat, lon, cameraDistance_m, why, bestTab]
  ["Monterey Canyon","Monterey Bay, California, United States","seafloor",36.75,-122.1,90000,"One of the largest submarine canyons on the US Pacific coast, cut into the shelf and winding down the continental slope. Switch Google Earth to show the ocean floor; Earthform Lens traces the canyon and its tributary gullies.","network"],
  ["Congo Canyon and fan channel","Congo Canyon, offshore Angola and DR Congo","seafloor",-6.0,10.5,600000,"The Congo River runs straight into a deep canyon that continues as a meandering submarine channel for hundreds of kilometres. Try the meander measures on it.","channel"],
  ["Bengal Fan channels","Bay of Bengal, Indian Ocean","seafloor",15.0,88.0,1500000,"The world's largest submarine fan, built by Ganges–Brahmaputra sediment. Look for long, sinuous channels and abandoned loops on the fan surface.","channel"],
  ["Hudson Canyon","Offshore New York, United States","seafloor",39.5,-72.4,250000,"A shelf-edge canyon fed by the drowned Hudson valley, with gullies cutting the slope on both sides.","network"],
  ["Amazon at Parintins","Parintins, Amazonas, Brazil","rivers",-2.6,-56.7,160000,"The Amazon weaves between islands, with dark blackwater tributaries joining the sediment-laden main river. Good for tributaries, side channels and islands.","network"],
  ["Meeting of the Waters","Manaus, Amazonas, Brazil","rivers",-3.13,-59.9,60000,"The black Rio Negro meets the tan Solimões and the two run side by side without mixing for kilometres.","network"],
  ["Manaus forest edge","Manaus, Amazon Rainforest, Brazil","edges",-2.985,-59.945,9000,"A razor-straight boundary where city blocks stop at the Adolpho Ducke forest reserve. Strong colour and texture contrast suits a split composition.","cover"],
  ["Santiago and the Andes front","Santiago, Andes Mountains, Chile","edges",-33.42,-70.52,26000,"The city's grid runs up to the steep mountain front, where faulting lifts the range above the basin. Ridges and gullies cast strong morning shadows.","pattern"],
  ["Madison isthmus","Madison, Wisconsin, United States","edges",43.075,-89.385,16000,"Two glacial lakes, Mendota and Monona, pinch the city onto a narrow isthmus. The dark water against the street grid makes a striking graphic.","lakes"],
  ["Brasília Plano Piloto","Brasília, Brazil","edges",-15.795,-47.885,16000,"A planned city shaped like an aircraft, curving along the shore of the artificial Lake Paranoá. Red cerrado soils add colour.","cover"],
  ["Vladivostok, Golden Horn Bay","Vladivostok, Russia","edges",43.11,131.89,16000,"Peninsulas and drowned river valleys (rias) wrap around dark sea, with the city terraced up the hillsides.","lakes"],
  ["Rocinha and Tijuca Forest","Rio de Janeiro, Brazil","edges",-22.988,-43.248,4500,"Dense hillside housing runs up against Atlantic rainforest on granite domes.","cover"],
  ["Palm Jumeirah","Dubai, United Arab Emirates","edges",25.115,55.135,13000,"An artificial island of dredged sand. Watch for shoreline adjustment and sediment plumes.","lakes"],
  ["Las Vegas suburban edge","Las Vegas, Nevada, United States","edges",36.17,-115.2,45000,"Sprawl ends abruptly at the desert. Alluvial fans spread from the Spring Mountains.","cover"],
  ["Sułoszowa strip fields","Sułoszowa, Poland","fields",50.27,19.71,5500,"A village along a single road with long, narrow medieval strip fields fanning out on both sides. The regular stripes suit the Pattern tool.","pattern"],
  ["Center-pivot circles, Kansas","Garden City, Kansas, United States","fields",37.95,-100.95,32000,"Irrigation circles about 800 m across, fed from the Ogallala aquifer. Their colours change with crop and season.","pattern"],
  ["Sea of Plastic, Almería","Almería, Spain","fields",36.74,-2.8,22000,"Tens of thousands of greenhouses form a bright mosaic between the mountains and the sea.","cover"],
  ["Bulb fields, Lisse","Lisse, Netherlands","fields",52.27,4.55,9000,"Tulip and hyacinth stripes in spring. In other seasons the fields are drab, so check the image date.","pattern"],
  ["Palouse hills","Palouse, Washington, United States","fields",47.0,-117.3,16000,"Rolling hills of wind-blown silt (loess dunes) under contour-ploughed wheat. Field edges trace the topography.","pattern"],
  ["Yuanyang rice terraces","Yuanyang, Yunnan, China","fields",23.09,102.78,7000,"Hand-built terraces follow the contour lines exactly, giving a natural contour map.","pattern"],
  ["Nushagak Bay tidal channels","Nushagak Bay, Alaska, United States","rivers",59.0,-158.4,26000,"Tight tidal meanders cutting through tundra into a macrotidal bay. Good for Channel and Network.","channel"],
  ["Juruá River meanders","Juruá River, Amazonas, Brazil","rivers",-6.65,-69.87,45000,"One of the most sinuous rivers on Earth, with cut-off oxbow lakes and scroll bars recording channel migration.","channel"],
  ["Mississippi oxbows","Mississippi River, Greenville, United States","rivers",33.35,-91.15,45000,"Abandoned meander loops (oxbows) and the modern, engineered channel. Compare dates with Change.","channel"],
  ["Horseshoe Bend","Horseshoe Bend, Arizona, United States","rivers",36.879,-111.51,3200,"An entrenched meander: the Colorado River cut down through sandstone while keeping its loop.","channel"],
  ["Anavilhanas archipelago","Rio Negro, Amazonas, Brazil","rivers",-2.6,-60.9,55000,"Hundreds of long, thin islands in a blackwater river, an anabranching planform.","network"],
  ["Waimakariri braided river","Waimakariri River, New Zealand","rivers",-43.43,172.25,22000,"A classic gravel braided river with many threads splitting and rejoining. Try the channel count index.","channel"],
  ["Betsiboka River delta","Betsiboka Delta, Madagascar","deltas",-15.85,46.35,60000,"Red, sediment-laden water from eroded highlands fills a tide-dominated estuary with sandbars.","network"],
  ["Lena River delta","Lena Delta, Russia","deltas",72.8,126.5,420000,"A vast Arctic delta with thousands of thaw lakes and distributary channels.","lakes"],
  ["Sundarbans","Sundarbans, Bangladesh","deltas",21.95,89.15,85000,"Mangrove islands cut by a dense web of tidal creeks, ideal for network loops and channel density.","network"],
  ["Okavango Delta","Okavango Delta, Botswana","deltas",-19.3,22.9,160000,"An inland delta that ends in the Kalahari. Channels fan out and the water evaporates rather than reaching the sea.","network"],
  ["Jade Bay tidal flats","Jadebusen, Germany","deltas",53.48,8.18,40000,"Wadden Sea tidal channels branching like trees across mudflats. Use low-tide imagery.","network"],
  ["Sossusvlei, Namib Sand Sea","Sossusvlei, Namib Desert, Namibia","deserts",-24.73,15.29,32000,"Star and linear dunes of red, iron-stained sand around dry clay pans. Run the Pattern tool on them.","pattern"],
  ["Richat Structure","Richat Structure, Mauritania","deserts",21.124,-11.402,65000,"A 40 km eroded dome whose concentric rings of rock are exposed by erosion.","pattern"],
  ["Erg Chebbi","Erg Chebbi, Morocco","deserts",31.15,-3.97,32000,"Star dunes up to about 150 m high at the edge of the Sahara.","pattern"],
  ["Rub' al Khali","Rub' al Khali, Saudi Arabia","deserts",20.5,50.9,45000,"The Empty Quarter: mega-dunes with interdune salt flats.","pattern"],
  ["White Sands","White Sands, New Mexico, United States","deserts",32.8,-106.33,26000,"Gypsum dunes that migrate north-east with the wind. Crest trends record the wind direction.","pattern"],
  ["Malaspina Glacier","Malaspina Glacier, Alaska, United States","ice",59.85,-140.55,95000,"A piedmont glacier spreading onto the coastal plain. Folded medial moraines record surges.","pattern"],
  ["Everest and the Khumbu","Mount Everest, Nepal","ice",27.988,86.925,22000,"High peaks, cirques and the debris-covered Khumbu Glacier.","pattern"],
  ["Salar de Uyuni","Salar de Uyuni, Bolivia","ice",-20.13,-67.49,160000,"The largest salt flat on Earth, with hexagonal salt crusts and island hills.","cover"],
  ["Mount Taranaki","Mount Taranaki, New Zealand","volcano",-39.296,174.064,55000,"A near-perfect cone, with a circular national park boundary separating forest from farmland.","cover"],
  ["Grand Prismatic Spring","Grand Prismatic Spring, Wyoming, United States","volcano",44.525,-110.838,1600,"Rings of microbial mats coloured by water temperature around a hot spring.","cover"],
  ["Lake Natron","Lake Natron, Tanzania","volcano",-2.42,36.05,65000,"An alkaline rift-valley lake turned red by salt-loving microbes.","lakes"],
  ["Great Blue Hole","Great Blue Hole, Belize","coasts",17.316,-87.535,3500,"A drowned karst sinkhole on a reef atoll, a dark circle in turquoise water.","lakes"],
];
const PCATS = [["all","All"],["edges","City edges"],["fields","Field patterns"],["rivers","Rivers"],["deltas","Deltas & tidal"],["deserts","Deserts"],["ice","Ice & mountains"],["volcano","Volcanic"],["coasts","Coasts"],["seafloor","Seafloor"]];
let pcat = "all";
const earthURL = p => `https://earth.google.com/web/@${p[3]},${p[4]},0a,${p[5]}d,35y,0h,0t,0r`;
const mapsURL = p => { const z = Math.max(3, Math.min(19, Math.round(Math.log2(40000000/p[5]*1.4)))); return `https://www.google.com/maps/@?api=1&map_action=map&center=${p[3]},${p[4]}&zoom=${z}&basemap=satellite`; };
const copURL = p => { const z = Math.max(3, Math.min(17, Math.round(Math.log2(40000000/p[5]*1.4)))); return `https://browser.dataspace.copernicus.eu/?zoom=${z}&lat=${p[3]}&lng=${p[4]}`; };
const TABN = {channel:"Channel", network:"Network", lakes:"Lakes", pattern:"Pattern", cover:"Cover"};
function renderDiscover(){
  const cats = $("dCats"); cats.innerHTML = "";
  PCATS.forEach(([k, n]) => { const b = document.createElement("button"); b.className = "chip" + (pcat === k ? " on" : ""); b.textContent = n; b.onclick = () => { pcat = k; renderDiscover(); }; cats.appendChild(b); });
  const q = ($("dSearch").value || "").toLowerCase();
  const list = PLACES.filter(p => (pcat === "all" || p[2] === pcat) && (!q || (p[0] + p[1] + p[6]).toLowerCase().includes(q)));
  $("dList").innerHTML = list.map(p => {
    const i = PLACES.indexOf(p);
    return `<div class="place"><div class="ph"><b>${p[0]}</b><span>${PCATS.find(c => c[0] === p[2])[1]}</span></div>
      <div class="pc">${p[1]} · <span class="mono">${Math.abs(p[3]).toFixed(2)}°${p[3] >= 0 ? "N" : "S"} ${Math.abs(p[4]).toFixed(2)}°${p[4] >= 0 ? "E" : "W"}</span></div>
      <p>${p[6]}</p><div class="pb"><a class="lnk" href="${earthURL(p)}" target="_blank" rel="noopener">Google Earth ↗</a><a class="lnk" href="${mapsURL(p)}" target="_blank" rel="noopener">Maps satellite ↗</a><a class="lnk" href="${copURL(p)}" target="_blank" rel="noopener">Sentinel‑2 ↗</a>
      <button class="sm" data-cap="${i}">Use as caption</button></div><div class="pt">Best Lab tool: ${TABN[p[7]]}</div></div>`;
  }).join("") || '<p class="note">No places match.</p>';
  $("dList").querySelectorAll("[data-cap]").forEach(b => b.onclick = () => {
    const p = PLACES[+b.dataset.cap]; window.__pendingPlace = {caption: p[1], name: p[0], lat: p[3], lon: p[4]};
    $("dPending").innerHTML = `Next image will be captioned <b>${p[1]}</b>. <button class="sm" id="dClear">Clear</button>`;
    $("dClear").onclick = () => { window.__pendingPlace = null; $("dPending").innerHTML = ""; };
    if (G.D && window.__studio && window.__studio.hasImage()){ G.place = window.__pendingPlace; toast("Caption set: " + p[1]); applyPlaceCaption(); }
    else toast("Saved. Screenshot the place, then open the image here.");
  });
}
function applyPlaceCaption(){
  if (!G.place || !window.__studio) return;
  window.__studio.setStyle({title: G.place.caption, sub: "", capStyle: "box", capPos: "br", border: "none", ov: "off"});
  G.artText = {title: G.place.caption, sub: ""};
  if ($("app-report").classList.contains("on") && G.autoLog) renderReport();
}
$("dSearch").oninput = () => renderDiscover();
$("dRandom").onclick = () => { const p = PLACES[Math.floor(Math.random()*PLACES.length)]; pcat = "all"; $("dSearch").value = p[0]; renderDiscover(); };
renderDiscover();
