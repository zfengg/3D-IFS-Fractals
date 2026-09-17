import {SummandPreview} from './SummandPreview';
import {editableSurfaceMaps,surfaceDefinitions,type SurfaceDefinition} from './surfaces';
import {IFS,type MapDefinition} from './model';

export class SurfaceEditor{
 private dialog=document.createElement('dialog');
 private preview?:SummandPreview;
 private previewTimer?:ReturnType<typeof setTimeout>;
 private updateDefinition(){
  const phi=this.el<HTMLTextAreaElement>('surface-phi').value.trim();
  const base=this.el<HTMLInputElement>('surface-base').value.trim();
  const lambda=this.el<HTMLInputElement>('surface-lambda').value||'λ';
  this.el('surface-map-formula').textContent=base==='0'
   ? `Fᵢⱼ(x, y, z) = (u, v, ${lambda}z + φ(u, v))`
   : `Fᵢⱼ(x, y, z) = (u, v, ${lambda}(z − h(x, y)) + h(u, v) + φ(u, v))`;
  const kind=Object.entries(surfaceDefinitions).find(([,value])=>value.phi===phi)?.[0];
  this.el('surface-summand-description').textContent=kind==='weierstrass'
   ? 'Sine product: a smooth wave with positive and negative lobes. Repeated copies add oscillations at successively finer scales.'
   : kind==='terrain' ? 'Tent product: a central peak that vanishes on every edge of the unit square. Repeated copies create a ridged terrain.'
   : kind==='takagi' ? 'Tent sum: the sum of two one-dimensional tent functions. Each quadrant is planar, producing a surface with creases at finer scales.'
   : 'Custom summand: the entered function sets the vertical detail added at each scale.';
 }
 private updatePreview(){
  if(!this.dialog.open)return;
  try{this.preview??=new SummandPreview(this.el('summand-preview'));this.el('summand-preview-status').textContent=this.preview.update(this.el<HTMLTextAreaElement>('surface-phi').value);}
  catch(error){this.el('summand-preview-status').textContent='Preview unavailable: '+(error as Error).message;}
 }
 constructor(private onApply:(maps:MapDefinition[],name:string,surface:SurfaceDefinition)=>void){
  this.dialog.id='surface-dialog';this.dialog.setAttribute('aria-labelledby','surface-title');
  this.dialog.innerHTML=`<form method="dialog" class="dialog-heading"><h2 id="surface-title">Edit Weierstrass-type surface</h2><button class="close" aria-label="Close surface editor">×</button></form>
  <p id="surface-description"></p>
  <label for="surface-name">Name</label><input id="surface-name" class="name-input" maxlength="80">
  <p>f(x,y) = h(x,y) + Σ λⁿ φ(2ⁿx, 2ⁿy), n ≥ 0</p>
  <div class="summand-layout"><div><label for="surface-function">Summand template</label><select id="surface-function"><option value="custom">Custom</option><option value="weierstrass">Sine product</option><option value="terrain">Tent product</option><option value="takagi">Tent sum</option></select>
  <label for="surface-phi">Summand φ(x,y)</label><textarea id="surface-phi" spellcheck="false"></textarea>
  </div><div class="summand-preview-panel"><h3>Summand preview</h3><div id="summand-preview"></div><p id="summand-preview-status" role="status"></p></div></div>
  <label for="surface-lambda">Vertical factor λ</label><input id="surface-lambda" class="name-input" type="number" min="0" max="1" step=".01">
  <label for="surface-base">Base h(x,y)</label><input id="surface-base" class="name-input" spellcheck="false">
  <section class="surface-ifs-definition" aria-labelledby="surface-ifs-heading"><h3 id="surface-ifs-heading">IFS definition</h3>
  <p>Four maps send the unit square to its four quadrants. For i, j ∈ {0, 1}, set u = (x + i)/2 and v = (y + j)/2.</p>
  <p id="surface-map-formula" class="surface-map-formula"></p>
  <p>Each map has weight 1/4. The factor λ scales the previous vertical detail, φ adds the summand at the new position, and h sets the base surface.</p>
  <p id="surface-summand-description"></p></section>
  <p class="sponge-help">Use x, y, pi, sin, cos, abs, and arithmetic; write multiplication as *. The summand is repeated periodically from the unit square. Matching values on opposite edges preserve continuity. All four maps update together.</p>
  <p id="surface-error" role="alert"></p><button id="surface-apply" class="primary">Apply IFS</button>`;
  document.body.append(this.dialog);
  this.el<HTMLSelectElement>('surface-function').onchange=()=>{
   const key=this.el<HTMLSelectElement>('surface-function').value as keyof typeof surfaceDefinitions;
   if(surfaceDefinitions[key])this.el<HTMLTextAreaElement>('surface-phi').value=surfaceDefinitions[key].phi;
   clearTimeout(this.previewTimer);this.updateDefinition();this.updatePreview();
  };
  this.el('surface-phi').oninput=()=>{this.el<HTMLSelectElement>('surface-function').value='custom';this.updateDefinition();clearTimeout(this.previewTimer);this.previewTimer=setTimeout(()=>this.updatePreview(),200);};
  for(const id of ['surface-lambda','surface-base'])this.el(id).oninput=()=>this.updateDefinition();
  this.dialog.addEventListener('close',()=>clearTimeout(this.previewTimer));
  this.el('surface-apply').onclick=()=>{
   try{
    const definition={phi:this.el<HTMLTextAreaElement>('surface-phi').value,lambda:this.el<HTMLInputElement>('surface-lambda').valueAsNumber,base:this.el<HTMLInputElement>('surface-base').value};
    const maps=editableSurfaceMaps(definition);IFS.fromJSON(maps);
    this.el('surface-error').textContent='Generating points…';
    this.onApply(maps,this.el<HTMLInputElement>('surface-name').value.trim()||'Custom surface',definition);
   }catch(error){this.el('surface-error').textContent=(error as Error).message;}
  };
 }
 private el<T extends HTMLElement=HTMLElement>(id:string):T{return this.dialog.querySelector(`#${id}`) as T;}
 open(definition:SurfaceDefinition,name:string,description='',creating=false){
  this.el('surface-title').textContent=creating?'Create Weierstrauss-type IFS':'Edit Weierstrass-type surface';
  this.el('surface-apply').textContent=creating?'Create IFS':'Apply IFS';
  this.el('surface-description').textContent=description||'A Weierstrass-type graph generated by four equally weighted maps. Edit the summand, vertical factor, and base below.';
  this.el<HTMLInputElement>('surface-name').value=name;
  this.el<HTMLTextAreaElement>('surface-phi').value=definition.phi;
  this.el<HTMLInputElement>('surface-lambda').value=String(definition.lambda);
  this.el<HTMLInputElement>('surface-base').value=definition.base;
  this.el<HTMLSelectElement>('surface-function').value=Object.entries(surfaceDefinitions).find(([,v])=>v.phi===definition.phi)?.[0]??'custom';
  this.el('surface-error').textContent='';this.dialog.showModal();this.updateDefinition();this.updatePreview();
 }
}
