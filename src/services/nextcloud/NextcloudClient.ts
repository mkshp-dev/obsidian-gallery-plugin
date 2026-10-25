import { requestUrl, RequestUrlResponse } from 'obsidian';
import { INextcloudConnection } from '../../models/interfaces';
import { NextcloudFile } from '../../models/nextcloud/NextcloudTypes';
import { Logger } from '../../utils/Logger';
import { ObjectUrlManager } from '../../utils/ObjectUrlManager';

interface CacheEntry<T> {
  promise: Promise<T>;
  timestamp: number;
}

export class NextcloudClient {
  private static cache: Map<string, CacheEntry<NextcloudFile[]>> = new Map();
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000;

  private baseUrl: string;
  private connection: INextcloudConnection;

  constructor(connection: INextcloudConnection) {
    this.connection = connection;
    this.baseUrl = connection.baseUrl.replace(/\/+$/, '');
  }

  public static invalidateCache(connectionKey?: string) {
    if (connectionKey) {
      // Find all cache keys that start with this connection key
      const keysToDelete = Array.from(NextcloudClient.cache.keys()).filter(key => key.startsWith(`${connectionKey}:`));
      for (const key of keysToDelete) {
        NextcloudClient.cache.delete(key);
      }
    } else {
      NextcloudClient.cache.clear();
    }
  }

  private getHeaders(): Record<string, string> {
    const authString = `${this.connection.username}:${this.connection.appPassword}`;
    const base64Auth = btoa(authString);
    return {
      'Authorization': `Basic ${base64Auth}`
    };
  }

  public async validateConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const url = `${this.baseUrl}/remote.php/dav/files/${encodeURIComponent(this.connection.username)}/`;

      const response = await requestUrl({
        url: url,
        method: 'PROPFIND',
        headers: {
          ...this.getHeaders(),
          'Depth': '0'
        }
      });

