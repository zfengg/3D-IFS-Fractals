import { MotionQuality } from './MotionQuality';
import { alphaBounds } from './imageBounds';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { PointSample } from './model';

export type ColorMode = 'height' | 'transform' | 'depth' | 'mono';

/** GPU point-cloud view. Appearance changes update uniforms, not a million colors. */
export class FractalViewer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.01, 100);
  private readonly controls: OrbitControls;
  private readonly grid = new THREE.GridHelper(12, 30, 0x365047, 0x233630);
  private readonly resizeObserver: ResizeObserver;
  private readonly motionQuality = new MotionQuality(250_000);
  private interacting = false;
  private lastMovement = -Infinity;
  private needsRender = true;
  private pointCount = 0;
  private reportedCount = -1;
  private cloud?: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly uniforms = {
    pointSize: { value: 1.4 },
    mapCount: { value: 4 },
    mode: { value: 0 },
    paletteColors: { value: Array.from({length:5},()=>new THREE.Color('#416db8')) },
    paletteSize: { value: 3 },
  };

  constructor(private readonly container: HTMLElement, onContextLost: () => void, private readonly onRenderedCount: (count:number,mapCount:number)=>void = ()=>{}) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    const canvas = this.renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', '3D fractal. Drag to orbit, scroll to zoom, or use arrow keys to pan.');
    container.append(canvas);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.addEventListener('start', () => { this.interacting=true; });
    this.controls.addEventListener('end', () => { this.interacting=false;this.lastMovement=performance.now(); });
    this.controls.addEventListener('change', () => { this.lastMovement=performance.now();this.needsRender=true; });
    this.controls.autoRotate = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.controls.autoRotateSpeed = 0.6;
    this.controls.minDistance = 1;
    this.controls.maxDistance = 20;
    this.controls.listenToKeyEvents(canvas);
    this.reset();
    this.grid.visible = false;
    this.grid.position.y = -1.6;
    const gridMaterial = this.grid.material as THREE.LineBasicMaterial;
    gridMaterial.transparent = true;
    gridMaterial.opacity = 0.24;
    this.scene.add(this.grid);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.setPointSize(1.4);
    let previous = 0;
    this.renderer.setAnimationLoop(time => {
      const delta = Math.min((time - previous) / 1000, 0.1);
      previous = time;
      if (document.hidden) { this.motionQuality.update(time,false); return; }
      const changed=this.controls.update(delta);
      const moving=this.interacting||changed||time-this.lastMovement<180;
      const budget=this.motionQuality.update(time,moving,this.pointCount);
      if(this.cloud){
        const count=moving?Math.min(this.pointCount,budget):this.pointCount;
        if(this.cloud.geometry.drawRange.count!==count){this.cloud.geometry.setDrawRange(0,count);this.needsRender=true;}
      }
      if(this.needsRender){
        this.renderer.render(this.scene,this.camera);this.needsRender=false;
        const count=this.cloud?.geometry.drawRange.count??0;
        if(count!==this.reportedCount){this.reportedCount=count;this.onRenderedCount(count,this.uniforms.mapCount.value);}
      }
    });
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      this.renderer.setAnimationLoop(null);
      onContextLost();
    });
  }

  defaultAutoRotate(count:number):boolean {return this.motionQuality.shouldAutoRotate(count,matchMedia('(prefers-reduced-motion: reduce)').matches);}
  get autoRotate(): boolean { return this.controls.autoRotate; }
  set autoRotate(value: boolean) { this.controls.autoRotate = value; }
  set showGrid(value: boolean) { this.grid.visible = value;this.needsRender=true; }

  private resize(): void {
    const { width, height } = this.container.getBoundingClientRect();
    this.renderer.setSize(width, height);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.needsRender=true;
  }

  reset(): void {
    this.camera.position.set(4.1, 2.1, 5.1);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  setPointSize(size: number): void {
    this.uniforms.pointSize.value = size * this.renderer.getPixelRatio();
    this.needsRender=true;
  }

  setColors(stops: string[], mode: ColorMode): void {
    this.uniforms.paletteSize.value=stops.length;
    this.uniforms.paletteColors.value.forEach((color,i)=>color.set(stops[Math.min(i,stops.length-1)]));
    this.uniforms.mode.value = ['height', 'transform', 'depth', 'mono'].indexOf(mode);
    this.needsRender=true;
  }

  setSample(sample: PointSample, mapCount: number): void {
    if (this.cloud) {
      this.scene.remove(this.cloud);
      this.cloud.geometry.dispose();
      this.cloud.material.dispose();
    }
    this.pointCount=sample.ids.length;
    this.reportedCount=-1;
    this.needsRender=true;
    this.uniforms.mapCount.value = mapCount;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(sample.positions, 3));
    geometry.setAttribute('mapIndex', new THREE.BufferAttribute(sample.ids, 1));
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: this.uniforms,
      vertexShader: `
        attribute float mapIndex;
        uniform float pointSize, mode, mapCount;
        uniform vec3 paletteColors[5];
        uniform float paletteSize;
        varying vec3 vColor;
        void main() {
          float t = position.y / 3.0 + 0.5;
          if (mode == 1.0) t = mapIndex / max(1.0, mapCount - 1.0);
          if (mode == 2.0) t = position.z / 3.0 + 0.5;
          if (mode == 3.0) t = 0.65;
          t = clamp(t, 0.0, 1.0);
          float positionInPalette=t*(paletteSize-1.0);
          vColor=paletteColors[0];
          for(int i=0;i<4;i++){
            if(positionInPalette>=float(i) && float(i)<paletteSize-1.0)
              vColor=mix(paletteColors[i],paletteColors[i+1],clamp(positionInPalette-float(i),0.0,1.0));
          }
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = pointSize;
        }`,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          gl_FragColor = vec4(vColor, 0.83 * (1.0 - smoothstep(0.2, 0.5, d)));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.cloud = new THREE.Points(geometry, material);
    this.scene.add(this.cloud);
  }

  /** Capture the current camera and appearance without interface overlays.
   * Render and copy synchronously so no persistent drawing buffer is needed.
   */
  async captureImage(options: {background?: 'transparent'|'dark'|'white'; format?: 'png'|'jpeg'; includeGrid?: boolean} = {}): Promise<Blob> {
    if (!this.cloud || this.renderer.getContext().isContextLost()) {
      throw new Error('The 3D view is not ready.');
    }
    const source = this.renderer.domElement;
    const capture = document.createElement('canvas');
    capture.width=source.width;capture.height=source.height;
    const captured=capture.getContext('2d');
    if(!captured)throw new Error('Image export is unavailable in this browser.');
    const originalGrid=this.grid.visible;
    const originalRange={...this.cloud.geometry.drawRange};
    try{
      this.grid.visible=options.includeGrid??false;
      this.cloud.geometry.setDrawRange(0,this.pointCount);
      this.renderer.render(this.scene,this.camera);
      captured.drawImage(source,0,0);
    }finally{
      this.grid.visible=originalGrid;
      this.cloud.geometry.setDrawRange(originalRange.start,originalRange.count);
      this.renderer.render(this.scene,this.camera);
    }
    const bounds=alphaBounds(captured.getImageData(0,0,capture.width,capture.height).data,capture.width,capture.height);
    if(!bounds)throw new Error('No visible object to export. Reset the view and try again.');
    const output=document.createElement('canvas');
    output.width=bounds.width;output.height=bounds.height;
    const context=output.getContext('2d');
    if(!context)throw new Error('Image export is unavailable in this browser.');
    const format=options.format??'png';
    const background=options.background??'transparent';
    if(background==='dark'){
      context.save();context.scale(output.width,output.height);
      const gradient=context.createRadialGradient(.5,.43,0,.5,.43,.62);
      gradient.addColorStop(0,'#17262c');gradient.addColorStop(1,'#0c1218');
      context.fillStyle=gradient;context.fillRect(0,0,1,1);context.restore();
    }else if(background==='white'||format==='jpeg'){
      context.fillStyle='#ffffff';context.fillRect(0,0,output.width,output.height);
    }
    context.drawImage(capture,bounds.x,bounds.y,bounds.width,bounds.height,0,0,bounds.width,bounds.height);
    return new Promise((resolve,reject)=>{
      output.toBlob(blob=>blob?resolve(blob):reject(new Error('Image encoding failed.')),format==='jpeg'?'image/jpeg':'image/png',.95);
    });
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.renderer.setAnimationLoop(null);
    this.cloud?.geometry.dispose();
    this.cloud?.material.dispose();
    this.grid.geometry.dispose();
    (this.grid.material as THREE.Material).dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
