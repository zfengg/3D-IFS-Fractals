import {editableSurfaceMaps,surfaceDefinitions,type SurfaceDefinition} from './surfaces';
import {IFS,type MapDefinition} from './model';

export class SurfaceEditor{
 private dialog=document.createElement('dialog');
 constructor(private onApply:(maps:MapDefinition[],name:string,surface:SurfaceDefinition)=>void){
  this.dialog.id='surface-dialog';this.dialog.setAttribute('aria-labelledby','surface-title');
  this.dialog.innerHTML=`<form method="dialog" class="dialog-heading"><h2 id="surface-title">Edit Weierstrass-type surface</h2><button class="close" aria-label="Close surface editor">×</button></form>
  <label for="surface-name">Name</label><input id="surface-name" class="name-input" maxlength="80">
  <p>f(x,y) = h(x,y) + Σ λⁿ φ(2ⁿx, 2ⁿy), n ≥ 0</p>
  <label for="surface-function">Summand template</label><select id="surface-function"><option value="custom">Custom</option><option value="weierstrass">Sine product</option><option value="terrain">Tent product</option><option value="takagi">Tent sum</option></select>
  <label for="surface-phi">Summand φ(x,y)</label><textarea id="surface-phi" spellcheck="false"></textarea>
  <label for="surface-lambda">Vertical factor λ</label><input id="surface-lambda" class="name-input" type="number" min="0" max="1" step=".01">
  <label for="surface-base">Base h(x,y)</label><input id="surface-base" class="name-input" spellcheck="false">
  <p class="sponge-help">Use x, y, pi, sin, cos, abs, and arithmetic; write multiplication as *. The summand is repeated periodically from the unit square. Matching values on opposite edges preserve continuity. All four maps update together.</p>
  <p id="surface-error" role="alert"></p><button id="surface-apply" class="primary">Apply IFS</button>`;
  document.body.append(this.dialog);
  this.el<HTMLSelectElement>('surface-function').onchange=()=>{
   const key=this.el<HTMLSelectElement>('surface-function').value as keyof typeof surfaceDefinitions;
   if(surfaceDefinitions[key])this.el<HTMLTextAreaElement>('surface-phi').value=surfaceDefinitions[key].phi;
  };
  this.el('surface-phi').oninput=()=>{this.el<HTMLSelectElement>('surface-function').value='custom';};
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
 open(definition:SurfaceDefinition,name:string){
  this.el<HTMLInputElement>('surface-name').value=name;
  this.el<HTMLTextAreaElement>('surface-phi').value=definition.phi;
  this.el<HTMLInputElement>('surface-lambda').value=String(definition.lambda);
  this.el<HTMLInputElement>('surface-base').value=definition.base;
  this.el<HTMLSelectElement>('surface-function').value=Object.entries(surfaceDefinitions).find(([,v])=>v.phi===definition.phi)?.[0]??'custom';
  this.el('surface-error').textContent='';this.dialog.showModal();
 }
}
