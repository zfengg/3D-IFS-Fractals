import {BernoulliEditor} from './BernoulliEditor';
import {isBernoulli} from './bernoulli';
import {SpongeEditor} from './SpongeEditor';
import type {SpongeDefinition,SpongeKind} from './sponges';
import {IFSEditor} from './IFSEditor';
import {FractalViewer,type ColorMode} from './FractalViewer';
import {presets,createPreset,type Preset} from './presets';
import {IFS,type MapDefinition,type PointSample} from './model';

function $(id:'editor'|'export-dialog'|'sponge-dialog'|'bernoulli-dialog'): HTMLDialogElement;
function $(id:string): HTMLInputElement;
function $(id:string): HTMLElement {const el=document.getElementById(id);if(!el)throw Error(`Missing element ${id}`);return el;}
interface Candidate {maps:MapDefinition[];info:Preset;custom?:boolean;key?:string}
const messageOf=(error:unknown)=>error instanceof Error?error.message:String(error);
let system=createPreset('tetra');
let customSystem:IFS|null=null;
let activeSponge:SpongeDefinition|undefined;
let customSponge:SpongeDefinition|undefined;
let currentPreset='tetra';
let maps=system.toJSON(),palette='aurora',seed=42,job=0;
let sample:PointSample|null=null,worker:Worker|null=null,pending:Candidate|null=null,timeout:ReturnType<typeof setTimeout>|undefined;
let viewer:FractalViewer|undefined;
const palettes:Record<string,string[]>={aurora:['#416db8','#54bfb5','#d6ef92'],ember:['#a43889','#ed7751','#ffe7a1'],ocean:['#5145bc','#44a6e6','#b2f8ed']};
$('preset').replaceChildren();
for(const [key,preset] of Object.entries(presets)){const option=document.createElement('option');option.value=key;option.textContent=preset.name;$('preset').append(option);}
$('preset').value=currentPreset;
function showError(message:string){$('error').textContent=message;$('error').hidden=!message;}
function mapKindLabel(){return `${maps.every(map=>'a' in map)?'affine ':''}${maps.length===1?'map':'maps'}`;}
function updateInfo(preset:Preset){
 $('fractal-title').textContent=preset.name; $('current-ifs-name').textContent=preset.name;
 const nonlinear=maps.filter(m=>'x' in m).length;
 $('map-kind-label').textContent=mapKindLabel();
 $('system-type').textContent=nonlinear===0?'':nonlinear===maps.length?'Nonlinear':'Mixed';
 $('map-count').textContent=String(maps.length);$('map-list').replaceChildren();
 
 maps.forEach((m,i)=>{const row=document.createElement('div');row.className='map-row';const label=document.createElement('span'),value=document.createElement('span');label.textContent=`f${i+1} ${'x'in m?'· nonlinear':'· affine'}`;value.textContent=`p = ${m.p.toFixed(3)}`;row.append(label,value);$('map-list').append(row);});

}
function recolor(){
 const mode=$('color-mode').value as ColorMode;
 const mono = mode==='mono';
 viewer?.setColors(mono?Array(3).fill($('mono-color').value):palettes[palette],mode);
 $('mono-legend').hidden=!mono;
 document.querySelector<HTMLElement>('.swatches')!.hidden=mono;
 $('mono-hex').textContent=$('mono-color').value.toUpperCase();
 document.querySelectorAll<HTMLButtonElement>('.mono-swatches button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.color===$('mono-color').value)));
 document.querySelector<HTMLElement>('.legend i')!.style.background=`linear-gradient(${[...palettes[palette]].reverse().join(',')})`;
 $('legend-top').textContent=mode==='transform'?'LAST':'HIGH';$('legend-bottom').textContent=mode==='transform'?'FIRST':'LOW';$('gradient-legend').hidden=mono;
}
function regenerate(candidate:Candidate|null=null){
 if(!viewer)return;
 const burnIn=$('burn-in').valueAsNumber,initialPoint=['initial-x','initial-y','initial-z'].map(id=>$(id).valueAsNumber);seed=$('seed').valueAsNumber;
 if(!Number.isInteger(seed)||!Number.isInteger(burnIn)||burnIn<0||burnIn>10000||!initialPoint.every(Number.isFinite)){const message='Enter a whole-number seed, a burn-in from 0 to 10,000, and three finite initial coordinates.';showError(message);if($('editor').open)$('editor-error').textContent=message;if($('sponge-dialog').open)$('sponge-error').textContent=message;if($('bernoulli-dialog').open)$('bernoulli-error').textContent=message;return;}
 worker?.terminate();clearTimeout(timeout);const id=++job;pending=candidate;
 $('status').textContent='Generating points…';showError('');worker=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});
 const fail=(message:string)=>{if(id!==job)return;clearTimeout(timeout);worker?.terminate();pending=null;$('preset').value=currentPreset;showError(message);if($('editor').open)$('editor-error').textContent=message;if($('sponge-dialog').open)$('sponge-error').textContent=message;if($('bernoulli-dialog').open)$('bernoulli-error').textContent=message;$('status').textContent=sample?'Previous result retained':'Generation failed';};
 worker.onerror=e=>fail(messageOf(e)||'Unable to start the point generator.');
 worker.onmessage=({data})=>{
  if(data.id!==job)return;
  if(data.error){fail(data.error);return;}clearTimeout(timeout);worker?.terminate();
  if(pending){system=IFS.fromJSON(pending.maps,pending.info.name);maps=system.toJSON();activeSponge=pending.info.sponge?structuredClone(pending.info.sponge):undefined;updateInfo(pending.info);if(pending.custom){customSystem=system;customSponge=activeSponge?structuredClone(activeSponge):undefined;currentPreset='custom';if(!$('preset').querySelector('[value="custom"]')){const option=document.createElement('option');option.value='custom';option.textContent='Custom system';$('preset').append(option);}$('preset').value='custom';}else {$('preset').value=pending.key!;currentPreset=pending.key!;}pending=null;}
  sample=data;viewer!.setSample(data,maps.length);$('download-image').disabled=false;recolor();$('status').textContent=`${data.ids.length.toLocaleString()} points · ${maps.length} ${mapKindLabel()}`;
  if($('editor').open)$('editor').close();if($('sponge-dialog').open)$('sponge-dialog').close();if($('bernoulli-dialog').open)$('bernoulli-dialog').close();
 };
 timeout=setTimeout(()=>fail('Generation took too long. Try fewer points or simpler expressions.'),15000);
 worker.postMessage({id,maps:candidate?.maps||maps,count:Number($('count').value),seed,burnIn,initialPoint});
}
function init(){
 try {
  viewer=new FractalViewer($('canvas-container'),()=>showError('The graphics context was lost. Reload this page to restore the view.'));
  $('rotate').checked=viewer.autoRotate;
  updateInfo(presets.tetra);regenerate();
 } catch(error) {
  showError('This visualizer needs WebGL 2. Please use a current browser with hardware acceleration enabled. '+messageOf(error));
  $('status').textContent='3D rendering unavailable';
 }
}
$('preset').addEventListener('change',()=>{const key=$('preset').value;if(key==='custom'&&customSystem){const saved=customSystem.toJSON();regenerate({maps:saved,info:{name:customSystem.name,description:'Your custom affine and nonlinear transformations.',maps:saved,sponge:customSponge},custom:true});return;}if(presets[key])regenerate({maps:structuredClone(presets[key].maps),info:presets[key],key});});
$('count').addEventListener('input',()=>{$('count-label').textContent=Number($('count').value).toLocaleString();});$('count').addEventListener('change',()=>regenerate(pending));
$('size').addEventListener('input',()=>{$('size-label').textContent=Number($('size').value).toFixed(1);viewer?.setPointSize(Number($('size').value));});
$('color-mode').addEventListener('change',recolor);
$('mono-color').addEventListener('input',recolor);
document.querySelectorAll<HTMLButtonElement>('.mono-swatches button').forEach(button=>button.addEventListener('click',()=>{ $('mono-color').value=button.dataset.color!;recolor(); }));
document.querySelectorAll<HTMLButtonElement>('.swatch').forEach(button=>button.addEventListener('click',()=>{palette=button.dataset.palette!;document.querySelectorAll<HTMLButtonElement>('.swatch').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});$('palette-label').textContent=palette[0].toUpperCase()+palette.slice(1);recolor();}));
$('rotate').addEventListener('change',()=>{if(viewer)viewer.autoRotate=$('rotate').checked;});$('grid').addEventListener('change',()=>{if(viewer)viewer.showGrid=$('grid').checked;});$('reset').addEventListener('click',()=>{viewer?.reset();});$('regenerate').addEventListener('click',()=>{regenerate(pending);});


