import { ObjectUrlManager } from '../../src/utils/ObjectUrlManager';

describe('ObjectUrlManager', () => {
    let mockCreateObjectURL: jest.Mock;
    let mockRevokeObjectURL: jest.Mock;

    beforeEach(() => {
        // Clear entries left by the previous test before installing fresh mocks,
        // so those revocations are not counted against this test
        ObjectUrlManager.cleanupAll();

        mockCreateObjectURL = jest.fn((blob) => `blob:mock-url-${blob.size}`);
        mockRevokeObjectURL = jest.fn();

        global.URL.createObjectURL = mockCreateObjectURL as any;
        global.URL.revokeObjectURL = mockRevokeObjectURL as any;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should create a new object URL and set ref count to 1', () => {
        const blob = new Blob(['test']);
        const key = 'test-key-1';

        const url = ObjectUrlManager.create(key, blob);

        expect(mockCreateObjectURL).toHaveBeenCalledWith(blob);
        expect(url).toBe('blob:mock-url-4');
        expect(ObjectUrlManager.getStats().totalEntries).toBe(1);
    });

    it('should acquire an existing object URL and increment ref count', () => {
        const blob = new Blob(['test']);
        const key = 'test-key-2';

        const url1 = ObjectUrlManager.create(key, blob);
        const url2 = ObjectUrlManager.acquire(key);

        expect(url1).toBe(url2);
        expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
        expect(ObjectUrlManager.getStats().totalEntries).toBe(1);
    });

    it('should return undefined when acquiring a non-existent key', () => {
        const url = ObjectUrlManager.acquire('non-existent-key');
        expect(url).toBeUndefined();
    });

    it('should decrement ref count on release and revoke URL when it reaches 0', () => {
        const blob = new Blob(['test']);
        const key = 'test-key-3';

        const url = ObjectUrlManager.create(key, blob);

        // Acquire once more, ref count = 2
        ObjectUrlManager.acquire(key);

        // Release once, ref count = 1
        ObjectUrlManager.releaseByUrl(url);
        expect(mockRevokeObjectURL).not.toHaveBeenCalled();
        expect(ObjectUrlManager.getStats().totalEntries).toBe(1);

        // Release again, ref count = 0
        ObjectUrlManager.releaseByUrl(url);
        expect(mockRevokeObjectURL).toHaveBeenCalledWith(url);
        expect(ObjectUrlManager.getStats().totalEntries).toBe(0);
    });

    it('should handle release of non-existent URL gracefully', () => {
        expect(() => {
            ObjectUrlManager.releaseByUrl('blob:non-existent');
        }).not.toThrow();
    });

    it('should cleanup all URLs', () => {
        const blob1 = new Blob(['test1']);
        const blob2 = new Blob(['test2']);

        ObjectUrlManager.create('key1', blob1);
        ObjectUrlManager.create('key2', blob2);

        expect(ObjectUrlManager.getStats().totalEntries).toBe(2);

        ObjectUrlManager.cleanupAll();

        expect(mockRevokeObjectURL).toHaveBeenCalledTimes(2);
        expect(ObjectUrlManager.getStats().totalEntries).toBe(0);
    });

    describe('getOrCreate', () => {
        it('should fetch and create a URL when none exists', async () => {
            const fetchBlob = jest.fn().mockResolvedValue(new Blob(['abc']));

            const url = await ObjectUrlManager.getOrCreate('k', fetchBlob);

            expect(url).toBe('blob:mock-url-3');
            expect(fetchBlob).toHaveBeenCalledTimes(1);
            expect(ObjectUrlManager.getStats().totalEntries).toBe(1);
        });

        it('should reuse an existing URL without fetching', async () => {
            const existing = ObjectUrlManager.create('k', new Blob(['abc']));
            const fetchBlob = jest.fn();

            const url = await ObjectUrlManager.getOrCreate('k', fetchBlob);

            expect(url).toBe(existing);
            expect(fetchBlob).not.toHaveBeenCalled();
        });

        it('should fetch once for concurrent requests and give each caller its own reference', async () => {
            let resolveFetch: (blob: Blob) => void = () => {};
            const fetchBlob = jest.fn(() => new Promise<Blob>(resolve => { resolveFetch = resolve; }));

            const first = ObjectUrlManager.getOrCreate('k', fetchBlob);
            const second = ObjectUrlManager.getOrCreate('k', fetchBlob);
            resolveFetch(new Blob(['abc']));
            const [url1, url2] = await Promise.all([first, second]);

            expect(fetchBlob).toHaveBeenCalledTimes(1);
            expect(url1).toBe(url2);

            // Two references: the URL survives the first release and is revoked by the second
            ObjectUrlManager.releaseByUrl(url1);
            expect(mockRevokeObjectURL).not.toHaveBeenCalled();
            ObjectUrlManager.releaseByUrl(url2);
            expect(mockRevokeObjectURL).toHaveBeenCalledWith(url1);
        });

        it('should reject every waiting caller when the fetch fails, and fetch again on the next call', async () => {
            const fetchBlob = jest.fn()
                .mockRejectedValueOnce(new Error('boom'))
                .mockResolvedValueOnce(new Blob(['abc']));

            await expect(Promise.all([
                ObjectUrlManager.getOrCreate('k', fetchBlob),
                ObjectUrlManager.getOrCreate('k', fetchBlob)
            ])).rejects.toThrow('boom');
            expect(ObjectUrlManager.getStats().totalEntries).toBe(0);

            await expect(ObjectUrlManager.getOrCreate('k', fetchBlob)).resolves.toBe('blob:mock-url-3');
            expect(fetchBlob).toHaveBeenCalledTimes(2);
        });
    });
});
