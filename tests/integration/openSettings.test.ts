import { EmptyState } from '../../src/views/components/EmptyState';

// Helper to attach minimal Obsidian-like DOM helpers to plain elements
function attachHelpers(el: any) {
  el.createDiv = (arg?: any) => {
    const d = document.createElement('div');
    if (typeof arg === 'string') d.className = arg;
    else if (arg && arg.cls) d.className = arg.cls;
    el.appendChild(d);
    attachHelpers(d);
    return d;
  };

  el.createEl = (tag: string, props?: any) => {
    const e = document.createElement(tag);
    if (props) {
      if (props.cls) e.className = props.cls;
      if (props.text) e.textContent = props.text;
    }
    el.appendChild(e);
    attachHelpers(e);
    return e;
  };

  el.createSpan = (cls?: string) => {
    const s = document.createElement('span');
    if (cls) s.className = cls;
    el.appendChild(s);
    attachHelpers(s);
    return s;
  };

  // Minimal classList helpers used in some code paths
  el.addClass = (c: string) => { el.classList.add(c); };
  el.removeClass = (c: string) => { el.classList.remove(c); };

  return el;
}

describe('EmptyState Open Settings action', () => {
  test('clicking Open Settings dispatches gallery-open-settings event', () => {
    const container = attachHelpers(document.createElement('div') as any);

    // Spy for the gallery-open-settings event
    const handler = jest.fn();
    document.addEventListener('gallery-open-settings', handler as EventListener);

    // Create EmptyState with a single action that dispatches the event
    EmptyState.createCustom(
      container,
      'External images blocked',
      'Remote images are blocked',
      { customDetails: 'Test' },
      [
        {
          label: 'Open Settings',
          action: () => {
            try { document.dispatchEvent(new CustomEvent('gallery-open-settings')); } catch {}
          },
          type: 'primary',
          icon: '⚙️'
        }
      ]
    );

    // Find the action button and click it
    const btn = container.querySelector('button.gallery-empty-action');
    expect(btn).toBeTruthy();
    (btn as HTMLButtonElement).click();

    expect(handler).toHaveBeenCalledTimes(1);

    // Cleanup
    document.removeEventListener('gallery-open-settings', handler as EventListener);
  });
});
