import { App, Modal, Setting } from 'obsidian';

export interface BurnConfirmDetails {
    noteName: string;
    /** Galleries in the note, which all get burned */
    count: number;
    /** Where the images go; '' for the vault root */
    folder: string;
}

/**
 * Asked before "Burn galleries in this note" changes anything. Burning replaces the
 * gallery code blocks with images, a one-way step, so the dialog says plainly what will happen.
 * It explains why: the page can then be published with its galleries.
 */
export class BurnConfirmModal extends Modal {
    private confirmed = false;
    private resolve: ((confirmed: boolean) => void) | null = null;

    constructor(app: App, private readonly details: BurnConfirmDetails) {
        super(app);
    }

    /** Open the dialog; resolves true when the user chose to burn, false when they cancelled or closed it */
    ask(): Promise<boolean> {
        return new Promise(resolve => {
            this.resolve = resolve;
            this.open();
        });
    }

    onOpen(): void {
        const { contentEl } = this;
        const { noteName, count, folder } = this.details;
        const one = count === 1;
        contentEl.addClass('gallery-burn-modal');
        this.titleEl.setText(one ? 'Burn this gallery into an image' : `Burn ${count} galleries into images`);

        contentEl.createEl('p', {
            text: 'Obsidian Publish, and other places that can\'t run plugins, show a gallery\'s code instead of its photos. ' +
                `Burning swaps ${one ? 'the gallery' : `the ${count} galleries`} in "${noteName}" for ${one ? 'a picture' : 'pictures'} of how ${one ? 'it looks' : 'they look'} right now, ` +
                'so the page can be published with its galleries.'
        });

        const steps = contentEl.createEl('ol');
        const where = steps.createEl('li');
        where.appendText(one ? 'The image is saved in ' : 'The images are saved in ');
        where.createEl('strong', { text: folder || 'the vault root' });
        where.appendText(' (you can change this in the plugin settings).');
        steps.createEl('li', { text: one ? 'The gallery\'s code block is replaced with the image.' : 'Each gallery\'s code block is replaced with its image.' });

        const tip = contentEl.createDiv({ cls: 'gallery-burn-tip' });
        tip.createEl('strong', { text: 'Good to know: ' });
        tip.appendText(
            'this is a one-way step. A burned gallery is a picture, so it won\'t pick up new photos and has no viewer, slideshow or pages. ' +
            'If you\'d like to keep the live gallery as well, copy its code block somewhere first.'
        );

        contentEl.createEl('p', {
            cls: 'gallery-burn-note',
            text: 'Carousels keep the slide that is showing and paged galleries the current page (the first one, for galleries you haven\'t scrolled to). Captions that appear only on hover are left out.'
        });

        new Setting(contentEl)
            .addButton(button => button
                .setButtonText('Cancel')
                .onClick(() => this.close()))
            .addButton(button => button
                .setButtonText(one ? 'Burn gallery' : `Burn ${count} galleries`)
                .setCta()
                .onClick(() => {
                    this.confirmed = true;
                    this.close();
                }));
    }

    onClose(): void {
        this.contentEl.empty();
        this.resolve?.(this.confirmed);
        this.resolve = null;
    }
}