      if (response.status === 200 || response.status === 207) {
        return { success: true, message: 'Connected successfully' };
      } else if (response.status === 401 || response.status === 403) {
        return { success: false, message: 'Authentication failed. Please check your credentials.' };
      } else if (response.status === 404) {
        return { success: false, message: 'Nextcloud WebDAV endpoint not found.' };
      } else {
        return { success: false, message: `Connection failed with status: ${response.status}` };
      }
    } catch (error) {
      Logger.error('Failed to validate Nextcloud connection:', error);
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error occurred' };
    }
  }

  public async listFiles(path: string, recursive: boolean = false, mimeTypesFilter?: string[]): Promise<NextcloudFile[]> {
    const cacheKey = `${this.connection.key}:${path}:${recursive}:${mimeTypesFilter ? mimeTypesFilter.join(',') : ''}`;
    const now = Date.now();
    const cached = NextcloudClient.cache.get(cacheKey);

    if (cached && (now - cached.timestamp < NextcloudClient.CACHE_TTL_MS)) {
      return cached.promise;
    }

    const promise = this.performListFiles(path, recursive, mimeTypesFilter);
    NextcloudClient.cache.set(cacheKey, { promise, timestamp: now });

    try {
      return await promise;
    } catch (error) {
      NextcloudClient.cache.delete(cacheKey);
      throw error;
    }
  }

  private async performListFiles(path: string, recursive: boolean, mimeTypesFilter?: string[]): Promise<NextcloudFile[]> {
    try {
      // Normalize path
      let normalizedPath = path.startsWith('/') ? path : `/${path}`;
      if (!normalizedPath.endsWith('/')) {
        normalizedPath += '/';
      }

      const url = `${this.baseUrl}/remote.php/dav/files/${encodeURIComponent(this.connection.username)}${normalizedPath}`;

      // throw: false so failures can name the folder and server instead of "Request failed, status 404"
      const response = await requestUrl({
        url: url,
        method: 'PROPFIND',
        headers: {
          ...this.getHeaders(),
          'Depth': recursive ? 'infinity' : '1'
        },
        throw: false
      });

      if (response.status === 404) {
        throw new Error(`Folder '${normalizedPath}' not found on ${this.baseUrl} (connection '${this.connection.key}')`);
      }
      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed for ${this.baseUrl} (connection '${this.connection.key}'). Check the username and app password.`);
      }
      if (response.status !== 200 && response.status !== 207) {
        throw new Error(`Failed to list files in '${normalizedPath}' on ${this.baseUrl}. Status: ${response.status}`);
      }

      return this.parseWebdavResponse(response.text, normalizedPath, mimeTypesFilter);
    } catch (error) {
      Logger.error(`Failed to list Nextcloud files at path ${path}:`, error);
      throw error;
    }
  }

  /**
   * Fetch a file as a blob URL. 'thumbnail' (256 px) and 'large' (2048 px) use Nextcloud's preview
   * endpoint, keeping the aspect ratio, and fall back to the original file if previews fail.
   */
  public async getFileBlobUrl(path: string, representation: 'thumbnail' | 'large' | 'original', fileId?: string): Promise<string> {
    // Stable key for ObjectUrlManager: connectionKey + representation + path
    const urlKey = `nextcloud:${this.connection.key}:${representation}:${path}`;
    try {
      return await ObjectUrlManager.getOrCreate(urlKey, () => this.fetchFileBlob(path, representation, fileId));
    } catch (error) {
      Logger.error(`Failed to get file blob URL for Nextcloud file at path ${path}:`, error);
      throw error;
    }
  }

  private async fetchFileBlob(path: string, representation: 'thumbnail' | 'large' | 'original', fileId?: string): Promise<Blob> {
    // Normalize path
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const originalUrl = `${this.baseUrl}/remote.php/dav/files/${encodeURIComponent(this.connection.username)}${normalizedPath}`;

    let response: RequestUrlResponse;
    if (representation !== 'original' && fileId) {
      const size = representation === 'large' ? 2048 : 256;
      // a=1 keeps the image's aspect ratio (Nextcloud crops previews to x*y by default).
      // throw: false so a failed preview (e.g. preview generation disabled) reaches the fallback below
      response = await requestUrl({
        url: `${this.baseUrl}/index.php/core/preview?fileId=${fileId}&x=${size}&y=${size}&a=1`,
        method: 'GET',
        headers: this.getHeaders(),
        throw: false
      });

      // Fallback for thumbnail if preview endpoint fails
      if (response.status !== 200) {
        Logger.debug(`Preview (${representation}) failed for ${fileId}, falling back to original`);
        response = await requestUrl({ url: originalUrl, method: 'GET', headers: this.getHeaders() });
      }
    } else {
      response = await requestUrl({ url: originalUrl, method: 'GET', headers: this.getHeaders() });
    }

    if (response.status !== 200) {
      throw new Error(`Failed to fetch file. Status: ${response.status}`);
    }

    // Convert array buffer to blob
    const contentType = typeof response.headers['content-type'] === 'string' ? response.headers['content-type'] : 'image/jpeg';
    return new Blob([response.arrayBuffer], { type: contentType });
  }

  private parseWebdavResponse(xmlText: string, basePath: string, mimeTypesFilter?: string[]): NextcloudFile[] {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    const responses = xmlDoc.getElementsByTagNameNS('DAV:', 'response');

    // If namespaces aren't working as expected in the environment, fallback to tagname
    const responsesList = responses.length > 0 ? Array.from(responses) : Array.from(xmlDoc.getElementsByTagName('d:response'));

    const files: NextcloudFile[] = [];
    let validImageMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (mimeTypesFilter && mimeTypesFilter.length > 0) {
        validImageMimeTypes = validImageMimeTypes.filter(mime => mimeTypesFilter.includes(mime));
    }

    for (const response of responsesList) {
      // Extract href
      let href = '';
      const hrefElements = response.getElementsByTagNameNS('DAV:', 'href');
      if (hrefElements.length > 0) {
        href = hrefElements[0].textContent || '';
      } else {
        const fallbackHref = response.getElementsByTagName('d:href');
        if (fallbackHref.length > 0) href = fallbackHref[0].textContent || '';
      }

      if (!href) continue;

      // Ensure we decode the URL to match paths properly
      const decodedHref = decodeURIComponent(href);

      // We need to exclude the directory itself.
      // Compare without trailing slashes for safety
      const reqPath = `/remote.php/dav/files/${this.connection.username}${basePath}`;
      if (decodedHref.replace(/\/$/, '') === reqPath.replace(/\/$/, '')) {
        continue;
      }

      // Extract properties
      let contentType = '';
      let contentLength = 0;
      let lastModified = '';
      let fileId = '';

      // Try namespace aware first
      const propstatList = response.getElementsByTagNameNS('DAV:', 'propstat');
      const propstats = propstatList.length > 0 ? Array.from(propstatList) : Array.from(response.getElementsByTagName('d:propstat'));

      for (const propstat of propstats) {
        // Only consider 200 OK properties
        let status = '';
        const statusEl = propstat.getElementsByTagNameNS('DAV:', 'status')[0] || propstat.getElementsByTagName('d:status')[0];
        if (statusEl) status = statusEl.textContent || '';

        if (status && !status.includes('200 OK')) {
          continue;
        }

        const props = propstat.getElementsByTagNameNS('DAV:', 'prop')[0] || propstat.getElementsByTagName('d:prop')[0];
        if (!props) continue;

        // Content Type
        const ctEl = props.getElementsByTagNameNS('DAV:', 'getcontenttype')[0] || props.getElementsByTagName('d:getcontenttype')[0];
        if (ctEl) contentType = ctEl.textContent || '';

        // Content Length
        const clEl = props.getElementsByTagNameNS('DAV:', 'getcontentlength')[0] || props.getElementsByTagName('d:getcontentlength')[0];
        if (clEl) contentLength = parseInt(clEl.textContent || '0', 10);

        // Last Modified
        const lmEl = props.getElementsByTagNameNS('DAV:', 'getlastmodified')[0] || props.getElementsByTagName('d:getlastmodified')[0];
        if (lmEl) lastModified = lmEl.textContent || '';

        // File ID (OwnCloud namespace)
        const ocIdEl = props.getElementsByTagNameNS('http://owncloud.org/ns', 'fileid')[0] || props.getElementsByTagName('oc:fileid')[0];
        if (ocIdEl) fileId = ocIdEl.textContent || '';
      }

      // Filter by image type
      if (validImageMimeTypes.includes(contentType)) {
        // Extract filename from href
        const parts = decodedHref.replace(/\/$/, '').split('/');
        const name = parts[parts.length - 1];

        // Path should be relative to the user's root
        const basePathPrefix = `/remote.php/dav/files/${this.connection.username}`;
        let path = decodedHref;
        if (path.startsWith(basePathPrefix)) {
          path = path.substring(basePathPrefix.length);
        }

        files.push({
          path,
          name,
          contentType,
          size: contentLength,
          lastModified,
          fileId
        });
      }
    }

    return files;
  }
}
