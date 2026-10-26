import { readFileSync } from 'fs';
import { join } from 'path';

// jsdom doesn't apply stylesheets, so these check the selectors in styles.css directly
const css = readFileSync(join(__dirname, '../../styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Every selector in the stylesheet, one per comma-separated entry */
const selectors = (): string[] =>
    Array.from(css.matchAll(/([^{}]+)\{/g))
        .flatMap(match => match[1].split(','))
        .map(selector => selector.trim())
        .filter(selector => selector !== '' && !selector.startsWith('@'));

describe('styles.css', () => {
    test('hover captions show on focus only inside the gallery', () => {
        // The Live Preview editor around a gallery is a focused contenteditable, which matches
        // :focus-visible; an unscoped selector shows every hover caption while editing (#204)
        const focusSelectors = selectors().filter(s => s.includes(':focus-visible') && s.includes('.gallery-caption.is-overlay'));
        expect(focusSelectors.length).toBeGreaterThan(0);
        for (const selector of focusSelectors) {
            expect(selector).toMatch(/^\.gallery-view /);
        }
    });
});
