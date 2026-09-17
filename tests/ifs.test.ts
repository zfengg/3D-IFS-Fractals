import test from 'node:test';
import assert from 'node:assert/strict';
import {AffineMap,NonlinearMap,IFS,type Vector3} from '../src/model';
import {compileExpression} from '../src/expression';
import {createPreset,presets} from '../src/presets';

test('affine maps apply the full matrix and translation simultaneously',()=>{
 const out:Vector3=[1,2,3];new AffineMap([1,2,0,0,1,3,4,0,1],[2,-1,5]).apply(...out,out);assert.deepEqual(out,[7,10,12]);
});
test('nonlinear maps apply all expressions to the original point',()=>{
 const out:Vector3=[1,2,3];new NonlinearMap(['y','z','x']).apply(...out,out);assert.deepEqual(out,[2,3,1]);
});
test('expression precedence, constants, and functions',()=>{
 assert.equal(compileExpression('-2^2 + pow(2, 3) + sin(pi/2)')(0,0,0),5);
 assert.equal(compileExpression('2^3^2')(0,0,0),512);
 assert.equal(compileExpression('2**-2')(0,0,0),.25);
 assert.equal(compileExpression('max(x,y) + abs(z)')(2,3,-4),7);
});
test('expressions reject JavaScript, malformed syntax, and unbounded complexity',()=>{
 for(const input of ['window.location','x;alert(1)','constructor(1)','sin()','2x','x +','sin(x,y)','('.repeat(160)+'x'+')'.repeat(160)])assert.throws(()=>compileExpression(input),input);
});
test('every preset produces reproducible, finite, fitted points',()=>{
 for(const key of Object.keys(presets)){
  const system=createPreset(key),a=system.generate(2000,17),b=system.generate(2000,17);
  assert.deepEqual(a,b,key);assert.equal(a.positions.length,6000);
  assert.ok(a.positions.every(v=>Number.isFinite(v)&&Math.abs(v)<=1.50001),key);
  assert.ok(new Set(a.ids).size>1,key);
 }
});
test('strict positive probability vectors are required and preserved',()=>{
 const map=(p:number)=>new NonlinearMap(['.5*x','.5*y','.5*z'],p);
 for(const p of [0,-1,2,NaN,Infinity])assert.throws(()=>map(p));
 assert.throws(()=>new IFS([map(.2),map(.3)]),/sum to 1/);
 assert.throws(()=>new IFS([map(.5),map(.50001)]),/sum to 1/);
 const system=new IFS([new AffineMap([.5,0,0,0,.5,0,0,0,.5],[1,0,0],.25),map(.75)]);
 assert.deepEqual(system.weights,[.25,.75]);
 assert.deepEqual(IFS.fromJSON(system.toJSON()).toJSON(),system.toJSON());
 const sample=system.generate(20000);const fraction=sample.ids.filter(id=>id===0).length/sample.ids.length;
 assert.ok(Math.abs(fraction-.25)<.02);
 assert.doesNotThrow(()=>new IFS([map(.1),map(.2),map(.7)]));
});
test('invalid systems and divergent or undefined trajectories fail usefully',()=>{
 assert.throws(()=>IFS.fromJSON([]));assert.throws(()=>IFS.fromJSON([{x:'x',y:'y',z:'z',p:0}]));
 assert.throws(()=>IFS.fromJSON([{a:[1],b:[0,0,0],p:1}]));
 assert.throws(()=>new IFS([new NonlinearMap(['x+1e9','y','z'])]).generate(100));
 assert.throws(()=>new IFS([new NonlinearMap(['sqrt(-1)','y','z'])]).generate(100));
 assert.throws(()=>createPreset('tetra').generate(5000001));
});

test('initial points are validated without mutation; notebook-style metadata is available',()=>{
 const system=new IFS([new NonlinearMap(['x','y','z'])]),start:Vector3=[2,3,4];
 system.generate(10,42,0,start);assert.deepEqual(start,[2,3,4]);
 assert.equal(system.numMaps,1);assert.equal(system.dimAmbient,3);assert.deepEqual(system.weights,[1]);
 assert.throws(()=>system.generate(10,42,0,[NaN,0,0]));
});

