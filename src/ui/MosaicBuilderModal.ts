import { App, Modal, Notice, Setting } from 'obsidian';
import type GalleryPlugin from '../main';
import { MosaicDraft } from '../models/mosaicDraft';
import {
    DEFAULT_MOSAIC_PATTERN,
    MOSAIC_MAX_COLUMNS,
    MOSAIC_MAX_ROWS,
    SavedMosaicPattern,
    blankCells,
    patternNameProblem,
    patternProblem
} from '../models/mosaicPattern';
import { renderPatternPreview } from './mosaicPatternPreview';

export interface MosaicBuilderOptions {
    /** The saved pattern to edit; without it a new pattern is made */
    editing?: SavedMosaicPattern;
    /** Start a new pattern from this one (used by Duplicate) */
    startFrom?: SavedMosaicPattern;
    /** Called with the saved pattern's name after it is saved */
    onSaved?: (name: string) => void;
}

/** A cell of the canvas, in cells (0-based) */
interface Cell { col: number; row: number }

/** What a click or drag on the canvas does */
type Tool = 'merge' | 'blank';

const HINTS: Record<Tool, string> = {
    merge: 'Drag across cells to merge them into one tile. Click a larger tile to split it, or a blank cell to use it again. Numbers show the order images fill the tiles.',
    blank: 'Click or drag across cells to leave them blank; the gallery shows nothing there. Click a blank cell to use it again.'
};

/**
 * "Build custom mosaic": draw a mosaic pattern on a grid and save it by name in the plugin
 * settings. With the merge tool, dragging across cells merges them into one tile and clicking a
 * larger tile splits it; with the blank tool, cells are left blank (empty in the gallery).
 * A gallery then uses the pattern with `pattern: <name>`.
 */
export class MosaicBuilderModal extends Modal {
    private draft: MosaicDraft;
    private name: string;
    private readonly originalName?: string;
    private tool: Tool = 'merge';

    private canvasEl!: HTMLElement;
    private selectionEl!: HTMLElement;
    private hintEl!: HTMLElement;
    private toolButtons = new Map<Tool, HTMLButtonElement>();
    private repeatEl!: HTMLElement;
    private nameNoteEl!: HTMLElement;
    private problemEl!: HTMLElement;
    private saveBtn!: HTMLButtonElement;
    private columnsLabel!: HTMLElement;
    private rowsLabel!: HTMLElement;

    /** The cell a drag started on, while the pointer is down */
    private dragStart: Cell | null = null;
    private dragEnd: Cell | null = null;
    /** Blank tool: whether the current drag makes cells blank (true) or uses them again (false) */
    private dragBlanks = true;

    constructor(app: App, private readonly plugin: GalleryPlugin, private readonly options: MosaicBuilderOptions = {}) {
        super(app);
        const source = options.editing ?? options.startFrom;
        this.draft = MosaicDraft.fromPattern(source && patternProblem(source) === undefined ? source : DEFAULT_MOSAIC_PATTERN);
        this.originalName = options.editing?.name;
        this.name = options.editing?.name ?? (options.startFrom ? `${options.startFrom.name} copy` : '');
    }

    onOpen(): void {
        this.modalEl.addClass('gallery-mosaic-builder-modal');
        const { contentEl } = this;
        contentEl.empty();
        this.setTitle(this.originalName ? `Edit mosaic: ${this.originalName}` : 'Build custom mosaic');

        new Setting(contentEl)
            .setName('Name')
            .setDesc('Use the pattern in a gallery with pattern: followed by this name.')
            .addText(text => {
                text.setPlaceholder('Featured')
                    .setValue(this.name)
                    .onChange(value => {
                        this.name = value;
                        this.refreshStatus();
                    });
                window.setTimeout(() => text.inputEl.focus(), 0);
            });
        this.nameNoteEl = contentEl.createDiv({ cls: 'gallery-mosaic-builder-note' });

        const toolbar = contentEl.createDiv({ cls: 'gallery-mosaic-builder-toolbar' });
        const tools = toolbar.createDiv({ cls: 'gallery-mosaic-builder-tools', attr: { role: 'group', 'aria-label': 'Tool' } });
        for (const [tool, label] of [['merge', 'Merge tiles'], ['blank', 'Leave blank']] as [Tool, string][]) {
            const btn = tools.createEl('button', { text: label });
            btn.addEventListener('click', () => {
                this.tool = tool;
                this.refreshTool();
            });
            this.toolButtons.set(tool, btn);
        }
        this.columnsLabel = this.renderStepper(toolbar, 'Columns', () => this.draft.columns, value => this.draft.resize(value, this.draft.rows), 2, MOSAIC_MAX_COLUMNS);
        this.rowsLabel = this.renderStepper(toolbar, 'Rows', () => this.draft.rows, value => this.draft.resize(this.draft.columns, value), 1, MOSAIC_MAX_ROWS);
        const reset = toolbar.createEl('button', { cls: 'gallery-mosaic-builder-reset', text: 'Reset' });
        reset.setAttr('aria-label', 'Make every cell a single tile');
        reset.addEventListener('click', () => {
            this.draft = MosaicDraft.blank(this.draft.columns, this.draft.rows);
            this.refresh();
        });

        const body = contentEl.createDiv({ cls: 'gallery-mosaic-builder-body' });
        const editor = body.createDiv({ cls: 'gallery-mosaic-builder-editor' });
        this.hintEl = editor.createDiv({ cls: 'gallery-mosaic-builder-hint' });
        this.canvasEl = editor.createDiv({ cls: 'gallery-mosaic-builder-canvas' });
        this.attachPointerHandlers(this.canvasEl);

        const side = body.createDiv({ cls: 'gallery-mosaic-builder-side' });
        side.createDiv({ cls: 'gallery-mosaic-builder-side-title', text: 'How it repeats' });
        this.repeatEl = side.createDiv({ cls: 'gallery-mosaic-builder-repeat' });
        side.createDiv({
            cls: 'gallery-mosaic-builder-note',
            text: 'The pattern repeats down the gallery. In a narrow pane, a pattern with more than two columns switches to the built-in two-column pattern.'
        });

        this.problemEl = contentEl.createDiv({ cls: 'gallery-mosaic-builder-problem' });
        const footer = contentEl.createDiv({ cls: 'modal-button-container' });
        footer.createEl('button', { text: 'Cancel' }).addEventListener('click', () => this.close());
        this.saveBtn = footer.createEl('button', { cls: 'mod-cta', text: 'Save pattern' });
        this.saveBtn.addEventListener('click', () => void this.save());

        this.refreshTool();
        this.refresh();
    }

