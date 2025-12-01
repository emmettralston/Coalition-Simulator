
// State for current formation
const state = {
  chosen: new Set(),       // selected houses
  allocations: {},         // house assigned portfolios
  locked: false,           // blocks edits after evaluation
  caretaker: false,        // true when a failed attempt installs caretaker
  lmwcMinSurplus: null,    // smallest surplus among minimal coalitions
  evaluated: false,        // has legislature voted
  minPartyCount: null      // fewest parties needed to hit majority
};

// Coalition math helpers

// Sum seats for a set of member IDs
function coalitionSeats(members){
  return members.reduce((sum,m)=> sum + HOUSES.find(h=>h.id===m).seats, 0);
}
// Check if a coalition meets the majority threshold
function isMajority(members){ return coalitionSeats(members) >= MAJORITY; }

// True when coalition is a winner and uses the minimum number of parties possible
function isMinimalWinning(members){
  if(!isMajority(members)) return false;
  if(state.minPartyCount === null) return false;
  return members.length === state.minPartyCount;
}

// Seats above the majority line
function surplusSeats(members){
  return coalitionSeats(members) - MAJORITY;
}

// Find the smallest party count that can reach majority across all subsets
function computeMinPartyCountForMajority(){
  const n = HOUSES.length;
  let minCount = null;
  for(let mask=1; mask < (1<<n); mask++){
    const members = [];
    for(let i=0;i<n;i++){ if(mask & (1<<i)) members.push(HOUSES[i].id); }
    if(isMajority(members)){
      if(minCount === null || members.length < minCount) minCount = members.length;
    }
  }
  return minCount;
}

// Find the lowest surplus among all minimal winning coalitions
function computeMinSurplusAcrossMWCs(){
  const n = HOUSES.length;
  let minSurplus = Infinity;
  for(let mask=1; mask < (1<<n); mask++){
    const members = [];
    for(let i=0;i<n;i++){ if(mask & (1<<i)) members.push(HOUSES[i].id); }
    if(isMinimalWinning(members)){
      const s = surplusSeats(members);
      if(s < minSurplus) minSurplus = s;
    }
  }
  return (minSurplus === Infinity) ? null : minSurplus;
}
// True when coalition is minimal and matches the lowest surplus found
function isLeastMWC(members){
  if(!isMinimalWinning(members)) return false;
  if(state.lmwcMinSurplus === null) return false;
  return surplusSeats(members) === state.lmwcMinSurplus;
}

// Label for coalition outcome
function coalitionType(members){
  if(isLeastMWC(members)) return "Least Minimal Winning Coalition (LMWC)";
  if(isMinimalWinning(members)) return "Minimal Winning Coalition (MWC)";
  if(isMajority(members)) return "Surplus Majority";
  return "Not a Government";
}

// Connected when policy spread is less than 5 points
function isConnected(members){
  if(members.length===0) return false;
  const positions = members.map(m=> HOUSES.find(x=>x.id===m)?.x ?? 0);
  const maxPos = Math.max(...positions);
  const minPos = Math.min(...positions);
  return (maxPos - minPos) < 5;
}

// Portfolio proportionality

// Seat share per member
function proportionalShares(members){
  const total = coalitionSeats(members);
  const out={};
  members.forEach(m=>{ out[m] = HOUSES.find(h=>h.id===m).seats/total; });
  return out;
}
// Score 0–100, lower mean absolute deviation between seat share and portfolio share yields higher score
function proportionalityScore(members, alloc){
  if(members.length===0) return 0;
  const prop = proportionalShares(members);
  const totalPorts = PORTFOLIOS.length;
  const actual = {};
  members.forEach(m=>{ actual[m] = ((alloc[m]||[]).length)/Math.max(1,totalPorts); });
  const mad = members.reduce((s,m)=> s + Math.abs(prop[m] - (actual[m]||0)), 0)/members.length;
  return Math.max(0, Math.round(100*(1 - 2*mad)));
}

// Document object model helper to create elements with attributes
function el(tag, attrs={}, children=[]){
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v])=>{
    if(k==="class") node.className=v;
    else if(k==="html") node.innerHTML=v;
    else node.setAttribute(k,v);
  });
  (Array.isArray(children)?children:[children]).forEach(ch=>{ if(ch) node.appendChild(ch); });
  return node;
}

// Houses table with checkboxes
function renderParties(){
  const wrap = document.getElementById('party-list');
  wrap.innerHTML='';
  const table = el('table');
  const thead = el('thead',{}, el('tr',{},[
    el('th',{html:'Pick'}), el('th',{html:'House'}), el('th',{html:'Seats'}), el('th',{html:'Policy'})
  ]));
  const tbody = el('tbody');

  HOUSES.forEach(h=>{
    const cb = el('input',{type:'checkbox'});
    cb.checked = state.chosen.has(h.id);
    cb.disabled = state.locked;
    cb.addEventListener('change',()=>{
      if(state.locked) return;
      if(cb.checked) state.chosen.add(h.id); else state.chosen.delete(h.id);
      ensureAllocForCoalition();
      renderSummary();
      renderPortfolios();
    });
    const tr = el('tr',{},[
      el('td',{},cb),
      el('td',{html:h.id}),
      el('td',{html:String(h.seats)}),
      el('td',{html:(h.x>0?'+':'')+h.x})
    ]);
    tbody.appendChild(tr);
  });
  table.appendChild(thead); table.appendChild(tbody);
  wrap.appendChild(table);
}

