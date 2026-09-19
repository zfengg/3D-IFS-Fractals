import {IFS,type MapDefinition} from './model';
import {spongeMaps,type SpongeDefinition} from './sponges';
import {editableSurfaceMaps,type SurfaceDefinition} from './surfaces';
import {isBernoulli} from './bernoulli';

export type EditorFile =
 | {version:1;type:'general'|'bernoulli';name:string;maps:MapDefinition[]}
 | {version:1;type:'sponge';name:string;definition:SpongeDefinition}
 | {version:1;type:'surface';name:string;definition:SurfaceDefinition};

/** Validate completely before changing any editor draft. Legacy map arrays remain supported. */
export function parseEditorFile(value:unknown):EditorFile {
 if(Array.isArray(value))return {version:1,type:'general',name:'Imported IFS',maps:IFS.fromJSON(value).toJSON()};
 if(!value||typeof value!=='object')throw Error('Expected an IFS JSON object or map array.');
 const file=value as EditorFile;
 if(file.version!==1)throw Error('Unsupported IFS JSON version.');
 if(typeof file.name!=='string'||!file.name.trim()||file.name.length>80)throw Error('Provide a name of 1–80 characters.');
 switch(file.type){
  case 'general':case 'bernoulli':{
   const maps=IFS.fromJSON(file.maps).toJSON();
   if(file.type==='bernoulli'&&!isBernoulli(maps))throw Error('Bernoulli IFS requires two affine maps with the same matrix.');
   return {...file,maps};
  }
  case 'sponge':{
   const d=file.definition;
   if(!d||!['menger','bedfordMcMullen','baranski'].includes(d.kind)||!Array.isArray(d.widths)||!d.widths.every(Array.isArray)||!Array.isArray(d.cells)||!d.cells.every(Array.isArray)|| (d.weights!==undefined&&!Array.isArray(d.weights)))throw Error('Invalid sponge definition.');
   spongeMaps(d);break;
  }
  case 'surface':{
   const d=file.definition;
   if(!d||typeof d.phi!=='string'||typeof d.base!=='string')throw Error('Provide summand and base expressions.');
   IFS.fromJSON(editableSurfaceMaps(d));break;
  }
  default:throw Error('Unknown IFS editor type.');
 }
 return structuredClone(file);
}
export function fileMaps(file:EditorFile):MapDefinition[]{
 return file.type==='sponge'?spongeMaps(file.definition):file.type==='surface'?editableSurfaceMaps(file.definition):file.maps;
}

/** Shared local-file controls. Import changes the draft only; Apply updates the plot. */
export function jsonControls(dialog:HTMLDialogElement,read:()=>EditorFile,write:(file:EditorFile)=>void,error:(message:string)=>void):()=>void {
 const row=document.createElement('div');row.className='json-file-actions';
 const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.hidden=true;
 const load=document.createElement('button'),save=document.createElement('button');
 for(const button of [load,save]){button.type='button';button.className='secondary-button';}
 load.textContent='Import JSON';save.textContent='Export JSON';row.append(load,save,input);
 dialog.querySelector('.dialog-heading')!.after(row);
 let revision=0;
 const invalidate=()=>{revision++;};dialog.addEventListener('close',invalidate);
 load.onclick=()=>{input.value='';input.click();};
 input.onchange=async()=>{
  const file=input.files?.[0];if(!file)return;const request=++revision;
  try{
   if(file.size>5*1024*1024)throw Error('Choose a JSON file smaller than 5 MB.');
   const text=await file.text();if(request!==revision||!dialog.open)return;
   write(parseEditorFile(JSON.parse(text)));error('');
  }catch(e){if(request===revision&&dialog.open)error(`Could not import JSON: ${(e as Error).message}`);}
 };
 save.onclick=()=>{
  try{
   const file=parseEditorFile(read());
   const url=URL.createObjectURL(new Blob([JSON.stringify(file,null,2)+'\n'],{type:'application/json'}));
   const link=document.createElement('a');link.href=url;link.download=(file.name.replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-|-$/g,'')||'ifs')+'.json';
   document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);error('');
  }catch(e){error(`Could not export JSON: ${(e as Error).message}`);}
 };
 return invalidate;
}
