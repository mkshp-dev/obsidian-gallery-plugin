import { AspectLayoutView, LayoutTile } from './AspectLayoutView';
import { isSvgPath } from '../models/media';
import {
  DEFAULT_MOSAIC_PATTERN,
  MosaicPattern,
  NARROW_MOSAIC_PATTERN,
  isLargeTile,
  placeMosaic
} from '../models/mosaicPattern';

/**
 * MosaicView
 * A grid of square cells where a repeating pattern gives some images large tiles. Images keep
 * their order and fill the tiles one by one; images after the last full repeat of the pattern go
 * into rows of single cells, so none are hidden. Tiles crop their image to fill, or with
 * `fit: contain` show it whole over a blurred copy of itself (SVGs are always fitted). Tiles
 * larger than one cell load the larger version of a remote image.
 *
 * The pattern is the saved one the block's `view.pattern` names, or the built-in one. Blank cells
 * in a pattern are left empty. When cells would be narrower than MIN_CELL, a two-column pattern
 * is used instead.
 *
 * With pagination, each page holds whole repeats of the pattern (see pageSize).
 *
 * Tunable from CSS: --gallery-mosaic-gap.
 */
export class MosaicView extends AspectLayoutView {
  protected readonly layoutClass = 'gallery-mosaic-layout';
  protected readonly tileClass = 'gallery-mosaic-tile';
  protected readonly layoutVariables = { gap: '--gallery-mosaic-gap' };

  private static readonly GAP = 4;
  /** Narrowest cell, in px, before the gallery switches to the two-column pattern */
  static readonly MIN_CELL = 90;
  /** Cell size used before the gallery has a width (it is hidden or not attached yet) */
  private static readonly FALLBACK_CELL = 160;

  /** Tiles the current layout made larger than one cell */
  private largeTiles = new WeakSet<LayoutTile>();

  constructor(container: HTMLElement) {
    super('mosaic', container);
  }

  render(): void {
    this.largeTiles = new WeakSet();
    super.render();
    this.root?.classList.toggle('is-contain', this.layoutOptions.fit === 'contain');
    for (const tile of this.tiles) {
      // A cropped SVG would cut off part of a logo or diagram, so it is fitted inside its tile
      if (isSvgPath(tile.image.path)) tile.el.classList.add('is-svg');
    }
  }

  /** The saved pattern the block names (already looked up and checked), or the built-in one */
  private configuredPattern(): MosaicPattern {
    return this.layoutOptions.pattern ?? DEFAULT_MOSAIC_PATTERN;
  }

  /**
   * A page holds whole repeats of the pattern, so every page shows the full pattern: itemsPerPage
   * rounded to the nearest multiple of the pattern's tiles, and at least one repeat. (The block's
   * pattern decides, not the two-column one a narrow pane switches to, so pages don't change
   * when the pane is resized.)
   */
  protected get pageSize(): number {
    return MosaicView.wholeRepeats(this.itemsPerPage, this.configuredPattern().slots.length);
  }

  /** `count` rounded to the nearest multiple of `tiles`, and at least `tiles` */
  static wholeRepeats(count: number, tiles: number): number {
    if (tiles <= 0) return count;
    return Math.max(1, Math.round(count / tiles)) * tiles;
  }

  /** The pattern to use at this width, and the size of its square cells */
  static fitPattern(pattern: MosaicPattern, width: number, gap: number): { pattern: MosaicPattern; cell: number } {
    if (width <= 0) return { pattern, cell: MosaicView.FALLBACK_CELL };
    const cellFor = (columns: number) => (width - gap * (columns - 1)) / columns;
    if (pattern.columns > NARROW_MOSAIC_PATTERN.columns && cellFor(pattern.columns) < MosaicView.MIN_CELL) {
      pattern = NARROW_MOSAIC_PATTERN;
    }
    return { pattern, cell: Math.max(1, cellFor(pattern.columns)) };
  }

  protected layout(width: number): void {
    if (!this.root) return;
    const gap = this.readCssNumber('--gallery-mosaic-gap', MosaicView.GAP, true);
    const { pattern, cell } = MosaicView.fitPattern(this.configuredPattern(), width, gap);

    this.root.style.setProperty('--gallery-mosaic-columns', String(pattern.columns));
    this.root.style.setProperty('--gallery-mosaic-cell', `${cell}px`);

    const placements = placeMosaic(pattern, this.tiles.length);
    this.tiles.forEach((tile, i) => {
      const place = placements[i];
      tile.el.style.gridColumn = `${place.col + 1} / span ${place.colSpan}`;
      tile.el.style.gridRow = `${place.row + 1} / span ${place.rowSpan}`;
      const large = isLargeTile(place);
      tile.el.classList.toggle('is-large', large);
      if (large) this.largeTiles.add(tile);
      else this.largeTiles.delete(tile);
    });
  }

  /**
   * Keep the loaded image's URL on the tile, so with `fit: contain` CSS can draw a blurred copy of
   * it behind the whole image. It is the URL the image already loaded, so nothing is fetched again.
   */
  protected onTileImageLoad(tile: LayoutTile, imgEl: HTMLImageElement): void {
    const src = imgEl.currentSrc || imgEl.src;
    if (src) tile.el.style.setProperty('--gallery-mosaic-backdrop', `url("${src.replace(/["\\]/g, c => `\\${c}`)}")`);
  }

  /** Large tiles load the larger version of a remote image (the one the viewer uses), so they stay sharp */
  protected resolveTileUrl(tile: LayoutTile): Promise<string> {
    if (this.largeTiles.has(tile) && tile.image.resolveLargeUrl) return tile.image.resolveLargeUrl();
    return super.resolveTileUrl(tile);
  }
}
