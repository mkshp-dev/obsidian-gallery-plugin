interface ObjectUrlEntry {
    url: string;
    refCount: number;
    key: string;
}

/**
 * Manages the lifecycle of Object URLs to prevent memory leaks, for image blobs
 * fetched from remote providers (Immich, Nextcloud, and their share links).
 */
export class ObjectUrlManager {
    private static entriesByKey: Map<string, ObjectUrlEntry> = new Map();
    private static entriesByUrl: Map<string, ObjectUrlEntry> = new Map();
    /** Blob fetches in progress, so concurrent requests for the same key download once */
    private static pendingByKey: Map<string, Promise<void>> = new Map();

    /**
     * Returns an object URL for `key`, acquiring the existing one or fetching and creating it.
     * Concurrent calls for the same key share one fetch. Each successful call holds one
     * reference, which the caller must give back with releaseByUrl.
     * @param key A stable identifier for the underlying resource
     * @param fetchBlob Downloads the resource; only called when no URL exists or is being fetched
     */
    public static async getOrCreate(key: string, fetchBlob: () => Promise<Blob>): Promise<string> {
        const existing = this.acquire(key);
        if (existing) {
            return existing;
        }

        let pending = this.pendingByKey.get(key);
        if (!pending) {
            pending = fetchBlob()
                .then(blob => {
                    // Registered without a reference; every waiting caller acquires its own below
                    const url = URL.createObjectURL(blob);
                    const entry: ObjectUrlEntry = { url, refCount: 0, key };
                    this.entriesByKey.set(key, entry);
                    this.entriesByUrl.set(url, entry);
                })
                .finally(() => this.pendingByKey.delete(key));
            this.pendingByKey.set(key, pending);
        }

        await pending;
        const url = this.acquire(key);
        if (!url) {
            throw new Error(`Object URL for '${key}' was revoked before it could be used`);
        }
        return url;
    }

    /**
     * Tries to acquire an existing object URL for the given key.
     * If found, increments the reference count and returns the URL.
     * @param key A stable identifier for the underlying resource (e.g. 'immich:conn1:asset123:original')
     * @returns The object URL if it exists, otherwise undefined.
     */
    public static acquire(key: string): string | undefined {
        const entry = this.entriesByKey.get(key);
        if (entry) {
            entry.refCount++;
            return entry.url;
        }
        return undefined;
    }

    /**
     * Creates a new object URL for the given blob and registers it with the given key.
     * Initializes the reference count to 1.
     * @param key A stable identifier for the underlying resource
     * @param blob The blob to create the URL for
     * @returns The newly created object URL
     */
    public static create(key: string, blob: Blob): string {
        const url = URL.createObjectURL(blob);
        const entry: ObjectUrlEntry = { url, refCount: 1, key };

        this.entriesByKey.set(key, entry);
        this.entriesByUrl.set(url, entry);

        return url;
    }

    /**
     * Decrements the reference count for the given object URL.
     * If the reference count reaches 0, the URL is revoked and removed from the registry.
     * @param url The object URL to release
     */
    public static releaseByUrl(url: string): void {
        const entry = this.entriesByUrl.get(url);
        if (entry) {
            entry.refCount--;
            if (entry.refCount <= 0) {
                URL.revokeObjectURL(entry.url);
                if (this.entriesByKey.get(entry.key) === entry) {
                    this.entriesByKey.delete(entry.key);
                }
                this.entriesByUrl.delete(entry.url);
            }
        }
    }

    /**
     * Used mainly for testing/debugging.
     */
    public static getStats(): { totalEntries: number } {
        return { totalEntries: this.entriesByKey.size };
    }

    /**
     * Used mainly for testing/debugging. Revokes all managed URLs.
     */
    public static cleanupAll(): void {
        for (const entry of this.entriesByKey.values()) {
            URL.revokeObjectURL(entry.url);
        }
        this.entriesByKey.clear();
        this.entriesByUrl.clear();
        this.pendingByKey.clear();
    }
}
