import { VIEW_TYPES, ViewType, resolveViewType } from './viewTypes';

/** Options a gallery block can set under `view:`, besides `type` */
export interface ViewBlockOptions {
    pagination?: boolean;
    itemsPerPage?: number;
    /** Overrides the "Show captions" setting for this gallery */
    captions?: boolean;
    /** Overrides the "Show gallery frame" setting for this gallery */
    frame?: boolean;
    /** Justified: target row height in px */
    rowHeight?: number;
    /** Masonry: minimum column width in px */
    columnWidth?: number;
    /** Masonry and justified: space between images in px */
    gap?: number;
    /** Carousel: stage height in px */
    height?: number;
}

type OptionKey = keyof ViewBlockOptions;

interface OptionSpec {
    /** Views the option applies to */
    views: readonly ViewType[];
    /** Why a value is invalid, or undefined when it is valid */
    check: (value: unknown) => string | undefined;
}

const PAGED_VIEWS = VIEW_TYPES.filter(v => v !== 'carousel');

const isBoolean = (key: string) => (value: unknown) =>
    typeof value === 'boolean' ? undefined : `view.${key} must be true or false`;

const isNumberIn = (key: string, min: number, max: number, integer = false) => (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max && (!integer || Number.isInteger(value))
        ? undefined
        : `view.${key} must be ${integer ? 'a whole number' : 'a number'} from ${min} to ${max}`;

/** Every `view:` option, the views it applies to, and how its value is checked */
export const VIEW_OPTIONS: Record<OptionKey, OptionSpec> = {
    pagination: { views: PAGED_VIEWS, check: isBoolean('pagination') },
    itemsPerPage: { views: PAGED_VIEWS, check: isNumberIn('itemsPerPage', 1, 10000, true) },
    captions: { views: VIEW_TYPES, check: isBoolean('captions') },
    // The embed view never has a frame
    frame: { views: VIEW_TYPES.filter(v => v !== 'embed'), check: isBoolean('frame') },
    rowHeight: { views: ['justified'], check: isNumberIn('rowHeight', 40, 1000) },
    columnWidth: { views: ['masonry'], check: isNumberIn('columnWidth', 60, 1000) },
    gap: { views: ['masonry', 'justified'], check: isNumberIn('gap', 0, 64) },
    height: { views: ['carousel'], check: isNumberIn('height', 120, 1500) }
};

const OPTION_KEYS = Object.keys(VIEW_OPTIONS) as OptionKey[];

/**
 * Errors in the values of known `view:` options (wrong type or out of range). The parser rejects a
 * block with any of these. Unknown keys are not errors; see readViewOptions.
 */
export function viewOptionErrors(view: unknown): string[] {
    if (typeof view !== 'object' || view === null) return [];
    const raw = view as Record<string, unknown>;
    return OPTION_KEYS
        .filter(key => raw[key] !== undefined)
        .map(key => VIEW_OPTIONS[key].check(raw[key]))
        .filter((error): error is string => error !== undefined);
}

/**
 * The options a gallery's `view:` sets for its view type, plus warnings for keys that are ignored:
 * unknown keys (often typos) and options that don't apply to the chosen view.
 * Invalid values are left out; the parser has already rejected blocks that contain them.
 */
export function readViewOptions(view: unknown): { type: ViewType; options: ViewBlockOptions; warnings: string[] } {
    const type = resolveViewType(view);
    const options: ViewBlockOptions = {};
    const warnings: string[] = [];
    if (typeof view !== 'object' || view === null) return { type, options, warnings };

    for (const [key, value] of Object.entries(view as Record<string, unknown>)) {
        if (key === 'type') continue;
        const spec = (VIEW_OPTIONS as Record<string, OptionSpec | undefined>)[key];
        if (!spec) {
            const known = OPTION_KEYS.filter(k => VIEW_OPTIONS[k].views.includes(type)).join(', ');
            warnings.push(`Unknown view option "${key}" is ignored. Options for the ${type} view: ${known}.`);
            continue;
        }
        if (!spec.views.includes(type)) {
            warnings.push(`"${key}" doesn't apply to the ${type} view and is ignored (it applies to: ${spec.views.join(', ')}).`);
            continue;
        }
        if (spec.check(value) === undefined) {
            (options as Record<string, unknown>)[key] = value;
        }
    }
    return { type, options, warnings };
}
