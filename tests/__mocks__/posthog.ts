// Jest test stub for the PostHog no-external bundle.
// The real bundle ships as ESM (`export ...`), which Jest/ts-jest cannot parse
// without additional transform config. Tests don't assert on PostHog behaviour,
// so we stub it out with no-op jest.fn implementations.
const posthog = {
    init: jest.fn(),
    capture: jest.fn(),
    identify: jest.fn(),
    reset: jest.fn(),
};

module.exports = posthog;
module.exports.default = posthog;
