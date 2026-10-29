import { IImmichConnection, INextcloudConnection } from '../models/interfaces';
import { GalleryPluginSettings } from '../models/settings';

/**
 * Public, read-only demo servers used by the showcase notes and the docs. The credentials are
 * meant to be published: the API key and app password can only read, and writes return 403.
 * Keep these in sync with docs-site/docs/demo-servers.md.
 */
export const DEMO = {
    immichKey: 'immich-demo',
    immichUrl: 'https://demo-immich.mkshp.dev',
    immichApiKey: 'Y8jMqmnnv5ME9wJl78U1D4cIgSGcigtMemcgWMxxE',
    immichAlbums: {
        landscapes: '0fe76d50-18b3-4f74-8f7c-3ede043982de',
        city: '0a33a817-9389-45f5-a99d-6ac12f56dc7f',
        travel: '882fef37-436a-49c1-af1a-e444d0216ee0'
    },
    immichShare: 'https://demo-immich.mkshp.dev/share/7XBAej6IyThZOS7izb78XcEJX7QhYwQBmxtHxaBz7TaaqiP5pxWyZQrN6TIvUGRhI9g',
    immichProtectedShare: 'https://demo-immich.mkshp.dev/share/RAHL6jLQTkqIDaSYjdlHdcbJ4W25u002dyorCdqYVDmoar8xyB7wiE8GARi4QH2eqWw',
    nextcloudKey: 'nextcloud-demo',
    nextcloudUrl: 'https://demo-nextcloud.mkshp.dev',
    nextcloudUser: 'demo',
    nextcloudAppPassword: 'psMXy2P4j2YZSjJuALSukdyzkjhIBAAqgUkQVFavPQPyRqkZfrkAXZhIknna8IIpLHsVgr8M',
    nextcloudShare: 'https://demo-nextcloud.mkshp.dev/s/DAxM47SmHesMTqa',
    nextcloudProtectedShare: 'https://demo-nextcloud.mkshp.dev/s/ZSBpcMLfaQPCi2Y',
    nextcloudPhotosAlbum: 'https://demo-nextcloud.mkshp.dev/apps/photos/public/wD9fLmI1TP6KEq76Yvs9fZrBdfDu8gfc',
    sharePassword: 'gallery-demo'
};

export const DEMO_IMMICH_CONNECTION: IImmichConnection = {
    key: DEMO.immichKey,
    baseUrl: DEMO.immichUrl,
    apiKey: DEMO.immichApiKey
};

export const DEMO_NEXTCLOUD_CONNECTION: INextcloudConnection = {
    key: DEMO.nextcloudKey,
    baseUrl: DEMO.nextcloudUrl,
    username: DEMO.nextcloudUser,
    appPassword: DEMO.nextcloudAppPassword
};

/** A user connection that already uses a demo key but points at another server */
export interface DemoConnectionConflict {
    key: string;
    baseUrl: string;
}

export interface DemoConnectionsResult {
    /** Keys of the connections that were added */
    added: string[];
    /** Demo keys left alone because a connection to a different server already uses them */
    conflicts: DemoConnectionConflict[];
}

const sameServer = (a: string, b: string) => a.replace(/\/+$/, '').toLowerCase() === b.replace(/\/+$/, '').toLowerCase();

/** True when `settings` already has the Immich demo connection, pointing at the demo server */
export function hasDemoImmichConnection(settings: GalleryPluginSettings): boolean {
    return settings.immichConnections.some(c => c.key === DEMO.immichKey && sameServer(c.baseUrl, DEMO.immichUrl));
}

/**
 * Add the demo connections to `settings`. A connection whose key is already taken is never
 * overwritten: if it points at the demo server it already works, otherwise it is reported as a
 * conflict so the user can be told the demo notes will not reach the demo server.
 * The caller saves the settings.
 */
export function addDemoConnections(settings: GalleryPluginSettings): DemoConnectionsResult {
    const result: DemoConnectionsResult = { added: [], conflicts: [] };
    const addTo = <T extends { key: string; baseUrl: string }>(connections: T[], demo: T) => {
        const existing = connections.find(c => c.key === demo.key);
        if (!existing) {
            connections.push({ ...demo });
            result.added.push(demo.key);
        } else if (!sameServer(existing.baseUrl, demo.baseUrl)) {
            result.conflicts.push({ key: existing.key, baseUrl: existing.baseUrl });
        }
    };
    addTo(settings.immichConnections, DEMO_IMMICH_CONNECTION);
    addTo(settings.nextcloudConnections, DEMO_NEXTCLOUD_CONNECTION);
    return result;
}
