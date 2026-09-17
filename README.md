# Exploring 3D IFS fractals

An interactive 3D IFS explorer built with **TypeScript, Three.js, and Vite**.

[Open the explorer](https://zfengg.github.io/3d-ifs-fractals/) · [Source code](https://github.com/zfengg/3d-ifs-fractals)

## Run locally

Use Node.js 22.12+ (or 20.19+).

```sh
npm install
npm run dev
```

`npm run build` performs strict TypeScript checking and creates a static site in `dist/`. `npm test` exercises the mathematics, parser, sampling, and validation.

## Use the explorer

- Drag to orbit, scroll or pinch to zoom, right-drag to pan. Arrow keys pan when the canvas has keyboard focus.
- Choose an affine or nonlinear preset from **Load example** and adjust density, point size, color mapping, rotation, and the reference grid.
- Select **Edit** to edit matrix entries or nonlinear equations, adjust probabilities, and add/remove maps. A system may mix both map types.
- Use the JSON tab to enter or copy a complete IFS. Press **Apply system** to regenerate. Invalid or divergent systems leave the last valid rendering visible.

## Object model

```ts
import { IFS, AffineMap, NonlinearMap } from './src/model';

const system = new IFS([
  new AffineMap(
    [.5, 0, 0, 0, .5, 0, 0, 0, .5], // row-major matrix
    [-.5, 0, 0],                     // translation
    0.5,                            // selection probability
  ),
  new NonlinearMap([
    '.5*x + .2*sin(y) + .5',
    '.5*y + .2*cos(z)',
    '.5*z + .2*sin(x)',
  ], 0.5),
], 'My IFS');

const { positions, ids } = system.generate(250_000, 42);
const restored = IFS.fromJSON(system.toJSON(), system.name);
```

`IFS` owns weighted maps, serialization, validation, and seeded chaos-game sampling. `IFSMap` is the abstract transformation contract, implemented by `AffineMap` and `NonlinearMap`. The worker reconstructs a proper `IFS` instance from serialized definitions. Rendering uses one GPU point cloud, and obsolete workers are terminated when a new request starts.

Nonlinear expressions support `x`, `y`, `z`, `pi`, `e`, arithmetic (`+ - * / ^ **`), and `sin`, `cos`, `tan`, `tanh`, `abs`, `sqrt`, `exp`, `log`, `floor`, `ceil`, `min`, `max`, `pow`, `atan2`. The expression parser does not execute JavaScript. Multiply explicitly, e.g. `0.5*x`. Coordinates are evaluated simultaneously. Probabilities must be strictly positive and sum to one (absolute floating-point tolerance: 1e-9). They are not silently normalized.

The first 100 iterations are discarded. Sampling uniformly fits the resulting bounding box to the view; geometry proportions are preserved, but displayed coordinates are normalized. Nonlinear maps need not have an attractor; undefined, nonfinite, and runaway trajectories are rejected, and generation has a time limit. The spatial fern and sine branches are experimental systems.

WebGL 2 is required. No backend or external AI service is used; computations stay in the browser. Typography uses Google Fonts with local fallbacks.

## Connection to the Pluto notebook

The supplied `PlotIFS.jl` notebook uses `IFS` (linear parts and translations), `WIFS` (weighted maps), and `IFSNonlinear` (functions). Here, one `IFS` object holds `AffineMap` and/or `NonlinearMap` instances. It exposes `numMaps`, `dimAmbient = 3`, and probability vector `weights`. The sampling settings expose the initial point, burn-in, and random seed. This is a 3D browser implementation, not a Julia runtime or notebook importer.

## Free deployment with GitHub Pages

GitHub Pages and Actions are free for public repositories. This project is static: it needs no paid server, database, or API key.

1. Push this project to a public GitHub repository on the `main` branch.
2. In the repository, choose **Settings → Pages → Source → GitHub Actions**.
3. Run the included **Deploy 3D IFS to GitHub Pages** workflow, or push a new commit to `main`.

The workflow installs locked dependencies, runs tests and the TypeScript production build, and deploys `dist/`. Vite uses relative asset URLs, including its worker, so the site works under a repository subpath such as `/VisualFractals/`. For an existing website, the contents of `dist/` can also be placed in a dedicated subdirectory without adopting this workflow or replacing the site's existing deployment.

GitHub documentation: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site

The visual editor displays the probability total. Adding a map proportionally redistributes the current probabilities to reserve its new share; removing a map rescales the remaining positive probabilities to sum to one. **Uniform** locks the vector to `1 / numMaps` and updates it when maps are added or removed. Turn it off to edit individual probabilities.

## Sponge gallery examples

- **Barański sponge:** partitions `(0.2, 0.5, 0.3)`, `(0.25, 0.35, 0.4)`, and `(0.15, 0.55, 0.3)` along x, y, and z. Retains the 20 cells whose index has at most one middle coordinate. Each map uses its cell widths as diagonal entries, cumulative interval lengths as translation, and probability 1/20.
- **Bedford–McMullen sponge:** a 2 × 3 × 4 grid. Retains both outer z layers and the two opposite xy columns in both inner layers (16 maps). All matrices are diag(1/2, 1/3, 1/4), translations are (i/2, j/3, k/4), and probabilities are 1/16.

These are particular examples of each family; all their maps can be edited. Background definitions: [self-affine sponges](https://pmc.ncbi.nlm.nih.gov/articles/PMC6961517/).

The IFS sidebar starts with **Load example** and **Create new**. General systems use a table with Type, Definition, and Weight columns. New general systems start with two equally weighted affine maps.

Sponge editors use one selectable xy grid with a z-layer selector and a live, rotatable 3D preview of occupied cells. The active layer is highlighted. **General IFS** is the default type for new systems. Bedford–McMullen systems take integer grid sizes (2–10 along each axis); Barański systems take positive interval widths summing to one in each direction, accepting fractions such as `1/3`. Click cells, fill or clear a layer, or select all. Interval widths determine geometry; map probabilities are configured separately with **Uniform** or individual entries. Up to 1,000 maps are supported. Applying a sponge preserves its grid configuration for later editing.

Menger sponge uses one integer grid size for all three axes, with the same layer selector and cell preview. Downloads are cropped to visible content before applying the background; PDF pages match the cropped image size, with no added margins.

For responsive camera interaction, the viewer draws at most 250,000 points during movement (100,000 on touch-oriented devices), lowering that budget after sustained slow frames. Full detail returns once movement settles; exports always use all generated points. A stationary view is rendered only when its appearance changes.
