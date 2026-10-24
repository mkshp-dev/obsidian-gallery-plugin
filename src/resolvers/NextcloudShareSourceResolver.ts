import { INextcloudShareSourceConfig, IImageSource } from '../models/interfaces';
import { GallerySourceResolver, GallerySourceResolveContext } from './GallerySourceResolver';
import { ImageSource } from '../models/ImageSource';
import { Logger } from '../utils/Logger';
import { ObjectUrlManager } from '../utils/ObjectUrlManager';
import { requestUrl } from 'obsidian';
import { globToRegex } from '../utils/globToRegex';

interface ShareFile {
    href: string;
    name: string;
    contentType: string;
    size: number;
    lastModified?: string;
}

export class NextcloudShareSourceResolver implements GallerySourceResolver<INextcloudShareSourceConfig> {
    readonly type = 'nextcloud-share';

    /** Upper bound on folders listed for one share, so a huge share cannot run away */
    private static readonly MAX_FOLDERS = 200;

    async resolve(source: INextcloudShareSourceConfig, context: GallerySourceResolveContext): Promise<{ images: IImageSource[], errors: string[] }> {
        const images: IImageSource[] = [];
        const errors: string[] = [];

        if (!source.url) {
            errors.push('Nextcloud share source is missing a URL.');
            return { images, errors };
        }

        let urlObj: URL;
        try {
            urlObj = new URL(source.url);
        } catch {
            errors.push(`Invalid URL format: ${source.url}`);
            return { images, errors };
        }

        // Parse share token and base URL from various Nextcloud share link formats:
        // - https://cloud.example.com/s/TOKEN
        // - https://cloud.example.com/index.php/s/TOKEN
        // - https://cloud.example.com/apps/photos/public/TOKEN
        // - https://cloud.example.com/index.php/apps/photos/public/TOKEN
        const knownPatterns = [
            { regex: /(.*)\/(?:index\.php\/)?apps\/photos\/public\/([a-zA-Z0-9_-]+)/, isPhotosApp: true },
            { regex: /(.*)\/(?:index\.php\/)?s\/([a-zA-Z0-9_-]+)/, isPhotosApp: false },
            { regex: /(.*)\/(?:index\.php\/)?apps\/files\/s\/([a-zA-Z0-9_-]+)/, isPhotosApp: false },
            { regex: /(.*)\/(?:index\.php\/)?public_shares\/([a-zA-Z0-9_-]+)/, isPhotosApp: false }
        ];

        let token = '';
        let basePath = '';
        let isPhotosApp = false;

        for (const pattern of knownPatterns) {
            const match = urlObj.pathname.match(pattern.regex);
            if (match) {
                basePath = match[1];
                token = match[2];
                isPhotosApp = pattern.isPhotosApp;
                break;
            }
        }

        // Fallback: if no pattern matched, try extracting last non-empty path segment as token
        if (!token) {
            const segments = urlObj.pathname.split('/').filter(Boolean);
            if (segments.length > 0) {
                token = segments[segments.length - 1];
                basePath = urlObj.pathname.substring(0, urlObj.pathname.lastIndexOf('/' + token));
            }
        }

        if (!token) {
            errors.push(`Invalid Nextcloud share URL: ${source.url}`);
            return { images, errors };
        }

        // Strip /index.php if present in basePath
        basePath = basePath.replace(/\/index\.php\/?$/, '');

        const baseUrl = `${urlObj.origin}${basePath}`;
        const password = source.password || '';

        const propfindBody = `<?xml version="1.0"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:resourcetype/>
    <d:getcontenttype/>
    <d:getcontentlength/>
    <d:getlastmodified/>
    <d:displayname/>
  </d:prop>
</d:propfind>`;

        // Construct primary and fallback configurations
        const strategies: Array<{ name: string; url: string; headers: Record<string, string>; requiresAuth: boolean }> = [];

        if (isPhotosApp) {
            // Nextcloud Photos app public album WebDAV endpoint (unauthenticated)
            strategies.push({
                name: 'photospublic',
                url: `${baseUrl}/remote.php/dav/photospublic/${token}/`,
                headers: { 'Content-Type': 'text/xml; charset=utf-8' },
                requiresAuth: false
            });
            // Fallback to standard public.php/webdav/
            const authString = `${token}:${password}`;
            strategies.push({
                name: 'webdav',
                url: `${baseUrl}/public.php/webdav/`,
                headers: {
                    'Authorization': `Basic ${btoa(authString)}`,
                    'X-Requested-With': 'XMLHttpRequest',
                    'Content-Type': 'text/xml; charset=utf-8'
                },
                requiresAuth: true
            });
        } else {
            // Standard files public share WebDAV endpoint
            const authString = `${token}:${password}`;
            strategies.push({
                name: 'webdav',
                url: `${baseUrl}/public.php/webdav/`,
                headers: {
                    'Authorization': `Basic ${btoa(authString)}`,
                    'X-Requested-With': 'XMLHttpRequest',
                    'Content-Type': 'text/xml; charset=utf-8'
                },
                requiresAuth: true
            });
            // Fallback to photospublic
            strategies.push({
                name: 'photospublic',
                url: `${baseUrl}/remote.php/dav/photospublic/${token}/`,
                headers: { 'Content-Type': 'text/xml; charset=utf-8' },
                requiresAuth: false
            });
        }

        let lastStatus = 0;
        let lastErrorText = '';

        const propfind = (url: string, headers: Record<string, string>) => requestUrl({
            url,
            method: 'PROPFIND',
            headers: { ...headers, 'Depth': '1' },
            body: propfindBody
        });

        for (const strat of strategies) {
            try {
                const response = await propfind(strat.url, strat.headers);

                lastStatus = response.status;

                if (response.status === 200 || response.status === 207) {
                    const listing = this.parseWebdavResponse(response.text, source.filters?.mimeTypes);
                    let files = listing.files;

                    // Folder shares are walked one level at a time (Depth: infinity is often disabled).
                    // Photos albums are flat, so only the files share needs this.
                    if (strat.name === 'webdav' && source.recursive !== false) {
                        files = files.concat(await this.listSubfolders(listing.folders, urlObj.origin, strat.headers, source.filters?.mimeTypes, propfind));
                    }

                    const { minSizeKb, maxSizeKb } = source.filters ?? {};
                    if (minSizeKb !== undefined) files = files.filter(file => file.size >= minSizeKb * 1024);
                    if (maxSizeKb !== undefined) files = files.filter(file => file.size <= maxSizeKb * 1024);

                    if (source.filenameFilter) {
                        const regex = globToRegex(source.filenameFilter);
                        files = files.filter(file => regex.test(file.name));
                    }

                    if (source.sort) {
                        const { by, order } = source.sort;
                        files.sort((a, b) => {
                            let comparison = 0;
                            if (by === 'name') {
                                comparison = a.name.localeCompare(b.name);
                            } else if (by === 'size') {
                                comparison = (a.size || 0) - (b.size || 0);
                            } else if (by === 'lastModified') {
                                const dateA = a.lastModified ? new Date(a.lastModified).getTime() : 0;
                                const dateB = b.lastModified ? new Date(b.lastModified).getTime() : 0;
                                comparison = dateA - dateB;
                            }
                            return order === 'desc' ? -comparison : comparison;
                        });
                    }

                    if (source.limit && source.limit > 0) {
                        files = files.slice(0, source.limit);
                    }

                    const fileHeaders: Record<string, string> = strat.requiresAuth ? {
                        'Authorization': strat.headers['Authorization'],
                        'X-Requested-With': 'XMLHttpRequest'
                    } : {};

                    for (const file of files) {
                        try {
                            const fileUrl = `${urlObj.origin}${file.href}`;
                            const cacheKey = `nextcloud-share:${token}:${file.href}`;
                            const logicalPath = `nextcloud-share://${token}${file.href}`;

                            // File contents are fetched lazily, when a view first displays the image
                            const loader = () => ObjectUrlManager.getOrCreate(cacheKey, async () => {
                                const fileRes = await requestUrl({
                                    url: fileUrl,
                                    method: 'GET',
                                    headers: fileHeaders
                                });

                                if (fileRes.status !== 200) {
                                    throw new Error(`Failed to fetch file. Status: ${fileRes.status}`);
                                }

                                const contentType = typeof fileRes.headers['content-type'] === 'string' ? fileRes.headers['content-type'] : 'image/jpeg';
                                return new Blob([fileRes.arrayBuffer], { type: contentType });
                            });

                            images.push(new ImageSource(logicalPath, 'nextcloud-share', file.name, undefined, undefined, loader));
                        } catch (e) {
                            Logger.warn(`Failed to resolve file ${file.href} for Nextcloud share: ${e instanceof Error ? e.message : String(e)}`);
                        }
                    }

                    return { images, errors };
                }

                if (response.status === 401 && strat.requiresAuth) {
                    lastErrorText = password
                        ? 'Authentication failed. Incorrect password for Nextcloud share.'
                        : 'Authentication failed. Nextcloud share is password-protected.';
                }
            } catch (error) {
                Logger.debug(`Strategy ${strat.name} failed for share ${token}:`, error);
            }
        }

        if (lastErrorText) {
            errors.push(lastErrorText);
        } else if (lastStatus === 404) {
            errors.push('Nextcloud share not found or expired.');
        } else {
            errors.push(`Failed to list files from Nextcloud share (HTTP ${lastStatus || 'error'})`);
        }

        return { images, errors };
    }

