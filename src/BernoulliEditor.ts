import {jsonControls,fileMaps} from './editorJSON';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { bernoulliMaps, bernoulliMatrix, isBernoulli } from './bernoulli';
import type { AffineDefinition } from './model';

/** The three draggable endpoints are the columns of the shared linear matrix. */
export class BernoulliEditor {
 private invalidateImport = () => {};
 private readonly dialog = document.createElement('dialog');
 private readonly inputs: HTMLInputElement[] = [];
 private readonly translationInputs: HTMLInputElement[][] = [];
 private matrix = [...bernoulliMatrix];
 private preview?: {sync:()=>void;resize:()=>void; stop:()=>void};
 private name = '3D Bernoulli convolutions';
 constructor(private readonly onApply:(maps:AffineDefinition[],name:string)=>void){
  this.dialog.id='bernoulli-dialog';
  this.dialog.setAttribute('aria-labelledby','bernoulli-title');
  this.dialog.innerHTML=`<form method="dialog" class="dialog-heading"><h2 id="bernoulli-title">3D Bernoulli convolutions</h2><button class="close" aria-label="Close Bernoulli editor">×</button></form>
   <p class="bernoulli-formula">f₀(x) = Ax + b₀ &nbsp; · &nbsp; f₁(x) = Ax + b₁</p>
   <div class="bernoulli-layout"><div><div class="bernoulli-columns" role="group" aria-label="Select matrix column"><button type="button" data-column="0">A e₁</button><button type="button" data-column="1">A e₂</button><button type="button" data-column="2">A e₃</button></div><div id="bernoulli-preview"></div><p class="sponge-help">Choose a colored endpoint, then drag its arrows or plane handles. Drag elsewhere to orbit; scroll to zoom. The outline is the unit cube; the solid shape is its image under A.</p></div>
   <div><h3>Shared linear matrix</h3><div id="bernoulli-matrix"></div><p class="sponge-help">Columns are the three edges from the origin. Numeric entries also support precise or keyboard editing.</p><h3>Translations</h3><div id="bernoulli-translations"></div><label for="bernoulli-p">Weight of f₀</label><input id="bernoulli-p" type="number" min="0" max="1" step=".01" value=".5"><p id="bernoulli-pair"></p><button id="bernoulli-reset" type="button">Reset matrix</button><p class="sponge-help">Use a contractive matrix for a bounded attractor. Apply to regenerate the fractal.</p></div></div>
   <p id="bernoulli-error" role="alert"></p><button id="bernoulli-apply" class="primary" type="button">Apply IFS</button>`;
  document.body.append(this.dialog);
  for(let i=0;i<9;i++){
   const input=document.createElement('input'); input.type='number';input.step='.01';
   input.setAttribute('aria-label',`Matrix row ${Math.floor(i/3)+1} column ${i%3+1}`);
   input.style.borderColor=['#ed8c82','#c2ef87','#78bbef'][i%3];
   input.oninput=()=>{if(input.value!==''&&Number.isFinite(input.valueAsNumber)){this.matrix[i]=input.valueAsNumber;this.preview?.sync();}this.validate();};
   this.el('bernoulli-matrix').append(input);this.inputs.push(input);
  }
  for(let map=0;map<2;map++){
   const row=document.createElement('div');row.className='bernoulli-translation';
   const title=document.createElement('span');title.textContent=map===0?'b₀':'b₁';row.append(title);
   this.translationInputs.push(['x','y','z'].map(axis=>{
    const label=document.createElement('label');label.textContent=axis;
    const input=document.createElement('input');input.type='number';input.step='.01';input.value=String(map);
    input.setAttribute('aria-label',`Translation ${map} ${axis}`);input.oninput=()=>this.validate();
    label.append(input);row.append(label);return input;
   }));
   this.el('bernoulli-translations').append(row);
  }
  this.el('bernoulli-reset').onclick=()=>{this.matrix=[...bernoulliMatrix];this.writeInputs();this.preview?.sync();this.validate();};
  this.el<HTMLInputElement>('bernoulli-p').oninput=()=>this.validate();
  this.el('bernoulli-apply').onclick=()=>{
   if(!this.validate())return;
   this.el('bernoulli-error').textContent='Generating points…';
   this.onApply(bernoulliMaps(this.matrix,this.el<HTMLInputElement>('bernoulli-p').valueAsNumber,this.readTranslations()),this.name);
  };
  this.invalidateImport=jsonControls(this.dialog,()=>{
   if(!this.validate())throw Error(this.el('bernoulli-error').textContent!);
   return {version:1,type:'bernoulli',name:this.name,maps:bernoulliMaps(this.matrix,this.el<HTMLInputElement>('bernoulli-p').valueAsNumber,this.readTranslations())};
  },file=>{
   const maps=fileMaps(file);if(!isBernoulli(maps))throw Error('Import two affine maps with the same linear matrix.');
   this.open(maps,file.name);
  },message=>{this.el('bernoulli-error').textContent=message;});
  this.dialog.addEventListener('close',()=>this.preview?.stop());
 }
 private el<T extends HTMLElement=HTMLElement>(id:string):T{return this.dialog.querySelector(`#${id}`) as T;}
 private readTranslations(){return this.translationInputs.map(row=>row.map(input=>input.valueAsNumber));}
 private writeInputs(){this.inputs.forEach((input,i)=>input.value=String(this.matrix[i]));}
 private validate():boolean{
  try{
   if(this.inputs.some(i=>i.value===''||!Number.isFinite(i.valueAsNumber)))throw new Error('Enter nine finite matrix entries.');
   const p=this.el<HTMLInputElement>('bernoulli-p').valueAsNumber;bernoulliMaps(this.matrix,p,this.readTranslations());
   this.el('bernoulli-pair').textContent=`Weight of f₁: ${Number((1-p).toPrecision(8))}`;
   this.el('bernoulli-error').textContent='';this.el<HTMLButtonElement>('bernoulli-apply').disabled=false;return true;
  }catch(error){this.el('bernoulli-error').textContent=(error as Error).message;this.el<HTMLButtonElement>('bernoulli-apply').disabled=true;return false;}
 }
 open(maps:AffineDefinition[],name:string){
  this.invalidateImport();
  this.matrix=[...maps[0].a];this.name=name;this.writeInputs();
  this.translationInputs.forEach((row,i)=>row.forEach((input,j)=>input.value=String(maps[i].b[j])));
  this.el<HTMLInputElement>('bernoulli-p').value=String(maps[0].p);this.validate();this.dialog.showModal();
  if(!this.preview)this.preview=this.createPreview();
  this.preview.sync();this.preview.resize();
 }
 private createPreview(){
  const host=this.el('bernoulli-preview'),scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(38,1,.01,100);camera.up.set(0,0,1);camera.position.set(1.9,-2.5,1.9);
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-label','Transformed unit cube with three draggable matrix columns');
  const orbit=new OrbitControls(camera,renderer.domElement);orbit.target.set(.35,.35,.35);orbit.enablePan=false;orbit.minDistance=.6;orbit.maxDistance=20;orbit.update();
  const draw=()=>{if(this.dialog.open)renderer.render(scene,camera);};
  orbit.addEventListener('change',draw);
  const geometry=new THREE.BoxGeometry(1,1,1);geometry.translate(.5,.5,.5);
  const outline=new THREE.LineSegments(new THREE.EdgesGeometry(geometry),new THREE.LineBasicMaterial({color:'#73868e',transparent:true,opacity:.6}));scene.add(outline);
  const solid=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:'#69c8b5',transparent:true,opacity:.18,side:THREE.DoubleSide,depthWrite:false}));
  const edges=new THREE.LineSegments(new THREE.EdgesGeometry(geometry),new THREE.LineBasicMaterial({color:'#a6ded0'}));
  solid.matrixAutoUpdate=false;edges.matrixAutoUpdate=false;scene.add(solid,edges,new THREE.AxesHelper(1.25));
  const colors=['#ed8c82','#c2ef87','#78bbef'];
  const handles=colors.map(color=>{const h=new THREE.Mesh(new THREE.SphereGeometry(.045,16,12),new THREE.MeshBasicMaterial({color,depthTest:false}));h.renderOrder=2;scene.add(h);return h;});
  const transform=new TransformControls(camera,renderer.domElement);transform.setMode('translate');transform.setSpace('world');transform.setSize(.8);scene.add(transform.getHelper());
  let selected=0,syncing=false;
  const choose=(i:number)=>{selected=i;transform.attach(handles[i]);this.dialog.querySelectorAll<HTMLButtonElement>('[data-column]').forEach((b,j)=>b.setAttribute('aria-pressed',String(j===i)));draw();};
  this.dialog.querySelectorAll<HTMLButtonElement>('[data-column]').forEach((b,i)=>b.onclick=()=>choose(i));
  const sync=()=>{
   syncing=true;const a=this.matrix;
   solid.matrix.set(a[0],a[1],a[2],0,a[3],a[4],a[5],0,a[6],a[7],a[8],0,0,0,0,1);edges.matrix.copy(solid.matrix);
   handles.forEach((h,i)=>h.position.set(a[i],a[i+3],a[i+6]));syncing=false;draw();
  };
  transform.addEventListener('dragging-changed',e=>{orbit.enabled=!e.value;});
  transform.addEventListener('objectChange',()=>{
   if(syncing)return;const p=handles[selected].position;
   [p.x,p.y,p.z].forEach((v,row)=>this.matrix[row*3+selected]=Number(v.toFixed(4)));
   this.writeInputs();this.validate();sync();
  });
  transform.addEventListener('change',draw);
  const raycaster=new THREE.Raycaster();
  renderer.domElement.addEventListener('pointerdown',e=>{
   if(transform.dragging||transform.axis)return;
   const rect=renderer.domElement.getBoundingClientRect();
   raycaster.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2),camera);
   const hit=raycaster.intersectObjects(handles)[0];if(hit)choose(handles.indexOf(hit.object as typeof handles[number]));
  });
  const resize=()=>{const {width,height}=host.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();draw();};
  new ResizeObserver(resize).observe(host);choose(0);sync();resize();
  return {sync,resize,stop:()=>{transform.reset();orbit.enabled=true;}};
 }
}
