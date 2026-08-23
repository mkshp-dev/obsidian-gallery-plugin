import { NotePathResolver } from '../../src/utils/NotePathResolver';

describe('NotePathResolver', () => {
    it('resolves "." to the note\'s parent folder', () => {
        expect(NotePathResolver.resolve('.', 'Gaming/Doom & Heretic/Log/2026/Altruze.md'))
            .toBe('Gaming/Doom & Heretic/Log/2026');
    });

    it('resolves "./sub/folder" as a subfolder of the note\'s parent folder', () => {
        expect(NotePathResolver.resolve('./Images', 'Notes/Foo.md')).toBe('Notes/Images');
    });

    it('resolves "../sibling" relative to the note\'s parent folder', () => {
        expect(NotePathResolver.resolve('../Attachments', 'Notes/Sub/Foo.md')).toBe('Notes/Attachments');
    });

    it('supports multiple ".." segments', () => {
        expect(NotePathResolver.resolve('../../Shared', 'A/B/C/Foo.md')).toBe('A/Shared');
    });

    it('resolves a bare ".." to one level above the note\'s folder', () => {
        expect(NotePathResolver.resolve('..', 'A/B/Foo.md')).toBe('A');
    });

    it('supports a bare ".." chained multiple levels', () => {
        expect(NotePathResolver.resolve('../..', 'A/B/C/Foo.md')).toBe('A');
    });

    it('does not treat a folder literally named "...foo" as relative', () => {
        expect(NotePathResolver.resolve('...foo', 'Notes/Foo.md')).toBe('...foo');
    });

    it('resolves "." for a note at the vault root to "/"', () => {
        expect(NotePathResolver.resolve('.', 'Foo.md')).toBe('/');
    });

    it('does not go above the vault root', () => {
        expect(NotePathResolver.resolve('../../../Too/Far', 'A/Foo.md')).toBe('Too/Far');
    });

    it('leaves absolute vault paths unchanged', () => {
        expect(NotePathResolver.resolve('Images/Gallery', 'Notes/Foo.md')).toBe('Images/Gallery');
    });

    it('leaves relative tokens unchanged when no notePath is available', () => {
        expect(NotePathResolver.resolve('.', undefined)).toBe('.');
        expect(NotePathResolver.resolve('../Attachments', undefined)).toBe('../Attachments');
    });

    describe('isRelative', () => {
        it('recognizes all supported relative forms', () => {
            expect(NotePathResolver.isRelative('.')).toBe(true);
            expect(NotePathResolver.isRelative('..')).toBe(true);
            expect(NotePathResolver.isRelative('./Sub')).toBe(true);
            expect(NotePathResolver.isRelative('../Sibling')).toBe(true);
        });

        it('rejects absolute paths and dot-prefixed folder names', () => {
            expect(NotePathResolver.isRelative('Images/Gallery')).toBe(false);
            expect(NotePathResolver.isRelative('...foo')).toBe(false);
        });
    });

    describe('toRelative', () => {
        it('is the inverse of resolve for a sibling folder', () => {
            expect(NotePathResolver.toRelative('Notes/Attachments', 'Notes/Sub/Foo.md')).toBe('../Attachments');
        });

        it('is the inverse of resolve for the note\'s own folder', () => {
            expect(NotePathResolver.toRelative('Gaming/Doom & Heretic/Log/2026', 'Gaming/Doom & Heretic/Log/2026/Altruze.md'))
                .toBe('.');
        });

        it('is the inverse of resolve for a subfolder', () => {
            expect(NotePathResolver.toRelative('Notes/Images', 'Notes/Foo.md')).toBe('./Images');
        });

        it('walks up multiple levels when needed', () => {
            expect(NotePathResolver.toRelative('A/Shared', 'A/B/C/Foo.md')).toBe('../../Shared');
        });

        it('treats the vault root target as "/"', () => {
            expect(NotePathResolver.toRelative('/', 'Notes/Foo.md')).toBe('..');
        });

        it('resolves back to the same absolute path via resolve()', () => {
            const notePath = 'A/B/C/Foo.md';
            const target = 'A/X/Y';
            const relative = NotePathResolver.toRelative(target, notePath);
            expect(NotePathResolver.resolve(relative, notePath)).toBe(target);
        });
    });
});
