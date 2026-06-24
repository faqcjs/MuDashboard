// ─── Constantes ───────────────────────────────────────────
const PROFILE_API   = 'https://www.baldunetamu.com/api/characters/public-profile';
const RANKING_API   = 'https://www.baldunetamu.com/api/ranking/level';
const PROFILE_URL   = 'https://www.baldunetamu.com/es/profile/';
const REALM         = 'balduneta_v2';
const REFRESH_SECS  = 30;
const STORAGE_KEY   = 'mu_characters';

const CLASS_MAP = {
  2: { name:'Dark Wizard',       filter:'dw' },
  18:{ name:'Dark Knight',       filter:'dk' },
  34:{ name:'Elf',               filter:'elf'},
  50:{ name:'Magic Gladiator',   filter:'mg' },
  66:{ name:'Lord Emperor',      filter:'lord'},
  82:{ name:'Summoner',          filter:'sum'},
  98:{ name:'Rage Fighter',      filter:'rf' },
  // variantes (clases intermedias comunes en S6)
  0: { name:'Dark Wizard',       filter:'dw' },
  1: { name:'Dark Knight',       filter:'dk' },
  16:{ name:'Dark Wizard',       filter:'dw' },
  17:{ name:'Dark Knight',       filter:'dk' },
  33:{ name:'Elf',               filter:'elf'},
  48:{ name:'Magic Gladiator',   filter:'mg' },
  64:{ name:'Lord Emperor',      filter:'lord'},
  80:{ name:'Summoner',          filter:'sum'},
  81:{ name:'Summoner',          filter:'sum'},
  96:{ name:'Rage Fighter',      filter:'rf' },
};

// ─── EXP por Master Level ────────────────────────────────
function expForML(n) {
  return n * (35208100 + n * 240000);
}

// ─── Estado ───────────────────────────────────────────────
let characters  = [];    // [{name, profileData, rankingData}]
let currentIdx  = 0;
let countdown   = REFRESH_SECS;
let refreshTimer = null;

// ─── LocalStorage ─────────────────────────────────────────
function loadStorage() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function saveStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(characters.map(c => c.name)));
}

// ─── Utilidades ───────────────────────────────────────────
function formatNum(n) {
  n = parseInt(n);
  if (isNaN(n)||n<=0) return '0';
  if (n>=1e9) return (n/1e9).toFixed(2)+'B';
  if (n>=1e6) return (n/1e6).toFixed(1)+'M';
  if (n>=1e3) return (n/1e3).toFixed(0)+'K';
  return n.toLocaleString();
}
function posColor(pos) {
  if (pos==1) return 'text-[#fbbf24]';
  if (pos==2) return 'text-slate-400';
  if (pos==3) return 'text-[#cd7c3a]';
  return 'text-slate-500';
}
function openProfile(name) {
  window.open(PROFILE_URL + encodeURIComponent(name) + '?realm=' + REALM, '_blank');
}
function searchProfile(e) {
  e.preventDefault();
  const name = document.getElementById('search-input').value.trim();
  if (name) openProfile(name);
}
function classInfo(classId) {
  return CLASS_MAP[classId] || { name:'Clase '+classId, filter:'sum' };
}

// ─── Fetch profile ─────────────────────────────────────────
async function fetchProfile(name) {
  const res = await fetch(`${PROFILE_API}?name=${encodeURIComponent(name)}&realm=${REALM}`);
  if (!res.ok) throw new Error('HTTP '+res.status);
  const json = await res.json();
  if (!json.success || !json.data) throw new Error('Personaje no encontrado');
  return json.data;
}

async function fetchRanking(classId) {
  const info = classInfo(classId);
  const res = await fetch(`${RANKING_API}?realm=${REALM}&classFilter=${info.filter}`);
  if (!res.ok) throw new Error('HTTP '+res.status);
  const json = await res.json();
  return json.ranking || [];
}

