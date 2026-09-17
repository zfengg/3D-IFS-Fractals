import { cellKey, parseWidths, spongeMaps, uniformPartition, validatePartitions, type Cell, type SpongeDefinition, type SpongeKind } from './sponges';
import { CellPreview } from './CellPreview';
import type { AffineDefinition } from './model';

export class SpongeEditor {
  private kind: SpongeKind = 'bedfordMcMullen';
  private widths: SpongeDefinition['widths'] = [uniformPartition(3), uniformPartition(4), uniformPartition(5)];
  private cells = new Map<string, number>();
  private dirty = false;
  private activeLayer = 0;
  private preview?: CellPreview;
  private readonly dialog = this.el<HTMLDialogElement>('sponge-dialog');

  constructor(private readonly onApply: (maps: AffineDefinition[], name: string, definition: SpongeDefinition) => void) {
    this.el<HTMLSelectElement>('sponge-layer').onchange = () => {
      this.activeLayer = Number(this.el<HTMLSelectElement>('sponge-layer').value);
      this.renderLayers(); this.updatePreview();
    };
    this.el('sponge-update').onclick = () => this.updateGrid();
    for (const id of ['sponge-n', 'sponge-nx', 'sponge-ny', 'sponge-nz', 'sponge-cuts-x', 'sponge-cuts-y', 'sponge-cuts-z']) {
      this.el(id).addEventListener('input', () => {
        this.dirty = true;
        this.el('sponge-grid-status').textContent = 'Update grid to use these changes.';
        this.el<HTMLButtonElement>('sponge-apply').disabled = true;
        if (this.kind !== 'baranski') {
          try {
            const widths = this.readWidths();
            this.renderAxisStrips(widths);
          } catch {
            this.el('sponge-axis-strips').replaceChildren();
          }
        }
      });
    }
    this.el('sponge-select-all').onclick = () => { this.allCells().forEach(c => this.select(c, true)); this.render(); };
    this.el('sponge-clear').onclick = () => { this.cells.clear(); this.render(); };
    this.el('sponge-invert').onclick = () => { this.allCells().forEach(c => this.select(c, !this.cells.has(cellKey(c)))); this.render(); };
    this.el<HTMLInputElement>('sponge-uniform').onchange = () => this.render();
    this.el('sponge-apply').onclick = () => {
      try {
        if (this.dirty) throw new Error('Update the grid before applying.');
        const selected = this.selectedCells();
        const definition: SpongeDefinition = {
          kind: this.kind, widths: structuredClone(this.widths), cells: selected,
          weights: selected.map(c => this.cells.get(cellKey(c))!),
        };
        const maps = spongeMaps(definition);
        const name = this.el<HTMLInputElement>('sponge-name').value.trim() || 'Custom sponge';
        this.setError('Generating preview…');
        this.onApply(maps, name, definition);
      } catch (error) { this.setError((error as Error).message); }
    };
  }

