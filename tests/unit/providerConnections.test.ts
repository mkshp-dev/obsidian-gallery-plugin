import { connectionHost, connectionProblems } from '../../src/ui/providerConnections';

describe('connectionHost', () => {
    test('returns the host of a valid URL, empty otherwise', () => {
        expect(connectionHost('https://demo-immich.mkshp.dev')).toBe('demo-immich.mkshp.dev');
        expect(connectionHost(' https://cloud.example.com:8443/ ')).toBe('cloud.example.com:8443');
        expect(connectionHost('cloud.example.com')).toBe('');
        expect(connectionHost('')).toBe('');
    });
});

describe('connectionProblems', () => {
    const ok = { key: 'home', baseUrl: 'https://photos.example.com' };

    test('a complete connection has no problems', () => {
        expect(connectionProblems(ok, [ok], { 'API key': 'abc' })).toEqual([]);
    });

    test('a new, empty connection lists what to fill in, in order', () => {
        const empty = { key: '', baseUrl: '' };
        expect(connectionProblems(empty, [empty], { username: '', 'app password': '' })).toEqual([
            'Add a connection key; gallery blocks refer to the connection by it.',
            'Add the server URL.',
            'Add the username.',
            'Add the app password.'
        ]);
    });

    test('flags a key used by another connection', () => {
        const other = { key: 'home', baseUrl: 'https://other.example.com' };
        expect(connectionProblems(ok, [ok, other], {})).toEqual([
            'Another connection already uses the key "home"; gallery blocks will use the first one.'
        ]);
    });

    test('flags spaces in the key and a URL without a scheme', () => {
        const conn = { key: 'my server', baseUrl: 'photos.example.com' };
        expect(connectionProblems(conn, [conn], {})).toEqual([
            'The connection key contains spaces; use letters, numbers and dashes.',
            'The server URL must start with https:// (or http://).'
        ]);
    });
});
