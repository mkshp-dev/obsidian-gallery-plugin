import { addDemoConnections, DEMO_IMMICH_CONNECTION, DEMO_NEXTCLOUD_CONNECTION } from '../../src/generators/DemoServers';
import { DEFAULT_SETTINGS, GalleryPluginSettings } from '../../src/models/settings';

const freshSettings = (): GalleryPluginSettings => ({ ...DEFAULT_SETTINGS, immichConnections: [], nextcloudConnections: [] });

describe('addDemoConnections', () => {
    test('an existing connection to the demo server under the demo key is not a conflict', () => {
        const settings = freshSettings();
        settings.nextcloudConnections.push({ ...DEMO_NEXTCLOUD_CONNECTION, baseUrl: 'https://demo-nextcloud.mkshp.dev/' });

        expect(addDemoConnections(settings)).toEqual({ added: ['immich-demo'], conflicts: [] });
    });

    test('adds both demo connections to empty settings', () => {
        const settings = freshSettings();

        expect(addDemoConnections(settings)).toEqual({ added: ['immich-demo', 'nextcloud-demo'], conflicts: [] });
        expect(settings.immichConnections).toEqual([DEMO_IMMICH_CONNECTION]);
        expect(settings.nextcloudConnections).toEqual([DEMO_NEXTCLOUD_CONNECTION]);
        // Copies, so editing the setting later never changes the shared constant
        expect(settings.immichConnections[0]).not.toBe(DEMO_IMMICH_CONNECTION);
    });

    test('never overwrites a connection that already uses a demo key, and reports it as a conflict', () => {
        const settings = freshSettings();
        settings.immichConnections.push({ key: 'immich-demo', baseUrl: 'https://mine.example.com', apiKey: 'mine' });
        settings.nextcloudConnections.push({ key: 'home', baseUrl: 'https://cloud.example.com', username: 'me', appPassword: 'x' });

        expect(addDemoConnections(settings)).toEqual({
            added: ['nextcloud-demo'],
            conflicts: [{ key: 'immich-demo', baseUrl: 'https://mine.example.com' }]
        });
        expect(settings.immichConnections).toEqual([{ key: 'immich-demo', baseUrl: 'https://mine.example.com', apiKey: 'mine' }]);
        expect(settings.nextcloudConnections.map(c => c.key)).toEqual(['home', 'nextcloud-demo']);
    });

    test('running it again adds nothing', () => {
        const settings = freshSettings();
        addDemoConnections(settings);

        expect(addDemoConnections(settings)).toEqual({ added: [], conflicts: [] });
        expect(settings.immichConnections).toHaveLength(1);
        expect(settings.nextcloudConnections).toHaveLength(1);
    });
});