test('sponge examples have the expected grid geometry and probability vectors',()=>{
 for(const [key,count] of [['baranski',20],['bedfordMcMullen',16]] as const){
  const system=createPreset(key);assert.equal(system.numMaps,count);
  assert.ok(Math.abs(system.weights.reduce((sum,p)=>sum+p,0)-1)<1e-12);
  for(const map of system.maps){
   assert.ok(map instanceof AffineMap);
   for(const axis of [0,1,2]){
    const scale=map.matrix[axis*3+axis],offset=map.translation[axis];
    assert.ok(scale>0&&scale<1);assert.ok(offset>=0&&offset+scale<=1+1e-12);
   }
   for(const index of [1,2,3,5,6,7])assert.equal(map.matrix[index],0);
  }
 }
 const bm=createPreset('bedfordMcMullen');
 for(const map of bm.maps)assert.deepEqual((map as AffineMap).matrix,[.5,0,0,0,1/3,0,0,0,.25]);
 for(const axis of [0,1,2])assert.equal(new Set(createPreset('baranski').maps.map(m=>(m as AffineMap).matrix[axis*3+axis])).size,3);
});


test('sponge builders use cell widths and cumulative offsets', async()=>{
 const {spongeMaps,uniformPartition,parseWidths}=await import('../src/sponges');
 const [map]=spongeMaps({kind:'bedfordMcMullen',widths:[uniformPartition(3),uniformPartition(4),uniformPartition(5)],cells:[[2,1,3]]});
 assert.deepEqual(map.a,[1/3,0,0,0,1/4,0,0,0,1/5]);
 assert.ok(map.b.every((value,i)=>Math.abs(value-[2/3,1/4,3/5][i])<1e-12));
 const cuts=parseWidths('1/4, 1/2, 1/4');
 const [uneven]=spongeMaps({kind:'baranski',widths:[cuts,cuts,cuts],cells:[[1,2,0]]});
 assert.deepEqual(uneven.a,[.5,0,0,0,.25,0,0,0,.25]);assert.deepEqual(uneven.b,[.25,.75,0]);
 const valid={kind:'baranski' as const,widths:[cuts,cuts,cuts] as [number[],number[],number[]],cells:[[0,0,0]] as [number,number,number][]};
 assert.throws(()=>spongeMaps({...valid,cells:[]}));
 assert.throws(()=>spongeMaps({...valid,cells:[[3,0,0]]}));
 assert.throws(()=>spongeMaps({...valid,cells:[[0,0,0],[0,0,0]]}));
 assert.throws(()=>spongeMaps({...valid,widths:[[.2,.3],cuts,cuts]}));
 assert.throws(()=>spongeMaps({...valid,kind:'bedfordMcMullen'}));
 assert.throws(()=>spongeMaps({...valid,weights:[.5]}));
});

test('large sponge sampling preserves map identifiers above 255',async()=>{
 const {spongeMaps,uniformPartition}=await import('../src/sponges');
 const cells:[number,number,number][]=[];
 for(let x=0;x<10;x++)for(let y=0;y<10;y++)for(let z=0;z<10;z++)cells.push([x,y,z]);
 const axis=uniformPartition(10);
 const system=IFS.fromJSON(spongeMaps({kind:'bedfordMcMullen',widths:[axis,axis,axis],cells}));
 const sample=system.generate(20000,42);
 assert.equal(system.numMaps,1000);assert.equal(new Set(sample.ids).size,1000);assert.ok(sample.ids instanceof Uint16Array);
});

test('Menger editor geometry uses a common uniform grid size',async()=>{
 const {spongeMaps,uniformPartition,mengerExample}=await import('../src/sponges');
 assert.equal(spongeMaps(mengerExample).length,20);
 const axis=uniformPartition(4);
 const [map]=spongeMaps({kind:'menger',widths:[axis,axis,axis],cells:[[3,2,1]]});
 assert.deepEqual(map.a,[.25,0,0,0,.25,0,0,0,.25]);
 assert.deepEqual(map.b,[.75,.5,.25]);
 assert.throws(()=>spongeMaps({...mengerExample,widths:[axis,axis,uniformPartition(3)]}),/must match/);
});


test('export bounds remove margins while retaining every visible edge pixel',async()=>{
 const {alphaBounds}=await import('../src/imageBounds');
 const pixels=new Uint8ClampedArray(8*6*4);
 assert.equal(alphaBounds(pixels,8,6),null);
 pixels[(2*8+3)*4+3]=255;pixels[(4*8+6)*4+3]=1;
 assert.deepEqual(alphaBounds(pixels,8,6),{x:3,y:2,width:4,height:3});
 pixels[3]=255;pixels[(5*8+7)*4+3]=255;
 assert.deepEqual(alphaBounds(pixels,8,6),{x:0,y:0,width:8,height:6});
 assert.deepEqual(alphaBounds(new Uint8ClampedArray([0,0,0,255]),1,1),{x:0,y:0,width:1,height:1});
});


