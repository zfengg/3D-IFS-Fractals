import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Cell, SpongeDefinition } from './sponges';

/** First-level occupied boxes, rendered only when the selection or camera changes. */
export class CellPreview {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(35, 1, .01, 100);
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  private readonly controls: OrbitControls;
  private readonly boxes = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), 1000);
  private readonly layer = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: '#dcf4a6', transparent: true, opacity: .7 }));

  constructor(private readonly host: HTMLElement) {
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.domElement.setAttribute('role', 'img');
    this.host.append(this.renderer.domElement);
    this.camera.up.set(0, 0, 1);
    this.camera.position.set(2, -2.8, 2);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enablePan = false;
    this.controls.minDistance = 1.6;
    this.controls.maxDistance = 6;
    this.controls.addEventListener('change', () => this.draw());
    this.controls.update();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x53676b, 2));
    const light = new THREE.DirectionalLight(0xffffff, 2); light.position.set(2, -3, 5); this.scene.add(light);
    const bounds = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: '#587970' }));
    this.boxes.count = 0;
    this.boxes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.boxes.frustumCulled = false;
    this.scene.add(bounds, this.boxes, this.layer);
    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
  }

  update(widths: SpongeDefinition['widths'], cells: Cell[], layer: number): void {
    const offsets = widths.map(axis => axis.map((_, i) => axis.slice(0, i).reduce((a, b) => a + b, 0)));
    const transform = new THREE.Object3D();
    cells.forEach((cell, i) => {
      transform.position.set(...cell.map((index, axis) => offsets[axis][index] + widths[axis][index] / 2 - .5) as [number, number, number]);
      transform.scale.set(...cell.map((index, axis) => widths[axis][index] * .96) as [number, number, number]);
      transform.updateMatrix(); this.boxes.setMatrixAt(i, transform.matrix);
      this.boxes.setColorAt(i, new THREE.Color(cell[2] === layer ? '#c2e88e' : '#408c88'));
    });
    this.boxes.count = cells.length;
    this.boxes.instanceMatrix.needsUpdate = true;
    if (this.boxes.instanceColor) this.boxes.instanceColor.needsUpdate = true;
    this.layer.scale.set(1.01, 1.01, widths[2][layer]);
    this.layer.position.z = offsets[2][layer] + widths[2][layer] / 2 - .5;
    this.renderer.domElement.setAttribute('aria-label', `${cells.length} selected cells in 3D. Layer ${layer + 1} highlighted.`);
    this.resize();
  }

  private resize(): void {
    const { width, height } = this.host.getBoundingClientRect();
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); this.draw();
  }
  private draw(): void { this.renderer.render(this.scene, this.camera); }
}
