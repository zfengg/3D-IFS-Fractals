import type { AffineDefinition, MapDefinition } from './model';

export const bernoulliMatrix = [.72,0,0,0,.58,0,0,0,.43];
export function bernoulliMaps(matrix: number[], probability = .5): AffineDefinition[] {
 if(matrix.length !== 9 || !matrix.every(Number.isFinite)) throw new Error('Enter nine finite matrix entries.');
 if(!Number.isFinite(probability) || probability <= 0 || probability >= 1) throw new Error('The first weight must be strictly between 0 and 1.');
 return [{a:[...matrix],b:[0,0,0],p:probability},{a:[...matrix],b:[1,1,1],p:1-probability}];
}
export function isBernoulli(maps: MapDefinition[]): maps is AffineDefinition[] {
 return maps.length===2 && maps.every(m=>'a' in m) &&
  (maps as AffineDefinition[]).every((m,i)=>m.b.every(v=>v===i) && m.a.every((v,j)=>v===(maps[0] as AffineDefinition).a[j]));
}
