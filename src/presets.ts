import {spongeMaps,mengerExample,baranskiExample,bedfordExample,type SpongeDefinition} from './sponges';
import { IFS, type MapDefinition } from './model';
export { IFS };
export interface Preset {name:string; description:string; maps:MapDefinition[]; sponge?:SpongeDefinition}
export const diagonal = (s: number, b: number[], p = 1) => ({ a: [s,0,0,0,s,0,0,0,s], b, p });
const tetra = [[0,1.224744871,0],[-1,-0.40824829,-0.577350269],[1,-0.40824829,-0.577350269],[0,-0.40824829,1.154700538]].map(v=>diagonal(.5,v.map(x=>x*.5),1/4));
const vicsek=[[0,0,0],[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]].map(v=>diagonal(1/3,v.map(x=>x*2/3),1/7));
const fern=[{a:[.12,0,0,0,.22,0,0,0,.12],b:[0,0,0],p:.01},{a:[.83,.035,0,-.035,.85,0,0,0,.8],b:[0,.28,0],p:.76}];
for(let i=0;i<3;i++){const t=i*Math.PI*2/3,c=Math.cos(t),s=Math.sin(t);fern.push({a:[.32*c,.38*c,-.32*s,-.28,.36,0,.32*s,.38*s,.32*c],b:[0,.16,0],p:.23/3});}

export const presets: Record<string,Preset>={
 tetra:{name:'Sierpiński tetrahedron',description:'Four half-scale copies, nested into a tetrahedron. A three-dimensional relative of the Sierpiński triangle.',maps:tetra},
 menger:{name:'Menger sponge',description:'Twenty smaller cubes remain at every level, opening a lattice of tunnels through the original cube.',maps:spongeMaps(mengerExample),sponge:mengerExample},
 baranski:{name:'Barański sponge',description:'A nonuniform 3 × 3 × 3 grid with 20 retained rectangular cells.',maps:spongeMaps(baranskiExample),sponge:baranskiExample},
 bedfordMcMullen:{name:'Bedford–McMullen sponge',description:'A 2 × 3 × 4 grid with 16 retained cells and contraction ratios 1/2, 1/3, 1/4.',maps:spongeMaps(bedfordExample),sponge:bedfordExample},
 vicsek:{name:'Vicsek cross',description:'Seven copies grow along three perpendicular axes, repeating a cross at every scale.',maps:vicsek},
 fern:{name:'Spatial fern',description:'An experimental branching system with a central stem and three rotated fronds in space.',maps:fern},
 nonlinear:{name:'Sine branches',description:'Three nonlinear maps bend and branch space with sine and cosine. Open the editor to change their equations.',maps:[{x:'.55*x + .25*sin(y) - .7',y:'.55*y + .2*cos(z)',z:'.55*z + .2*sin(x)',p:1/3},{x:'.55*x + .25*sin(z) + .7',y:'.55*y + .2*sin(x)',z:'.55*z + .2*cos(y)',p:1/3},{x:'.5*x + .2*sin(y)',y:'.5*y + .8',z:'.5*z + .3*cos(x)',p:1/3}]}
};

export function createPreset(key: string): IFS { const preset = presets[key]; if(!preset) throw new Error("Unknown preset"); return IFS.fromJSON(preset.maps, preset.name); }
