import {jsonControls,fileMaps} from './editorJSON';
import { IFS, type MapDefinition, type AffineDefinition } from './model';
import { diagonal } from './presets';

/** Table-based editor. Draft changes never mutate the currently rendered IFS. */
export class IFSEditor {
  private draft: MapDefinition[] = [];
  private expanded: number | null = null;
  private invalidateImport = () => {};
  private mode: 'table' | 'json' = 'table';
  private equalWeights = true;
  private readonly dialog = this.element<HTMLDialogElement>('editor');

  constructor(private readonly onApply: (maps: MapDefinition[], name: string) => void) {
    this.invalidateImport=jsonControls(this.dialog,()=>({version:1,type:'general',name:this.element<HTMLInputElement>('ifs-name').value.trim()||'Untitled IFS',maps:this.mode==='json'?JSON.parse(this.element<HTMLTextAreaElement>('system-json').value):this.draft}),file=>{
      const maps=fileMaps(file);this.draft=maps;this.expanded=null;
      this.equalWeights=maps.every(map=>Math.abs(map.p-1/maps.length)<1e-12);
      this.element<HTMLInputElement>('ifs-name').value=file.name;
      this.element<HTMLTextAreaElement>('system-json').value=JSON.stringify(maps,null,2);
      this.updateMode();
    },message=>this.error(message));
    this.element('fields-tab').onclick = () => this.setMode('table');
    this.element('json-tab').onclick = () => this.setMode('json');
    this.element('add-map').onclick = () => this.addMap();
    this.element('add-map-bottom').onclick = () => this.addMap();
    this.element<HTMLInputElement>('equal-probabilities').onchange = () => {
      this.equalWeights = this.element<HTMLInputElement>('equal-probabilities').checked;
      if(this.equalWeights)this.draft.forEach(map => map.p = 1 / this.draft.length);
      this.error(''); this.render();
    };
    this.element('apply').onclick = () => {
      try {
        const input = this.mode === 'json'
          ? JSON.parse(this.element<HTMLTextAreaElement>('system-json').value)
          : this.draft;
        const name = this.element<HTMLInputElement>('ifs-name').value.trim() || 'Untitled IFS';
        const system = IFS.fromJSON(input, name);
        this.error('Generating preview…');
        this.onApply(system.toJSON(), name);
      } catch (error) { this.error((error as Error).message); }
    };
  }

  private element<T extends HTMLElement = HTMLElement>(id: string): T {
    const result = document.getElementById(id);
    if (!result) throw new Error(`Missing editor element: ${id}`);
    return result as T;
  }

  open(maps: MapDefinition[], name: string, creating: boolean): void {
    this.invalidateImport();
    this.draft = structuredClone(maps);
    this.equalWeights = this.draft.every(map => Math.abs(map.p - 1 / this.draft.length) < 1e-12);
    this.expanded = null; this.mode = 'table';
    this.element('editor-title').textContent = creating ? 'Create New IFS' : 'Edit IFS';
    this.element<HTMLInputElement>('ifs-name').value = name;
    this.element('apply').textContent = creating ? 'Create IFS' : 'Apply IFS';
    this.error(''); this.updateMode(); this.dialog.showModal();
  }

  openNew(): void {
    this.open([diagonal(.5, [-.5, 0, 0], .5), diagonal(.5, [.5, 0, 0], .5)], 'Untitled IFS', true);
  }

  private error(message: string): void { this.element('editor-error').textContent = message; }

  private updateTotal(): void {
    const total = this.draft.reduce((sum, map) => sum + map.p, 0);
    const valid = this.draft.every(map => Number.isFinite(map.p) && map.p > 0 && map.p <= 1) && Math.abs(total - 1) <= 1e-9;
    const element = this.element('probability-total');
    element.textContent = `Total weight: ${Number.isFinite(total) ? Number(total.toPrecision(10)) : '—'} / 1`;
    element.classList.toggle('invalid', !valid);
  }

  private setMode(mode: 'table' | 'json'): void {
    if (this.mode === mode) return;
    try {
      if (mode === 'json') this.element<HTMLTextAreaElement>('system-json').value = JSON.stringify(this.draft, null, 2);
      else {
        const input = JSON.parse(this.element<HTMLTextAreaElement>('system-json').value);
        this.draft = IFS.fromJSON(input).toJSON(); this.expanded = null;
        this.equalWeights = this.draft.every(map => Math.abs(map.p - 1 / this.draft.length) < 1e-12);
      }
      this.mode = mode; this.error(''); this.updateMode();
    } catch (error) { this.error((error as Error).message); }
  }

  private updateMode(): void {
    const table = this.mode === 'table';
    this.element('visual-editor').hidden = !table;
    this.element('json-editor').hidden = table;
    this.element('add-map').hidden = !table;
    this.element('fields-tab').classList.toggle('selected', table);
    this.element('json-tab').classList.toggle('selected', !table);
    if (table) this.render();
  }

  private addMap(): void {
    if (this.draft.length >= 1000) { this.error('A system can contain at most 1,000 maps.'); return; }
    const total = this.draft.reduce((sum, map) => sum + map.p, 0);
    if (!Number.isFinite(total) || !this.draft.every(map => map.p > 0)) {
      this.error('Correct the positive weights before adding a map.'); return;
    }
    const probability = 1 / (this.draft.length + 1);
    this.draft.forEach(map => map.p = map.p / total * (1 - probability));
    this.draft.push(diagonal(.5, [0, 0, 0], probability));
    this.expanded = this.draft.length - 1; this.error(''); this.render();
  }

