import { Logger } from '../Logger';

export class ImmichHelpers {
    public static normalizeBaseUrl(url: string): string {
        try {
            const urlObj = new URL(url);
            // Remove trailing slash if present
            return urlObj.origin + urlObj.pathname.replace(/\/$/, '');
        } catch {
            Logger.warn('Invalid base URL provided to ImmichHelpers', url);
            return url.replace(/\/$/, '');
        }
    }
}
