(function () {
  'use strict';
  const options = new URL(window.location.href).searchParams;
  const channel = 'homepage-visitor-map';
  const mode = options.get('mode') === 'dark' ? 'dark' : 'light';
  const nativeWidth = 480;
  let scale = Number(options.get('scale'));
  if (!(scale > 0 && scale <= 1)) scale = 0.5;
  let widget;
  try {
    widget = new URL(options.get('widget'));
    if (widget.origin !== 'https://mapmyvisitors.com' || widget.pathname !== '/map.js' || widget.searchParams.get('w') !== '480') widget = null;
  } catch (_) { widget = null; }
  window.visitorMapFrame = { widgetURL: widget ? widget.href : null, failed: !widget };
  if (widget) {
    ['co', 'ct'].forEach((key, index) => {
      const color = widget.searchParams.get(key);
      if (/^[0-9a-f]{6}$/i.test(color || '')) document.documentElement.style.setProperty(index ? '--map-text' : '--map-bg', '#' + color);
    });
  }
  const fonts = new WeakMap();
  let content;
  let queued = false;
  let lastHeight = 0;

  function set(element, property, value) {
    const current = element.style.getPropertyValue(property);
    if (/px$/.test(value) && /px$/.test(current) && Math.abs(parseFloat(current) - parseFloat(value)) < 0.01 && element.style.getPropertyPriority(property) === 'important') return;
    if (element.style.getPropertyValue(property) !== value || element.style.getPropertyPriority(property) !== 'important') element.style.setProperty(property, value, 'important');
  }

  function compensate() {
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
    let text;
    while ((text = walker.nextNode())) {
      const label = text.nodeValue.trim();
      const element = text.parentElement;
      if (!element || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(element.tagName)) continue;
      const counter = /\b(total\s+)?(pageviews|visitors|visits)\b/i.test(label) || element.classList.contains('map-error');
      const zoom = /^[+\-−]$/.test(label);
      if (!counter && !zoom) continue;
      const target = zoom ? element.closest('button, [role="button"], a') || element : element;
      if (!fonts.has(target)) fonts.set(target, parseFloat(getComputedStyle(target).fontSize) || 13);
      set(target, 'font-size', Math.max(fonts.get(target), 13 / scale) + 'px');
      set(target, 'line-height', '1.25');
      if (counter && target.tagName !== 'TEXT' && target.tagName !== 'TSPAN') {
        set(target, 'white-space', 'normal');
        set(target, 'max-width', nativeWidth + 'px');
        set(target, 'overflow-wrap', 'anywhere');
      }
      if (zoom) {
        set(target, 'min-width', 20 / scale + 'px');
        set(target, 'min-height', 20 / scale + 'px');
        const parent = target.parentElement;
        if (parent && /^[+\-−\s]+$/.test(parent.textContent)) set(parent, 'min-width', 20 / scale + 'px');
      }
    }
  }

  function measure() {
    queued = false;
    if (!content || content.getBoundingClientRect().width === 0) return;
    if (!content.querySelector('img, canvas, svg, iframe, .map-error')) return;
    compensate();
    const box = content.getBoundingClientRect();
    let height = box.height;
    let right = box.width;
    content.querySelectorAll('div, p, span, a, img, canvas, svg, iframe, button, [role="button"]').forEach(element => {
      const bounds = element.getBoundingClientRect();
      if (bounds.width > 0 && bounds.height > 0) {
        height = Math.max(height, bounds.bottom - box.top);
        right = Math.max(right, bounds.right - box.left);
      }
    });
    height = Math.ceil(Math.max(1, height));
    if (height === lastHeight) return;
    lastHeight = height;
    window.parent.postMessage({ channel, kind: 'measure', mode, nativeWidth, nativeHeight: height, horizontalOverflow: right > nativeWidth + 1 }, window.location.origin);
  }

  function schedule() {
    if (!queued) { queued = true; requestAnimationFrame(measure); }
  }

  window.addEventListener('message', event => {
    if (event.source !== window.parent || event.origin !== window.location.origin) return;
    const data = event.data;
    if (!data || data.channel !== channel || data.kind !== 'configure' || data.mode !== mode || !(data.scale > 0 && data.scale <= 1)) return;
    const changed = scale !== data.scale;
    scale = data.scale;
    if (changed) lastHeight = 0;
    schedule();
  });

  document.addEventListener('DOMContentLoaded', () => {
    content = document.getElementById('map-frame-content');
    if (window.visitorMapFrame.failed) {
      const error = document.createElement('p');
      error.className = 'map-error';
      error.textContent = 'Visitor statistics are currently unavailable. Please try again later.';
      error.style.fontSize = 13 / scale + 'px';
      content.replaceChildren(error);
    }
    new MutationObserver(schedule).observe(content, { childList: true, subtree: true, attributes: true, characterData: true });
    if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(content);
    content.addEventListener('load', schedule, true);
    window.addEventListener('resize', schedule);
    schedule();
  });
})();
