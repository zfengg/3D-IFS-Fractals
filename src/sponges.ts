import { IFS, type AffineDefinition } from './model';

export type SpongeKind = 'bedfordMcMullen' | 'baranski' | 'menger';
export type Cell = [number, number, number];
export interface SpongeDefinition {
  kind: SpongeKind;
  widths: [number[], number[], number[]];
  cells: Cell[];
  weights?: number[];
}
export const cellKey = (cell: Cell): string => cell.join(',');

export function uniformPartition(size: number): number[] {
  if (!Number.isInteger(size) || size < 2 || size > 10) throw new Error('Grid sizes must be whole numbers from 2 to 10.');
  return Array.from({ length: size }, () => 1 / size);
}

export function validatePartitions(widths: SpongeDefinition['widths']): void {
  if (widths.length !== 3) throw new Error('Provide interval widths for x, y, and z.');
  widths.forEach((axis, i) => {
    const label = ['x', 'y', 'z'][i];
    if (axis.length < 2 || axis.length > 10 || !axis.every(w => Number.isFinite(w) && w > 0 && w < 1)) {
      throw new Error(`${label}: enter 2–10 strictly positive interval widths, each less than 1.`);
    }
    const sum = axis.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1) > 1e-9) throw new Error(`${label}: interval widths must sum to 1 (currently ${Number(sum.toPrecision(12))}).`);
  });
}

export function parseWidths(text: string): number[] {
  const entries = text.trim().split(/[\s,;]+/).filter(Boolean);
  return entries.map(entry => {
    // Fractions make equal thirds, sevenths, etc. expressible without rounding.
    const parts = entry.split('/');
    return parts.length === 1 ? Number(parts[0]) : parts.length === 2 && parts.every(p => p.trim() !== '') ? Number(parts[0]) / Number(parts[1]) : NaN;
  });
}

export function spongeMaps(definition: SpongeDefinition): AffineDefinition[] {
  const { widths, cells, weights } = definition;
  validatePartitions(widths);
  if (definition.kind !== 'baranski' && widths.some(axis => axis.some(w => Math.abs(w - 1 / axis.length) > 1e-9))) {
    throw new Error('Grid subdivisions must be uniform along each axis.');
  }
  if (definition.kind === 'menger' && widths.some(axis => axis.length !== widths[0].length)) throw new Error('Menger grid sizes must match along all three axes.');
  if (cells.length === 0) throw new Error('Select at least one occupied cell.');
  if (weights && weights.length !== cells.length) throw new Error('Provide one probability per selected cell.');
  const seen = new Set<string>();
  const offsets = widths.map(axis => axis.map((_, i) => axis.slice(0, i).reduce((a, b) => a + b, 0)));
  const maps = cells.map((cell, i) => {
    if (cell.length !== 3 || !cell.every((v, axis) => Number.isInteger(v) && v >= 0 && v < widths[axis].length)) throw new Error('A selected cell is outside the grid.');
    const key = cellKey(cell);
    if (seen.has(key)) throw new Error('Each cell can be selected only once.');
    seen.add(key);
    const [x, y, z] = cell;
    return {
      a: [widths[0][x], 0, 0, 0, widths[1][y], 0, 0, 0, widths[2][z]],
      b: [offsets[0][x], offsets[1][y], offsets[2][z]],
      p: weights ? weights[i] : 1 / cells.length,
    };
  });
  IFS.fromJSON(maps); // Use the same strict probability validation as the table.
  return maps;
}

export const baranskiExample: SpongeDefinition = {
  kind: 'baranski', widths: [[.2, .5, .3], [.25, .35, .4], [.15, .55, .3]], cells: [],
};
for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) for (let z = 0; z < 3; z++) {
  if (Number(x === 1) + Number(y === 1) + Number(z === 1) <= 1) baranskiExample.cells.push([x, y, z]);
}
export const bedfordExample: SpongeDefinition = {
  kind: 'bedfordMcMullen', widths: [uniformPartition(2), uniformPartition(3), uniformPartition(4)], cells: [],
};
for (let x = 0; x < 2; x++) for (let y = 0; y < 3; y++) for (let z = 0; z < 4; z++) {
  if (z === 0 || z === 3 || (x === 0 && y === 0) || (x === 1 && y === 2)) bedfordExample.cells.push([x, y, z]);
}

export const mengerExample: SpongeDefinition = {
  kind: 'menger', widths: [uniformPartition(3), uniformPartition(3), uniformPartition(3)],
  cells: baranskiExample.cells.map(cell => [...cell] as Cell),
};