    /**
     * List every folder below `folders` (breadth-first, Depth 1 per request) and return their image files.
     * A sub-folder that fails to list is skipped rather than failing the whole share.
     */
    private async listSubfolders(
        folders: string[],
        origin: string,
        headers: Record<string, string>,
        mimeTypes: string[] | undefined,
        propfind: (url: string, headers: Record<string, string>) => Promise<{ status: number; text: string }>
    ): Promise<ShareFile[]> {
        const files: ShareFile[] = [];
        const queue = [...folders];
        const visited = new Set<string>();

        while (queue.length > 0 && visited.size < NextcloudShareSourceResolver.MAX_FOLDERS) {
            const href = queue.shift()!;
            if (visited.has(href)) continue;
            visited.add(href);

            try {
                const response = await propfind(`${origin}${href}`, headers);
                if (response.status !== 200 && response.status !== 207) {
                    Logger.warn(`Skipping Nextcloud share folder ${href}: HTTP ${response.status}`);
                    continue;
                }
                const listing = this.parseWebdavResponse(response.text, mimeTypes);
                files.push(...listing.files);
                queue.push(...listing.folders);
            } catch (error) {
                Logger.warn(`Skipping Nextcloud share folder ${href}:`, error);
            }
        }

        if (queue.length > 0) {
            Logger.warn(`Nextcloud share has more than ${NextcloudShareSourceResolver.MAX_FOLDERS} folders; the rest were not listed`);
        }
        return files;
    }

