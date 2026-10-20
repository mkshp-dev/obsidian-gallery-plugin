import { App, Modal, Setting } from 'obsidian';
import { DEMO } from '../generators/DemoServers';

/** What the user chose: add the demo connections, create the notes without them, or cancel */
export type DemoConnectionsChoice = 'add' | 'skip' | 'cancel';

/**
 * Asked before creating the showcase notes: adding the demo connections writes to the user's
 * settings and makes the vault contact a server run by the plugin's author, so it needs consent.
 */
export class DemoConnectionsModal extends Modal {
    private choice: DemoConnectionsChoice = 'cancel';
    private resolve: ((choice: DemoConnectionsChoice) => void) | null = null;

    constructor(app: App) {
        super(app);
    }

    /** Open the dialog and resolve with the choice once it closes (closing it without a choice cancels) */
    ask(): Promise<DemoConnectionsChoice> {
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

        new Setting(contentEl)
            .addButton(button => button
                .setButtonText('Notes only')
                .onClick(() => this.finish('skip')))
            .addButton(button => button
                .setButtonText('Add connections')
                .setCta()
                .onClick(() => this.finish('add')));
    }

    onClose(): void {
        this.contentEl.empty();
        this.resolve?.(this.choice);
        this.resolve = null;
    }

    private finish(choice: DemoConnectionsChoice): void {
        this.choice = choice;
        this.close();
    }
}
