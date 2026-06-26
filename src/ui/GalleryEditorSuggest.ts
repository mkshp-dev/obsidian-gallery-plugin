import { App, Editor, EditorPosition, EditorSuggest, EditorSuggestContext, EditorSuggestTriggerInfo, TFile } from 'obsidian';
import GalleryPlugin from '../../main';
import { ImmichClient } from '../services/immich/ImmichClient';
import { IImmichConnection } from '../models/interfaces';

// Suggestion item interface
interface SuggestionItem {
    label: string;
    value: string;
    description?: string;
}

export class GalleryEditorSuggest extends EditorSuggest<SuggestionItem> {
    private plugin: GalleryPlugin;

    constructor(app: App, plugin: GalleryPlugin) {
        super(app);
        this.plugin = plugin;
    }

    onTrigger(cursor: EditorPosition, editor: Editor, _file: TFile | null): EditorSuggestTriggerInfo | null {
        // 1. Check if we are inside an `obs-gallery` block
        let inGalleryBlock = false;
        let startLine = cursor.line;
        while (startLine >= 0) {
            const l = editor.getLine(startLine);
            if (l.startsWith('```obs-gallery')) {
                inGalleryBlock = true;
                break;
            }
            if (l.startsWith('```') && startLine !== cursor.line) {
                break;
            }
            startLine--;
        }

        if (!inGalleryBlock) {
            return null;
        }

        const line = editor.getLine(cursor.line);
        const prefix = line.substring(0, cursor.ch);

        // Simple match for values after keys
        // We look for common keys where autocomplete is useful

        // 1. connection:
        const matchConnection = prefix.match(/connection:\s*(.*)/);
        if (matchConnection) {
            return {
                start: { line: cursor.line, ch: matchConnection.index! + prefix.indexOf(matchConnection[1]) },
                end: cursor,
                query: JSON.stringify({ field: 'connection', text: matchConnection[1] })
            };
        }

        // 2. type:
        const matchType = prefix.match(/type:\s*(.*)/);
        if (matchType) {
            return {
                start: { line: cursor.line, ch: matchType.index! + prefix.indexOf(matchType[1]) },
                end: cursor,
                query: JSON.stringify({ field: 'type', text: matchType[1] })
            };
        }

        // 3. albumIds, tags, people array items
        // Typically they look like:
        // - item
        const matchListItem = prefix.match(/-\s*(.*)/);
        if (matchListItem) {
            // we need to know what array we are in
            // go up to find the closest key without indentation or less indentation
            const matchCurrentIndent = prefix.match(/^\s*/);
            const currentIndentLength = matchCurrentIndent ? matchCurrentIndent[0].length : 0;
            let fieldName = '';
            for (let i = cursor.line - 1; i >= startLine; i--) {
                const l = editor.getLine(i);
                const matchIndent = l.match(/^\s*/);
                const indentLength = matchIndent ? matchIndent[0].length : 0;
                if (indentLength < currentIndentLength && l.includes(':')) {
                    fieldName = l.split(':')[0].trim();
                    break;
                }
            }

            if (['albumIds', 'albums', 'tags', 'people'].includes(fieldName)) {
                return {
                    start: { line: cursor.line, ch: matchListItem.index! + prefix.indexOf(matchListItem[1]) },
                    end: cursor,
                    query: JSON.stringify({ field: fieldName, text: matchListItem[1] })
                };
            }
        }

        // 4. assetType
        const matchAssetType = prefix.match(/assetType:\s*(.*)/);
        if (matchAssetType) {
            return {
                start: { line: cursor.line, ch: matchAssetType.index! + prefix.indexOf(matchAssetType[1]) },
                end: cursor,
                query: JSON.stringify({ field: 'assetType', text: matchAssetType[1] })
            };
        }

        // 5. sort.order
        const matchSortOrder = prefix.match(/order:\s*(.*)/);
        if (matchSortOrder) {
            return {
                start: { line: cursor.line, ch: matchSortOrder.index! + prefix.indexOf(matchSortOrder[1]) },
                end: cursor,
                query: JSON.stringify({ field: 'sort.order', text: matchSortOrder[1] })
            };
        }

        // 6. view type
        const matchViewType = prefix.match(/view:\s*(.*)/);
        if (matchViewType) {
            return {
                start: { line: cursor.line, ch: matchViewType.index! + prefix.indexOf(matchViewType[1]) },
                end: cursor,
                query: JSON.stringify({ field: 'view', text: matchViewType[1] })
            };
        }

        return null;
    }