    onClose(): void {
        this.contentEl.empty();
    }

    /** A "− value +" control; returns the element showing the value */
    private renderStepper(parent: HTMLElement, label: string, get: () => number, set: (value: number) => void, min: number, max: number): HTMLElement {
        const wrap = parent.createDiv({ cls: 'gallery-mosaic-builder-stepper' });
        wrap.createSpan({ cls: 'gallery-mosaic-builder-stepper-label', text: label });
        const minus = wrap.createEl('button', { text: '−', attr: { 'aria-label': `Fewer ${label.toLowerCase()}` } });
        const value = wrap.createSpan({ cls: 'gallery-mosaic-builder-stepper-value' });
        const plus = wrap.createEl('button', { text: '+', attr: { 'aria-label': `More ${label.toLowerCase()}` } });
        const step = (delta: number) => {
            const next = get() + delta;
            if (next < min || next > max) return;
            set(next);
            this.refresh();
        };
        minus.addEventListener('click', () => step(-1));
        plus.addEventListener('click', () => step(1));
        return value;
    }

    private refreshTool(): void {
        for (const [tool, btn] of this.toolButtons) {
            btn.toggleClass('is-active', tool === this.tool);
            btn.setAttr('aria-pressed', String(tool === this.tool));
        }
        this.hintEl.setText(HINTS[this.tool]);
        this.canvasEl.toggleClass('is-blank-tool', this.tool === 'blank');
    }

    /** Redraw the canvas, the repeat preview and the status after an edit */
    private refresh(): void {
        this.columnsLabel.setText(String(this.draft.columns));
        this.rowsLabel.setText(String(this.draft.rows));
        this.renderCanvas();
        this.repeatEl.empty();
        if (this.draft.tileCount > 0) renderPatternPreview(this.repeatEl, this.draft.toPattern(), { repeats: 2, numbered: true });
        this.refreshStatus();
    }

    private renderCanvas(): void {
        const canvas = this.canvasEl;
        canvas.empty();
        canvas.style.setProperty('--gallery-mosaic-builder-columns', String(this.draft.columns));
        canvas.style.setProperty('--gallery-mosaic-builder-rows', String(this.draft.rows));

        const pattern = this.draft.toPattern();
        for (const blank of blankCells(pattern)) {
            const cell = canvas.createDiv({
                cls: 'gallery-mosaic-builder-blank',
                attr: { role: 'button', tabindex: '0', 'aria-label': `Blank cell, column ${blank.col + 1}, row ${blank.row + 1}. Press Enter to use it again.` }
            });
            cell.style.gridColumn = String(blank.col + 1);
            cell.style.gridRow = String(blank.row + 1);
            this.onActivate(cell, () => this.draft.setBlank(blank.col, blank.row, blank.col, blank.row, false));
        }

        pattern.slots.forEach((slot, i) => {
            const large = slot.colSpan > 1 || slot.rowSpan > 1;
            const tile = canvas.createDiv({
                cls: `gallery-mosaic-builder-tile${large ? ' is-large' : ''}`,
                text: String(i + 1),
                attr: large
                    ? { role: 'button', tabindex: '0', 'aria-label': `Tile ${i + 1}, ${slot.colSpan} by ${slot.rowSpan} cells. Press Enter to split it.` }
                    : { 'aria-label': `Tile ${i + 1}` }
            });
            tile.style.gridColumn = `${slot.col + 1} / span ${slot.colSpan}`;
            tile.style.gridRow = `${slot.row + 1} / span ${slot.rowSpan}`;
            if (large) this.onActivate(tile, () => this.draft.split(slot.col, slot.row));
        });

        this.selectionEl = canvas.createDiv({ cls: 'gallery-mosaic-builder-selection' });
        this.selectionEl.hide();
    }

