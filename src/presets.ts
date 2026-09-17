import {bernoulliMaps,bernoulliMatrix} from './bernoulli';
import {spongeMaps,mengerExample,baranskiExample,bedfordExample,type SpongeDefinition} from './sponges';
import { IFS, type MapDefinition } from './model';
export { IFS };
export interface Preset {name:string; description:string; maps:MapDefinition[]; defaultPoints?:number; sponge?:SpongeDefinition}
export const diagonal = (s: number, b: number[], p = 1) => ({ a: [s,0,0,0,s,0,0,0,s], b, p });
// Zhou Feng, ETDS 46 (2026), Example 7.1: f_d(x) = Λ⁻¹(x+d).
// https://arxiv.org/html/2405.03213#S7
const fengETDS = [[0,0,0],[0,1,0],[0,2,0],[0,3,0],[0,0,1],[1,0,1]]
 .map(d=>({a:[1/64,0,0,0,1/16,0,0,0,1/8],b:[d[0]/64,d[1]/16,d[2]/8],p:1/6}));
const tetra = [[0,1.224744871,0],[-1,-0.40824829,-0.577350269],[1,-0.40824829,-0.577350269],[0,-0.40824829,1.154700538]].map(v=>diagonal(.5,v.map(x=>x*.5),1/4));
const vicsek=[[0,0,0],[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]].map(v=>diagonal(1/3,v.map(x=>x*2/3),1/7));
const fern=[{a:[.12,0,0,0,.22,0,0,0,.12],b:[0,0,0],p:.01},{a:[.83,.035,0,-.035,.85,0,0,0,.8],b:[0,.28,0],p:.76}];
for(let i=0;i<3;i++){const t=i*Math.PI*2/3,c=Math.cos(t),s=Math.sin(t);fern.push({a:[.32*c,.38*c,-.32*s,-.28,.36,0,.32*s,.38*s,.32*c],b:[0,.16,0],p:.23/3});}

// Similarities with explicit rotations keep these examples contractive.
const octahedron = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]
 .map(v=>diagonal(.5,v.map(x=>x*.5),1/6));
const dust: MapDefinition[] = [];
for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])
 dust.push(diagonal(1/3,[x*2/3,y*2/3,z*2/3],1/8));
const twistedTetra = tetra.map((map,i)=>{
 const angle=(i%2 ? -1 : 1)*Math.PI/5,c=Math.cos(angle)*.48,s=Math.sin(angle)*.48;
 return {a:[c,0,s,0,.48,0,-s,0,c],b:map.b,p:1/4};
});
// A short trunk and three tilted, azimuthally rotated copies of the whole tree.
const tree: MapDefinition[] = [{a:[.12,0,0,0,.5,0,0,0,.12],b:[0,0,0],p:.1}];
for(let i=0;i<3;i++){
 const angle=i*2*Math.PI/3,c=Math.cos(angle),s=Math.sin(angle);
 const tilt=Math.PI/5,u=Math.cos(tilt),v=Math.sin(tilt),r=.62;
 tree.push({a:[r*c*u,r*c*v,r*s,-r*v,r*u,0,-r*s*u,-r*s*v,r*c],b:[0,.5,0],p:.3});
}

export const presets: Record<string,Preset>={
 tetra:{name:'Sierpiński tetrahedron',description:'Four half-scale copies, nested into a tetrahedron. A three-dimensional relative of the Sierpiński triangle.',maps:tetra},
 bernoulli:{name:'3D Bernoulli convolutions',description:'Two maps with a shared linear matrix and translations (0,0,0) and (1,1,1).',maps:bernoulliMaps(bernoulliMatrix)},
 menger:{name:'Menger sponge',defaultPoints:750_000,description:'Twenty smaller cubes remain at every level, opening a lattice of tunnels through the original cube.',maps:spongeMaps(mengerExample),sponge:mengerExample},
 baranski:{name:'Barański sponge',description:'A nonuniform 3 × 3 × 3 grid with 20 retained rectangular cells.',maps:spongeMaps(baranskiExample),sponge:baranskiExample},
 fengETDS:{name:"BM sponge with MFD = MME",description:'Example 7.1: six maps on a 64 × 16 × 8 grid, with uniform weights.',maps:fengETDS},
 bedfordMcMullen:{name:'Bedford–McMullen sponge',description:'A 2 × 3 × 4 grid with 16 retained cells and contraction ratios 1/2, 1/3, 1/4.',maps:spongeMaps(bedfordExample),sponge:bedfordExample},
 octahedron:{name:'Sierpiński octahedron',description:'Six half-scale copies arranged at the vertices of an octahedron.',maps:octahedron},
 cantorDust:{name:'Cantor dust',description:'Eight corner copies at one-third scale form a sparse cubic dust.',maps:dust},
 twistedTetra:{name:'Twisted tetrahedron',description:'Four rotated copies give a tetrahedral arrangement a spiral texture.',maps:twistedTetra},
 tree:{name:'Branching tree',description:'Three tilted branches repeat around a slender central trunk.',maps:tree},
 vicsek:{name:'Vicsek cross',description:'Seven copies grow along three perpendicular axes, repeating a cross at every scale.',maps:vicsek},
 fern:{name:'Spatial fern',description:'An experimental branching system with a central stem and three rotated fronds in space.',maps:fern},
 nonlinear:{name:'Sine branches',description:'Three nonlinear maps bend and branch space with sine and cosine. Open the editor to change their equations.',maps:[{x:'.55*x + .25*sin(y) - .7',y:'.55*y + .2*cos(z)',z:'.55*z + .2*sin(x)',p:1/3},{x:'.55*x + .25*sin(z) + .7',y:'.55*y + .2*sin(x)',z:'.55*z + .2*cos(y)',p:1/3},{x:'.5*x + .2*sin(y)',y:'.5*y + .8',z:'.5*z + .3*cos(x)',p:1/3}]}
};

export function createPreset(key: string): IFS { const preset = presets[key]; if(!preset) throw new Error("Unknown preset"); return IFS.fromJSON(preset.maps, preset.name); }
