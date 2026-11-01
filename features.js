(() => {
'use strict';
const $=id=>document.getElementById(id);
const payload=JSON.parse($('site-data').textContent);
const features=payload.catalog.features;
const byId=new Map(features.map(f=>[f.id,f]));
const clone=v=>JSON.parse(JSON.stringify(v));
const storageKey='sports-record-feature-plan-v1';
const basePlan=clone(payload.plan);
let plan=clone(basePlan);
const percentIds=new Set(['win_rate','home_after_four_away','home_game','last_game_blowout_loss','opponent_loss_last_meeting']);
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
function validate(value){
 if(!value||value.schema_version!==1||value.current_season_only!==true||JSON.stringify(value.windows)!=='[1,5,7]'||!Array.isArray(value.selected)||!Array.isArray(value.custom)||value.custom.length>60)throw new Error('Use a current-season-only plan with windows 1, 5 and 7.');
 const seen=new Set();for(const item of value.selected){if(!byId.has(item.id)||!['track','test'].includes(item.purpose)||seen.has(item.id))throw new Error('Unknown or repeated feature selection.');seen.add(item.id);}
 for(const item of value.custom){if(!item||!['all','nba','nfl','nhl'].includes(item.league))throw new Error('Each custom idea needs a valid league.');for(const [key,max] of [['name',140],['definition',1600],['hypothesis',1000],['source',500]]){if(typeof item[key]!=='string'||item[key].length>max||(['name','definition'].includes(key)&&!item[key].trim()))throw new Error('Each custom idea needs a name and an observable definition within the limits.');}}
 const clean={schema_version:1,current_season_only:true,windows:[1,5,7],selected:value.selected.map(x=>({id:x.id,purpose:x.purpose})),custom:value.custom.map(x=>({league:x.league,name:x.name.trim(),definition:x.definition.trim(),hypothesis:x.hypothesis.trim(),source:x.source.trim()}))};
 if(new TextEncoder().encode(JSON.stringify(clean)).length>59000)throw new Error('Keep the plan below 59 KB so it fits the GitHub form.');return clean;
}
try{const saved=localStorage.getItem(storageKey);if(saved)plan=validate(JSON.parse(saved));}catch{$('plan-status').textContent='Browser storage was unavailable or contained an incompatible draft. The saved site plan is shown.';}
function save(message){plan=validate(plan);$('feature-json').value=JSON.stringify(plan,null,2);let local=true;try{localStorage.setItem(storageKey,JSON.stringify(plan));}catch{local=false;}$('plan-status').textContent=message||(local?'Draft saved in this browser. Export it or publish through GitHub to keep a shared copy.':'Draft is in this page only. Browser storage is unavailable; download a copy.');$('selection-feedback').textContent=message||`${plan.selected.length} items in your draft. No collection or training job has started; live predictions are unchanged.`;filterCatalog();}
function paintCards(){for(const card of document.querySelectorAll('.feature-card')){const f=byId.get(card.dataset.feature);card.dataset.status=f.status;const choice=plan.selected.find(x=>x.id===f.id);const checkbox=card.querySelector('input');const select=card.querySelector('select');checkbox.disabled=false;checkbox.checked=Boolean(choice);select.disabled=!choice;select.value=choice?.purpose||'track';card.classList.toggle('selected',Boolean(choice));card.querySelector('.selection-help').textContent=choice?(choice.purpose==='test'?'In your plan: model test requested, not running.':'In your plan: tracking requested; new data is not fetched by this checkbox.'):'Outside your plan. Existing data remains available.';}}
for(const card of document.querySelectorAll('.feature-card')){const id=card.dataset.feature;card.querySelector('input').addEventListener('change',event=>{plan.selected=plan.selected.filter(x=>x.id!==id);if(event.target.checked)plan.selected.push({id,purpose:card.querySelector('select').value});paintCards();save(`${event.target.checked?'Added':'Removed'}: ${byId.get(id).name}. Draft only; live predictions are unchanged.`);});card.querySelector('select').addEventListener('change',event=>{const choice=plan.selected.find(x=>x.id===id);if(choice)choice.purpose=event.target.value;paintCards();save('Research request updated. No collection or model test has started.');});}
for(const group of [...new Set(features.map(f=>f.group))].sort()){const option=el('option',group);option.value=group;$('catalog-group').append(option);}
function filterCatalog(){let shown=0;const selected=new Set(plan.selected.map(x=>x.id));const league=$('catalog-league').value;const group=$('catalog-group').value;const state=$('catalog-state').value;const query=$('catalog-search').value.trim().toLowerCase();for(const card of document.querySelectorAll('.feature-card')){const f=byId.get(card.dataset.feature);const matchLeague=!league||f.league===league||(league!=='all'&&f.league==='all');const matchState=!state||(state==='selected'?selected.has(f.id):f.status===state);card.hidden=!(matchLeague&&(!group||f.group===group)&&matchState&&(`${f.name} ${f.definition} ${f.group}`.toLowerCase().includes(query)));if(!card.hidden)shown++;}$('catalog-count').textContent=`${shown} of ${features.length} candidates shown · ${plan.selected.length} in your draft plan · ${plan.custom.length} custom ideas. Selection does not activate a model weight.`;}
for(const id of ['catalog-league','catalog-group','catalog-state'])$(id).addEventListener('change',filterCatalog);$('catalog-search').addEventListener('input',filterCatalog);
function paintCustom(){const target=$('custom-list');target.replaceChildren();plan.custom.forEach((item,index)=>{const box=el('div',undefined,'custom-item');const remove=el('button','Remove');remove.type='button';remove.addEventListener('click',()=>{plan.custom.splice(index,1);paintCustom();save();});box.append(remove,el('h3',`${item.league.toUpperCase()} · ${item.name}`),el('p',item.definition),el('p',`Hypothesis: ${item.hypothesis||'Unspecified; effect unknown.'}`,'small muted'),el('p',`Source to verify: ${item.source||'Not yet identified.'}`,'small muted'));target.append(box);});}
$('custom-form').addEventListener('submit',event=>{event.preventDefault();const item={league:$('custom-league').value,name:$('custom-name').value,definition:$('custom-definition').value,hypothesis:$('custom-hypothesis').value,source:$('custom-source').value};try{const draft=validate({...plan,custom:[...plan.custom,item]});plan=draft;paintCustom();save('Custom idea added to this draft; no data or model effect is assumed.');$('custom-form').reset();}catch(error){$('plan-status').textContent=error.message;}});
$('export-plan').addEventListener('click',()=>{save();const blob=new Blob([JSON.stringify(plan,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=el('a');link.href=url;link.download='sports-feature-plan.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
$('import-plan').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;if(file.size>250000){$('plan-status').textContent='That plan is too large; use a JSON file under 250 KB.';return;}try{plan=validate(JSON.parse(await file.text()));paintCards();paintCustom();save('Imported draft. It has not changed the shared site or live model.');}catch(error){$('plan-status').textContent=error.message;}event.target.value='';});
$('reset-plan').addEventListener('click',()=>{plan=clone(basePlan);paintCards();paintCustom();save('The saved site plan is now your local draft.');});
$('copy-plan').addEventListener('click',async()=>{save();try{await navigator.clipboard.writeText($('feature-json').value);$('plan-status').textContent='Copied. In GitHub choose save_features and paste into Feature-plan JSON.';}catch{$('feature-json').focus();$('feature-json').select();$('plan-status').textContent='Select and copy the JSON with your device’s Copy command.';}});
const observed=value=>value!==null&&value!==undefined;
const format=(value,percent=false)=>observed(value)?`${Number(value).toFixed(2)}${percent?'%':''}`:'—';
const signed=value=>`${value>0?'+':''}${Number(value).toFixed(2)}`;
const isFlag=key=>byId.get(key)?.aggregation==='flag';
function pooled(history,key,end,window,complete=false){
 const slots=history.slice(Math.max(0,end-window+1),end+1);
 const values=slots.map(g=>g.values[key]).filter(observed);
 if(complete&&(slots.length!==window||values.length!==window))return null;
 const denominator=values.reduce((n,v)=>n+v[1],0);
 return denominator?values.reduce((n,v)=>n+v[0],0)/denominator*(percentIds.has(key)?100:1):null;
}
const date=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',month:'short',day:'numeric'}).format(new Date(value));
function unitFor(key){
 if(['scoring_margin','points_for','points_against'].includes(key))return $('trend-league').value==='nhl'?'goals':'points';
 if(percentIds.has(key))return '%';
 return key==='days_since_home_game'?'days':'games';
}
function display(value,key,single=false){
 if(!observed(value))return '—';
 if(single&&isFlag(key))return value?'Yes':'No';
 if(single&&key==='win_rate')return value?'Win':'No win';
 if(key==='scoring_margin')return `${signed(value)} ${unitFor(key)}`;
 return `${format(value,percentIds.has(key))}${percentIds.has(key)?'':` ${unitFor(key)}`}`;
}
function teamsChanged(){
 const league=payload.tracking.leagues[$('trend-league').value];
 $('trend-team').replaceChildren();
 for(const team of league?.teams||[]){const option=el('option',team.name);option.value=team.id;$('trend-team').append(option);}
 showTrend();
}
for(const key of payload.tracking.tracked){const option=el('option',byId.get(key)?.name||key);option.value=key;$('trend-metric').append(option);}
function showTrend(){
 const league=payload.tracking.leagues[$('trend-league').value];
 const team=league?.teams.find(t=>t.id===$('trend-team').value);if(!team)return;
 const key=$('trend-metric').value, summary=team.summary[key], percentage=percentIds.has(key), units=unitFor(key);
 const metricName=key==='scoring_margin'?'Winning / losing margin':byId.get(key).name;
 $('trend-title').textContent=`${team.name} — ${metricName} (${units})`;
 $('trend-explanation').textContent=key==='scoring_margin'
  ?`Own final score minus opponent score. Above zero = won; below zero = lost. +21 means a win by 21 ${units}; −5 means a loss by 5. These are raw margins, without opponent or pace adjustments.`
  :isFlag(key)?`${byId.get(key).definition} Latest-game values are Yes/No. Rolling percentages show how often the condition occurred, not a win probability or a psychological effect.`
  :key==='win_rate'?'Each game is a win or no win; the rolling lines show the share of games won. This is the team’s win rate, not your pick record.'
  :`${byId.get(key).definition} Lines show the individual value and simple averages, not a predicted result.${key==='points_against'?' A lower value means fewer points or goals conceded; pace and opponent still matter.':''}`;
 const tiles=$('trend-tiles');tiles.replaceChildren();
 for(const [title,metric] of [['Latest game','latest'],['Last 5 average','last_5'],['Last 7 average','last_7'],['Season average','season']]){
  const value=summary[metric],tile=el('div',undefined,'trend-tile');
  const count=`${value.games_with_data} of ${value.games_requested} games with data${value.games_with_data<value.games_requested?' — partial':''}`;
  tile.append(el('span',title),el('strong',display(value.value,key,metric==='latest')),el('small',count));tiles.append(tile);
 }
 const change=el('div',undefined,'trend-tile'), latest=summary.latest.value, previous=summary.previous.value;
 let changeText=observed(summary.game_change)?`${signed(summary.game_change)} ${percentage?'percentage points':units}`:'—';
 if(isFlag(key)&&observed(latest)&&observed(previous))changeText=`${display(previous,key,true)} → ${display(latest,key,true)}`;
 change.append(el('span','Change from previous game'),el('strong',changeText),el('small',observed(latest)&&observed(previous)?(isFlag(key)?'Previous flag → latest flag; this is not a model effect.':`${display(latest,key)} minus (${display(previous,key)})`):'Both games need an observation.'));tiles.append(change);
 const last5=summary.last_5, last7=summary.last_7;
 $('trend-reading').textContent=key==='scoring_margin'&&observed(latest)
  ?`${team.name} ${latest===0?'finished tied':`${latest>0?'won by':'lost by'} ${Math.abs(latest)} ${units}`} in the latest game. Across the ${last5.games_with_data} available games in the last-five window, the average margin was ${display(last5.value,key)} per game.${team.history.length===7?' The seven-game and season averages match because only seven games have been played.':''} This does not itself tell us whether the team improved against comparable opponents.`
  :`The last-five window contains ${last5.games_with_data} observations; the last-seven window contains ${last7.games_with_data}.${isFlag(key)?' For a flag, 20% over five games means one of those five games met the condition.':''}`;
 const describe=n=>{
  const current=summary[`last_${n}`],old=summary[`preceding_${n}`],value=summary[`change_${n}`];
  return observed(value)?`${n} vs previous ${n}: ${signed(value)} ${percentage?'percentage points':units}`
   :`${n} vs previous ${n}: unavailable (need two complete ${n}-game windows; recent ${current.games_with_data}/${n}, preceding ${old.games_with_data}/${n})`;
 };
 $('trend-detail').textContent=`${describe(5)}. ${describe(7)}.`;
 const rows=$('trend-log');rows.replaceChildren();
 for(let i=team.history.length-1;i>=0;i--){
  const game=team.history[i],v=game.values[key],row=el('tr');
  for(const text of [date(game.starts_at),`${game.neutral_site?'vs (neutral)':game.side==='home'?'vs':'at'} ${game.opponent}`,game.score,display(v?v[0]/v[1]*(percentage?100:1):null,key,true),display(pooled(team.history,key,i,5,true),key),display(pooled(team.history,key,i,7,true),key)])row.append(el('td',text));
  rows.append(row);
 }
 drawChart(team.history,key,percentage);
}
function drawChart(history,key,percentage){
 const host=$('trend-chart');host.replaceChildren();
 if(!history.length){host.append(el('p','No eligible current-season finals yet.','empty'));return;}
 const ns='http://www.w3.org/2000/svg';
 const svg=(tag,attrs,text)=>{const node=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs||{}))node.setAttribute(k,String(v));if(text!==undefined)node.textContent=text;return node;};
 const root=svg('svg',{viewBox:'0 0 900 295',role:'img','aria-label':`${byId.get(key).name}: individual games and complete five/seven-game averages. Exact values are in the game log.`});
 const colors=['#165b45','#b46c22','#5268a5'];
 const series=[1,5,7].map(n=>history.map((_,i)=>pooled(history,key,i,n,true)));
 const all=series.flat().filter(observed);
 if(!all.length){host.append(el('p','This metric has no observed values yet.','empty'));return;}
 let low=Math.min(...all),high=Math.max(...all);
 if(key==='scoring_margin'){low=Math.min(low,0);high=Math.max(high,0);}
 if(percentage){low=0;high=100;}
 if(low===high){low-=1;high+=1;}
 const rough=(high-low)/4,power=10**Math.floor(Math.log10(rough));
 const step=[1,2,5,10].find(n=>n*power>=rough)*power;
 low=Math.floor(low/step)*step;high=Math.ceil(high/step)*step;
 const x=i=>80+i/Math.max(1,history.length-1)*785, y=v=>235-(v-low)/(high-low)*195;
 for(let value=low;value<=high+step*.01;value+=step){
  const zero=key==='scoring_margin'&&Math.abs(value)<step*.001;
  root.append(svg('line',{x1:80,x2:865,y1:y(value),y2:y(value),stroke:zero?'#536964':'#dce3dc','stroke-width':zero?1.6:1,'stroke-dasharray':zero?'5 4':'none'}),svg('text',{x:69,y:y(value)+4,'text-anchor':'end',fill:'#536964','font-size':11},`${Number(value.toFixed(2))}${percentage?'%':''}`));
 }
 root.append(svg('text',{x:80,y:22,fill:'#536964','font-size':11},key==='scoring_margin'?`Margin (${unitFor(key)}); 0 = level score`:isFlag(key)?'Share of games meeting the condition (%)':`${byId.get(key).name} (${unitFor(key)})`));
 series.forEach((values,s)=>{
  let path='',open=false;
  values.forEach((value,i)=>{if(!observed(value)){open=false;return;}path+=`${open?'L':'M'}${x(i).toFixed(2)} ${y(value).toFixed(2)} `;open=true;});
  root.append(svg('path',{d:path,fill:'none',stroke:colors[s],'stroke-width':s?2:2.5}));
  values.forEach((value,i)=>{
   if(!observed(value))return;
   const game=history[i],dot=svg('circle',{cx:x(i),cy:y(value),r:s?3:4,fill:colors[s],tabindex:0});
   const label=`${date(game.starts_at)}; ${game.opponent}; ${s?`last ${[1,5,7][s]} average`:'individual game'}: ${display(value,key,s===0)}`;
   dot.setAttribute('aria-label',label);dot.append(svg('title',{},label));root.append(dot);
  });
 });
 const ticks=new Set(history.length<=8?history.map((_,i)=>i):[0,1,2,3,4].map(i=>Math.round((history.length-1)*i/4)));
 for(const i of ticks)root.append(svg('text',{x:x(i),y:258,'text-anchor':i===0?'start':i===history.length-1?'end':'middle',fill:'#536964','font-size':11},date(history[i].starts_at)));
 root.append(svg('text',{x:472,y:282,'text-anchor':'middle',fill:'#536964','font-size':11},'Game date — each dot is one completed game'));
 host.append(root);
}
$('trend-league').addEventListener('change',teamsChanged);$('trend-team').addEventListener('change',showTrend);$('trend-metric').addEventListener('change',showTrend);
paintCards();paintCustom();save();teamsChanged();
})();