    async getSuggestions(context: EditorSuggestContext): Promise<SuggestionItem[]> {
        let queryData: { field: string, text: string };
        try {
            const parsed = JSON.parse(context.query) as unknown;
            queryData = parsed as { field: string, text: string };
        } catch {
            return [];
        }

        const { field, text } = queryData;
        const textLower = text.toLowerCase();
        const suggestions: SuggestionItem[] = [];

        if (field === 'connection') {
            const connections = this.plugin.settings.immichConnections || [];
            for (const c of connections) {
                if (c.key.toLowerCase().includes(textLower)) {
                    suggestions.push({ label: c.key, value: c.key, description: c.baseUrl });
                }
            }
        } else if (field === 'type') {
            const types = ['local', 'immich', 'immich-share'];
            for (const t of types) {
                if (t.includes(textLower)) {
                    suggestions.push({ label: t, value: t });
                }
            }
        } else if (field === 'assetType') {
            const types = ['IMAGE', 'VIDEO'];
            for (const t of types) {
                if (t.toLowerCase().includes(textLower)) {
                    suggestions.push({ label: t, value: t });
                }
            }
        } else if (field === 'sort.order') {
            const orders = ['desc', 'asc'];
            for (const o of orders) {
                if (o.includes(textLower)) {
                    suggestions.push({ label: o, value: o });
                }
            }
        } else if (field === 'view') {
            const views = ['grid', 'masonry', 'carousel'];
            for (const v of views) {
                if (v.includes(textLower)) {
                    suggestions.push({ label: v, value: v });
                }
            }
        } else if (['albumIds', 'albums', 'tags', 'people'].includes(field)) {
            // Need to figure out the connection to use
            const connection = this.findConnectionFromContext(context);
            if (connection) {
                try {
                    const client = new ImmichClient(connection);
                    if (field === 'albumIds' || field === 'albums') {
                        const albums = await client.getAlbums();
                        for (const a of albums) {
                            if (a.albumName && a.albumName.toLowerCase().includes(textLower)) {
                                suggestions.push({ label: a.albumName || a.id, value: a.id, description: `ID: ${a.id}` });
                            }
                        }
                    } else if (field === 'tags') {
                        const tags = await client.getTags();
                        for (const t of tags) {
                            if (t.value.toLowerCase().includes(textLower)) {
                                suggestions.push({ label: t.value, value: t.id, description: `ID: ${t.id}` });
                            }
                        }
                    } else if (field === 'people') {
                        const people = await client.getPeople();
                        for (const p of people) {
                            if (p.name.toLowerCase().includes(textLower)) {
                                suggestions.push({ label: p.name, value: p.id, description: `ID: ${p.id}` });
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error fetching Immich metadata for autocomplete', e);
                }
            }
        }

        return suggestions;
    }

    renderSuggestion(item: SuggestionItem, el: HTMLElement): void {
        const div = el.createDiv({ cls: 'gallery-suggestion-item' });
        div.createSpan({ text: item.label, cls: 'gallery-suggestion-label' });
        if (item.description) {
            div.createSpan({ text: item.description, cls: 'gallery-suggestion-description' });
        }

        // Inline styles for now, can move to CSS later
        el.setCssStyles({ display: 'flex', flexDirection: 'column' });

        const labelEl = div.querySelector('.gallery-suggestion-label');
        if (labelEl instanceof HTMLElement) {
            labelEl.setCssStyles({ fontWeight: 'bold' });
        }

        const descEl = div.querySelector('.gallery-suggestion-description');
        if (descEl instanceof HTMLElement) {
            descEl.setCssStyles({ fontSize: '0.8em', color: 'var(--text-muted)' });
        }
    }

    selectSuggestion(item: SuggestionItem, evt: MouseEvent | KeyboardEvent): void {
        if (!this.context) return;

        const { editor, start, end } = this.context;
        // In YAML, strings with spaces might need quotes, but let's stick to raw values
        // or quote if it contains spaces (for tags/people) - actually IDs don't have spaces typically.
        let val = item.value;
        if (val.includes(' ') && !val.startsWith('"')) {
            val = `"${val}"`;
        }
        editor.replaceRange(val, start, end);
    }

    private findConnectionFromContext(context: EditorSuggestContext): IImmichConnection | undefined {
        const { editor, start } = context;

        let connectionKey = '';

        for (let i = start.line; i >= 0; i--) {
            const l = editor.getLine(i);
            if (l.startsWith('```')) {
                if (l.startsWith('```obs-gallery')) {
                    break;
                }
                // hit another block somehow
                break;
            }

            // If we find 'connection: <key>'
            const connMatch = l.match(/connection:\s*(.*)/);
            if (connMatch) {
                // Ensure it's part of the same block
                // For simplicity, just grab the first one we see upwards
                connectionKey = connMatch[1].trim();
                break;
            }
        }

        if (connectionKey) {
            return this.plugin.settings.immichConnections?.find((c: IImmichConnection) => c.key === connectionKey);
        }

        if (this.plugin.settings.immichConnections && this.plugin.settings.immichConnections.length > 0) {
            return this.plugin.settings.immichConnections[0];
        }

        return undefined;
    }
}