  private el<T extends HTMLElement = HTMLElement>(id: string): T {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Missing sponge editor element: ${id}`);
    return element as T;
  }

  open(definition: SpongeDefinition, name: string, creating = false): void {
    this.kind = definition.kind;
    this.activeLayer = 0;
    this.widths = structuredClone(definition.widths);
    this.cells = new Map(definition.cells.map((cell, i) => [cellKey(cell), definition.weights?.[i] ?? 1 / definition.cells.length]));
    this.dirty = false;
    const uniform = !definition.weights || definition.weights.every(p => Math.abs(p - 1 / definition.cells.length) < 1e-12);
    this.el<HTMLInputElement>('sponge-uniform').checked = uniform;
    this.el('sponge-title').textContent = creating ? 'Create sponge' : 'Edit sponge';
    this.el('sponge-family').textContent = this.kind === 'menger' ? 'Menger' : this.kind === 'bedfordMcMullen' ? 'Bedford–McMullen' : 'Barański';
    this.el<HTMLInputElement>('sponge-name').value = name;
    this.el('sponge-cubic-controls').hidden = this.kind !== 'menger';
    this.el<HTMLInputElement>('sponge-n').value = String(this.widths[0].length);
    this.el('sponge-grid-controls').hidden = this.kind !== 'bedfordMcMullen';
    this.el('sponge-cut-controls').hidden = this.kind !== 'baranski';
    for (const [axis, i] of ['x', 'y', 'z'].map((axis, i) => [axis, i] as const)) {
      this.el<HTMLInputElement>(`sponge-n${axis}`).value = String(this.widths[i].length);
      this.el<HTMLInputElement>(`sponge-cuts-${axis}`).value = this.widths[i].join(', ');
    }
    this.el('sponge-grid-status').textContent = '';
    this.setError(''); this.render(); this.dialog.showModal();
    if (!this.preview) {
      try { this.preview = new CellPreview(this.el('sponge-preview')); }
      catch { this.el('sponge-preview').textContent = '3D preview unavailable.'; }
    }
    this.updatePreview();
  }

  openNew(kind: SpongeKind): void {
    this.open({ kind, widths: kind === 'menger' ? [uniformPartition(3), uniformPartition(3), uniformPartition(3)] : kind === 'bedfordMcMullen'
      ? [uniformPartition(3), uniformPartition(4), uniformPartition(5)]
      : [[.2, .5, .3], [.25, .35, .4], [.15, .55, .3]], cells: [] },
    kind === 'menger' ? 'My Menger sponge' : kind === 'bedfordMcMullen' ? 'My Bedford–McMullen sponge' : 'My Barański sponge', true);
  }

  private setError(message: string): void { this.el('sponge-error').textContent = message; }

  private readWidths(): SpongeDefinition['widths'] {
    return ['x', 'y', 'z'].map(axis => this.kind === 'baranski'
      ? parseWidths(this.el<HTMLInputElement>(`sponge-cuts-${axis}`).value)
      : uniformPartition(this.el<HTMLInputElement>(this.kind === 'menger' ? 'sponge-n' : `sponge-n${axis}`).valueAsNumber)) as SpongeDefinition['widths'];
  }

  private updateGrid(): void {
    try {
      const next = this.readWidths();
      validatePartitions(next);
      const previousCount = this.cells.size;
      this.widths = next;
      this.activeLayer = Math.min(this.activeLayer, next[2].length - 1);
      for (const cell of this.selectedCells()) if (cell.some((v, axis) => v >= next[axis].length)) this.cells.delete(cellKey(cell));
      this.dirty = false;
      const removed = previousCount - this.cells.size;
      this.el('sponge-grid-status').textContent = removed ? `${removed} selected cells outside the resized grid removed.` : 'Grid updated. Existing cell indices retained.';
      this.setError(''); this.render();
    } catch (error) { this.setError((error as Error).message); }
  }

  private allCells(): Cell[] {
    const result: Cell[] = [];
    for (let z = 0; z < this.widths[2].length; z++) for (let y = 0; y < this.widths[1].length; y++) for (let x = 0; x < this.widths[0].length; x++) result.push([x, y, z]);
    return result;
  }

  private selectedCells(): Cell[] {
    return [...this.cells.keys()].map(key => key.split(',').map(Number) as Cell).sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
  }

  private select(cell: Cell, selected: boolean): void {
    const key = cellKey(cell);
    if (!selected) this.cells.delete(key);
    else if (!this.cells.has(key)) this.cells.set(key, 1 / (this.cells.size + 1));
  }

  private render(): void {
    const uniform = this.el<HTMLInputElement>('sponge-uniform').checked;
    if (uniform) for (const key of this.cells.keys()) this.cells.set(key, 1 / this.cells.size);
    this.el('sponge-selected-count').textContent = `${this.cells.size} / ${this.widths.reduce((a, b) => a * b.length, 1)} cells selected`;
    this.el<HTMLButtonElement>('sponge-apply').disabled = this.dirty || this.cells.size === 0;
    this.renderAxisStrips(); this.renderLayers(); this.renderWeights(); this.updatePreview();
  }

  private renderAxisStrips(widths: SpongeDefinition['widths'] = this.widths): void {
    const strips = this.el('sponge-axis-strips'); strips.replaceChildren();
    widths.forEach((axis, i) => {
      const row = document.createElement('div'); row.className = 'axis-strip-row';
      const label = document.createElement('span'); label.textContent = ['x', 'y', 'z'][i];
      const strip = document.createElement('div'); strip.className = 'axis-strip';
      axis.forEach((width, j) => {
        const part = document.createElement('span'); part.style.flex = String(width);
        part.textContent = this.kind !== 'baranski' ? `1/${axis.length}` : Number(width.toPrecision(3)).toString(); part.title = `${['x', 'y', 'z'][i]} interval ${j + 1}: ${width}`;
        strip.append(part);
      });
      row.append(label, strip); strips.append(row);
    });
  }

  private updatePreview(): void { this.preview?.update(this.widths, this.selectedCells(), this.activeLayer); }

  private renderLayers(): void {
    const selector = this.el<HTMLSelectElement>('sponge-layer');
    selector.replaceChildren(...this.widths[2].map((_, z) => {
      const option = document.createElement('option'); option.value = String(z);
      const count = this.selectedCells().filter(c => c[2] === z).length;
      option.textContent = `z${z + 1} · ${count} selected`; return option;
    }));
    selector.value = String(this.activeLayer);
    const layers = this.el('sponge-layers'); layers.replaceChildren();
    const z = this.activeLayer;
    {
      const card = document.createElement('section'); card.className = 'layer-card';
      const header = document.createElement('div'); header.className = 'layer-heading';
      const title = document.createElement('h4'); title.textContent = `z${z + 1}`;
      const start = this.widths[2].slice(0, z).reduce((a, b) => a + b, 0);
      const range = document.createElement('span'); range.textContent = `${Number(start.toPrecision(3))}–${Number((start + this.widths[2][z]).toPrecision(3))}`;
      header.append(title, range);
      const actions = document.createElement('div'); actions.className = 'layer-actions';
      for (const [text, selected] of [['Fill', true], ['Clear', false]] as const) {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = text;
        button.setAttribute('aria-label', `${text} layer ${z + 1}`);
        button.onclick = () => { this.allCells().filter(c => c[2] === z).forEach(c => this.select(c, selected)); this.render(); };
        actions.append(button);
      }
      const grid = document.createElement('div'); grid.className = 'layer-grid';
      grid.style.gridTemplateColumns = this.widths[0].map(w => `${w}fr`).join(' ');
      grid.style.gridTemplateRows = [...this.widths[1]].reverse().map(w => `${w}fr`).join(' ');
      for (let y = this.widths[1].length - 1; y >= 0; y--) for (let x = 0; x < this.widths[0].length; x++) {
        const cell: Cell = [x, y, z], key = cellKey(cell);
        const button = document.createElement('button'); button.className = 'grid-cell'; button.type = 'button'; button.dataset.cell = key;
        button.setAttribute('aria-label', `Cell x ${x + 1}, y ${y + 1}, z ${z + 1}`);
        button.setAttribute('aria-pressed', String(this.cells.has(key))); button.title = `x${x + 1}, y${y + 1}, z${z + 1}`;
        button.textContent = this.cells.has(key) ? '✓' : '';
        button.onclick = () => {
          this.select(cell, !this.cells.has(key)); this.setError(''); this.render();
          this.el('sponge-layers').querySelector<HTMLButtonElement>(`[data-cell="${key}"]`)?.focus();
        };
        grid.append(button);
      }
      card.append(header, grid, actions); layers.append(card);
    }
  }

  private renderWeights(): void {
    const uniform = this.el<HTMLInputElement>('sponge-uniform').checked;
    const container = this.el('sponge-weights'); container.hidden = uniform; container.replaceChildren();
    if (!uniform) for (const cell of this.selectedCells()) {
      const key = cellKey(cell), label = document.createElement('label'), input = document.createElement('input');
      label.textContent = `x${cell[0] + 1} y${cell[1] + 1} z${cell[2] + 1}`;
      input.type = 'number'; input.step = 'any'; input.min = '0'; input.max = '1'; input.value = String(this.cells.get(key));
      input.setAttribute('aria-label', `Weight cell ${cell.map(v => v + 1).join(',')}`);
      input.oninput = () => { this.cells.set(key, input.valueAsNumber); this.updateWeightTotal(); };
      label.append(input); container.append(label);
    }
    this.updateWeightTotal();
  }

  private updateWeightTotal(): void {
    const values = [...this.cells.values()], total = values.reduce((a, b) => a + b, 0);
    this.el('sponge-weight-total').textContent = `Σ p = ${Number.isFinite(total) ? Number(total.toPrecision(10)) : '—'}`;
    this.el('sponge-weight-total').classList.toggle('invalid', !values.every(p => p > 0 && p <= 1) || Math.abs(total - 1) > 1e-9);
  }
}
