import { AspectLayoutView, LayoutTile } from './AspectLayoutView';

/**
 * MasonryView
 * Pinterest-style layout: columns of equal width, each image at its natural height. Each tile
 * goes into the currently shortest column, so the gallery reads left to right, top to bottom.
 * The legacy `grid` view name renders with this view.
 *
 * Tunable from CSS: --gallery-masonry-column-width (minimum column width) and --gallery-masonry-gap.
 */
export class MasonryView extends AspectLayoutView {
  protected readonly layoutClass = 'gallery-masonry-layout';
  protected readonly tileClass = 'gallery-masonry-tile';

  private static readonly COLUMN_WIDTH = 220;
  private static readonly GAP = 8;

  private columns: HTMLElement[] = [];

  constructor(container: HTMLElement) {
    super('masonry', container);
  }

  render(): void {
    this.columns = [];
    super.render();
  }

  protected layout(width: number): void {
    const minColumnWidth = this.readCssNumber('--gallery-masonry-column-width', MasonryView.COLUMN_WIDTH);
    const gap = this.readCssNumber('--gallery-masonry-gap', MasonryView.GAP);

    const count = width > 0 ? Math.max(1, Math.floor((width + gap) / (minColumnWidth + gap))) : 1;
    const columnWidth = width > 0 ? (width - gap * (count - 1)) / count : minColumnWidth;
    const captionHeight = this.measureCaptionHeight();

    // Greedy shortest-column placement on estimated heights. The image box is sized from the
    // ratio (see --gallery-tile-ratio), so the estimate matches the rendered height.
    const assigned: LayoutTile[][] = Array.from({ length: count }, () => []);
    const heights = new Array<number>(count).fill(0);
    for (const tile of this.tiles) {
      let shortest = 0;
      for (let c = 1; c < count; c++) {
        if (heights[c] < heights[shortest] - 0.5) shortest = c;
      }
      assigned[shortest].push(tile);
      heights[shortest] += columnWidth / tile.ratio + captionHeight + gap;
    }

    this.columns = this.syncContainers(this.columns, count, 'gallery-masonry-column');
    this.columns.forEach((column, c) => this.syncChildren(column, assigned[c]));
  }

  /** Height a caption adds below each image (captions are clamped to the same line count) */
  private measureCaptionHeight(): number {
    const caption = this.root?.querySelector<HTMLElement>('.gallery-caption');
    return caption ? caption.offsetHeight : 0;
  }
}
