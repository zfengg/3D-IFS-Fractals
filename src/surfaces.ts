import {compileExpression} from './expression';
import type { MapDefinition } from './model';

/** Graph IFSes: each map covers a quadrant of [0,1]². */
export function surfaceMaps(kind: 'weierstrass' | 'terrain' | 'takagi'): MapDefinition[] {
 const maps:MapDefinition[]=[];
 for(let i=0;i<2;i++)for(let j=0;j<2;j++){
  const u=`((x+${i})/2)`,v=`((y+${j})/2)`;
  if(kind==='takagi'){
   // The periodic tent function is linear on each half of its period.
   maps.push({a:[.5,0,0,0,.5,0,i?-1:1,j?-1:1,.6],b:[i/2,j/2,i+j],p:.25});
  }else if(kind==='weierstrass'){
   maps.push({x:u,y:v,z:`0.65*z+sin(pi*(x+${i}))*sin(pi*(y+${j}))`,p:.25});
  }else{
   // f=h+g, h=.2x+.35y-.45xy, g=q+.45g(2x,2y),
   // q=.8 tent(x)tent(y). g vanishes on the square boundary.
   const h=(x:string,y:string)=>`(0.2*${x}+0.35*${y}-0.45*${x}*${y})`;
   maps.push({x:u,y:v,z:`0.45*(z-${h('x','y')})+${h(u,v)}+0.8*${i?'(1-x)':'x'}*${j?'(1-y)':'y'}`,p:.25});
  }
 }
 return maps;
}

export interface SurfaceDefinition {phi:string;lambda:number;base:string}
export const surfaceDefinitions:Record<'weierstrass'|'terrain'|'takagi',SurfaceDefinition>={
 weierstrass:{phi:'sin(2*pi*x)*sin(2*pi*y)',lambda:.65,base:'0'},
 terrain:{phi:'0.8*(1-abs(2*x-1))*(1-abs(2*y-1))',lambda:.45,base:'0.2*x+0.35*y-0.45*x*y'},
 takagi:{phi:'(1-abs(2*x-1))+(1-abs(2*y-1))',lambda:.6,base:'0'},
};

/** Substitute identifiers, never arbitrary substrings such as the x in exp. */
export function editableSurfaceMaps(definition:SurfaceDefinition):MapDefinition[]{
 const {phi,lambda,base}=definition;
 if(!Number.isFinite(lambda)||lambda<=0||lambda>=1)throw new Error('Choose 0 < λ < 1.');
 for(const expression of [phi,base]){
  if(/\bz\b/.test(expression))throw new Error('Surface functions may use x and y, but not z.');
  compileExpression(expression);
 }
 const maps:MapDefinition[]=[];
 for(let i=0;i<2;i++)for(let j=0;j<2;j++){
  const x=`((x+${i})/2)`,y=`((y+${j})/2)`;
  const at=(expression:string)=>expression.replace(/\b[xy]\b/g,v=>v==='x'?x:y);
  const z=base.trim()==='0'?`${lambda}*z+(${at(phi)})`:`${lambda}*(z-(${base}))+(${at(base)})+(${at(phi)})`;
  compileExpression(z);maps.push({x,y,z,p:.25});
 }
 return maps;
}
