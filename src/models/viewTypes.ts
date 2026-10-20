/** Every view a gallery can render with */
export const VIEW_TYPES = ['thumbnail', 'carousel', 'masonry', 'justified', 'embed'] as const;

export type ViewType = typeof VIEW_TYPES[number];

/**
 * Older names still accepted in gallery blocks. `grid` was always documented as a masonry layout,
 * so existing `view: grid` blocks render as masonry.
 */
export const VIEW_TYPE_ALIASES = { grid: 'masonry' } as const satisfies Record<string, ViewType>;

/** A view name as written in a gallery block: a view type or one of its aliases */
export type ViewTypeName = ViewType | keyof typeof VIEW_TYPE_ALIASES;

export const DEFAULT_VIEW_TYPE: ViewType = 'thumbnail';

/** Maps a view name (or alias) to its view type; undefined when the name is not a known view */
export function normalizeViewType(name: unknown): ViewType | undefined {
    if (typeof name !== 'string') return undefined;
    if ((VIEW_TYPES as readonly string[]).includes(name)) return name as ViewType;
    return Object.prototype.hasOwnProperty.call(VIEW_TYPE_ALIASES, name)
        ? VIEW_TYPE_ALIASES[name as keyof typeof VIEW_TYPE_ALIASES]
        : undefined;
}

/** The raw view name in a `view:` value, which is either a name or an object with a `type` */
export function getViewTypeName(view: unknown): string | undefined {
    if (typeof view === 'string') return view;
    if (typeof view === 'object' && view !== null && 'type' in view) {
        const type = view.type;
        return typeof type === 'string' ? type : undefined;
    }
    return undefined;
}

/** The view type a `view:` value selects, falling back to the default view when missing or unknown */
export function resolveViewType(view: unknown): ViewType {
    return normalizeViewType(getViewTypeName(view)) ?? DEFAULT_VIEW_TYPE;
}

/** Views that show many small tiles, so remote sources should fetch thumbnails rather than full images */
export function usesThumbnailImages(viewType: string | undefined): boolean {
    const type = normalizeViewType(viewType);
    return type === 'thumbnail' || type === 'masonry' || type === 'justified';
}