for(const [buttonId,showId,panelId,cssClass] of [
 ['toggle-ifs','show-ifs','ifs-panel','ifs-hidden'],
 ['toggle-appearance','show-appearance','appearance-panel','appearance-hidden'],
]){
 const preferenceKey=`ifs-explorer.sidebar.${panelId}`;
 const setHidden=(hidden:boolean,userAction=false)=>{
  $(panelId).hidden=hidden;
  document.querySelector('main')!.classList.toggle(cssClass,hidden);
  $(showId).hidden=!hidden;
  $(buttonId).setAttribute('aria-expanded',String(!hidden));
  if(userAction){
   $(hidden?showId:buttonId).focus();
   try{localStorage.setItem(preferenceKey,hidden?'hidden':'visible');}catch{/* Storage may be disabled; controls still work. */}
  }
 };
 try{setHidden(localStorage.getItem(preferenceKey)==='hidden');}catch{setHidden(false);}
 $(buttonId).addEventListener('click',()=>setHidden(true,true));
 $(showId).addEventListener('click',()=>setHidden(false,true));
}
$('download-image').addEventListener('click',()=>{
 if(!viewer||!sample)return;
 $('export-error').textContent='';$('export-dialog').showModal();
});
let transparentBackgroundPreferred=true;
$('export-format').addEventListener('change',()=>{
 const jpeg=$('export-format').value==='jpeg';
 const transparent=$('export-background').querySelector<HTMLOptionElement>('[value="transparent"]')!;
 transparent.disabled=jpeg;$('export-note').hidden=!jpeg;
 if(jpeg&&$('export-background').value==='transparent'){$('export-background').value='white';transparentBackgroundPreferred=true;}
 else if(!jpeg&&transparentBackgroundPreferred)$('export-background').value='transparent';
});
$('export-background').addEventListener('change',()=>{transparentBackgroundPreferred=$('export-background').value==='transparent';});
$('save-image').addEventListener('click',async()=>{
 if(!viewer||!sample)return;
 const button=$('save-image');button.disabled=true;button.textContent='Saving…';$('export-error').textContent='';
 const format=$('export-format').value as 'png'|'pdf'|'jpeg';
 try{
  let blob=await viewer.captureImage({background:$('export-background').value as 'transparent'|'dark'|'white',format:format==='jpeg'?'jpeg':'png',includeGrid:$('export-grid').checked});
  if(format==='pdf'){
   const {PDFDocument}=await import('pdf-lib');
   const document=await PDFDocument.create();
   const png=await document.embedPng(await blob.arrayBuffer());
   const width=png.width*.75,height=png.height*.75;
   const page=document.addPage([width,height]);page.drawImage(png,{x:0,y:0,width,height});
   document.setTitle(system.name);document.setCreator('Exploring 3D IFS fractals');
   blob=new Blob([new Uint8Array(await document.save())],{type:'application/pdf'});
  }
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  const name=system.name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-|-$/g,'').toLowerCase()||'ifs-fractal';
  link.href=url;link.download=`${name}.${format==='jpeg'?'jpg':format}`;document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);$('export-dialog').close();
 }catch(error){$('export-error').textContent=`Could not download: ${messageOf(error)}`;}
 finally{button.disabled=false;button.textContent='Download';}
});

