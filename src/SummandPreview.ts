import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {compileExpression} from './expression';

/** A sampled graph on the unit square; renders only on edits, resize or orbit. */
export class SummandPreview {
 private scene=new THREE.Scene();
 private camera=new THREE.PerspectiveCamera(38,1,.01,100);
 private renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
 private controls:OrbitControls;
 private mesh=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.8}));
 constructor(private host:HTMLElement){
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  this.renderer.domElement.setAttribute('role','img');
  this.renderer.domElement.setAttribute('aria-label','Graph of the summand on the unit square. Drag to orbit; scroll to zoom.');
  host.append(this.renderer.domElement);
  this.camera.zoom=1.6;this.camera.up.set(0,0,1);this.camera.position.set(2,-2.8,2.1);
  this.controls=new OrbitControls(this.camera,this.renderer.domElement);
  this.controls.enablePan=false;this.controls.minDistance=1;this.controls.maxDistance=10;
  this.controls.addEventListener('change',()=>this.draw());this.controls.update();
  this.scene.add(new THREE.HemisphereLight(0xffffff,0x3b5264,2));
  const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(1,-2,4);this.scene.add(light,this.mesh);
  new ResizeObserver(()=>this.resize()).observe(host);
 }
 update(source:string):string{
  try{
   if(/\bz\b/.test(source))throw Error('The summand may use x and y, but not z.');
   const fn=compileExpression(source),n=64,values:number[]=[];
   let low=Infinity,high=-Infinity;
   for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){
    const z=fn(i/n,j/n,0);
    if(!Number.isFinite(z)||Math.abs(z)>1e12)throw Error('The summand must have finite values of magnitude at most 10¹² on the preview grid.');
    values.push(z);low=Math.min(low,z);high=Math.max(high,z);
   }
   const geometry=new THREE.PlaneGeometry(1,1,n,n),positions=geometry.getAttribute('position');
   const colors=new Float32Array(values.length*3),color=new THREE.Color();
   const scale=1/Math.max(1,high-low),middle=(low+high)/2;
   for(let k=0;k<values.length;k++){
    const x=(k%(n+1))/n,y=Math.floor(k/(n+1))/n,z=values[k];
    positions.setXYZ(k,(x-.5)*scale,(y-.5)*scale,(z-middle)*scale);
    color.set('#416db8').lerp(new THREE.Color('#d6ef92'),high===low?.5:(z-low)/(high-low));color.toArray(colors,k*3);
   }
   geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.computeVertexNormals();geometry.computeBoundingSphere();
   this.mesh.geometry.dispose();this.mesh.geometry=geometry;this.mesh.visible=true;this.resize();
   return `x, y ∈ [0, 1] · φ ≈ ${Number(low.toPrecision(4))} to ${Number(high.toPrecision(4))}`;
  }catch(error){this.mesh.visible=false;this.draw();throw error;}
 }
 private resize(){const {width,height}=this.host.getBoundingClientRect();if(!width||!height)return;this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.draw();}
 private draw(){if(this.host.getClientRects().length)this.renderer.render(this.scene,this.camera);}
}
