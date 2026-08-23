/**
 * Resolves gallery source paths that are relative to the note containing the
 * gallery code block, so folder notes don't need to hardcode their own path.
 *
 * Supported forms:
 *   "."            -> the note's parent folder
 *   ".."           -> one level above the note's parent folder
 *   "./sub/folder" -> a subfolder of the note's parent folder
 *   "../sibling"   -> a folder relative to the note's parent folder, walking up
 *                     one level per leading ".." segment (any number of levels)
 *
 * Anything else (including absolute vault paths, which is the existing
 * behavior) is returned unchanged.
 */
export class NotePathResolver {
    static resolve(path: string, notePath?: string): string {
        const trimmed = path.trim();

        // Matches ".", "..", "./x", "../x", "../../x", etc. - but not an
        // unrelated folder name that merely starts with a dot, like "...foo".
        const isRelative = /^\.{1,2}(\/|$)/.test(trimmed);
        if (!isRelative) {
            return trimmed;
        }

        if (!notePath) {
            // No note context available (e.g. programmatic use) - nothing to resolve against.
            return trimmed;
        }

        const noteFolder = notePath.includes('/') ? notePath.slice(0, notePath.lastIndexOf('/')) : '';
        const folderParts = noteFolder ? noteFolder.split('/') : [];

        const segments = trimmed.split('/').filter(part => part.length > 0 && part !== '.');

        for (const segment of segments) {
            if (segment === '..') {
                folderParts.pop();
            } else {
                folderParts.push(segment);
            }
        }

        // Vault root is addressed as "/" in Obsidian's API, not "".
        return folderParts.length > 0 ? folderParts.join('/') : '/';
    }

    /** True if `path` is one of the relative forms handled by {@link resolve} (".", "..", "./x", "../x", ...). */
    static isRelative(path: string): boolean {
        return /^\.{1,2}(\/|$)/.test(path.trim());
    }

    /**
     * Inverse of {@link resolve}: expresses an absolute vault folder path as the
     * shortest relative form seen from `notePath`. Used by the gallery builder UI
     * to convert a folder picked from an absolute list into a note-relative path.
     */
    static toRelative(targetAbsolutePath: string, notePath: string): string {
        const noteFolder = notePath.includes('/') ? notePath.slice(0, notePath.lastIndexOf('/')) : '';
        const noteParts = noteFolder ? noteFolder.split('/') : [];

        const normalizedTarget = targetAbsolutePath.trim() === '/' ? '' : targetAbsolutePath.trim();
        const targetParts = normalizedTarget ? normalizedTarget.split('/').filter(part => part.length > 0) : [];

        let common = 0;
        while (common < noteParts.length && common < targetParts.length && noteParts[common] === targetParts[common]) {
            common++;
        }

        const upCount = noteParts.length - common;
        const downParts = targetParts.slice(common);

        if (upCount === 0 && downParts.length === 0) return '.';
        if (upCount === 0) return './' + downParts.join('/');

        const segments: string[] = [];
        for (let i = 0; i < upCount; i++) segments.push('..');
        segments.push(...downParts);
        return segments.join('/');
    }
}