  private removeMap(index: number): void {
    if (this.draft.length <= 1) return;
    this.draft.splice(index, 1);
    const total = this.draft.reduce((sum, map) => sum + map.p, 0);
    if (Number.isFinite(total) && this.draft.every(map => map.p > 0)) this.draft.forEach(map => map.p /= total);
    this.expanded = null; this.error(''); this.render();
  }

  private render(): void {
    if(this.equalWeights)this.draft.forEach(map => map.p = 1 / this.draft.length);
    this.element<HTMLInputElement>('equal-probabilities').checked = this.equalWeights;
    const body = this.element('map-rows'); body.replaceChildren();
    this.draft.forEach((map, index) => {
      const row = document.createElement('tr');
      const label = document.createElement('th'); label.scope = 'row'; label.textContent = `f${index + 1}`;
      const typeCell = document.createElement('td');
      const type = document.createElement('select');
      type.setAttribute('aria-label', `Map ${index + 1} type`);
      type.innerHTML = '<option value="affine">Affine</option><option value="nonlinear">Nonlinear</option>';
      type.value = 'x' in map ? 'nonlinear' : 'affine';
      type.onchange = () => {
        if (type.value === 'nonlinear' && 'a' in map) {
          const expressions = [0, 1, 2].map(i => `${map.a[i * 3]}*x + ${map.a[i * 3 + 1]}*y + ${map.a[i * 3 + 2]}*z + ${map.b[i]}`);
          this.draft[index] = { x: expressions[0], y: expressions[1], z: expressions[2], p: map.p };
        } else this.draft[index] = diagonal(.5, [0, 0, 0], map.p);
        this.expanded = index; this.render();
      };
      typeCell.append(type);
      const weightCell = document.createElement('td');
      const weight = document.createElement('input');
      weight.type = 'number'; weight.min = '0'; weight.max = '1'; weight.step = 'any';
      weight.disabled = this.equalWeights;
      weight.value = String(map.p); weight.setAttribute('aria-label', `Map ${index + 1} weight`);
      weight.oninput = () => { map.p = weight.valueAsNumber; this.error(''); this.updateTotal(); };
      weightCell.append(weight);
      const transformCell = document.createElement('td');
      const details = document.createElement('button'); details.type = 'button'; details.className = 'map-details-button';
      details.textContent = 'a' in map ? 'Matrix + translation' : 'Equations';
      details.setAttribute('aria-label', `Edit map ${index + 1} definition`);
      details.setAttribute('aria-expanded', String(this.expanded === index));
      details.onclick = () => { this.expanded = this.expanded === index ? null : index; this.render(); };
      transformCell.append(details);
      const actionCell = document.createElement('td');
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'remove-map'; remove.textContent = '×';
      remove.disabled = this.draft.length === 1; remove.setAttribute('aria-label', `Remove map ${index + 1}`);
      remove.onclick = () => this.removeMap(index); actionCell.append(remove);
      row.append(label, typeCell, transformCell, weightCell, actionCell); body.append(row);
      if (this.expanded === index) {
        const expandedRow = document.createElement('tr'); expandedRow.className = 'map-detail-row';
        const cell = document.createElement('td'); cell.colSpan = 5;
        this.renderTransformation(cell, map, index); expandedRow.append(cell); body.append(expandedRow);
      }
    });
    this.updateTotal();
  }

  private renderTransformation(container: HTMLElement, map: MapDefinition, index: number): void {
    if ('a' in map) {
      const layout = document.createElement('div'); layout.className = 'matrix-layout';
      for (const [key, title, count] of [['a', 'Matrix', 9], ['b', 'Translation', 3]] as const) {
        const wrapper = document.createElement('div'), caption = document.createElement('div'), fields = document.createElement('div');
        caption.className = 'matrix-label'; caption.textContent = title;
        fields.className = key === 'a' ? 'matrix' : 'vector';
        for (let i = 0; i < count; i++) {
          const input = document.createElement('input'); input.type = 'number'; input.step = 'any'; input.value = String(map[key][i]);
          input.setAttribute('aria-label', key === 'a' ? `Map ${index + 1} matrix row ${Math.floor(i / 3) + 1} column ${i % 3 + 1}` : `Map ${index + 1} translation ${['x', 'y', 'z'][i]}`);
          input.oninput = () => { (map as AffineDefinition)[key][i] = input.valueAsNumber; };
          fields.append(input);
        }
        wrapper.append(caption, fields); layout.append(wrapper);
      }
      container.append(layout);
    } else {
      for (const axis of ['x', 'y', 'z'] as const) {
        const label = document.createElement('label'); label.className = 'equation';
        const symbol = document.createElement('span'); symbol.textContent = `${axis}′ =`;
        const input = document.createElement('input'); input.value = map[axis]; input.spellcheck = false;
        input.setAttribute('aria-label', `Map ${index + 1} ${axis} expression`);
        input.oninput = () => { map[axis] = input.value; };
        label.append(symbol, input); container.append(label);
      }
      const help = document.createElement('p'); help.className = 'expression-help';
      help.textContent = 'x, y, z · pi, e · + − * / ^ · sin, cos, tan, tanh, abs, sqrt, exp, log, floor, ceil, min, max, pow, atan2';
      container.append(help);
    }
  }
}