test('motion budget responds to sustained slow frames without reacting to pauses',async()=>{
 const {MotionQuality}=await import('../src/MotionQuality');
 const quality=new MotionQuality();
 let time=0;quality.update(time,true);
 for(let i=0;i<40;i++)assert.equal(quality.update(time+=16.7,true),250000);
 assert.equal(quality.update(time+=1000,true),250000);
 for(let i=0;i<20;i++)quality.update(time+=30,true);
 assert.equal(quality.budget,175000);
 quality.update(time,false);
 assert.equal(quality.update(time+=5000,true),175000);
 for(let i=0;i<300;i++)quality.update(time+=30,true);
 assert.equal(quality.budget,50000);
});

test('Bernoulli maps share a matrix with editable translations and complementary probabilities',async()=>{
 const {bernoulliMaps,bernoulliMatrix,isBernoulli}=await import('../src/bernoulli');
 const maps=bernoulliMaps(bernoulliMatrix,.3);
 assert.deepEqual(maps.map(m=>m.b),[[0,0,0],[1,1,1]]);
 assert.deepEqual(maps.map(m=>m.p),[.3,.7]);
 assert.deepEqual(maps[0].a,maps[1].a);assert.notEqual(maps[0].a,maps[1].a);
 assert.ok(isBernoulli(maps));assert.ok(!isBernoulli(presets.tetra.maps));
 assert.ok(isBernoulli([maps[0],{...maps[1],b:[1,0,1]}]));
 const translations=[[-.2,.3,0],[1,2,-3]];
 const edited=bernoulliMaps(bernoulliMatrix,.4,translations);
 assert.deepEqual(edited.map(m=>m.b),translations);assert.notEqual(edited[0].b,translations[0]);
 assert.deepEqual(IFS.fromJSON(edited).toJSON(),edited);assert.ok(isBernoulli(edited));
 assert.throws(()=>bernoulliMaps(bernoulliMatrix,.5,[[NaN,0,0],[1,1,1]]));
 assert.throws(()=>bernoulliMaps(bernoulliMatrix,.5,[[0,0],[1,1,1]]));
 assert.throws(()=>bernoulliMaps([1,2]));assert.throws(()=>bernoulliMaps(bernoulliMatrix,0));
 assert.throws(()=>bernoulliMaps(bernoulliMatrix,1));
 const p:Vector3=[1,2,3],out:Vector3=[0,0,0];
 new AffineMap(maps[1].a,maps[1].b,maps[1].p).apply(...p,out);
 assert.deepEqual(out,[1.72,2.16,2.29]);
});


test('the five-million-point limit is supported',()=>{
 const sample=createPreset('menger').generate(5_000_000,42);
 assert.equal(sample.positions.length,15_000_000);
 assert.equal(sample.ids.length,5_000_000);
 assert.ok(sample.positions.every(Number.isFinite));
});

test('Feng ETDS example reproduces the six digits and inverse expansion of Example 7.1',()=>{
 const system=createPreset('fengETDS');
 assert.equal(system.numMaps,6);
 assert.deepEqual(system.weights,Array(6).fill(1/6));
 for(const map of system.maps)assert.deepEqual((map as AffineMap).matrix,[1/64,0,0,0,1/16,0,0,0,1/8]);
 assert.deepEqual(system.maps.map(m=>(m as AffineMap).translation.map((v,i)=>v*[64,16,8][i])),[[0,0,0],[0,1,0],[0,2,0],[0,3,0],[0,0,1],[1,0,1]]);
});

