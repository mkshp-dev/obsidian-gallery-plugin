import { IImmichConnection, INextcloudConnection } from './interfaces';

/**
 * Plugin settings
 */
export interface GalleryPluginSettings {
    errorDisplayMode?: 'full' | 'text' | 'hidden';
    allowRemoteImages: boolean;
    remoteLoadTimeoutMs: number;
    validateRemoteContentType?: boolean;
    // How long (ms) to wait before finally destroying a detached gallery
    gracePeriodMs?: number;
    // Enable verbose lifecycle logging to help debug detach/reattach behavior
    enableLifecycleLogging?: boolean;
    showCaptions: boolean;
    captionMaxLines: number;
    // Pagination defaults (can be overridden per-gallery via the view: config)
    defaultPagination: boolean;
    defaultItemsPerPage: number;
    immichConnections: IImmichConnection[];
    nextcloudConnections: INextcloudConnection[];
}

export const DEFAULT_SETTINGS: GalleryPluginSettings = {
    errorDisplayMode: 'full',
    allowRemoteImages: false,
    remoteLoadTimeoutMs: 30000,
    validateRemoteContentType: false,
    gracePeriodMs: 30000,
    enableLifecycleLogging: false,
    showCaptions: true,
    captionMaxLines: 1,
    defaultPagination: false,
    defaultItemsPerPage: 24,
    immichConnections: [],
    nextcloudConnections: []
};
