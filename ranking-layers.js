(() => {
'use strict';
const $=id=>document.getElementById(id),payload=JSON.parse($('site-data').textContent);
if(!$('layer-rows')||!payload.layers)return;
const key='sports-record-feature-plan-v2';
const names={base:'Base',form:'Base + form',situations:'Base + situations',availability:'Base + availability',combined:'All available'};
const groups={base:[],form:['form'],situations:['situations'],availability:['availability'],combined:['form','situations','availability']};
const element=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
const number=value=>value===null||value===undefined?'—':`${value>0?'+':''}${value.toFixed(2)}`;
const known=new Set(payload.catalog.features.map(f=>f.id));
function valid(plan){return plan?.schema_version===1&&plan.current_season_only===true&&Array.isArray(plan.selected)&&plan.selected.every(f=>known.has(f.id));}
function selection(){if(valid(window.sportsFactorSelection))return window.sportsFactorSelection;try{const saved=JSON.parse(localStorage.getItem(key));if(valid(saved))return saved;}catch{}return payload.plan;}
function activeFactors(data,selected){return Object.entries(data.features).filter(([id,state])=>state.status==='fitted'&&selected.has(id));}
function contribution(team,factors,group){const keys=factors.filter(([,state])=>state.group===group).map(([id])=>id);if(!keys.length||keys.some(id=>team.contributions[id]===null||team.contributions[id]===undefined))return null;return keys.reduce((sum,id)=>sum+team.contributions[id],0);}
function render(){
 const league=$('layer-league').value,data=payload.layers.leagues[league],view=$('layer-view').value;
 if(!data)return;
 const plan=selection(),selected=new Set(plan.selected.map(f=>f.id)),factors=activeFactors(data,selected),chosen=groups[view];
 const active=factors.filter(([,state])=>chosen.includes(state.group));
 const unavailableView=view!=='base'&&view!=='combined'&&!active.length;
 const relevant=payload.catalog.features.filter(f=>f.league==='all'||f.league===league);
 $('layer-summary').textContent=`${names[view]} · ${factors.length} fitted additions selected for ${league.toUpperCase()} · ${relevant.filter(f=>selected.has(f.id)).length} factors enabled in the selection. ${unavailableView?'This layer has no fitted adjustment yet.':'Base statistics remain in the base score; unavailable factors add no estimated effect.'}`;
 const controls=$('layer-factor-controls');controls.replaceChildren();
 for(const [id,state]of Object.entries(data.features)){
  const label=element('label'),input=element('input');input.type='checkbox';input.checked=selected.has(id);input.disabled=state.status!=='fitted';
  input.addEventListener('change',()=>{const next=selection();next.selected=next.selected.filter(f=>f.id!==id);if(input.checked)next.selected.push({id,purpose:'test'});window.sportsFactorSelection=next;let saved=true;try{localStorage.setItem(key,JSON.stringify(next));}catch{saved=false;}window.dispatchEvent(new Event('ranking-selection-change'));if(!saved)$('layer-summary').textContent+=' Changes last for this page only; browser storage is unavailable.';});
  label.append(input,element('span',`${state.name}${state.status==='fitted'?'':' — insufficient sample'}`));controls.append(label);
 }
 const teams=data.teams.map(team=>{
  const missing=active.some(([id])=>team.contributions[id]===null||team.contributions[id]===undefined);
  const score=team.games&&!missing&&!unavailableView?team.base_rating+active.reduce((sum,[id])=>sum+team.contributions[id],0):null;
  return {...team,score,parts:{form:contribution(team,factors,'form'),situations:contribution(team,factors,'situations'),availability:null}};
 }).sort((a,b)=>(a.score===null)-(b.score===null)||(b.score??0)-(a.score??0)||a.name.localeCompare(b.name));
 let rank=null,previous=null;
 const rows=$('layer-rows');rows.replaceChildren();
 teams.forEach((team,index)=>{
  if(team.score!==null&&Number(team.score.toFixed(6))!==previous){rank=index+1;previous=Number(team.score.toFixed(6));}
  const row=element('tr'),name=element('td');name.append(element('strong',team.name));
  const fixture=team.next_game;name.append(element('small',fixture?`${fixture.state==='in'?'In progress':'Next'}: ${fixture.opponent} · ${new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',month:'short',day:'numeric'}).format(new Date(fixture.starts_at))}`:'No scheduled game'));
  row.append(element('td',team.score===null?'—':String(rank)),name,element('td',team.base_rank===null?'—':String(team.base_rank)),element('td',team.games?number(team.base_rating):'Unrated'));
  for(const group of ['form','situations','availability']){const cell=element('td',number(team.parts[group]));if(team.parts[group]!==null)cell.className=team.parts[group]>=0?'layer-positive':'layer-negative';if(!chosen.includes(group))cell.append(element('small','Excluded from this view'));row.append(cell);}
  row.append(element('td',number(team.score)));rows.append(row);
 });
 const check=data.evaluation,target=$('layer-evaluation');target.replaceChildren();
 $('layer-evaluation-note').textContent=check.status==='reconstructed_holdout'?`${check.training_games} earlier training games; ${check.games} later test games, beginning ${check.test_from.slice(0,10)}. Checkboxes update this comparison using weights learned before those test games. A factor fitted only more recently is absent from this earlier check.`:'Not enough separated current-season training and test games yet.';
 for(const [id,result]of Object.entries(check.views||{})){
  const keys=result.applied_features.filter(key=>selected.has(key));
  if(!['base','combined'].includes(id)&&!keys.length){const row=element('tr');for(const text of [names[id],'—','—','—','No fitted addition in this check'])row.append(element('td',text));target.append(row);continue;}
  const sample=check.predictions.filter(row=>keys.every(key=>row.adjustments[key]!==null&&row.adjustments[key]!==undefined));
  let wins=0,losses=0,error=0,baseError=0;
  for(const row of sample){const edge=row.base_edge+keys.reduce((sum,key)=>sum+row.adjustments[key],0);error+=Math.abs(row.target-edge);baseError+=Math.abs(row.target-row.base_edge);if(edge&&row.actual_margin){if((edge>0)===(row.actual_margin>0))wins++;else losses++;}}
  const row=element('tr');for(const text of [names[id],`${wins}–${losses}`,sample.length?(error/sample.length).toFixed(2):'—',sample.length?(baseError/sample.length).toFixed(2):'—',keys.map(f=>data.features[f]?.name||f).join(', ')||'None'])row.append(element('td',text));target.append(row);
 }
}
$('layer-league').addEventListener('change',render);$('layer-view').addEventListener('change',render);
window.addEventListener('ranking-selection-change',render);window.addEventListener('storage',event=>{if(event.key===key){window.sportsFactorSelection=null;render();}});
render();
})();
