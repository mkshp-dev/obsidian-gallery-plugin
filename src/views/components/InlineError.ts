/**
 * InlineError component for displaying non-fatal source resolution errors
 * alongside successfully loaded images in a mixed-source gallery.
 * Renders a compact single-line message so it doesn't dominate the UI.
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
     * Render a compact single-line inline error
     */
    private render(): void {
        if (!this.errors || this.errors.length === 0) {
            return;
        }

        if (this.errorElement) {
            this.errorElement.remove();
        }

        const message = this.errors.length === 1
            ? this.errors[0]
            : `${this.errors[0]} (+${this.errors.length - 1} more)`;

        this.errorElement = this.container.createDiv('gallery-error-compact');
        this.errorElement.textContent = `\u26a0\ufe0f gallery: ${message}`;
    }

    /**
     * Remove the inline error
     */
    destroy(): void {
        if (this.errorElement) {
            this.errorElement.remove();
            this.errorElement = null;
        }
    }
}
