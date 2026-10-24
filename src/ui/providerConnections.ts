/** Fields every provider connection has */
export interface ConnectionBase {
    key: string;
    baseUrl: string;
}

/** The host shown on a connection card, e.g. "photos.example.com" ("" when the URL is not usable) */
export function connectionHost(baseUrl: string): string {
    try {
        return new URL(baseUrl.trim()).host;
    } catch {
        return '';
    }
}

/**
 * Problems that stop a connection from working, in the order a user would fix them.
 * `credentials` maps each required credential field's label to its value.
 */
export function connectionProblems(
    conn: ConnectionBase,
    all: ConnectionBase[],
    credentials: Record<string, string>
): string[] {
    const problems: string[] = [];
    const key = conn.key.trim();

    if (!key) {
        problems.push('Add a connection key; gallery blocks refer to the connection by it.');
    } else if (all.filter(c => c.key.trim() === key).length > 1) {
        problems.push(`Another connection already uses the key "${key}"; gallery blocks will use the first one.`);
    } else if (/\s/.test(key)) {
        problems.push('The connection key contains spaces; use letters, numbers and dashes.');
    }

    const url = conn.baseUrl.trim();
    if (!url) {
        problems.push('Add the server URL.');
    } else if (!/^https?:\/\//i.test(url) || !connectionHost(url)) {
        problems.push('The server URL must start with https:// (or http://).');
    }

    for (const [label, value] of Object.entries(credentials)) {
        if (!value.trim()) problems.push(`Add the ${label}.`);
    }
    return problems;
}
