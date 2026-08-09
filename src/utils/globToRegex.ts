/**
 * Converts a simple glob pattern into a regular expression.
 * Supports '*' for any number of characters, '?' for a single character,
 * and '{foo,bar}' for alternate strings.
 */
export function globToRegex(glob: string): RegExp {
    let reStr = '';
    for (let i = 0; i < glob.length; i++) {
        const c = glob[i];
        if (c === '*') {
            reStr += '.*';
        } else if (c === '?') {
            reStr += '.';
        } else if (c === '.') {
            reStr += '\\.';
        } else if (c === '{') {
            const end = glob.indexOf('}', i);
            if (end !== -1) {
                const parts = glob.substring(i + 1, end).split(',');
                // Escape special regex characters in the alternatives
                const escapedParts = parts.map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                reStr += '(' + escapedParts.join('|') + ')';
                i = end;
            } else {
                reStr += '\\{';
            }
        } else if (['\\', '^', '$', '+', '(', ')', '[', ']', '|'].includes(c)) {
            reStr += '\\' + c;
        } else {
            reStr += c;
        }
    }
    return new RegExp('^' + reStr + '$', 'i');
}