    /** Run an edit when a focused element gets Enter or Space (the keyboard way to edit) */
    private onActivate(el: HTMLElement, edit: () => void): void {
        el.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            edit();
            this.refresh();
        });
    }

    /** The cell under a pointer position, clamped to the grid */
    private cellAt(e: PointerEvent): Cell {
        const rect = this.canvasEl.getBoundingClientRect();
        const clamp = (v: number, max: number) => Math.max(0, Math.min(max - 1, v));
        return {
            col: clamp(Math.floor(((e.clientX - rect.left) / Math.max(1, rect.width)) * this.draft.columns), this.draft.columns),
            row: clamp(Math.floor(((e.clientY - rect.top) / Math.max(1, rect.height)) * this.draft.rows), this.draft.rows)
        };
    }

    private attachPointerHandlers(canvas: HTMLElement): void {
        canvas.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            canvas.setPointerCapture?.(e.pointerId);
            this.dragStart = this.cellAt(e);
            this.dragEnd = this.dragStart;
            // A drag that starts on a blank cell uses cells again; otherwise it blanks them
            this.dragBlanks = !this.draft.isBlank(this.dragStart.col, this.dragStart.row);
            this.showSelection();
        });
        canvas.addEventListener('pointermove', (e) => {
            if (!this.dragStart) return;
            const cell = this.cellAt(e);
            if (cell.col === this.dragEnd?.col && cell.row === this.dragEnd?.row) return;
            this.dragEnd = cell;
            this.showSelection();
        });
        const finish = (e: PointerEvent, apply: boolean) => {
            const start = this.dragStart;
            if (!start) return;
            const end = apply ? this.cellAt(e) : start;
            this.dragStart = null;
            this.dragEnd = null;
            this.selectionEl.hide();
            if (!apply) return;
            this.applyDrag(start, end);
            this.refresh();
        };
        canvas.addEventListener('pointerup', (e) => finish(e, true));
        canvas.addEventListener('pointercancel', (e) => finish(e, false));
    }

    private applyDrag(start: Cell, end: Cell): void {
        if (this.tool === 'blank') {
            this.draft.setBlank(start.col, start.row, end.col, end.row, this.dragBlanks);
            return;
        }
        const click = start.col === end.col && start.row === end.row;
        const slot = this.draft.slotAt(start.col, start.row);
        // A click splits a larger tile; on a blank cell, merge makes it a tile again
        if (click && slot && (slot.colSpan > 1 || slot.rowSpan > 1)) this.draft.split(start.col, start.row);
        else this.draft.merge(start.col, start.row, end.col, end.row);
    }

    /** Outline the cells the current drag covers */
    private showSelection(): void {
        if (!this.dragStart || !this.dragEnd) return;
        const left = Math.min(this.dragStart.col, this.dragEnd.col), right = Math.max(this.dragStart.col, this.dragEnd.col);
        const top = Math.min(this.dragStart.row, this.dragEnd.row), bottom = Math.max(this.dragStart.row, this.dragEnd.row);
        this.selectionEl.style.gridColumn = `${left + 1} / ${right + 2}`;
        this.selectionEl.style.gridRow = `${top + 1} / ${bottom + 2}`;
        this.selectionEl.toggleClass('is-blanking', this.tool === 'blank' && this.dragBlanks);
        this.selectionEl.show();
    }

    /** Why the pattern can't be saved yet, or undefined when it can */
    private problem(): string | undefined {
        return patternNameProblem(this.name, this.plugin.settings.mosaicPatterns, this.originalName) ?? this.draft.problem();
    }

    private refreshStatus(): void {
        const renamed = this.originalName !== undefined && this.name.trim() !== '' &&
            this.name.trim().toLowerCase() !== this.originalName.trim().toLowerCase();
        this.nameNoteEl.setText(renamed
            ? `Galleries that use "${this.originalName}" will switch to the built-in pattern until you change them to the new name.`
            : '');
        const problem = this.problem();
        this.problemEl.setText(problem ?? '');
        this.saveBtn.disabled = problem !== undefined;
    }

    private async save(): Promise<void> {
        if (this.problem() !== undefined) return;

        const saved: SavedMosaicPattern = { name: this.name.trim(), ...this.draft.toPattern() };
        const patterns = this.plugin.settings.mosaicPatterns;
        const index = this.originalName === undefined ? -1 : patterns.findIndex(p => p.name === this.originalName);
        if (index === -1) patterns.push(saved);
        else patterns[index] = saved;

        await this.plugin.saveSettings();
        // Galleries already showing this pattern pick up the change without fetching images again
        this.plugin.refreshGalleries('none');
        new Notice(`Saved the mosaic pattern "${saved.name}". Use it with pattern: ${saved.name}`);
        this.options.onSaved?.(saved.name);
        this.close();
    }
}
