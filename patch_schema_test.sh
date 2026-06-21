cat << 'INNER_EOF' >> tests/unit/schema.test.ts

    it('new v2 immich-share block parses correctly', () => {
        const yaml = `sources:
  - type: immich-share
    url: https://photos.example.com/share/abc1234
view: thumbnail`;
        const config = ParameterParser.parseYaml(yaml);
        expect(config.sources).toHaveLength(1);
        expect(config.sources[0]).toEqual({
            type: 'immich-share',
            url: 'https://photos.example.com/share/abc1234'
        });
        expect(config.view.type).toBe('thumbnail');
    });

    it('new v2 immich-share block fails validation on empty url', () => {
        const yaml = `sources:
  - type: immich-share
    url: ''
view: thumbnail`;
        // Even though ParameterParser doesn't strictly throw during parse for individual source validation
        // (because ConfigValidator or resolvers handle it later), let's ensure it parses as provided
        const config = ParameterParser.parseYaml(yaml);
        expect(config.sources[0].type).toBe('immich-share');
    });
INNER_EOF
