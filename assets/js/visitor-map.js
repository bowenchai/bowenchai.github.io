(function () {
  'use strict';
  const root = document.getElementById('visitorMap');
  if (!root) return;
  const original = new URL(root.dataset.mapSrc, document.baseURI);
  const nativeWidth = Number(original.searchParams.get('w'));
  if (original.origin !== 'https://mapmyvisitors.com' || original.pathname !== '/map.js' || nativeWidth !== 480) return;
  const channel = 'homepage-visitor-map';
  const entries = new Map();
  let activeMode;

  function theme() {
    const explicit = document.documentElement.getAttribute('data-theme');
    const dark = explicit ? explicit === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    const styles = getComputedStyle(document.documentElement);
    const color = (name, fallback) => {
      const value = styles.getPropertyValue(name).trim();
      return /^#[0-9a-f]{6}$/i.test(value) ? value.slice(1).toLowerCase() : fallback;
    };
    return {
      mode: dark ? 'dark' : 'light',
      background: color('--luka-bg', dark ? '1a1917' : 'faf9f7'),
      text: color('--luka-text', dark ? 'd1cec7' : '3d3929')
    };
  }

  function fit(entry) {
    const displayWidth = Math.min(240, root.clientWidth);
    if (!(displayWidth > 0)) return;
    const scale = displayWidth / nativeWidth;
    entry.frame.style.width = nativeWidth + 'px';
    entry.frame.style.height = entry.height + 'px';
    entry.frame.style.transform = 'scale(' + scale + ')';
    entry.frame.style.visibility = entry.measured ? 'visible' : 'hidden';
    entry.viewport.style.height = entry.measured ? entry.height * scale + 'px' : 'auto';
    entry.frame.contentWindow.postMessage({ channel, kind: 'configure', mode: entry.mode, scale }, window.location.origin);
  }

  function create(settings) {
    const url = new URL(original.href);
    url.searchParams.set('co', settings.background);
    url.searchParams.set('ct', settings.text);
    const viewport = document.createElement('div');
    viewport.className = 'visitor-map-viewport';
    const frame = document.createElement('iframe');
    frame.className = 'visitor-map-frame';
    frame.title = 'Visitor map (' + settings.mode + ' theme)';
    frame.setAttribute('scrolling', 'no');
    const frameURL = new URL('assets/visitor-map/renderer.html', document.baseURI);
    frameURL.searchParams.set('widget', url.href);
    frameURL.searchParams.set('mode', settings.mode);
    frameURL.searchParams.set('scale', String(Math.min(240, root.clientWidth || 240) / nativeWidth));
    frameURL.searchParams.set('v', 'fit-theme-1');
    frame.src = frameURL.href;
    const status = document.createElement('p');
    status.className = 'visitor-map-status';
    status.textContent = 'Loading visitor map…';
    viewport.appendChild(status);
    viewport.appendChild(frame);
    root.appendChild(viewport);
    const entry = { mode: settings.mode, viewport, frame, status, measured: false, height: 1 };
    entries.set(settings.mode, entry);
    frame.addEventListener('load', () => fit(entry));
    frame.addEventListener('error', () => { status.textContent = 'Visitor map is currently unavailable.'; });
    return entry;
  }

  function sync() {
    const settings = theme();
    activeMode = settings.mode;
    const active = entries.get(activeMode) || create(settings);
    entries.forEach(entry => { entry.viewport.hidden = entry !== active; });
    fit(active);
  }

  window.addEventListener('message', event => {
    if (event.origin !== window.location.origin) return;
    const data = event.data;
    if (!data || data.channel !== channel || data.kind !== 'measure') return;
    const entry = entries.get(data.mode);
    if (!entry || event.source !== entry.frame.contentWindow) return;
    if (data.nativeWidth !== nativeWidth || !Number.isFinite(data.nativeHeight) || data.nativeHeight <= 0 || data.nativeHeight > 10000) return;
    entry.height = data.nativeHeight;
    entry.measured = true;
    entry.status.hidden = true;
    root.dataset.mapHorizontalOverflow = data.horizontalOverflow ? 'true' : 'false';
    if (entry.mode === activeMode) fit(entry);
  });

  root.replaceChildren();
  new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if ('ResizeObserver' in window) new ResizeObserver(() => { const entry = entries.get(activeMode); if (entry) fit(entry); }).observe(root);
  window.addEventListener('resize', () => { const entry = entries.get(activeMode); if (entry) fit(entry); });
  sync();
})();
