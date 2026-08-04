import { INextcloudShareSourceConfig, IImageSource } from '../models/interfaces';
import { GallerySourceResolver, GallerySourceResolveContext } from './GallerySourceResolver';
import { ImageSource } from '../models/ImageSource';
import { Logger } from '../utils/Logger';
import { ObjectUrlManager } from '../utils/immich/ObjectUrlManager';
import { requestUrl } from 'obsidian';

export class NextcloudShareSourceResolver implements GallerySourceResolver<INextcloudShareSourceConfig> {
    readonly type = 'nextcloud-share';

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

        // Parse share token
        // e.g. https://cloud.example.com/s/TOKEN
        const match = urlObj.pathname.match(/\/s\/([^/]+)/);
        if (!match) {
            errors.push('Invalid Nextcloud share URL. Expected format: https://cloud.example.com/s/{TOKEN}');
            return { images, errors };
        }
        const token = match[1];

        // Extract base URL correctly in case Nextcloud is hosted in a subdirectory
        const basePath = urlObj.pathname.substring(0, urlObj.pathname.indexOf('/s/'));
        const baseUrl = `${urlObj.origin}${basePath}`;
        const password = source.password || '';

        const webdavUrl = `${baseUrl}/public.php/webdav/`;

        const authString = `${token}:${password}`;
        const base64Auth = btoa(authString);
        const headers = {
            'Authorization': `Basic ${base64Auth}`,
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'text/xml; charset=utf-8'
        };

        try {
            const propfindBody = `<?xml version="1.0"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:resourcetype/>
    <d:getcontenttype/>
    <d:getcontentlength/>
    <d:displayname/>
  </d:prop>
</d:propfind>`;

            const response = await requestUrl({
                url: webdavUrl,
                method: 'PROPFIND',
                headers: {
                    ...headers,
                    'Depth': '1'
                },
                body: propfindBody
            });

            if (response.status === 401) {
                if (password) {
                    errors.push('Authentication failed. Incorrect password for Nextcloud share.');
                } else {
                    errors.push('Authentication failed. Nextcloud share is password-protected.');
                }
                return { images, errors };
            } else if (response.status === 404) {
                errors.push('Nextcloud share not found or expired.');
                return { images, errors };
            } else if (response.status !== 200 && response.status !== 207) {
                errors.push(`Failed to list files. Status: ${response.status}`);
                return { images, errors };
            }

            const files = this.parseWebdavResponse(response.text);

            const resolvedImages = await Promise.all(files.map(async (file) => {
                try {
                    const fileUrl = `${urlObj.origin}${file.href}`; // href typically includes full path

                    const cacheKey = `nextcloud-share:${token}:${file.href}`;
                    let blobUrl = ObjectUrlManager.acquire(cacheKey);

                    if (!blobUrl) {
                        const fileRes = await requestUrl({
                            url: fileUrl,
                            method: 'GET',
                            headers: {
                                'Authorization': `Basic ${base64Auth}`,
                                'X-Requested-With': 'XMLHttpRequest'
                            }
                        });

                        if (fileRes.status !== 200) {
                            throw new Error(`Failed to fetch file. Status: ${fileRes.status}`);
                        }

                        const contentType = typeof fileRes.headers['content-type'] === 'string' ? fileRes.headers['content-type'] : 'image/jpeg';
                        const blob = new Blob([fileRes.arrayBuffer], { type: contentType });
                        blobUrl = ObjectUrlManager.create(cacheKey, blob);
                    }

                    if (blobUrl) {
                        const logicalPath = `nextcloud-share://${token}${file.href}`;
                        return new ImageSource(logicalPath, 'nextcloud-share', file.name, blobUrl, undefined);
                    }
                    return null;
                } catch (e) {
                    Logger.warn(`Failed to load file ${file.href} for Nextcloud share: ${e instanceof Error ? e.message : String(e)}`);
                    return null;
                }
            }));

            for (const img of resolvedImages) {
                if (img !== null) {
                    images.push(img);
                }
            }

        } catch (error) {
            errors.push(error instanceof Error ? error.message : String(error));
        }

        return { images, errors };
    }

    private parseWebdavResponse(xmlText: string): Array<{ href: string, name: string, contentType: string }> {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        const responses = xmlDoc.getElementsByTagNameNS('DAV:', 'response');

        const responsesList = responses.length > 0 ? Array.from(responses) : Array.from(xmlDoc.getElementsByTagName('d:response'));
        const files: Array<{ href: string, name: string, contentType: string }> = [];
        const validImageMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

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

                const dispEl = props.getElementsByTagNameNS('DAV:', 'displayname')[0] || props.getElementsByTagName('d:displayname')[0];
                if (dispEl) displayName = dispEl.textContent || '';
            }

            if (isCollection) continue;

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
                    contentType
                });
            }
        }

        return files;
    }
}
