import { App, Modal, Setting } from 'obsidian';
import { DEMO } from '../generators/DemoServers';
import { SAMPLE_PHOTOS_HOST } from '../generators/SamplePhotos';
import { SAMPLE_PHOTO_COUNT, SAMPLE_PHOTO_MEGABYTES } from '../generators/SamplePhotoSet';

/** What the user chose: add the demo connections, create the notes without them, or cancel */
export type DemoConnectionsChoice = 'add' | 'skip' | 'cancel';

export interface DemoConnectionsAnswer {
    choice: DemoConnectionsChoice;
    /** Whether to download the sample photos for the use-case notes */
    downloadPhotos: boolean;
}

/**
 * Asked before creating the showcase or use-case notes: adding the demo connections writes to the
 * user's settings, and both they and the sample photo download make the vault contact servers run
 * by the plugin's author, so they need consent.
 */
export class DemoConnectionsModal extends Modal {
    private choice: DemoConnectionsChoice = 'cancel';
    // Off when no photos are published yet, since there would be nothing to download
    private downloadPhotos = SAMPLE_PHOTO_COUNT > 0;
    private resolve: ((answer: DemoConnectionsAnswer) => void) | null = null;

    constructor(app: App) {
        super(app);
    }

    /** Open the dialog and resolve with the answer once it closes (closing it without a choice cancels) */
    ask(): Promise<DemoConnectionsAnswer> {
        return new Promise(resolve => {
            this.resolve = resolve;
            this.open();
        });
    }

    onOpen(): void {
        const { contentEl } = this;
        this.titleEl.setText('Add demo server connections?');

        contentEl.createEl('p', {
            text: `The Immich and Nextcloud showcase notes load photos from public, read-only demo servers. ` +
                `To make them work right away, the plugin can add two connections to your settings: ` +
                `${DEMO.immichKey} (${DEMO.immichUrl}) and ${DEMO.nextcloudKey} (${DEMO.nextcloudUrl}).`
        });
        contentEl.createEl('p', {
            text: 'Those notes will then contact servers run by the plugin\'s author. Existing connections with the same names are not changed, and you can remove the demo connections at any time in the providers settings.'
        });

        if (SAMPLE_PHOTO_COUNT > 0) {
            new Setting(contentEl)
                .setName('Download sample photos')
                .setDesc(`For the use-case notes: ${SAMPLE_PHOTO_COUNT} photos, about ${SAMPLE_PHOTO_MEGABYTES} MB from ${SAMPLE_PHOTOS_HOST}, saved in your vault.`)
                .addToggle(toggle => toggle
                    .setValue(this.downloadPhotos)
                    .onChange(value => { this.downloadPhotos = value; }));
        }

        new Setting(contentEl)
            .addButton(button => button
                .setButtonText('Skip connections')
                .onClick(() => this.finish('skip')))
            .addButton(button => button
                .setButtonText('Add connections')
                .setCta()
                .onClick(() => this.finish('add')));
    }

    onClose(): void {
        this.contentEl.empty();
        this.resolve?.({ choice: this.choice, downloadPhotos: this.choice !== 'cancel' && this.downloadPhotos });
        this.resolve = null;
    }

    private finish(choice: DemoConnectionsChoice): void {
        this.choice = choice;
        this.close();
    }
}
