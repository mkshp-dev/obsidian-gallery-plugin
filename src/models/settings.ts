import { IImmichConnection } from './interfaces';

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
    immichConnections: IImmichConnection[];
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
    immichConnections: []
};
