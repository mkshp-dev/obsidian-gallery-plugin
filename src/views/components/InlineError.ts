/**
 * InlineError component for displaying non-fatal source resolution errors
 * alongside successfully loaded images in a mixed-source gallery.
 * It provides a compact, text-first UI within the note block.
 */
export class InlineError {
    private container: HTMLElement;
    private errors: string[];
    private errorElement: HTMLElement | null = null;

    constructor(container: HTMLElement, errors: string[]) {
        this.container = container;
        this.errors = errors;
        this.render();
    }

    /**
     * Render the inline error block
     */
    private render(): void {
        if (!this.errors || this.errors.length === 0) {
            return;
        }

        // Clear existing if any
        if (this.errorElement) {
            this.errorElement.remove();
        }

        // Create main container for the inline errors
        this.errorElement = this.container.createDiv('gallery-inline-error-container');

        // Add a header/title for the error block
        const headerEl = this.errorElement.createDiv('gallery-inline-error-header');

        const iconEl = headerEl.createSpan('gallery-inline-error-icon');
        iconEl.textContent = '⚠️';

        const titleEl = headerEl.createSpan('gallery-inline-error-title');
        titleEl.textContent = 'Some sources could not be loaded:';

        // Create a list for the exact error messages
        const listEl = this.errorElement.createEl('ul', { cls: 'gallery-inline-error-list' });

        for (const error of this.errors) {
            // Avoid adding pure generic messages if we have specific ones,
            // but for now we just render what we are given
            const itemEl = listEl.createEl('li', { cls: 'gallery-inline-error-item' });
            itemEl.textContent = error;
        }
    }

    /**
     * Remove the inline error block
     */
    destroy(): void {
        if (this.errorElement) {
            this.errorElement.remove();
            this.errorElement = null;
        }
    }
}
