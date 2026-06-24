const IMG_BASE   = 'https://www.baldunetamu.com';
const PROFILE_API = 'https://www.baldunetamu.com/api/characters/public-profile';
const REALM      = 'balduneta_v2';

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

function rarityBorder(rarity) {
  return { legendary:'border-[#fbbf24]', epic:'border-[#c084fc]', rare:'border-[#60a5fa]', uncommon:'border-[#34d399]', common:'border-white/20' }[rarity] || 'border-white/20';
}
function rarityGlow(rarity) {
  return { legendary:'box-shadow:0 0 12px rgba(251,191,36,0.5)', epic:'box-shadow:0 0 12px rgba(192,132,252,0.5)', rare:'box-shadow:0 0 12px rgba(96,165,250,0.4)', uncommon:'box-shadow:0 0 8px rgba(52,211,153,0.3)', common:'' }[rarity] || '';
}
function rarityColor(rarity) {
  return { legendary:'text-[#fbbf24]', epic:'text-[#c084fc]', rare:'text-[#60a5fa]', uncommon:'text-[#34d399]', common:'text-slate-400' }[rarity] || 'text-slate-400';
}

function renderSection(sectionId, title, items) {
  const el = document.getElementById(sectionId);
  if (!items.length) { el.innerHTML=''; return; }

  el.innerHTML = `
    <div>
      <div class="cinzel text-base font-bold text-[#f97316] tracking-widest mb-4">${title}</div>
      <div class="flex flex-wrap gap-3">
        ${items.map(item => {
          const excOpts = getExcellentOpts(item.excellent);
          const border  = rarityBorder(item.rarity);
          const glow    = rarityGlow(item.rarity);
          const color   = rarityColor(item.rarity);

          const levelBadge = item.level > 0
            ? `<div class="absolute top-1 right-1 bg-[#f97316] text-white text-xs font-bold rounded-full flex items-center justify-center leading-none" style="width:22px;height:22px">+${item.level}</div>`
            : '';
          const luckBadge = item.luck
            ? `<div class="absolute bottom-1 left-1 bg-yellow-500/90 text-white text-xs font-bold rounded px-1.5 py-0.5 leading-tight">L</div>`
            : '';
          const ancientBadge = item.ancient
            ? `<div class="absolute bottom-1 right-1 bg-amber-500/90 text-white text-xs font-bold rounded px-1.5 py-0.5 leading-tight">A</div>`
            : '';

          const tooltipLines = [
            `<div class="font-bold mb-2 uppercase text-xs tracking-wider ${color}">[${item.rarity.toUpperCase()}] +${item.level}</div>`,
            item.ancient ? '<div class="text-amber-300">✦ Ancient</div>' : '',
            item.skill   ? '<div class="text-blue-300">✦ Skill</div>'   : '',
            item.luck    ? '<div class="text-yellow-300">✦ Luck</div>'  : '',
            ...excOpts.map(o => `<div class="text-[#c084fc]">✦ ${o}</div>`),
          ].filter(Boolean).join('');

          return `
            <div class="item-box relative bg-[#111118] border-2 ${border} rounded-xl flex items-center justify-center cursor-default hover:bg-white/5 transition-all" style="width:96px;height:96px;padding:8px;${glow}">
              <img src="${IMG_BASE}${item.imagePath}" alt="item" class="object-contain pixelated" style="width:68px;height:68px" onerror="this.style.display='none'"/>
              ${levelBadge}${luckBadge}${ancientBadge}
              <div class="item-tooltip absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 bg-[#0d0d1a] border border-[#c084fc]/30 rounded-xl p-3 text-sm text-slate-300 space-y-1 pointer-events-none" style="min-width:170px">
                ${tooltipLines}
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>`;
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  const name   = params.get('name');
  if (!name) { history.back(); return; }

  document.getElementById('char-name').textContent = name;
  document.title = `Equipamiento · ${name}`;

  try {
    const res  = await fetch(`${PROFILE_API}?name=${encodeURIComponent(name)}&realm=${REALM}`);
    const json = await res.json();
    if (!json.success) throw new Error();

    const inv = (json.data.inventory || []).filter(i => !i.isEmpty);

    renderSection('section-weapons',     'Weapons',     inv.filter(i => i.slotIndex <= 1));
    renderSection('section-armor',       'Armor',       inv.filter(i => i.slotIndex >= 2 && i.slotIndex <= 7));
    renderSection('section-wings',       'Wings',       inv.filter(i => i.slotIndex === 8));
    renderSection('section-accessories', 'Accessories', inv.filter(i => i.slotIndex >= 9 && i.slotIndex <= 12));

  } catch(e) {
    document.getElementById('error').classList.remove('hidden');
    document.getElementById('skeleton').classList.add('hidden');
    return;
  }

  document.getElementById('skeleton').classList.add('hidden');
  document.getElementById('content').classList.remove('hidden');
}

init();