import posthog from 'posthog-js/dist/module.full.no-external';

declare const __POSTHOG_TOKEN__: string;
declare const __POSTHOG_HOST__: string;

export function initPostHog(): void {
    if (!__POSTHOG_TOKEN__) return;
    posthog.init(__POSTHOG_TOKEN__, {
        api_host: __POSTHOG_HOST__ || 'https://eu.i.posthog.com',
        defaults: '2026-05-30',
    });
}

export { posthog };
