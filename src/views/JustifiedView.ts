import { AspectLayoutView, LayoutTile } from './AspectLayoutView';

interface JustifiedRow {
  tiles: LayoutTile[];
  height: number;
  /** False for the last row when it is not full; its images keep the target height */
  justified: boolean;
}

/**
 * JustifiedView
 * Rows of equal height that exactly fill the width, with each image uncropped at its own width
 * (the layout used by Immich, Google Photos and Flickr). Captions show over the image on hover.
 *
 * Tunable from CSS: --gallery-justified-row-height (target row height) and --gallery-justified-gap.
 */
export class JustifiedView extends AspectLayoutView {
  protected readonly layoutClass = 'gallery-justified-layout';
  protected readonly tileClass = 'gallery-justified-tile';
  protected readonly layoutVariables = { rowHeight: '--gallery-justified-row-height', gap: '--gallery-justified-gap' };

  private static readonly ROW_HEIGHT = 220;
  private static readonly GAP = 4;

  private rows: HTMLElement[] = [];

  constructor(container: HTMLElement) {
    super('justified', container);
  }

  render(): void {
    this.rows = [];
    super.render();
  }

  protected layout(width: number): void {
    // Rows need a width to fill; until the gallery is visible the tiles stay unplaced
    if (width <= 0) return;

    const targetHeight = this.readCssNumber('--gallery-justified-row-height', JustifiedView.ROW_HEIGHT);
    const gap = this.readCssNumber('--gallery-justified-gap', JustifiedView.GAP);
    const rows = JustifiedView.buildRows(this.tiles, width, targetHeight, gap);

    this.rows = this.syncContainers(this.rows, rows.length, 'gallery-justified-row');
    rows.forEach((row, r) => {
      const rowEl = this.rows[r];
      rowEl.style.setProperty('--gallery-row-height', `${row.height}px`);
      for (const tile of row.tiles) {
        // Justified rows split the width in proportion to the ratios (flex-basis 0, grow by ratio);
        // a short last row keeps each image at its width for the target height.
        tile.el.style.setProperty('--gallery-tile-grow', row.justified ? String(tile.ratio) : '0');
        tile.el.style.setProperty('--gallery-tile-basis', row.justified ? '0px' : `${tile.ratio * row.height}px`);
      }
      this.syncChildren(rowEl, row.tiles);
    });
  }

  /**
   * Split tiles into rows. A row is closed once adding the next tile would shrink it below the
   * target height; the tile goes into whichever row (this one or the next) keeps the height nearer
   * the target. An image too wide to fit the width at the target height (a panorama) gets a row
   * of its own, and the row before it is left unstretched, like the last row.
   */
  static buildRows(tiles: LayoutTile[], width: number, targetHeight: number, gap: number): JustifiedRow[] {
    const fitHeight = (count: number, ratioSum: number) => (width - gap * (count - 1)) / ratioSum;
    // A row that may not fill the width: justified only if it already fills it at the target height
    const openRow = (rowTiles: LayoutTile[], ratioSum: number): JustifiedRow => {
      const height = fitHeight(rowTiles.length, ratioSum);
      return height <= targetHeight
        ? { tiles: rowTiles, height, justified: true }
        : { tiles: rowTiles, height: targetHeight, justified: false };
    };

    const rows: JustifiedRow[] = [];
    let current: LayoutTile[] = [];
    let ratioSum = 0;

    for (const tile of tiles) {
      if (tile.ratio * targetHeight >= width) {
        if (current.length > 0) rows.push(openRow(current, ratioSum));
        rows.push({ tiles: [tile], height: width / tile.ratio, justified: true });
        current = [];
        ratioSum = 0;
        continue;
      }

      const heightWith = fitHeight(current.length + 1, ratioSum + tile.ratio);
      if (current.length > 0 && heightWith < targetHeight) {
        const heightWithout = fitHeight(current.length, ratioSum);
        if (heightWithout - targetHeight <= targetHeight - heightWith) {
          rows.push({ tiles: current, height: heightWithout, justified: true });
          current = [tile];
          ratioSum = tile.ratio;
        } else {
          rows.push({ tiles: [...current, tile], height: heightWith, justified: true });
          current = [];
          ratioSum = 0;
        }
        continue;
      }
      current.push(tile);
      ratioSum += tile.ratio;
    }

    if (current.length > 0) rows.push(openRow(current, ratioSum));
    return rows;
  }
}