// ─── Onboarding ───────────────────────────────────────────
async function addCharacterOnboard() {
  const input = document.getElementById('onboard-input');
  const err   = document.getElementById('onboard-error');
  const load  = document.getElementById('onboard-loading');
  const name  = input.value.trim();

  err.classList.add('hidden');
  if (!name) { err.textContent='Ingresá un nombre.'; err.classList.remove('hidden'); return; }

  load.classList.remove('hidden');
  try {
    await addCharacter(name);
    document.getElementById('onboarding').style.display='none';
  } catch(e) {
    err.textContent = e.message === 'Personaje no encontrado'
      ? 'No se encontró el personaje. Revisá el nombre.'
      : 'Error de conexión. Intentá de nuevo.';
    err.classList.remove('hidden');
  } finally {
    load.classList.add('hidden');
  }
}

// ─── Agregar personaje ────────────────────────────────────
async function addCharacter(name) {
  // Evitar duplicados
  if (characters.find(c => c.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('El personaje ya está agregado.');
  }
  const profile = await fetchProfile(name);
  const classId = profile.character.class;
  const ranking = await fetchRanking(classId);
  characters.push({ name: profile.character.name, profile, ranking });
  saveStorage();
  renderTabs();
  selectChar(characters.length - 1);
}

// ─── Quitar personaje ─────────────────────────────────────
function removeChar(idx) {
  characters.splice(idx, 1);
  saveStorage();
  if (characters.length === 0) {
    document.getElementById('onboarding').style.display='flex';
    document.getElementById('char-tabs').innerHTML='';
    document.getElementById('table-wrap').innerHTML='<div class="text-center py-16 text-slate-500 text-sm">Seleccioná un personaje para ver el ranking.</div>';
    document.getElementById('c-rank').textContent='—';
    return;
  }
  currentIdx = Math.min(idx, characters.length-1);
  renderTabs();
  renderAll(currentIdx);
}

// ─── Agregar nuevo desde header ───────────────────────────
async function promptAddChar() {
  const name = prompt('Nombre del nuevo personaje:');
  if (!name || !name.trim()) return;
  try {
    await addCharacter(name.trim());
  } catch(e) {
    alert(e.message);
  }
}

// ─── Tabs ─────────────────────────────────────────────────
function renderTabs() {
  const tabs = document.getElementById('char-tabs');
  tabs.innerHTML = characters.map((c,i) => `
    <button id="tab-${i}" onclick="selectChar(${i})"
      class="${i===currentIdx?'tab-active':'tab-inactive'} cinzel text-xs tracking-widest py-3 px-1 whitespace-nowrap transition-colors flex items-center gap-1.5">
      ${c.name}
      <span onclick="event.stopPropagation();removeChar(${i})"
        class="text-slate-600 hover:text-red-400 transition-colors text-base leading-none ml-1" title="Quitar">×</span>
    </button>
  `).join('') + `
    <button onclick="promptAddChar()" class="ml-2 text-slate-600 hover:text-[#c084fc] transition-colors text-lg leading-none py-3 shrink-0" title="Agregar personaje">+</button>
  `;
}

function selectChar(idx) {
  currentIdx = idx;
  renderTabs();
  showCardSkeleton();
  showTableSkeleton();
  renderAll(idx);
}

// ─── Render card ──────────────────────────────────────────
function renderCard(c) {
  const ch    = c.profile.character;
  const stats = c.profile.stats || {};
  const base  = stats.base  || {};
  const combat= stats.combat|| {};
  const info  = classInfo(ch.class);

  // Busco en ranking
  const ranking = c.ranking || [];
  const topGs   = ranking.length ? Math.max(...ranking.map(r=>r.GearScore)) : 0;
  const me      = ranking.find(r => r.Name.toLowerCase() === ch.name.toLowerCase());

  document.getElementById('c-rank').textContent   = me ? '#'+me.RankingPos : '—';
  document.getElementById('c-name').textContent   = ch.name;
  document.getElementById('c-class').textContent  = info.name;
  document.getElementById('c-guild').textContent  = ch.guild || 'Sin guild';
  const locStatus = getLocationStatus(ch.location, ch.isOnline);
  document.getElementById('c-online').innerHTML = locStatus ? `<span class="${locStatus.color} text-xs font-medium">${locStatus.text}</span>` : '';

  document.getElementById('c-gs').textContent     = ch.gearScore;
  document.getElementById('c-gs-vs').textContent  = topGs
    ? (ch.gearScore >= topGs ? '🏆 Mayor GS' : `Top: ${topGs} (−${topGs-ch.gearScore})`)
    : '';

  document.getElementById('c-ml').textContent     = me ? me.MasterLevel : '—';
  if (me) {
    const expVal = parseInt(me.MasterExperience) || 0;
    saveExpOnLoad(ch.name, expVal);
    const delta = getExpDelta(ch.name, expVal);
    const deltaStr = delta ? ` <span class="text-[10px] text-[#34d399]">(+${formatNum(delta)})</span>` : '';
    document.getElementById('c-exp').innerHTML = formatNum(expVal) + deltaStr;
  } else {
    document.getElementById('c-exp').textContent = '—';
  }
  document.getElementById('c-resets').textContent = ch.resets;
  document.getElementById('c-level').textContent  = ch.level;

  document.getElementById('c-kills').textContent  = (ch.kills||0).toLocaleString();
  document.getElementById('c-deaths').textContent = (ch.deads||0).toLocaleString();

  document.getElementById('s-str').textContent    = base.strength   || 0;
  document.getElementById('s-agi').textContent    = base.dexterity  || 0;
  document.getElementById('s-vit').textContent    = base.vitality   || 0;
  document.getElementById('s-ene').textContent    = base.energy     || 0;
  document.getElementById('s-cmd').textContent    = base.leadership || 0;

  document.getElementById('s-life').textContent   = formatNum(combat.maxLife   || 0);
  document.getElementById('s-mana').textContent   = formatNum(combat.maxMana   || 0);
  document.getElementById('s-bp').textContent     = formatNum(combat.maxBP     || 0);
  document.getElementById('s-shield').textContent = formatNum(combat.shield    || 0);

  document.getElementById('ranking-class-label').textContent = info.name;
  hideCardSkeleton();

  // Master EXP progress bar
  if (me) {
    const ml     = parseInt(me.MasterLevel);
    const expNow = parseInt(me.MasterExperience);
    const expForNext = expForML(ml + 1);
    const expForCurr = expForML(ml);
    const pct    = Math.min(100, Math.max(0, ((expNow - expForCurr) / (expForNext - expForCurr)) * 100));
    const missing = Math.max(0, expForNext - expNow);

    document.getElementById('ml-current').textContent  = ml;
    document.getElementById('ml-next').textContent     = ml + 1;
    document.getElementById('ml-bar').style.width      = pct.toFixed(1) + '%';
    document.getElementById('ml-exp-current').textContent = formatNum(expNow);
    document.getElementById('ml-exp-missing').textContent = formatNum(missing);
    document.getElementById('ml-exp-needed').textContent  = formatNum(expForNext);
  } else {
    document.getElementById('ml-current').textContent = '—';
    document.getElementById('ml-next').textContent    = '—';
    document.getElementById('ml-bar').style.width     = '0%';
    document.getElementById('ml-exp-current').textContent = '—';
    document.getElementById('ml-exp-missing').textContent = '—';
    document.getElementById('ml-exp-needed').textContent  = '—';
  }
}

// ─── Render tabla ─────────────────────────────────────────
function renderTable(c) {
  const ranking = c.ranking || [];
  const myName  = c.name.toLowerCase();

  if (!ranking.length) {
    document.getElementById('table-wrap').innerHTML =
      '<div class="text-center py-12 text-slate-500 text-sm">No hay datos de ranking para esta clase.</div>';
    return;
  }

  const rows = ranking.map(r => {
    const isMe = r.Name.toLowerCase() === myName;
    return `
      <tr onclick="openModalProfile('${r.Name}')" class="${isMe?'bg-[#34d399]/5 border-l-2 border-[#34d399]':''} border-b border-white/5 hover:bg-white/[0.04] transition-colors">
        <td class="px-4 py-3 cinzel font-bold text-sm ${posColor(parseInt(r.RankingPos))}">#${r.RankingPos}</td>
        <td class="px-4 py-3 text-sm ${isMe?'font-bold text-[#34d399]':'font-medium text-slate-200 hover:text-[#c084fc]'}">
          ${r.Name}${isMe?' ←':''}
        </td>
        <td class="px-4 py-3 hidden sm:table-cell">
          ${r.Guild&&r.Guild!=='No Guild'?`<span class="text-xs text-slate-400 bg-white/5 rounded px-2 py-0.5">${r.Guild}</span>`:'<span class="text-slate-600 text-xs">—</span>'}
        </td>
        <td class="px-4 py-3 font-semibold text-[#c084fc] text-sm">${r.MasterLevel}</td>
        <td class="px-4 py-3 text-[#fbbf24] text-xs">${formatNum(r.MasterExperience)}</td>
        <td class="px-4 py-3 text-[#f97316] font-medium text-sm hidden sm:table-cell">${r.GearScore}</td>
        <td class="px-4 py-3 text-slate-500 text-xs hidden md:table-cell">${r.ResetCount}r · lv${r.cLevel}</td>
      </tr>`;
  }).join('');

  document.getElementById('table-wrap').innerHTML = `
    <table class="w-full text-sm min-w-[380px]">
      <thead>
        <tr class="border-b border-[#1e1e2e]">
          <th class="px-4 py-3 text-left text-[10px] uppercase tracking-widest text-slate-500 font-medium">#</th>
          <th class="px-4 py-3 text-left text-[10px] uppercase tracking-widest text-slate-500 font-medium">Nombre</th>
          <th class="px-4 py-3 text-left text-[10px] uppercase tracking-widest text-slate-500 font-medium hidden sm:table-cell">Guild</th>
          <th class="px-4 py-3 text-left text-[10px] uppercase tracking-widest text-slate-500 font-medium">ML</th>
          <th class="px-4 py-3 text-left text-[10px] uppercase tracking-widest text-slate-500 font-medium">EXP</th>
          <th class="px-4 py-3 text-left text-[10px] uppercase tracking-widest text-slate-500 font-medium hidden sm:table-cell">GS</th>
          <th class="px-4 py-3 text-left text-[10px] uppercase tracking-widest text-slate-500 font-medium hidden md:table-cell">Info</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function renderAll(idx) {
  const c = characters[idx];
  if (!c) return;
  renderCard(c);
  renderTable(c);
}

// ─── Refresh ──────────────────────────────────────────────
async function refreshCurrent() {
  const c = characters[currentIdx];
  if (!c) return;
  showCardSkeleton();
  showTableSkeleton();
  try {
    const profile = await fetchProfile(c.name);
    const classId = profile.character.class;
    const ranking = await fetchRanking(classId);
    characters[currentIdx].profile = profile;
    characters[currentIdx].ranking = ranking;
    renderAll(currentIdx);
  } catch(e) { /* silencioso */ }
  countdown = REFRESH_SECS;
}

// ─── Safe zones ───────────────────────────────────────────
const SAFE_ZONES = [
  { map: 38, x: 71,  y: 106 },
  { map: 4,  x: 94,  y: 86  },
  { map: 4,  x: 20,  y: 217 },
];
const SAFE_RADIUS = 5;

function getLocationStatus(location, isOnline) {
  if (!isOnline) return null;
  if (!location) return { text: '⚔️ Farmeando', color: 'text-[#f97316]' };

  const { map, x, y } = location;
  const inSafe = SAFE_ZONES.some(z =>
    z.map === map &&
    Math.abs(z.x - x) <= SAFE_RADIUS &&
    Math.abs(z.y - y) <= SAFE_RADIUS
  );

  return inSafe
    ? { text: '🛡️ En safe',    color: 'text-[#34d399]' }
    : { text: '⚔️ Farmeando', color: 'text-[#f97316]' };
}

// ─── Skeletons ────────────────────────────────────────────
function showCardSkeleton() {
  document.getElementById('card-skeleton').classList.remove('hidden');
  document.getElementById('card-content').classList.add('invisible');
}

function hideCardSkeleton() {
  document.getElementById('card-skeleton').classList.add('hidden');
  document.getElementById('card-content').classList.remove('invisible');
}

function showTableSkeleton() {
  document.getElementById('table-wrap').innerHTML = `
    <div class="p-4 space-y-2">
      ${[1,2,3,4,5,6,7,8].map(i=>`
        <div class="flex gap-4 items-center px-2 py-2">
          <div class="skeleton h-4 w-8 rounded"></div>
          <div class="skeleton h-4 w-28 rounded"></div>
          <div class="skeleton h-4 w-20 rounded hidden sm:block"></div>
          <div class="skeleton h-4 w-10 rounded"></div>
          <div class="skeleton h-4 w-16 rounded"></div>
          <div class="skeleton h-4 w-10 rounded hidden sm:block"></div>
        </div>`).join('')}
    </div>`;
}

// ─── EXP delta (ganancia desde apertura) ─────────────────
const expOnLoad = {}; // {charName: expAtLoad}

function saveExpOnLoad(name, exp) {
  if (!expOnLoad[name]) expOnLoad[name] = parseInt(exp) || 0;
}

function getExpDelta(name, currentExp) {
  if (!expOnLoad[name]) return null;
  const delta = (parseInt(currentExp) || 0) - expOnLoad[name];
  return delta > 0 ? delta : null;
}

// ─── Modal perfil ─────────────────────────────────────────
function closeModal() {
  document.getElementById('profile-modal').classList.add('hidden');
  document.getElementById('profile-modal').classList.remove('flex');
}

async function openModalProfile(name) {
  const modal = document.getElementById('profile-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.getElementById('m-loading').classList.add('hidden');
  document.getElementById('m-error').classList.add('hidden');
  document.getElementById('modal-skeleton').classList.remove('hidden');
  document.getElementById('modal-content').classList.add('hidden');

  // Reset con skeleton en el modal
  document.querySelectorAll('#profile-modal [id^="m-"]').forEach(el => {
    if (el.tagName !== 'DIV' || el.id === 'm-loading' || el.id === 'm-error') return;
    el.innerHTML = '<span class="skeleton inline-block h-4 w-16 rounded align-middle"></span>';
  });

  // Reset fields
  ['m-name','m-class','m-guild','m-online','m-rank','m-gs','m-ml','m-resets',
   'm-level','m-kills','m-deaths','m-str','m-agi','m-vit','m-ene','m-cmd',
   'm-life','m-mana','m-bp','m-shield'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '—';
  });

  try {
    const [profileData, rankingData] = await Promise.all([
      fetchProfile(name),
      fetchProfile(name).then(p => fetchRanking(p.character.class))
    ]);

    const ch     = profileData.character;
    const stats  = profileData.stats || {};
    const base   = stats.base   || {};
    const combat = stats.combat || {};
    const info   = classInfo(ch.class);
    const ranking = rankingData;
    const meRank  = ranking.find(r => r.Name.toLowerCase() === ch.name.toLowerCase());
    const topGs   = ranking.length ? Math.max(...ranking.map(r=>r.GearScore)) : 0;

    document.getElementById('m-name').textContent   = ch.name;
    document.getElementById('m-class').textContent  = info.name;
    document.getElementById('m-guild').textContent  = ch.guild || 'Sin guild';
    const mLocStatus = getLocationStatus(ch.location, ch.isOnline);
    document.getElementById('m-online').innerHTML = mLocStatus ? `<span class="${mLocStatus.color} text-xs font-medium">${mLocStatus.text}</span>` : '';
    document.getElementById('m-rank').textContent   = meRank ? '#'+meRank.RankingPos : '—';
    document.getElementById('m-gs').textContent     = ch.gearScore;
    document.getElementById('m-ml').textContent     = meRank ? meRank.MasterLevel : '—';
    document.getElementById('m-resets').textContent = ch.resets;
    document.getElementById('m-level').textContent  = ch.level;
    document.getElementById('m-kills').textContent  = (ch.kills||0).toLocaleString();
    document.getElementById('m-deaths').textContent = (ch.deads||0).toLocaleString();
    document.getElementById('m-str').textContent    = base.strength   || 0;
    document.getElementById('m-agi').textContent    = base.dexterity  || 0;
    document.getElementById('m-vit').textContent    = base.vitality   || 0;
    document.getElementById('m-ene').textContent    = base.energy     || 0;
    document.getElementById('m-cmd').textContent    = base.leadership || 0;
    document.getElementById('m-life').textContent   = formatNum(combat.maxLife   || 0);
    document.getElementById('m-mana').textContent   = formatNum(combat.maxMana   || 0);
    document.getElementById('m-bp').textContent     = formatNum(combat.maxBP     || 0);
    document.getElementById('m-shield').textContent = formatNum(combat.shield    || 0);

  } catch(e) {
    document.getElementById('m-error').classList.remove('hidden');
  } finally {
    document.getElementById('modal-skeleton').classList.add('hidden');
    document.getElementById('modal-content').classList.remove('hidden');
  }
}

// Cerrar modal clickeando fuera
document.getElementById('profile-modal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// ─── Equipamiento ─────────────────────────────────────────
const IMG_BASE = 'https://www.baldunetamu.com';

const EXCELLENT_LABELS = {
  2:  '+Life/kill',
  4:  '+Mana/kill',
  8:  '+DMG rate',
  16: '+Wizardry',
  32: '+Atk Speed',
  64: '+Dmg%',
};

function getExcellentOpts(excellent) {
  if (!excellent) return [];
  return Object.entries(EXCELLENT_LABELS)
    .filter(([bit]) => (excellent & parseInt(bit)) !== 0)
    .map(([, label]) => label);
}

function closeEquipModal() {
  document.getElementById('equip-modal').classList.add('hidden');
  document.getElementById('equip-modal').classList.remove('flex');
  if (equipOpenedFromProfile) {
    equipOpenedFromProfile = false;
    document.getElementById('profile-modal').classList.remove('hidden');
    document.getElementById('profile-modal').classList.add('flex');
  }
}

function renderEquipSection(sectionId, title, items) {
  const el = document.getElementById(sectionId);
  if (!items.length) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div>
      <div class="cinzel text-base font-bold text-[#f97316] tracking-widest mb-4">${title}</div>
      <div class="flex flex-wrap gap-3">
        ${items.map(item => {
          const excOpts = getExcellentOpts(item.excellent);
          const rarityBorder = {
            legendary: 'border-[#fbbf24]',
            epic:      'border-[#c084fc]',
            rare:      'border-[#60a5fa]',
            uncommon:  'border-[#34d399]',
            common:    'border-white/20',
          }[item.rarity] || 'border-white/20';
          const rarityGlow = {
            legendary: 'shadow-[0_0_12px_rgba(251,191,36,0.5)]',
            epic:      'shadow-[0_0_12px_rgba(192,132,252,0.5)]',
            rare:      'shadow-[0_0_12px_rgba(96,165,250,0.4)]',
            uncommon:  'shadow-[0_0_8px_rgba(52,211,153,0.3)]',
            common:    '',
          }[item.rarity] || '';

          const tooltipLines = [
            `<div class="font-bold text-[#f97316] mb-1 uppercase text-[9px] tracking-wider">[${item.rarity.toUpperCase()}] +${item.level}</div>`,
            item.ancient ? '<div class="text-amber-300">✦ Ancient</div>' : '',
            item.skill   ? '<div class="text-blue-300">✦ Skill</div>' : '',
            item.luck    ? '<div class="text-yellow-300">✦ Luck</div>' : '',
            ...excOpts.map(o => `<div class="text-[#c084fc]">✦ ${o}</div>`),
          ].filter(Boolean).join('');

          const levelBadge = item.level > 0
            ? `<div class="absolute top-1 right-1 bg-[#f97316] text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center leading-none">+${item.level}</div>`
            : '';
          const luckBadge = item.luck
            ? `<div class="absolute bottom-1 left-1 bg-yellow-500/90 text-white text-xs font-bold rounded px-1.5 py-0.5 leading-tight">L</div>`
            : '';
          const ancientBadge = item.ancient
            ? `<div class="absolute bottom-1 right-1 bg-amber-500/90 text-white text-xs font-bold rounded px-1.5 py-0.5 leading-tight">A</div>`
            : '';

          return `
            <div class="group relative bg-[#111118] border-2 ${rarityBorder} ${rarityGlow} rounded-xl p-2 w-16 h-16 flex items-center justify-center cursor-default hover:bg-white/5 transition-all">
              <img src="${IMG_BASE}${item.imagePath}" alt="item" class="w-10 h-10 object-contain pixelated" onerror="this.style.display='none'"/>
              ${levelBadge}${luckBadge}${ancientBadge}
              <!-- Tooltip -->
              <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 hidden group-hover:block bg-[#0d0d1a] border border-[#c084fc]/30 rounded-xl p-3 text-sm text-slate-300 space-y-1 pointer-events-none" style="min-width:180px">
                ${tooltipLines}
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>`;
}

let equipOpenedFromProfile = false;

async function openEquipModal(name, fromProfile = false) {
  equipOpenedFromProfile = fromProfile;
  // If opened from profile modal, hide it
  if (fromProfile) {
    document.getElementById('profile-modal').classList.add('hidden');
    document.getElementById('profile-modal').classList.remove('flex');
  }
  const modal = document.getElementById('equip-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.getElementById('equip-charname').textContent = name;
  document.getElementById('equip-error').classList.add('hidden');
  document.getElementById('equip-skeleton').classList.remove('hidden');
  document.getElementById('equip-content').classList.add('hidden');

  try {
    const data = await fetchProfile(name);
    const inv = (data.inventory || []).filter(i => !i.isEmpty);

    const weapons     = inv.filter(i => i.slotIndex <= 1);
    const armor       = inv.filter(i => i.slotIndex >= 2 && i.slotIndex <= 7);
    const wings       = inv.filter(i => i.slotIndex === 8);
    const accessories = inv.filter(i => i.slotIndex >= 9 && i.slotIndex <= 12);

    renderEquipSection('equip-section-weapons',     'Weapons',     weapons);
    renderEquipSection('equip-section-armor',       'Armor',       armor);
    renderEquipSection('equip-section-wings',       'Wings',       wings);
    renderEquipSection('equip-section-accessories', 'Accessories', accessories);

  } catch(e) {
    document.getElementById('equip-error').classList.remove('hidden');
  } finally {
    document.getElementById('equip-skeleton').classList.add('hidden');
    document.getElementById('equip-content').classList.remove('hidden');
  }
}

// Cerrar equip modal clickeando fuera
document.getElementById('equip-modal').addEventListener('click', function(e) {
  if (e.target === this) closeEquipModal();
});

// ─── Init ─────────────────────────────────────────────────
async function init() {
  const saved = loadStorage();

  if (saved.length === 0) {
    document.getElementById('onboarding').style.display = 'flex';
    return;
  }

  document.getElementById('onboarding').style.display = 'none';
  showCardSkeleton();
  showTableSkeleton();

  // Carga todos los personajes guardados
  for (const name of saved) {
    try {
      const profile = await fetchProfile(name);
      const classId = profile.character.class;
      const ranking = await fetchRanking(classId);
      const expInit = ranking.find(r => r.Name.toLowerCase() === profile.character.name.toLowerCase());
      if (expInit) saveExpOnLoad(profile.character.name, expInit.MasterExperience);
      characters.push({ name: profile.character.name, profile, ranking });
    } catch(e) { /* si falla uno, lo saltea */ }
  }

  if (characters.length === 0) {
    document.getElementById('onboarding').style.display = 'flex';
    return;
  }

  renderTabs();
  renderAll(0);

  // Countdown + auto-refresh
  setInterval(() => {
    countdown--;
    document.getElementById('countdown').textContent = countdown;
    if (countdown <= 0) refreshCurrent();
  }, 1000);
}

// Enter en onboarding
document.getElementById('onboard-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') addCharacterOnboard();
});

init();