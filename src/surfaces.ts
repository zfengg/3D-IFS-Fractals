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
