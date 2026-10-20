import { addDemoConnections, DEMO_IMMICH_CONNECTION, DEMO_NEXTCLOUD_CONNECTION } from '../../src/generators/DemoServers';
import { DEFAULT_SETTINGS, GalleryPluginSettings } from '../../src/models/settings';

const freshSettings = (): GalleryPluginSettings => ({ ...DEFAULT_SETTINGS, immichConnections: [], nextcloudConnections: [] });

describe('addDemoConnections', () => {
    test('adds both demo connections to empty settings', () => {
        const settings = freshSettings();

        expect(addDemoConnections(settings)).toEqual(['immich-demo', 'nextcloud-demo']);
        expect(settings.immichConnections).toEqual([DEMO_IMMICH_CONNECTION]);
        expect(settings.nextcloudConnections).toEqual([DEMO_NEXTCLOUD_CONNECTION]);
        // Copies, so editing the setting later never changes the shared constant
        expect(settings.immichConnections[0]).not.toBe(DEMO_IMMICH_CONNECTION);
    });

    test('never overwrites a connection that already uses a demo key', () => {
        const settings = freshSettings();
        settings.immichConnections.push({ key: 'immich-demo', baseUrl: 'https://mine.example.com', apiKey: 'mine' });
        settings.nextcloudConnections.push({ key: 'home', baseUrl: 'https://cloud.example.com', username: 'me', appPassword: 'x' });

        expect(addDemoConnections(settings)).toEqual(['nextcloud-demo']);
        expect(settings.immichConnections).toEqual([{ key: 'immich-demo', baseUrl: 'https://mine.example.com', apiKey: 'mine' }]);
        expect(settings.nextcloudConnections.map(c => c.key)).toEqual(['home', 'nextcloud-demo']);
    });

    test('running it again adds nothing', () => {
        const settings = freshSettings();
        addDemoConnections(settings);

        expect(addDemoConnections(settings)).toEqual([]);
        expect(settings.immichConnections).toHaveLength(1);
        expect(settings.nextcloudConnections).toHaveLength(1);
    });
});
