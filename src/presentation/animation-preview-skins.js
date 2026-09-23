import { CAMPAIGN_STYLES } from '../simulation/campaign-styles.js';

// Shared navigation for the three visual inspection pages.
export function previewSkin(faction) {
  const requested=new URLSearchParams(location.search).get('skin');
  const style=CAMPAIGN_STYLES[faction].find(s=>s.id===requested);
  const nav=document.createElement('p');
  const label=document.createElement('label');label.textContent='Tenue : ';
  const select=document.createElement('select');select.setAttribute('aria-label','Tenue du candidat');
  for(const option of [{id:'',name:'Sprite de base'},...CAMPAIGN_STYLES[faction]]) {
    const el=document.createElement('option');el.value=option.id;el.textContent=option.name;select.append(el);
  }
  select.value=style?.id||'';
  select.onchange=()=>{const url=new URL(location.href);url.searchParams.set('skin',select.value);location.href=url.href;};
  label.append(select);nav.append(label);document.querySelector('h1').after(nav);
  return style?.id||null;
}

export const skinQuery = (faction,skin) => '?candidate='+encodeURIComponent(faction)+(skin?'&skin='+encodeURIComponent(skin):'');