const editor=new IFSEditor((next,name)=>{
 regenerate({maps:next,info:{name,description:'',maps:next},custom:true});
});
const spongeEditor=new SpongeEditor((next,name,sponge)=>{
 regenerate({maps:next,info:{name,description:'',maps:next,sponge},custom:true});
});
const bernoulliEditor=new BernoulliEditor((next,name)=>{regenerate({maps:next,info:{name,description:'',maps:next},custom:true});});
function editCurrent(){
 if(activeSponge)spongeEditor.open(activeSponge,system.name);
 else if(isBernoulli(maps))bernoulliEditor.open(maps,system.name);
 else editor.open(maps,system.name,false);
}
$('edit').onclick=editCurrent;
$('edit-example').onclick=()=>{
 const key=$('preset').value;
 if(key===currentPreset){editCurrent();return;}
 const example=presets[key];
 if(!example)return;
 if(example.sponge)spongeEditor.open(example.sponge,example.name);
 else if(isBernoulli(example.maps))bernoulliEditor.open(example.maps,example.name);
 else editor.open(example.maps,example.name,false);
};
$('create-new').onclick=()=>{
 const kind=$('new-system-kind').value;
 if(kind==='general')editor.openNew();else spongeEditor.openNew(kind as SpongeKind);
};
function setWorkflow(create:boolean){
 $('gallery-controls').hidden=create;$('new-system-controls').hidden=!create;
 for(const [id,selected] of [['mode-example',!create],['mode-create',create]] as const){
  $(id).classList.toggle('selected',selected);$(id).setAttribute('aria-pressed',String(selected));
 }
}
$('mode-example').onclick=()=>setWorkflow(false);
$('mode-create').onclick=()=>setWorkflow(true);
init();