test('surface IFSes preserve their continuous graph equations',()=>{
 const tent=(x:number)=>2*Math.abs(x-Math.round(x));
 const h=(x:number,y:number)=>.2*x+.35*y-.45*x*y;
 function value(kind:string,x:number,y:number){
  const lambda=kind==='weierstrass'?.65:kind==='takagi'?.6:.45;
  let sum=kind==='terrain'?h(x,y):0,weight=1;
  for(let n=0;n<48;n++){
   sum+=weight*(kind==='weierstrass'?Math.sin(2*Math.PI*x)*Math.sin(2*Math.PI*y):kind==='takagi'?tent(x)+tent(y):.8*tent(x)*tent(y));
   x=(2*x)%1;y=(2*y)%1;weight*=lambda;
  }
  return sum;
 }
 for(const key of ['weierstrass','terrain','takagi']){
  const system=createPreset(key);assert.equal(system.numMaps,4);
  for(const [x,y] of [[.13,.27],[.7,.41],[0,0],[1,1],[.5,.5]])for(const map of system.maps){
   const out:Vector3=[0,0,0];map.apply(x,y,value(key,x,y),out);
   assert.ok(Math.abs(out[2]-value(key,out[0],out[1]))<1e-8,key);
   assert.equal(map.weight,.25);
  }
 }
 assert.ok(Math.abs(value('terrain',.5,.5)-.9625)<1e-12);
 assert.deepEqual([[0,0],[1,0],[0,1],[1,1]].map(([x,y])=>Number(value('terrain',x,y).toFixed(10))),[0,.2,.35,.1]);
});

test('editable summands produce the same branches as the surface presets',async()=>{
 const {editableSurfaceMaps,surfaceDefinitions}=await import('../src/surfaces');
 for(const kind of ['weierstrass','terrain','takagi'] as const){
  const edited=IFS.fromJSON(editableSurfaceMaps(surfaceDefinitions[kind])),original=createPreset(kind);
  for(let i=0;i<4;i++){
   const a:Vector3=[0,0,0],b:Vector3=[0,0,0];
   edited.maps[i].apply(.23,.61,.4,a);original.maps[i].apply(.23,.61,.4,b);
   a.forEach((v,j)=>assert.ok(Math.abs(v-b[j])<1e-12));
  }
 }
 const custom={phi:'exp(x)+y^2',lambda:.4,base:'x*y'};
 const map=IFS.fromJSON(editableSurfaceMaps(custom)).maps[3],out:Vector3=[0,0,0];
 map.apply(.2,.4,.7,out);
 assert.ok(Math.abs(out[2]-(.4*(.7-.2*.4)+.6*.7+Math.exp(.6)+.7**2))<1e-12);
 for(const definition of [{...custom,lambda:1},{...custom,phi:'z'},{...custom,phi:'sin('}])assert.throws(()=>editableSurfaceMaps(definition));
});

test('piecewise expressions use comparison precedence, lazy branches and nested conditionals',()=>{
 const evaluate=(s:string,x=0,y=0)=>compileExpression(s)(x,y,0);
 assert.equal(evaluate('x < 0.35 ? x/0.35 : (1-x)/0.65',.35),1);
 assert.equal(evaluate('x < 0 ? -1 : x <= 1 ? x : 1',.4),.4);
 assert.equal(evaluate('x < 0 ? -1 : x <= 1 ? x : 1',2),1);
 assert.equal(evaluate('x === 0 ? 0 : 1/x'),0);
 assert.equal(evaluate('x >= 0 ? sqrt(x) : sqrt(-x)',-4),2);
 assert.equal(evaluate('1 + 2 < 4 ? 7 : 9'),7);
 assert.equal(evaluate('(x > 0 ? 2 : 3) + (y !== 0 ? 4 : 5)',1,1),6);
 assert.equal(evaluate('max(x < 0 ? -x : x, 2)',-3),3);
 for(const s of ['x ? 1','x < ? 1 : 0','x ? : 0','x ? 1 :','x=1','x ? alert(1) : 0'])assert.throws(()=>compileExpression(s));
});

test('piecewise-linear gallery surface has matching edges and preserves its graph',()=>{
 const preset=presets.piecewise,definition=preset.surface!;
 const phi=compileExpression(definition.phi);
 assert.equal(phi(.35,.6,0),2);
 for(const t of [0,.2,.35,.6,1]){
  assert.ok(Math.abs(phi(0,t,0)-phi(1,t,0))<1e-12);
  assert.ok(Math.abs(phi(t,0,0)-phi(t,1,0))<1e-12);
 }
 const graph=(x:number,y:number)=>{let sum=0,weight=1;for(let n=0;n<48;n++){sum+=weight*phi(x%1,y%1,0);x*=2;y*=2;weight*=definition.lambda;}return sum;};
 const ifs=createPreset('piecewise');
 for(const map of ifs.maps)for(const [x,y] of [[.13,.27],[.7,.2],[.35,.6]]){
  const out:Vector3=[0,0,0];map.apply(x,y,graph(x,y),out);
  assert.ok(Math.abs(out[2]-graph(out[0],out[1]))<1e-9);
 }
});