    /**
     * Parse a Depth 1 PROPFIND: the image files it lists, and the raw (still URL-encoded) hrefs of
     * its sub-folders. The first response is the listed folder itself and is not a sub-folder.
     */
    private parseWebdavResponse(xmlText: string, mimeTypesFilter?: string[]): { files: ShareFile[]; folders: string[] } {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        const responses = xmlDoc.getElementsByTagNameNS('DAV:', 'response');

        const responsesList = responses.length > 0 ? Array.from(responses) : Array.from(xmlDoc.getElementsByTagName('d:response'));
        const files: ShareFile[] = [];
        const folders: string[] = [];

        let validImageMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (mimeTypesFilter && mimeTypesFilter.length > 0) {
            validImageMimeTypes = validImageMimeTypes.filter(mime => mimeTypesFilter.includes(mime));
        }

        for (const response of responsesList) {
            let href = '';
            const hrefElements = response.getElementsByTagNameNS('DAV:', 'href');
            if (hrefElements.length > 0) {
                href = hrefElements[0].textContent || '';
            } else {
                const fallbackHref = response.getElementsByTagName('d:href');
                if (fallbackHref.length > 0) href = fallbackHref[0].textContent || '';
            }

            if (!href) continue;

            const decodedHref = decodeURIComponent(href);

            let isCollection = false;
            let contentType = '';
            let displayName = '';
            let contentLength = 0;
            let lastModified = '';

            const propstatList = response.getElementsByTagNameNS('DAV:', 'propstat');
            const propstats = propstatList.length > 0 ? Array.from(propstatList) : Array.from(response.getElementsByTagName('d:propstat'));

            for (const propstat of propstats) {
                let status = '';
                const statusEl = propstat.getElementsByTagNameNS('DAV:', 'status')[0] || propstat.getElementsByTagName('d:status')[0];
                if (statusEl) status = statusEl.textContent || '';

                if (status && !status.includes('200 OK')) {
                    continue;
                }

                const props = propstat.getElementsByTagNameNS('DAV:', 'prop')[0] || propstat.getElementsByTagName('d:prop')[0];
                if (!props) continue;

                const resTypeEl = props.getElementsByTagNameNS('DAV:', 'resourcetype')[0] || props.getElementsByTagName('d:resourcetype')[0];
                if (resTypeEl) {
                    const collection = resTypeEl.getElementsByTagNameNS('DAV:', 'collection')[0] || resTypeEl.getElementsByTagName('d:collection')[0];
                    if (collection) {
                        isCollection = true;
                    }
                }

                const ctEl = props.getElementsByTagNameNS('DAV:', 'getcontenttype')[0] || props.getElementsByTagName('d:getcontenttype')[0];
                if (ctEl) contentType = ctEl.textContent || '';

                const clEl = props.getElementsByTagNameNS('DAV:', 'getcontentlength')[0] || props.getElementsByTagName('d:getcontentlength')[0];
                if (clEl) contentLength = parseInt(clEl.textContent || '0', 10);

                const lmEl = props.getElementsByTagNameNS('DAV:', 'getlastmodified')[0] || props.getElementsByTagName('d:getlastmodified')[0];
                if (lmEl) lastModified = lmEl.textContent || '';

                const dispEl = props.getElementsByTagNameNS('DAV:', 'displayname')[0] || props.getElementsByTagName('d:displayname')[0];
                if (dispEl) displayName = dispEl.textContent || '';
            }

            if (isCollection) {
                if (response !== responsesList[0]) folders.push(href.startsWith('/') ? href : `/${href}`);
                continue;
            }

            if (validImageMimeTypes.includes(contentType)) {
                let name = displayName;
                if (!name) {
                    const parts = decodedHref.replace(/\/$/, '').split('/');
                    name = parts[parts.length - 1];
                    if (!name) name = 'shared-image';
                }

                files.push({
                    href: decodedHref.startsWith('/') ? decodedHref : `/${decodedHref}`,
                    name,
                    contentType,
                    size: contentLength,
                    lastModified
                });
            }
        }

        return { files, folders };
    }
}