// Keep allocations in sync with chosen coalition
function ensureAllocForCoalition(){
  const chosen = [...state.chosen];
  Object.keys(state.allocations).forEach(k=>{ if(!state.chosen.has(k)) delete state.allocations[k]; });
  chosen.forEach(m=>{ if(!state.allocations[m]) state.allocations[m]=[]; });
}

// Update key performance indicators (KPIs), status badge, government type, and caretaker banner
function renderSummary(){
  const members = [...state.chosen];
  const seats = coalitionSeats(members);
  document.getElementById('kpi-majority').textContent = `${MAJORITY}/${TOTAL_SEATS}`;
  document.getElementById('kpi-seats').textContent = `${seats}/${TOTAL_SEATS}`;
  document.getElementById('kpi-connected').textContent = members.length? (isConnected(members)?'YES':'NO') : '—';
  const status = document.getElementById('badge-status');
  if(state.evaluated){
    const type = coalitionType(members);
    status.textContent = isMajority(members) ? 'Investiture: PASSED' : 'Investiture: FAILED';
    status.style.background = isMajority(members) ? '#0f2c23' : 'rgba(69, 19, 19, 1)';
    status.style.borderColor = isMajority(members) ? '#1b5e46' : '#5e1b1b';
    document.getElementById('pill-type').textContent = `Government Type: ${type}`;
  } else {
    status.textContent = 'Legislature Must Vote';
    status.style.background = '#1b2142';
    status.style.borderColor = '#2c3560';
    document.getElementById('pill-type').textContent = 'Government Type: —';
  }
  document.getElementById('caretaker-banner').style.display = state.caretaker ? 'block' : 'none';
}

// Portfolio assignment table and proportionality score
function renderPortfolios(){
  const div = document.getElementById('portfolio-table');
  div.innerHTML='';
  const members = [...state.chosen];

  const tbl = el('table');
  tbl.appendChild(el('thead',{}, el('tr',{},[
    el('th',{html:'Portfolio'}), el('th',{html:'Assigned to'})
  ])));
  const body = el('tbody');
  const taken = new Map();
  for(const [house,ports] of Object.entries(state.allocations)){ ports.forEach(p=> taken.set(p,house)); }

  PORTFOLIOS.forEach(p=>{
    const sel = el('select',{class:'input'});
    sel.disabled = state.locked || members.length===0;
    sel.appendChild(el('option',{value:'',html:'(unassigned)'}));
    members.forEach(m=>{
      const opt = el('option',{value:m,html:m});
      if(taken.get(p)===m) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change',()=>{
      if(state.locked || members.length===0) return;
      for(const h of Object.keys(state.allocations)){
        state.allocations[h] = state.allocations[h].filter(x=>x!==p);
      }
      const to = sel.value;
      if(to){ state.allocations[to].push(p); }
      updateProportionalityScore();
    });
    const tr = el('tr',{},[
      el('td',{html:p}),
      el('td',{}, sel)
    ]);
    body.appendChild(tr);
  });
  tbl.appendChild(body);
  div.appendChild(tbl);
  updateProportionalityScore();
}

// Show proportionality score when eligible
function updateProportionalityScore(){
  const members = [...state.chosen];
  const score = proportionalityScore(members, state.allocations);
  document.getElementById('proportionality-score').textContent = (members.length && state.evaluated) ? (score+"/100") : '—';
}

// Require every portfolio to be assigned to a member in the coalition
function allPortfoliosAssigned(members){
  if(members.length===0) return false;
  const assigned = new Set();
  for(const [house, ports] of Object.entries(state.allocations)){
    if(!members.includes(house)) continue;
    ports.forEach(p=>assigned.add(p));
  }
  return PORTFOLIOS.every(p=>assigned.has(p));
}

// Evaluate coalition then freeze state and show results
function evaluate(){
  if(state.locked) return;
  const members = [...state.chosen];
  if(!allPortfoliosAssigned(members)){
    alert('Assign all cabinet portfolios to coalition members before evaluating.');
    return;
  }
  state.evaluated = true;
  const passed = isMajority(members);

  // Freeze the attempt after a vote, failed votes trigger caretaker
  state.locked = true;
  state.caretaker = !passed;
  document.getElementById('btn-eval').disabled = true;

  renderSummary();
  updateProportionalityScore();
}

// Reset all state and re-render UI
function reset(){
  state.chosen = new Set();
  state.allocations = {};
  state.locked = false;
  state.caretaker = false;
  state.evaluated = false;
  // Recompute coalition thresholds for this scenario
  state.minPartyCount = computeMinPartyCountForMajority();
  state.lmwcMinSurplus = computeMinSurplusAcrossMWCs();
  renderParties();
  renderSummary();
  renderPortfolios();
  document.getElementById('proportionality-score').textContent='—';
  document.getElementById('btn-eval').disabled = false;
}

// bootstrap
document.getElementById('btn-reset').addEventListener('click', reset);
document.getElementById('btn-eval').addEventListener('click', evaluate);
reset();
