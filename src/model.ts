import {compileExpression, type Expression} from './expression';

export type Vector3 = [number, number, number];
export interface AffineDefinition {a: number[]; b: number[]; p: number}
export interface NonlinearDefinition {x: string; y: string; z: string; p: number}
export type MapDefinition = AffineDefinition | NonlinearDefinition;
export interface PointSample {positions: Float32Array; ids: Uint16Array}
/** A weighted transformation of R³. All coordinates use the same input point. */
export abstract class IFSMap {
  abstract readonly kind: 'affine' | 'nonlinear';
  constructor(public readonly weight: number) {
    if (!Number.isFinite(weight) || weight <= 0 || weight > 1) throw new Error('Each probability must be finite and strictly positive, and at most 1.');
  }
  abstract apply(x: number, y: number, z: number, output: Vector3): void;
  abstract toJSON(): MapDefinition;
}

export class AffineMap extends IFSMap {
  readonly kind = 'affine';
  readonly matrix: readonly number[];
  readonly translation: readonly number[];
  constructor(matrix: number[], translation: number[], weight = 1) {
    super(weight);
    if (!Array.isArray(matrix) || matrix.length !== 9 || !Array.isArray(translation) || translation.length !== 3 || ![...matrix,...translation].every(Number.isFinite)) {
      throw new Error('Affine maps need a 3 × 3 matrix and a 3-component translation with finite numbers.');
    }
    this.matrix = Object.freeze([...matrix]); this.translation = Object.freeze([...translation]);
  }
  apply(x: number, y: number, z: number, out: Vector3): void {
    const a=this.matrix,b=this.translation;
    out[0]=a[0]*x+a[1]*y+a[2]*z+b[0];
    out[1]=a[3]*x+a[4]*y+a[5]*z+b[1];
    out[2]=a[6]*x+a[7]*y+a[8]*z+b[2];
  }
  toJSON(): AffineDefinition {return {a:[...this.matrix],b:[...this.translation],p:this.weight};}
}

export class NonlinearMap extends IFSMap {
  readonly kind = 'nonlinear';
  readonly expressions: readonly [string,string,string];
  private readonly compiled: readonly Expression[];
  constructor(expressions: [string,string,string], weight = 1) {
    super(weight);
    this.expressions=Object.freeze([...expressions]) as readonly [string,string,string];
    this.compiled=expressions.map((source,i)=>{try{return compileExpression(source);}catch(error){throw new Error(`${['x','y','z'][i]}′: ${(error as Error).message}`);}});
  }
  apply(x: number,y: number,z: number,out: Vector3): void {for(let i=0;i<3;i++)out[i]=this.compiled[i](x,y,z);}
  toJSON(): NonlinearDefinition {return {x:this.expressions[0],y:this.expressions[1],z:this.expressions[2],p:this.weight};}
}

/** Owns an IFS and its deterministic chaos-game sampling algorithm. */
export class IFS {
  readonly maps: readonly IFSMap[];
  private readonly cumulative: number[];
  readonly dimAmbient = 3;
  get numMaps(): number { return this.maps.length; }
  get weights(): number[] { return this.maps.map(m=>m.weight); }
  constructor(maps: IFSMap[], public readonly name='Custom IFS') {
    if(maps.length<1 || maps.length>1000)throw new Error('Provide between 1 and 1,000 transformations.');
    this.maps=Object.freeze([...maps]);
    const total=maps.reduce((s,m)=>s+m.weight,0);
    if(!Number.isFinite(total)||Math.abs(total-1)>1e-9)throw new Error(`Probabilities must sum to 1 (current total: ${total}).`);
    let sum=0;this.cumulative=maps.map(m=>(sum+=m.weight));this.cumulative[this.cumulative.length-1]=1;
  }
  static fromJSON(input: unknown, name='Custom IFS'): IFS {
    if(!Array.isArray(input))throw new Error('The system must be an array of maps.');
    return new IFS(input.map((m,i)=>{
      try {
        if(!m||typeof m!=='object'||typeof m.p!=='number')throw new Error('Each map needs a numeric probability p.');
        return ('x'in m||'y'in m||'z'in m)?new NonlinearMap([m.x,m.y,m.z],m.p):new AffineMap(m.a,m.b,m.p);
      } catch(error){throw new Error(`Transform ${i+1}: ${(error as Error).message}`);}
    }),name);
  }
  toJSON(): MapDefinition[] {return this.maps.map(m=>m.toJSON());}
  generate(count: number, seed=42, burnIn=100, initialPoint: Vector3=[0,0,0]): PointSample {
    if(!Number.isInteger(count)||count<1||count>1000000)throw new Error('Point count must be between 1 and 1,000,000.');
    if(!Number.isInteger(burnIn)||burnIn<0||burnIn>10000)throw new Error('Burn-in must be between 0 and 10,000.');
    if(initialPoint.length!==3||!initialPoint.every(Number.isFinite))throw new Error('The initial point must have three finite coordinates.');
    let state=seed>>>0;
    const random=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;};
    const positions=new Float32Array(count*3),ids=new Uint16Array(count),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity],point: Vector3=[...initialPoint];
    for(let i=-burnIn;i<count;i++){
      const r=random();let low=0,high=this.maps.length-1;while(low<high){const middle=(low+high)>>>1;if(r<this.cumulative[middle])high=middle;else low=middle+1;}const index=low;
      this.maps[index].apply(point[0],point[1],point[2],point);
      if(!point.every(v=>Number.isFinite(v)&&Math.abs(v)<1e8))throw new Error('This system diverges or leaves the function domain. Check its scales and expressions.');
      if(i>=0){ids[i]=index;for(let k=0;k<3;k++){positions[i*3+k]=point[k];min[k]=Math.min(min[k],point[k]);max[k]=Math.max(max[k],point[k]);}}
    }
    // Fit the sampled bounds uniformly: the shape's aspect ratio is preserved.
    const center=min.map((v,k)=>(v+max[k])/2),extent=Math.max(...max.map((v,k)=>v-min[k]));
    for(let i=0;i<positions.length;i++)positions[i]=(positions[i]-center[i%3])/(extent||1)*3;
    return {positions,ids};
  }
}
