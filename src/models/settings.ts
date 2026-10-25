import { IImmichConnection, INextcloudConnection } from './interfaces';

/**
 * Plugin settings
 */
export interface GalleryPluginSettings {
    // 'full' shows a one-line message, 'hidden' shows nothing. Older versions also had 'text',
    // which looked the same as 'full'; loadSettings migrates it.
    errorDisplayMode?: 'full' | 'hidden';
    allowRemoteImages: boolean;
    remoteLoadTimeoutMs: number;
    validateRemoteContentType?: boolean;
    // How long (ms) to wait before finally destroying a detached gallery
    gracePeriodMs?: number;
    // Enable verbose lifecycle logging to help debug detach/reattach behavior
    enableLifecycleLogging?: boolean;
    showCaptions: boolean;
    // Draw the border, background and padding around each gallery (overridable per gallery with frame:)
    showFrame: boolean;
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
    showFrame: true,
    captionMaxLines: 1,
    defaultPagination: false,
    defaultItemsPerPage: 24,
    immichConnections: [],
    nextcloudConnections: []
};
