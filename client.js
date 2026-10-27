window.__ModuleLoader__.load({
  id: 'dsh-86-zone-ui',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /* ======================================================================
       86 -不存在的战区-  /  ZONE 86 THEME

       Layers, outermost first:
         1. theme tokens  — the 15 --dsw-* aliases the shell paints with
         2. decor         — scanlines, sweep beam, grid, vignette (click-through)
         3. HUD           — the operator portrait pinned to the top-right corner
         4. rail          — collapsible tactical status desk on the right
         5. settings      — its own section in DSH settings
         6. shell copy    — sidebar wordmark + document title

       Everything the theme adds is prefixed e86- and lives in fixed-position
       layers, so the shell's own layout is never measured, shifted or patched.
       That is a deliberate departure from the reference plugin, which surgically
       rewrites the shell's grid on every resize tick.
       ====================================================================== */

    /* ---------------------------------------------------------------- tokens
       Dark only, by design: the light entry carries the same value as the dark
       one so a user on a light OS scheme still gets the zone, never a washed
       out half-themed screen. */
    const TOKENS = {
      '--dsw-alias-bg-base': '#04080f',
      '--dsw-alias-bg-layer-1': '#071320',
      '--dsw-alias-bg-layer-2': '#0a1b2b',
      '--dsw-alias-bg-layer-3': '#0d2235',
      '--dsw-alias-bg-overlay': '#081726',
      '--dsw-alias-border-l1': '#123a5c',
      '--dsw-alias-border-l2': '#1a5c8a',
      '--dsw-alias-border-l3': '#2a86c4',
      '--dsw-alias-brand-primary': '#3fb6ff',
      '--dsw-alias-label-primary': '#e8f6ff',
      '--dsw-alias-label-secondary': '#9dc4dd',
      '--dsw-alias-label-tertiary': '#6d90ab',
      '--dsw-alias-state-error-primary': '#ff5c7a',
      '--dsw-alias-state-idle-primary': '#5b7f99',
      '--dsw-alias-state-success-primary': '#47e0a4',
      '--dsw-alias-state-warn-primary': '#ffb454',
      '--dsw-specific-sidebar-fill': '#050d17',
    };

    const THEME_ID = 'e86-zone';

    /* How much of the artwork shows through the shell's base surface. Higher
       strength = more image, so the base token gets less opaque. */
    const BG_LEVELS = { off: 0, soft: 0.24, mid: 0.44, strong: 0.64 };

    /* Rail surface colour, driven by the brightness slider. 0 = near-black
       navy, 100 = a clearly lit steel blue. Both stops keep the same hue. */
    function railSurface(t) {
      const k = Math.max(0, Math.min(1, t / 100));
      const from = [6, 14, 24];
      const to = [58, 104, 146];
      const mix = (bias) => from.map((v, i) => Math.round(v + (to[i] - v) * Math.max(0, Math.min(1, k * (1 + bias))))).join(', ');
      return {
        top: `rgba(${mix(0.10)}, 0.985)`,
        bottom: `rgba(${mix(-0.15)}, 0.975)`,
      };
    }

    const ACCENT = { line: '#3fb6ff', glow: '#59e0ff', dim: 'rgba(63, 182, 255, 0.18)' };

    const HERO_BRAND_DEFAULT = '第 86 区';
    const TITLE_DEFAULT = '86 -不存在的战区-';
    const AVATAR_URL = '/86-ui/avatar';
    const PORTRAITS = [
      { id: '00', label: '原图' },
      { id: '01', label: '素颜' },
      { id: '02', label: '特写' },
      { id: '03', label: '军帽' },
      { id: '04', label: '侧光' },
    ];
    const SCENES = [
      { id: 'rail', label: '铁轨', file: 'background.jpg' },
      { id: 'flowers', label: '花海', file: 'background-flowers.jpg' },
    ];
    function backdropSrc(scene) {
      return scene && scene !== 'rail' ? '/86-ui/background?scene=' + scene : '/86-ui/background';
    }

    function avatarSrc(art) {
      return art && art !== '00' ? AVATAR_URL + '?art=' + art : AVATAR_URL;
    }


    /* ------------------------------------------------------------ event bus
       Fifty entries, strings only, appended only when something actually
       happens. No console hook, no DOM observer, no polling. */
    const EVENTS_MAX = 50;
    const events = { list: [], listeners: new Set(), seq: 0 };

    function emitEvent(level, text) {
      events.seq += 1;
      const entry = { id: events.seq, at: Date.now(), level, text };
      events.list = events.list.concat([entry]).slice(-EVENTS_MAX);
      Array.from(events.listeners).forEach((fn) => {
        try { fn(); } catch (e) { /* a listener must not break the bus */ }
      });
    }

    function useEvents() {
      const state = React.useState(events.list);
      React.useEffect(() => {
        const fn = () => state[1](events.list.slice());
        events.listeners.add(fn);
        return () => { events.listeners.delete(fn); };
      }, []);
      return state[0];
    }

    /* ----------------------------------------------------------------- store
       A tiny module-level store. Every control is a boolean or a short string,
       so localStorage plus a listener set is enough — no state library, and the
       settings page and the rail stay in sync without prop drilling. */
    const LS = 'e86:';

    const DEFAULTS = {
      enabled: true,
      scan: true,
      grid: true,
      vignette: true,
      hud: true,
      logo: true,
      bg: true,
      bgStrength: 'mid',
      bgScene: 'rail',
      railBright: 28,
      hudBright: 50,
      rain: true,
      heroMark: true,
      ticker: true,
      tabStyle: true,
      blueprint: true,
      avatarMode: 'id',
      avatarArt: '00',
      railDefault: false,
      railOpen: false,
      brand: HERO_BRAND_DEFAULT,
      title: TITLE_DEFAULT,
    };

    const store = {
      values: Object.assign({}, DEFAULTS),
      listeners: new Set(),
      read() {
        Object.keys(DEFAULTS).forEach((key) => {
          let raw = null;
          try { raw = window.localStorage.getItem(LS + key); } catch (e) { raw = null; }
          if (raw === null) return;
          const fallback = DEFAULTS[key];
          if (typeof fallback === 'boolean') this.values[key] = raw === '1';
          else this.values[key] = raw;
        });
      },
      get(key) { return this.values[key]; },
      set(key, value) {
        if (this.values[key] === value) return;
        this.values[key] = value;
        try {
          window.localStorage.setItem(LS + key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
        } catch (e) { /* private mode: keep the in-memory value */ }
        this.emit();
      },
      reset() {
        Object.keys(DEFAULTS).forEach((key) => {
          this.values[key] = DEFAULTS[key];
          try { window.localStorage.removeItem(LS + key); } catch (e) { /* ignore */ }
        });
        this.emit();
      },
      emit() {
        Array.from(this.listeners).forEach((fn) => {
          try { fn(); } catch (e) { /* a listener must not break the rest */ }
        });
      },
      subscribe(fn) {
        this.listeners.add(fn);
        return () => { this.listeners.delete(fn); };
      },
    };

    function useSetting(key) {
      const state = React.useState(() => store.get(key));
      const value = state[0];
      React.useEffect(() => {
        const off = store.subscribe(() => state[1](store.get(key)));
        state[1](store.get(key));
        return off;
      }, [key]);
      return [value, (next) => store.set(key, next)];
    }

    /* The shell mounts into #root. Whether it is a normal-flow block or an
       inset:0 fixed layer decides which property actually moves it, so measure
       instead of guessing — the CSS rule alone did not take on the real app. */
    let rootReported = false;
    let lastShellSig = '';

    function applyRailPush(open) {
      const root = document.getElementById('root') || (document.body && document.body.firstElementChild);
      if (!root) return;
      if (open) {
        const style = window.getComputedStyle(root);
        if (!rootReported) {
          rootReported = true;
          console.log('[e86] shell root:', root.tagName, root.id || '(no id)', style.position, style.width);
        }
        if (style.position === 'fixed' || style.position === 'absolute') {
          root.style.setProperty('right', '304px', 'important');
          root.style.removeProperty('width');
        } else {
          root.style.setProperty('width', 'calc(100vw - 304px)', 'important');
          root.style.setProperty('max-width', 'calc(100vw - 304px)', 'important');
        }
      } else {
        root.style.removeProperty('right');
        root.style.removeProperty('width');
        root.style.removeProperty('max-width');
      }
    }

    /* Another skin in this profile paints the shell surfaces itself, and it
       wins on specificity. Rather than fight it in CSS, find the elements the
       slots give us a handle on and set them inline with !important. */
    let shellReported = false;

    /* The shell repaints its root constantly, so the transparency has to be
       re-asserted whenever it does. */
    let rootWatcher = null;
    let watchedRoot = null;

    function watchRoot() {
      const root = document.getElementById('root');
      if (!root || watchedRoot === root) return;
      try { if (rootWatcher) rootWatcher.disconnect(); } catch (e) { /* gone */ }
      watchedRoot = root;
      rootWatcher = new MutationObserver(() => {
        if (!store.get('bg')) return;
        if ((BG_LEVELS[store.get('bgStrength')] || 0) <= 0) return;
        if (root.style.getPropertyValue('background-color') !== 'transparent') {
          root.style.setProperty('background-color', 'transparent', 'important');
        }
        if (root.style.getPropertyValue('background-image') !== 'none') {
          root.style.setProperty('background-image', 'none', 'important');
        }
        revealBackdrop();
        clearBaseFills();
      });
      rootWatcher.observe(root, { attributes: true, attributeFilter: ['style', 'class'] });
    }

    /* An <img> decodes fine in this shell (the probe proves it) while the very
       same URL used as a CSS background paints nothing. So the backdrop is a
       real element, pinned at z-index -1: above the canvas background, below
       every in-flow surface, click-through. */
    let backdropEl = null;

    function applyBackdrop() {
      const root = document.getElementById('root');
      if (!document.body) return;
      if (!backdropEl) {
        backdropEl = document.createElement('img');
        backdropEl.id = 'e86-backdrop';
        backdropEl.alt = '';
        backdropEl.setAttribute('aria-hidden', 'true');
        backdropEl.draggable = false;
        backdropEl.style.cssText = [
          'position:fixed',
          'inset:0',
          'width:100%',
          'height:100%',
          'object-fit:cover',
          'object-position:center center',
          'z-index:-1',
          'pointer-events:none',
          'user-select:none',
          'filter:brightness(0.92) saturate(1.05)',
        ].join(';');
        backdropEl.addEventListener('load', () => {
          emitEvent('info', '背景已加载 ' + backdropEl.naturalWidth + '×' + backdropEl.naturalHeight);
        });
        backdropEl.addEventListener('error', () => emitEvent('warn', '背景加载失败'));
        backdropEl.addEventListener('error', () => console.log('[e86] backdrop img ERROR'));
        backdropEl.src = backdropSrc(store.get('bgScene'));
        document.body.insertBefore(backdropEl, document.body.firstChild);
      }
      /* Switching scenes keeps the same <img>, so the src has to be re-stamped
         whenever the setting changes (applyBackdrop runs on every repaint). */
      const wanted = backdropSrc(store.get('bgScene'));
      if (backdropEl && backdropEl.getAttribute('src') !== wanted) {
        backdropEl.src = wanted;
      }
      [document.documentElement, document.body, root].forEach((el) => {
        if (!el) return;
        el.style.setProperty('background-color', 'transparent', 'important');
        el.style.setProperty('background-image', 'none', 'important');
      });
    }

    function dropBackdrop() {
      if (backdropEl && backdropEl.parentNode) backdropEl.parentNode.removeChild(backdropEl);
      backdropEl = null;
    }

    /* The shell paints its layout roots with the base colour (#04080f). Those
       are exactly the surfaces that must let the artwork through, and nothing
       else is: cards use the layer colours, dialogs are excluded. Precise by
       definition — only a surface whose computed fill equals the base colour
       and that covers a large part of the viewport is cleared. */
    function clearBaseFills() {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const nodes = document.querySelectorAll('div, main, section, header, aside, article');
      for (let i = 0; i < nodes.length; i += 1) {
        const el = nodes[i];
        if (el.closest && el.closest('.e86-decor, .e86-hud, .e86-rail, .e86-logo, .e86-ticker')) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width * rect.height < vw * vh * 0.30) continue;
        const style = window.getComputedStyle(el);
        /* Dialogs are the only thing exempt. Testing for a descendant input was
           wrong: the app root contains the composer's textarea, so the
           conversation column itself got skipped and kept its opaque fill. */
        const floating = style.position === 'fixed' || style.position === 'absolute';
        if (floating && (parseInt(style.zIndex, 10) || 0) >= 40) continue;
        if (style.backgroundColor === BASE_FILL) {
          el.style.setProperty('background-color', 'transparent', 'important');
        }
        /* Every large surface is a candidate, cleared or not: the repair loop
           re-checks these, which catches a reused container that only turns
           opaque later (no childList mutation would ever report that). */
        if (clearedEls.length < 60 && clearedEls.indexOf(el) === -1) clearedEls.push(el);
      }
    }

    /* The layout wrappers directly under #root carry the shell's own fill.
       Only those are cleared — three nodes at most — so opening a dialog or a
       card never gets touched. */
    function revealBackdrop() {
      const root = document.getElementById('root');
      if (!root) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      Array.from(root.children).forEach((child) => {
        if (child.closest('.e86-decor, .e86-hud, .e86-rail, .e86-logo')) return;
        if (child.querySelector('input, textarea, select')) return;
        const rect = child.getBoundingClientRect();
        if (rect.width * rect.height < vw * vh * 0.45) return;
        child.style.setProperty('background-color', 'transparent', 'important');
        child.style.setProperty('background-image', 'none', 'important');
      });
    }

    /* The top tabs have no stable class name, but they do have fixed labels.
       They are located by text inside the content column's top strip, tagged
       with a data attribute, and styled from CSS. If none are found nothing
       happens — and the count is reported in the event log so the outcome is
       visible instead of assumed. */
    const TAB_LABELS = ['对话', '上下文', '编队'];

    function markTabs() {
      if (!store.get('tabStyle')) return;
      const vw = window.innerWidth;
      const sideW = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--e86-sidebar-w'), 10) || 248;
      const stale = document.querySelectorAll('[data-e86-tab]');
      for (let i = 0; i < stale.length; i += 1) {
        stale[i].removeAttribute('data-e86-tab');
        stale[i].removeAttribute('data-e86-index');
        stale[i].removeAttribute('data-e86-active');
      }
      const nodes = document.querySelectorAll('button, a, [role="tab"], [role="tablist"] > *');
      let found = 0;
      for (let i = 0; i < nodes.length; i += 1) {
        const el = nodes[i];
        if (el.closest('[data-e86-tab="1"]')) continue;
        const text = (el.textContent || '').trim();
        const index = TAB_LABELS.indexOf(text);
        if (index === -1) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top > 200 || rect.left < sideW - 60 || rect.width > vw * 0.4) continue;
        const active = el.getAttribute('aria-selected') === 'true'
          || el.getAttribute('data-state') === 'active'
          || /active|selected|current/i.test(String(el.className || ''));
        el.setAttribute('data-e86-tab', '1');
        el.setAttribute('data-e86-index', String(index + 1).padStart(2, '0'));
        if (active) el.setAttribute('data-e86-active', '1');
        else el.removeAttribute('data-e86-active');
        if (el.parentElement) el.parentElement.setAttribute('data-e86-tabbar', '1');
        found += 1;
      }
      if (found && found !== lastTabCount) {
        lastTabCount = found;
        emitEvent('info', '标签页已识别 ' + found + ' 个');
      }
    }

    let lastTabCount = 0;

    /* Same trick as the tabs: the sidebar's rows have no stable class name but
       they do have fixed labels. Tagging them gives CSS a hook that survives
       shell updates — and if the labels ever change, nothing is styled. */
    /* 新会话 is the call-to-action button, not a nav row: numbering it pushed
       its icon and label off the left edge, so it keeps the shell's layout. */
    const NAV_LABELS = ['任务看板', '插件', '自动化任务', '上下文洞察'];
    const GROUP_LABELS = ['工作区', '今日消费', '会话', '最近'];

    function markSidebar() {
      const side = document.querySelector('[data-e86-side="1"]');
      if (!side) return;
      /* Re-tag from scratch every time. A row and its inner label share the
         same text, so both used to get tagged and the number was drawn twice;
         the closest() guard below keeps only the outermost match. */
      const previous = side.querySelectorAll('[data-e86-nav], [data-e86-group]');
      for (let i = 0; i < previous.length; i += 1) {
        previous[i].removeAttribute('data-e86-nav');
        previous[i].removeAttribute('data-e86-group');
        previous[i].removeAttribute('data-e86-index');
      }
      let navCount = 0;
      let groupCount = 0;
      const nodes = side.querySelectorAll('button, a, [role="button"], li, div, span');
      for (let i = 0; i < nodes.length; i += 1) {
        const el = nodes[i];
        if (el.closest('[data-e86-nav="1"], [data-e86-group="1"]')) continue;
        /* Only leaf-ish nodes: a wrapper would swallow the whole row. */
        if (el.children.length > 3) continue;
        const text = (el.textContent || '').trim();
        if (!text || text.length > 12) continue;
        const nav = NAV_LABELS.indexOf(text);
        if (nav !== -1) {
          el.setAttribute('data-e86-nav', '1');
          el.setAttribute('data-e86-index', String(nav + 1).padStart(2, '0'));
          navCount += 1;
          continue;
        }
        if (GROUP_LABELS.indexOf(text) !== -1) {
          el.setAttribute('data-e86-group', '1');
          groupCount += 1;
        }
      }
      if ((navCount || groupCount) && (navCount + groupCount) !== lastSideCount) {
        lastSideCount = navCount + groupCount;
        emitEvent('info', '侧栏已识别 ' + navCount + ' 项导航 / ' + groupCount + ' 个分组');
      }
    }

    let lastSideCount = 0;

    /* Switching conversations replaces the subtree *inside* #root. The body
       watcher never sees that, so the freshly mounted column kept its opaque
       fill and the artwork stayed hidden until some unrelated timer happened
       to repaint. Two cheap mechanisms fix it:

       1. an incremental sweep of newly added nodes (each element inspected at
          most once, so the cost is proportional to new DOM, not to the page)
       2. a periodic re-check of the handful of surfaces we already cleared,
          for when the shell paints them back. */
    const sweptEls = new WeakSet();
    const clearedEls = [];
    const BASE_FILL = 'rgb(4, 8, 15)';

    function considerClear(el) {
      if (!el || el.nodeType !== 1 || sweptEls.has(el)) return;
      if (el.closest && el.closest('.e86-decor, .e86-hud, .e86-rail, .e86-logo, .e86-ticker')) return;
      sweptEls.add(el);
      const style = window.getComputedStyle(el);
      if (style.backgroundColor !== BASE_FILL) return;
      const rect = el.getBoundingClientRect();
      if (rect.width * rect.height < window.innerWidth * window.innerHeight * 0.30) return;
      const floating = style.position === 'fixed' || style.position === 'absolute';
      if (floating && (parseInt(style.zIndex, 10) || 0) >= 40) return;
      el.style.setProperty('background-color', 'transparent', 'important');
      if (clearedEls.length < 60) clearedEls.push(el);
    }

    function sweepSubtree(node) {
      if (!node || node.nodeType !== 1) return;
      considerClear(node);
      if (!node.querySelectorAll) return;
      const list = node.querySelectorAll('div, main, section, header, aside, article');
      for (let i = 0; i < list.length; i += 1) considerClear(list[i]);
    }

    let contentWatcher = null;
    let contentTimer = 0;

    function watchContent() {
      const root = document.getElementById('root');
      if (!root || contentWatcher) return;
      contentWatcher = new MutationObserver((records) => {
        if (!store.get('bg')) return;
        let added = null;
        for (const record of records) {
          if (!record.addedNodes || !record.addedNodes.length) continue;
          for (const node of record.addedNodes) {
            if (node.nodeType !== 1) continue;
            if (!added) added = [];
            added.push(node);
          }
        }
        if (!added) return;
        if (contentTimer) return;
        contentTimer = window.setTimeout(() => {
          contentTimer = 0;
          try {
            for (const node of added) sweepSubtree(node);
            if (!document.getElementById('e86-backdrop')) applyBackdrop();
            markTabs();
            markSidebar();
          } catch (e) { /* mid-render */ }
        }, 180);
      });
      try { contentWatcher.observe(root, { childList: true, subtree: true }); } catch (e) { /* detached */ }
    }

    /* Late re-paints: the shell may set the fill back on a surface we already
       cleared. Sixty getComputedStyle calls every 1.4 s is nothing. */
    let repairTimer = 0;

    function startRepairLoop() {
      if (repairTimer) return;
      repairTimer = window.setInterval(() => {
        if (!store.get('bg') || (BG_LEVELS[store.get('bgStrength')] || 0) <= 0) return;
        if (!document.getElementById('e86-backdrop')) { try { applyBackdrop(); } catch (e) { /* ignore */ } }
        for (const el of clearedEls) {
          if (!el.isConnected) continue;
          const style = window.getComputedStyle(el);
          if (style.backgroundColor === BASE_FILL) {
            el.style.setProperty('background-color', 'transparent', 'important');
          }
        }
      }, 1400);
    }

    /* #root gets replaced on some navigations; re-attach when that happens. */
    let bodyWatcher = null;
    let pendingPaint = false;

    function watchBody() {
      if (bodyWatcher || !document.body) return;
      bodyWatcher = new MutationObserver(() => {
        if (pendingPaint) return;
        pendingPaint = true;
        window.setTimeout(() => {
          pendingPaint = false;
          try {
            contentWatcher = null;   // #root may have been replaced
            paintShell();
          } catch (e) { /* mid-render */ }
        }, 120);
      });
      bodyWatcher.observe(document.body, { childList: true });
    }

    function paintShell() {
      const root = document.getElementById('root');
      const strength = BG_LEVELS[store.get('bgStrength')] || 0;
      const wantBg = Boolean(root && store.get('bg') && strength > 0);

      if (root) {
        if (wantBg) {
          root.style.setProperty('background-color', 'transparent', 'important');
          root.style.setProperty('background-image', 'none', 'important');
          watchRoot();
          watchBody();
          revealBackdrop();
          clearBaseFills();
          applyBackdrop();
          watchContent();
          startRepairLoop();
          try { markTabs(); } catch (e) { /* tabs not mounted yet */ }
          try { markSidebar(); } catch (e) { /* sidebar not mounted yet */ }
        } else {
          root.style.removeProperty('background-color');
          root.style.removeProperty('background-image');
          dropBackdrop();
        }
      }

      const brand = document.querySelector('[data-e86-brand]');
      if (!brand) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let el = brand.parentElement;
      let side = null;
      for (let depth = 0; depth < 9 && el; depth += 1, el = el.parentElement) {
        const rect = el.getBoundingClientRect();
        if (rect.height > vh * 0.55 && rect.width > 150 && rect.width < vw * 0.45) {
          side = el;
          break;
        }
      }
      if (!shellReported) {
        shellReported = true;
        console.log('[e86] shell root:', root ? root.tagName + '#' + (root.id || '-') : 'none',
          '| sidebar:', side ? side.tagName + '.' + (side.className || '').toString().slice(0, 60) : 'not found',
          '| size:', side ? Math.round(side.getBoundingClientRect().width) + 'x' + Math.round(side.getBoundingClientRect().height) : '-');
      }
      if (!side) return;
      root.style.setProperty('--e86-sidebar-w', Math.round(side.getBoundingClientRect().width) + 'px');
      if (side.getAttribute('data-e86-side') !== '1') side.setAttribute('data-e86-side', '1');
      try { markSidebar(); } catch (e) { /* sidebar not ready */ }
      side.style.setProperty('background-color', 'rgba(5, 13, 23, 0.84)', 'important');
      side.style.setProperty('background-image', 'none', 'important');
    }

    /* Keep <html> attributes and the accent custom properties in step with the
       store. Runs outside React so a toggle flips the whole page in one frame. */
    function syncRoot(force) {
      const root = document.documentElement;
      if (!root) return;
      const enabled = store.get('enabled');
      if (enabled) root.setAttribute('data-e86', 'on');
      else root.removeAttribute('data-e86');
      root.setAttribute('data-e86-scan', store.get('scan') ? 'on' : 'off');
      root.setAttribute('data-e86-grid', store.get('grid') ? 'on' : 'off');
      root.setAttribute('data-e86-vignette', store.get('vignette') ? 'on' : 'off');
      root.setAttribute('data-e86-hud', store.get('hud') ? 'on' : 'off');
      root.setAttribute('data-e86-logo', store.get('logo') ? 'on' : 'off');
      root.setAttribute('data-e86-rail-open', store.get('railOpen') ? 'on' : 'off');
      /* The backdrop lives on <html> as a background-image. Painting it there
         means every shell surface keeps its normal stacking; they only have to
         let it through, which is what the translucent base token is for. */
      const strength = BG_LEVELS[store.get('bgStrength')] || 0;
      const bgOn = store.get('bg') && strength > 0;
      if (bgOn) {
        root.setAttribute('data-e86-bg', 'on');
        const baseAlpha = (1 - strength * 0.95);
        root.style.setProperty('--dsw-alias-bg-base', `rgba(4, 8, 15, ${baseAlpha.toFixed(3)})`);
        root.style.setProperty('--dsw-specific-sidebar-fill', `rgba(5, 13, 23, ${Math.min(0.94, baseAlpha + 0.18).toFixed(3)})`);
      } else {
        root.removeAttribute('data-e86-bg');
        root.style.removeProperty('--dsw-alias-bg-base');
        root.style.removeProperty('--dsw-specific-sidebar-fill');
      }
      const hudLift = 0.90 + (Math.max(0, Math.min(100, Number(store.get('hudBright')) || 0)) / 100) * 1.10;
      root.style.setProperty('--e86-hud-lift', hudLift.toFixed(2));
      try { applyRailPush(store.get('railOpen')); } catch (e) { /* root not mounted yet */ }
      /* Brightness sliders fire a change per pixel. Only re-paint the shell
         when something structural actually changed, otherwise dragging a
         slider rebuilds half the page under your finger. */
      const shellSig = [store.get('bg'), store.get('bgStrength'), store.get('railOpen')].join('|');
      if (force || shellSig !== lastShellSig) {
        lastShellSig = shellSig;
        try {
          paintShell();
          /* Everything below reaches into other plugins' nodes. With the second
             theme out of the profile it is unnecessary, and it is the part that
             kept breaking things, so it is opt-in. */
        } catch (e) { /* shell not mounted yet */ }
      }
      root.style.setProperty('--e86-line', ACCENT.line);
      root.style.setProperty('--e86-glow', ACCENT.glow);
      root.style.setProperty('--e86-dim', ACCENT.dim);
    }

    /* ------------------------------------------------------------------- css */

    const BASE_CSS = `
      html[data-e86="on"] {
        --e86-line: #3fb6ff;
        --e86-glow: #59e0ff;
        --e86-dim: rgba(63, 182, 255, 0.18);
        --e86-ink: #04080f;
        --e86-mono: ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, Consolas, monospace;
        --e86-cjk: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif;
      }
      html[data-e86="on"] ::selection {
        background: var(--e86-dim);
        color: #e8f6ff;
      }
      html[data-e86="on"] * {
        scrollbar-color: var(--e86-line) transparent;
        scrollbar-width: thin;
      }
      html[data-e86="on"] *::-webkit-scrollbar { width: 8px; height: 8px; }
      html[data-e86="on"] *::-webkit-scrollbar-track { background: transparent; }
      html[data-e86="on"] *::-webkit-scrollbar-thumb {
        background: linear-gradient(180deg, var(--e86-line), rgba(63, 182, 255, 0.25));
        border-radius: 0;
      }
      html[data-e86="on"] :focus-visible {
        outline: 1px solid var(--e86-line);
        outline-offset: 2px;
      }
    `;

    const DECOR_CSS = `
      .e86-decor {
        position: fixed;
        inset: 0;
        z-index: 2147483000;
        pointer-events: none;
      }
      .e86-decor > * { position: absolute; inset: 0; pointer-events: none; }
      .e86-decor__scan {
        background-image: repeating-linear-gradient(
          to bottom,
          rgba(126, 200, 255, 0.035) 0px,
          rgba(126, 200, 255, 0.035) 1px,
          transparent 1px,
          transparent 4px
        );
        opacity: 0.85;
        mix-blend-mode: screen;
      }
      html[data-e86-scan="off"] .e86-decor__scan { display: none; }
      .e86-decor__grid {
        background-image:
          linear-gradient(to right, rgba(63, 182, 255, 0.10) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(63, 182, 255, 0.10) 1px, transparent 1px);
        background-size: 56px 56px;
        -webkit-mask-image: radial-gradient(120% 90% at 50% 0%, #000 0%, transparent 78%);
        mask-image: radial-gradient(120% 90% at 50% 0%, #000 0%, transparent 78%);
        opacity: 0.5;
      }
      html[data-e86-grid="off"] .e86-decor__grid { display: none; }
      .e86-decor__vignette {
        background: radial-gradient(120% 100% at 50% 40%, transparent 50%, rgba(2, 5, 10, 0.26) 100%);
      }
      html[data-e86-vignette="off"] .e86-decor__vignette { display: none; }
      .e86-decor__beam {
        height: 32vh;
        inset: auto 0 auto 0;
        top: -40vh;
        background: linear-gradient(
          to bottom,
          transparent 0%,
          rgba(63, 182, 255, 0.045) 42%,
          rgba(126, 224, 255, 0.13) 50%,
          rgba(63, 182, 255, 0.045) 58%,
          transparent 100%
        );
        animation: e86-sweep 9s linear infinite;
        mix-blend-mode: screen;
      }
      @keyframes e86-sweep {
        0% { transform: translateY(0); opacity: 0; }
        8% { opacity: 1; }
        92% { opacity: 1; }
        100% { transform: translateY(160vh); opacity: 0; }
      }
      .e86-decor__corner {
        width: 84px;
        height: 84px;
        inset: auto;
        border-color: var(--e86-line);
        opacity: 0.55;
      }
      .e86-decor__corner--tl { top: 10px; left: 10px; border-top: 1px solid; border-left: 1px solid; }
      .e86-decor__corner--br { bottom: 10px; right: 10px; border-bottom: 1px solid; border-right: 1px solid; }
      @media (prefers-reduced-motion: reduce) {
        .e86-decor__beam { animation: none; opacity: 0; }
      }
    `;

    const TICKER_CSS = `
      .e86-ticker {
        position: fixed;
        left: var(--e86-sidebar-w, 248px);
        right: 0;
        bottom: 0;
        height: 24px;
        z-index: 1550;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 0 14px;
        pointer-events: none;
        overflow: hidden;
        background: linear-gradient(180deg, rgba(6, 14, 24, 0.74), rgba(6, 14, 24, 0.94));
        border-top: 1px solid rgba(63, 182, 255, 0.20);
        font: 10px/1 var(--e86-mono);
        letter-spacing: 0.14em;
        color: #8fb3cd;
      }
      .e86-ticker__tag {
        flex: none;
        color: #59e0ff;
        border: 1px solid rgba(63, 182, 255, 0.34);
        padding: 3px 7px;
        letter-spacing: 0.18em;
      }
      .e86-ticker__view { flex: 1; min-width: 0; overflow: hidden; }
      .e86-ticker__track { display: inline-block; white-space: nowrap; animation: e86-tick 34s linear infinite; }
      .e86-ticker__item { margin-right: 10px; }
      .e86-ticker__item b { color: #cfe8fa; font-weight: 500; margin-right: 6px; }
      .e86-ticker__item i { color: #59e0ff; font-style: normal; }
      .e86-ticker__item s { color: #3f6480; text-decoration: none; margin-left: 10px; }
      @keyframes e86-tick { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      @media (prefers-reduced-motion: reduce) { .e86-ticker__track { animation: none; } }
    `;

    const BG_CSS = `
      html[data-e86="on"] {
        background-color: #04080f;
      }
      html[data-e86-bg="on"] {
        background-color: #04080f;
      }
      /* A breath of extra shade at the edges keeps long transcripts readable
         without touching the middle of the artwork. */
      html[data-e86-bg="on"] body::before {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 0;
        background:
          radial-gradient(120% 90% at 50% 45%, rgba(4, 8, 15, 0) 42%, rgba(4, 8, 15, 0.34) 100%),
          linear-gradient(180deg, rgba(4, 8, 15, 0.22) 0%, rgba(4, 8, 15, 0) 30%);
      }
    `;

    /* Scrollbars, cursors, code blocks: the three surfaces every long session
       touches, and none of them need to know the shell's hashed class names. */
    const ACCOUNT_CSS = `
      .e86-account {
        display: flex;
        flex-direction: column;
        gap: 5px;
        width: 100%;
      }
      .e86-account__rank {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 0 3px;
        font: 8px/1 var(--e86-mono);
        letter-spacing: 0.16em;
        color: #6d90ab;
        white-space: nowrap;
        overflow: hidden;
      }
      .e86-account__grade {
        color: #59e0ff;
        letter-spacing: 0.14em;
      }
      .e86-account__rank em {
        font-style: normal;
        font-family: var(--e86-cjk);
        font-size: 9px;
        letter-spacing: 0.18em;
        color: #8fb3cd;
      }
      .e86-account__dot {
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: #47e0a4;
        box-shadow: 0 0 6px rgba(71, 224, 164, 0.8);
        margin-left: auto;
        animation: e86-account-pulse 2.6s ease-in-out infinite;
      }
      @keyframes e86-account-pulse {
        0%, 100% { opacity: 0.35; }
        50% { opacity: 1; }
      }
      .e86-account__link {
        color: #7099b8;
        letter-spacing: 0.12em;
      }
      @media (prefers-reduced-motion: reduce) {
        .e86-account__dot { animation: none; opacity: 0.9; }
      }
    `;

    const SURFACE_CSS = `
      html[data-e86="on"] ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      html[data-e86="on"] ::-webkit-scrollbar-track {
        background: transparent;
      }
      html[data-e86="on"] ::-webkit-scrollbar-thumb {
        background: rgba(63, 182, 255, 0.26);
        border: 2px solid transparent;
        background-clip: padding-box;
        border-radius: 6px;
      }
      html[data-e86="on"] ::-webkit-scrollbar-thumb:hover {
        background: rgba(89, 224, 255, 0.45);
        background-clip: padding-box;
      }
      html[data-e86="on"] ::-webkit-scrollbar-corner { background: transparent; }
      html[data-e86="on"] * { scrollbar-color: rgba(63, 182, 255, 0.30) transparent; scrollbar-width: thin; }

      html[data-e86="on"] article,
      html[data-e86="on"] [data-message-id],
      html[data-e86="on"] [data-role],
      /* ---- left column ---- */
      html[data-e86="on"] [data-e86-side="1"] {
        position: relative;
        box-shadow: 1px 0 0 rgba(63, 182, 255, 0.10) inset, 0 0 40px rgba(4, 8, 15, 0.35) inset;
      }
      html[data-e86="on"] [data-e86-side="1"] [data-e86-nav="1"] {
        position: relative;
        letter-spacing: 0.10em !important;
        transition: color 0.16s, background-color 0.16s;
        padding-left: 16px !important;
      }
      html[data-e86="on"] [data-e86-side="1"] [data-e86-nav="1"]::before {
        content: attr(data-e86-index);
        position: absolute;
        left: 0;
        top: 50%;
        transform: translateY(-50%);
        font: 8px/1 var(--e86-mono);
        letter-spacing: 0.04em;
        color: rgba(63, 182, 255, 0.45);
        transition: color 0.16s;
      }
      html[data-e86="on"] [data-e86-side="1"] [data-e86-nav="1"]::after {
        content: "";
        position: absolute;
        left: 0;
        top: 50%;
        width: 2px;
        height: 0;
        transform: translateY(-50%);
        background: var(--e86-glow);
        box-shadow: 0 0 8px rgba(89, 224, 255, 0.7);
        transition: height 0.18s ease-out;
      }
      html[data-e86="on"] [data-e86-side="1"] [data-e86-nav="1"]:hover { color: #e8f6ff !important; }
      html[data-e86="on"] [data-e86-side="1"] [data-e86-nav="1"]:hover::before { color: #59e0ff; }
      html[data-e86="on"] [data-e86-side="1"] [data-e86-nav="1"]:hover::after { height: 58%; }

      html[data-e86="on"] [data-e86-side="1"] [data-e86-group="1"] {
        display: flex;
        align-items: center;
        gap: 8px;
        letter-spacing: 0.22em !important;
        font-size: 9px !important;
        color: #6d90ab !important;
        text-transform: uppercase;
      }
      html[data-e86="on"] [data-e86-side="1"] [data-e86-group="1"]::before {
        content: "";
        width: 10px;
        height: 1px;
        flex: none;
        background: rgba(63, 182, 255, 0.55);
      }
      html[data-e86="on"] [data-e86-side="1"] [data-e86-group="1"]::after {
        content: "";
        flex: 1;
        height: 1px;
        background: linear-gradient(90deg, rgba(63, 182, 255, 0.22), rgba(63, 182, 255, 0));
      }

      html[data-e86="on"] [data-e86-tab="1"] {
        position: relative;
        letter-spacing: 0.14em !important;
        padding-bottom: 6px !important;
        color: #8fb3cd !important;
        transition: color 0.16s;
      }
      html[data-e86="on"] [data-e86-tab="1"]::before {
        content: attr(data-e86-index);
        font: 8px/1 var(--e86-mono);
        letter-spacing: 0.06em;
        color: rgba(63, 182, 255, 0.55);
        margin-right: 6px;
        vertical-align: 1px;
      }
      html[data-e86="on"] [data-e86-tab="1"]::after {
        content: "";
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: 1px;
        background: transparent;
        transition: background 0.16s;
      }
      html[data-e86="on"] [data-e86-tab="1"]:hover { color: #cfe8fa !important; }
      html[data-e86="on"] [data-e86-tab="1"]:hover::after { background: rgba(63, 182, 255, 0.35); }
      html[data-e86="on"] [data-e86-tab="1"][data-e86-active="1"] { color: #e8f6ff !important; }
      html[data-e86="on"] [data-e86-tab="1"][data-e86-active="1"]::before { color: #59e0ff; }
      html[data-e86="on"] [data-e86-tab="1"][data-e86-active="1"]::after {
        background: linear-gradient(90deg, rgba(63, 182, 255, 0.9), rgba(63, 182, 255, 0.15));
        box-shadow: 0 0 8px rgba(63, 182, 255, 0.5);
      }
      html[data-e86="on"] pre {
        position: relative;
        background: rgba(6, 17, 29, 0.88) !important;
        border: 1px solid rgba(63, 182, 255, 0.16) !important;
        border-left: 2px solid rgba(63, 182, 255, 0.55) !important;
        border-radius: 2px !important;
        box-shadow: 0 0 0 1px rgba(4, 8, 15, 0.6) inset;
      }
      html[data-e86="on"] pre code {
        color: #cfe8fa;
        background: transparent !important;
      }
      html[data-e86="on"] :not(pre) > code {
        background: rgba(63, 182, 255, 0.12) !important;
        border: 1px solid rgba(63, 182, 255, 0.18);
        border-radius: 2px;
        padding: 0.08em 0.34em;
        color: #a8dcff !important;
      }
    `;

    const BLUEPRINT_CSS = `
      .e86-blueprint {
        position: fixed;
        top: 78px;
        bottom: 26px;
        left: var(--e86-sidebar-w, 248px);
        right: 0;
        z-index: 1340;
        pointer-events: none;
        background-color: var(--e86-glow);
        opacity: 0.10;
        mix-blend-mode: screen;
        -webkit-mask-image: url("/86-ui/blueprint");
        mask-image: url("/86-ui/blueprint");
        -webkit-mask-size: auto 100%;
        mask-size: auto 100%;
        -webkit-mask-position: center 46%;
        mask-position: center 46%;
        -webkit-mask-repeat: no-repeat;
        mask-repeat: no-repeat;
        transition: opacity 0.3s;
      }
      .e86-blueprint__sweep {
        position: absolute;
        inset: 0;
        background: linear-gradient(
          to bottom,
          rgba(255, 255, 255, 0) 42%,
          rgba(255, 255, 255, 0.55) 49%,
          rgba(255, 255, 255, 1) 50%,
          rgba(255, 255, 255, 0.55) 51%,
          rgba(255, 255, 255, 0) 58%
        );
        animation: e86-bp-sweep 9s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        will-change: transform;
      }
      @keyframes e86-bp-sweep {
        0% { transform: translateY(-110%); }
        55%, 100% { transform: translateY(110%); }
      }
      html[data-e86-bp="off"] .e86-blueprint { display: none; }
      @media (prefers-reduced-motion: reduce) {
        .e86-blueprint__sweep { animation: none; opacity: 0; }
      }
    `;

    const LOGO_CSS = `
      .e86-logo {
        position: fixed;
        left: 6px;
        top: 6px;
        z-index: 1450;
        height: 42px;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 0 11px 0 9px;
        background: #000;
        border: 1px solid rgba(63, 182, 255, 0.40);
        box-shadow:
          0 0 0 1px rgba(0, 0, 0, 0.95) inset,
          0 8px 26px rgba(0, 0, 0, 0.62),
          0 0 18px rgba(63, 182, 255, 0.14);
        pointer-events: none;
        overflow: hidden;
        font-family: var(--e86-mono);
        box-sizing: border-box;
      }
      .e86-logo::after {
        content: "";
        position: absolute;
        inset: 0;
        background-image: repeating-linear-gradient(
          to bottom,
          rgba(255, 255, 255, 0.05) 0px,
          rgba(255, 255, 255, 0.05) 1px,
          transparent 1px,
          transparent 3px
        );
        pointer-events: none;
      }
      /* The lockup gets its own broadcast: a sweep across the plate, a glitch on
         the numeral, a decode flicker on the katakana and a breathing box. */
      .e86-logo__sweep {
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: linear-gradient(90deg,
          rgba(89, 224, 255, 0) 0%,
          rgba(89, 224, 255, 0.20) 42%,
          rgba(170, 245, 255, 0.55) 50%,
          rgba(89, 224, 255, 0.20) 58%,
          rgba(89, 224, 255, 0) 100%);
        mix-blend-mode: screen;
        transform: translateX(-130%);
        animation: e86-logo-sweep 6.5s cubic-bezier(0.45, 0, 0.55, 1) infinite;
      }
      @keyframes e86-logo-sweep {
        0%, 52% { transform: translateX(-130%); }
        64% { transform: translateX(130%); }
        100% { transform: translateX(130%); }
      }
      .e86-logo__num {
        animation: e86-logo-glitch 5.7s steps(1, end) infinite;
      }
      @keyframes e86-logo-glitch {
        0%, 86%, 100% { transform: scaleX(1.04) translate(0, 0); text-shadow: none; }
        87% { transform: scaleX(1.04) translate(-1px, 0); text-shadow: 1px 0 rgba(255, 60, 110, 0.55), -1px 0 rgba(80, 230, 255, 0.55); }
        88% { transform: scaleX(1.07) translate(1px, 0); text-shadow: -1px 0 rgba(255, 60, 110, 0.5), 1px 0 rgba(80, 230, 255, 0.5); }
        89% { transform: scaleX(1.04) translate(0, 0); text-shadow: none; }
      }
      .e86-logo__kana {
        animation: e86-logo-kana 4.3s steps(1, end) infinite;
      }
      @keyframes e86-logo-kana {
        0%, 90%, 100% { opacity: 1; }
        91% { opacity: 0.25; }
        92% { opacity: 1; }
        95% { opacity: 0.55; }
        96% { opacity: 1; }
      }
      .e86-logo__box {
        animation: e86-logo-box 3.9s ease-in-out infinite;
      }
      @keyframes e86-logo-box {
        0%, 100% { border-color: rgba(255, 255, 255, 0.72); box-shadow: none; }
        50% { border-color: rgba(130, 225, 255, 0.95); box-shadow: 0 0 9px rgba(63, 182, 255, 0.45); }
      }
      @media (prefers-reduced-motion: reduce) {
        .e86-logo__sweep { animation: none; opacity: 0; }
        .e86-logo__num, .e86-logo__kana, .e86-logo__box { animation: none; }
      }
      .e86-logo__num {
        font-family: "Arial Black", "Helvetica Neue", "PingFang SC", sans-serif;
        font-weight: 900;
        font-size: 27px;
        line-height: 1;
        letter-spacing: -1.5px;
        color: #ffffff;
        transform: scaleX(1.04);
      }
      .e86-logo__side {
        display: flex;
        flex-direction: column;
        gap: 3px;
        padding-top: 1px;
      }
      .e86-logo__kana {
        font-size: 7px;
        line-height: 1;
        letter-spacing: 0.4px;
        color: #d7ebfa;
        white-space: nowrap;
      }
      .e86-logo__box {
        font-size: 7px;
        line-height: 1;
        letter-spacing: 1.1px;
        color: #ffffff;
        white-space: nowrap;
        border: 1px solid rgba(255, 255, 255, 0.72);
        padding: 2px 5px 1px;
        text-align: center;
      }
      html[data-e86-logo="off"] .e86-logo { display: none; }
      @media (max-width: 760px) {
        .e86-logo { height: 36px; padding: 0 8px; gap: 8px; }
        /* The lockup gets its own broadcast: a sweep across the plate, a glitch on
         the numeral, a decode flicker on the katakana and a breathing box. */
      .e86-logo__sweep {
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: linear-gradient(90deg,
          rgba(89, 224, 255, 0) 0%,
          rgba(89, 224, 255, 0.20) 42%,
          rgba(170, 245, 255, 0.55) 50%,
          rgba(89, 224, 255, 0.20) 58%,
          rgba(89, 224, 255, 0) 100%);
        mix-blend-mode: screen;
        transform: translateX(-130%);
        animation: e86-logo-sweep 6.5s cubic-bezier(0.45, 0, 0.55, 1) infinite;
      }
      @keyframes e86-logo-sweep {
        0%, 52% { transform: translateX(-130%); }
        64% { transform: translateX(130%); }
        100% { transform: translateX(130%); }
      }
      .e86-logo__num {
        animation: e86-logo-glitch 5.7s steps(1, end) infinite;
      }
      @keyframes e86-logo-glitch {
        0%, 86%, 100% { transform: scaleX(1.04) translate(0, 0); text-shadow: none; }
        87% { transform: scaleX(1.04) translate(-1px, 0); text-shadow: 1px 0 rgba(255, 60, 110, 0.55), -1px 0 rgba(80, 230, 255, 0.55); }
        88% { transform: scaleX(1.07) translate(1px, 0); text-shadow: -1px 0 rgba(255, 60, 110, 0.5), 1px 0 rgba(80, 230, 255, 0.5); }
        89% { transform: scaleX(1.04) translate(0, 0); text-shadow: none; }
      }
      .e86-logo__kana {
        animation: e86-logo-kana 4.3s steps(1, end) infinite;
      }
      @keyframes e86-logo-kana {
        0%, 90%, 100% { opacity: 1; }
        91% { opacity: 0.25; }
        92% { opacity: 1; }
        95% { opacity: 0.55; }
        96% { opacity: 1; }
      }
      .e86-logo__box {
        animation: e86-logo-box 3.9s ease-in-out infinite;
      }
      @keyframes e86-logo-box {
        0%, 100% { border-color: rgba(255, 255, 255, 0.72); box-shadow: none; }
        50% { border-color: rgba(130, 225, 255, 0.95); box-shadow: 0 0 9px rgba(63, 182, 255, 0.45); }
      }
      @media (prefers-reduced-motion: reduce) {
        .e86-logo__sweep { animation: none; opacity: 0; }
        .e86-logo__num, .e86-logo__kana, .e86-logo__box { animation: none; }
      }
      .e86-logo__num { font-size: 23px; }
        .e86-logo__kana, .e86-logo__box { font-size: 6px; }
      }
    `;

    const HUD_CSS = `
      .e86-hud {
        position: fixed;
        top: 56px;
        right: 18px;
        /* above the rail (1600): the two must never overlap, but if a theme
           grows the header the rail would otherwise paint over the portrait */
        z-index: 1650;
        pointer-events: none;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 8px;
        font-family: var(--e86-mono);
        --e86-hud-edge: 152px;
      }
      html[data-e86-hud="off"] .e86-hud { display: none; }
      .e86-hud::before {
        content: "";
        position: absolute;
        inset: -12px -22px -12px -72px;
        background: linear-gradient(90deg, rgba(4, 8, 15, 0) 0%, rgba(4, 8, 15, 0.72) 62%, rgba(4, 8, 15, 0.9) 100%);
        z-index: -1;
      }
      .e86-hud__frame {
        position: relative;
        /* Without this the portrait's multiply blends with whatever sits
           behind the frame — the dock strip darkens it whenever the rail is
           open. Isolation pins the blend to the artwork's own field. */
        isolation: isolate;
        width: var(--e86-hud-edge);
        height: var(--e86-hud-edge);
        border: 1px solid var(--e86-line);
        background: #04080f;
        box-shadow:
          0 0 0 1px rgba(63, 182, 255, 0.16) inset,
          0 0 22px rgba(63, 182, 255, 0.30),
          0 0 60px rgba(63, 182, 255, 0.12);
        overflow: hidden;
      }
      /* Signal tremor: two coprime periods so the shake never feels like a loop,
         a 2px tear bar that flashes on the beat, and a hard-stepped offset so it
         reads as interference rather than a wobble. */
      .e86-hud__art { animation: e86-hud-tremor-a 3.7s steps(1, end) infinite; }
      @keyframes e86-hud-tremor-a {
        0%, 82%, 100% { transform: translate(0, 0); }
        83% { transform: translate(-1.5px, 0.5px); }
        84% { transform: translate(1.5px, -1px); }
        85% { transform: translate(-1px, 0.5px); }
        86% { transform: translate(1px, 0); }
      }
      .e86-hud__tear {
        position: absolute;
        left: 0;
        right: 0;
        top: 36%;
        height: 2px;
        pointer-events: none;
        background: linear-gradient(90deg, rgba(160, 240, 255, 0) 0%, rgba(190, 250, 255, 0.95) 40%, rgba(255, 255, 255, 0.9) 52%, rgba(160, 240, 255, 0) 100%);
        mix-blend-mode: screen;
        opacity: 0;
        animation: e86-hud-tear 3.7s steps(1, end) infinite;
      }
      @keyframes e86-hud-tear {
        0%, 82%, 100% { opacity: 0; transform: translateY(0); }
        83% { opacity: 0.95; transform: translateY(7px); }
        84% { opacity: 0.5; transform: translateY(-12px); }
        85% { opacity: 0.15; }
        86% { opacity: 0; }
      }
      .e86-hud__sweep {
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        height: 45%;
        pointer-events: none;
        background: linear-gradient(
          to bottom,
          rgba(89, 224, 255, 0) 0%,
          rgba(89, 224, 255, 0.16) 42%,
          rgba(160, 240, 255, 0.42) 50%,
          rgba(89, 224, 255, 0.16) 58%,
          rgba(89, 224, 255, 0) 100%
        );
        mix-blend-mode: screen;
        animation: e86-hud-sweep 5.2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
      }
      @keyframes e86-hud-sweep {
        0% { transform: translateY(-110%); opacity: 0; }
        12% { opacity: 1; }
        88% { opacity: 1; }
        100% { transform: translateY(240%); opacity: 0; }
      }
      .e86-hud__img {
        animation: e86-hud-flicker 7s steps(1, end) infinite,
                   e86-hud-tremor-b 5.3s steps(1, end) infinite;
      }
      @keyframes e86-hud-tremor-b {
        0%, 71%, 100% { transform: scale(1.05) translate(0, 0); }
        72% { transform: scale(1.05) translate(0.8px, -0.6px); }
        73% { transform: scale(1.06) translate(-0.8px, 0.6px); }
      }
      @keyframes e86-hud-flicker {
        0%, 88%, 100% { opacity: 1; }
        89% { opacity: 0.78; }
        90% { opacity: 1; }
        93% { opacity: 0.88; }
        94% { opacity: 1; }
      }
      .e86-hud__frame { animation: e86-hud-glow 4.6s ease-in-out infinite; }
      @keyframes e86-hud-glow {
        0%, 100% {
          box-shadow:
            0 0 0 1px rgba(63, 182, 255, 0.16) inset,
            0 0 20px rgba(63, 182, 255, 0.28),
            0 0 52px rgba(63, 182, 255, 0.10);
        }
        50% {
          box-shadow:
            0 0 0 1px rgba(63, 182, 255, 0.22) inset,
            0 0 30px rgba(63, 182, 255, 0.52),
            0 0 76px rgba(63, 182, 255, 0.20);
        }
      }
      .e86-hud__frame::after {
        content: "";
        position: absolute;
        inset: 0;
        /* Softer than it once was: the line-art portraits carry far more
           detail than the first artwork, and a 0.42/3px raster ate it. */
        background-image: repeating-linear-gradient(
          to bottom,
          rgba(2, 6, 12, 0.24) 0px,
          rgba(2, 6, 12, 0.24) 1px,
          transparent 1px,
          transparent 4px
        );
        mix-blend-mode: multiply;
        pointer-events: none;
        animation: e86-hud-lines 9s linear infinite;
      }
      @keyframes e86-hud-lines {
        from { background-position: 0 0; }
        to { background-position: 0 12px; }
      }
      .e86-hud__art {
        position: absolute;
        inset: 0;
        background-color: #dceefb;
        filter: brightness(var(--e86-hud-lift, 1.45));
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--e86-line);
        background: linear-gradient(160deg, var(--e86-line) 0%, #1d6ea8 100%);
      }
      .e86-hud__art[data-mode="original"] {
        background: #04080f;
      }
      .e86-hud__art[data-mode="id"] {
        background: linear-gradient(160deg, #dceefb 0%, #a6cce6 100%);
      }
      .e86-hud__art[data-mode="id"] .e86-hud__img {
        filter: grayscale(1) contrast(1.06);
        mix-blend-mode: multiply;
      }
      .e86-hud__art[data-emblem="1"] {
        background: radial-gradient(130% 130% at 28% 18%, #0c3352 0%, #061521 58%, #04080f 100%);
      }
      .e86-hud__img {
        width: 100%;
        height: 100%;
        transform: scale(1.05);
        object-fit: cover;
        display: block;
        filter: grayscale(1) invert(1) contrast(1.12) brightness(1.06);
        mix-blend-mode: multiply;
      }
      .e86-hud__art[data-mode="original"] .e86-hud__img {
        filter: none;
        mix-blend-mode: normal;
      }
      .e86-emblem {
        width: 70%;
        height: 70%;
        color: var(--e86-line);
        filter: drop-shadow(0 0 7px rgba(89, 224, 255, 0.55));
      }
      .e86-hud__corner {
        position: absolute;
        width: 12px;
        height: 12px;
        border-color: var(--e86-glow);
        z-index: 3;
      }
      .e86-hud__corner--tl { top: -1px; left: -1px; border-top: 2px solid; border-left: 2px solid; }
      .e86-hud__corner--tr { top: -1px; right: -1px; border-top: 2px solid; border-right: 2px solid; }
      .e86-hud__corner--bl { bottom: -1px; left: -1px; border-bottom: 2px solid; border-left: 2px solid; }
      .e86-hud__corner--br { bottom: -1px; right: -1px; border-bottom: 2px solid; border-right: 2px solid; }
      /* With the rail open the HUD becomes the header of that column:
         portrait centred, name plate and link status stacked underneath. */
      html[data-e86-rail-open="on"] .e86-hud {
        right: 16px;
        width: 288px;
        flex-direction: column;
        align-items: center;
        gap: 9px;
      }
      html[data-e86-rail-open="on"] .e86-hud__frame {
        width: 176px;
        height: 176px;
        flex: none;
      }
      html[data-e86-rail-open="on"] .e86-hud__plate {
        width: 100%;
        align-items: center;
        text-align: center;
        border-right: none;
        border-left: none;
        background: none;
        padding: 0;
      }
      html[data-e86-rail-open="on"] .e86-hud__plate b { font-size: 12px; letter-spacing: 0.34em; }
      html[data-e86-rail-open="on"] .e86-hud__plate span { font-size: 10px; letter-spacing: 0.42em; }
      html[data-e86-rail-open="on"] .e86-hud__plate em { font-size: 8px; letter-spacing: 0.26em; }
      /* The header sits inside the dark dock column, so the same artwork reads
         dimmer there. Compensation is explicit rather than clever: the base
         lift multiplied by 1.18 while the rail is open. */
      html[data-e86-rail-open="on"] .e86-hud__art {
        /* brightness alone only clips the paper; pulling contrast down lifts
           the ink too, which is what actually reads as "brighter" here. */
        filter: brightness(calc(var(--e86-hud-lift, 1.45) * 1.08)) contrast(0.94);
      }
      html[data-e86-rail-open="on"] .e86-hud__frame::before {
        content: "";
        position: absolute;
        inset: 0;
        z-index: 2;
        pointer-events: none;
        background: linear-gradient(180deg, rgba(214, 240, 255, 0.13), rgba(150, 205, 240, 0.07));
        mix-blend-mode: screen;
      }
      html[data-e86-rail-open="on"] .e86-hud__status {
        width: auto;
        justify-content: center;
        padding-left: 0;
      }
      html[data-e86-rail-open="on"] .e86-rail { top: 332px !important; }
      .e86-hud__plate {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 1px;
        padding: 5px 8px;
        border-right: 2px solid var(--e86-line);
        background: linear-gradient(90deg, transparent, rgba(4, 8, 15, 0.86) 32%);
        text-align: right;
      }
      .e86-hud__plate b {
        font-size: 10px;
        letter-spacing: 0.22em;
        color: #e8f6ff;
        font-weight: 600;
      }
      .e86-hud__plate span {
        font-size: 9px;
        letter-spacing: 0.34em;
        color: var(--e86-line);
      }
      .e86-hud__plate em {
        font-size: 8px;
        font-style: normal;
        letter-spacing: 0.2em;
        color: #6d90ab;
      }
      .e86-hud__status {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 8px;
        letter-spacing: 0.2em;
        color: #7fb2e8;
      }
      .e86-hud__status i {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: var(--e86-glow);
        box-shadow: 0 0 8px var(--e86-glow);
        animation: e86-pulse 2.4s ease-in-out infinite;
      }
      @keyframes e86-pulse {
        0%, 100% { opacity: 0.35; }
        50% { opacity: 1; }
      }
      @media (max-width: 760px) {
        .e86-hud { --e86-hud-edge: 76px; top: 8px; right: 10px; }
        .e86-hud__plate { display: none; }
      }
    `;

    const RAIL_CSS = `
      .e86-rail {
        position: fixed;
        top: 252px;
        right: 16px;
        bottom: auto;
        max-height: calc(100vh - 272px);
        width: 288px;
        z-index: 1600;
        pointer-events: auto;
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 12px;
        box-sizing: border-box;
        background: linear-gradient(180deg, rgba(18, 40, 62, 0.95) 0%, rgba(11, 27, 44, 0.92) 100%) !important;
        border: 1px solid rgba(63, 182, 255, 0.34) !important;
        box-shadow:
          0 0 0 1px rgba(63, 182, 255, 0.08) inset,
          0 18px 60px rgba(0, 0, 0, 0.62),
          0 0 34px rgba(63, 182, 255, 0.12);
        -webkit-backdrop-filter: blur(14px) saturate(1.1);
        backdrop-filter: blur(14px) saturate(1.1);
        color: #cfe8f8;
        font-family: var(--e86-mono);
        overflow-x: hidden;
        overflow-y: auto;
        animation: e86-rail-in 0.26s ease-out both;
      }
      @keyframes e86-rail-in {
        from { opacity: 0.45; transform: translateX(14px); }
        to { opacity: 1; transform: translateX(0); }
      }
      .e86-rail::after {
        content: "";
        position: absolute;
        top: 0;
        bottom: 0;
        left: -26px;
        width: 26px;
        background: linear-gradient(90deg, rgba(4, 8, 15, 0) 0%, rgba(4, 8, 15, 0.55) 100%);
        pointer-events: none;
      }
      .e86-rail::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background-image: repeating-linear-gradient(
          to bottom,
          rgba(126, 200, 255, 0.032) 0px,
          rgba(126, 200, 255, 0.032) 1px,
          transparent 1px,
          transparent 4px
        );
      }
      .e86-rail {
        display: flex;
        flex-direction: column;
      }
      .e86-rail__scroll {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        overflow-x: hidden;
        overscroll-behavior: contain;
        margin: 0 -2px;
        padding: 0 2px;
        scrollbar-gutter: stable;
      }
      .e86-rail__head {
        flex: none;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding-bottom: 8px;
        border-bottom: 1px solid rgba(63, 182, 255, 0.26);
        position: relative;
      }
      .e86-rail__title {
        display: flex;
        align-items: baseline;
        gap: 7px;
        flex: none;
        white-space: nowrap;
        font-size: 11px;
        letter-spacing: 0.22em;
        color: #e8f6ff;
      }
      .e86-rail__title b { font-weight: 600; }
      .e86-rail__title em {
        font-style: normal;
        font-size: 9px;
        letter-spacing: 0.16em;
        color: #6d90ab;
      }
      .e86-quick {
        display: flex;
        gap: 4px;
        margin-left: auto;
        margin-right: 7px;
        flex: none;
      }
      .e86-quick__btn {
        width: 19px;
        height: 19px;
        display: grid;
        place-items: center;
        padding: 0;
        border: 1px solid rgba(63, 182, 255, 0.22);
        background: transparent;
        color: #4f7593;
        font: 9px/1 var(--e86-cjk);
        cursor: pointer;
        transition: color 0.15s, border-color 0.15s, background 0.15s;
      }
      .e86-quick__btn:hover { color: #cfe8fa; border-color: rgba(63, 182, 255, 0.45); }
      .e86-quick__btn--reload { margin-left: 5px; color: #7fb2cf; }
      .e86-quick__btn--reload:hover { color: #59e0ff; border-color: rgba(63, 182, 255, 0.55); }
      .e86-quick__btn[data-on="1"] {
        color: #59e0ff;
        border-color: rgba(63, 182, 255, 0.62);
        background: rgba(63, 182, 255, 0.14);
        box-shadow: 0 0 8px rgba(63, 182, 255, 0.28);
      }
      .e86-rail__close {
        width: 20px;
        height: 20px;
        flex: none;
        display: grid;
        place-items: center;
        border: 1px solid rgba(63, 182, 255, 0.34);
        background: rgba(63, 182, 255, 0.06);
        color: #9dc4dd;
        cursor: pointer;
        font: inherit;
        line-height: 1;
        padding: 0;
        transition: color 0.15s, border-color 0.15s, background 0.15s;
      }
      .e86-rail__close:hover {
        color: #e8f6ff;
        border-color: var(--e86-line);
        background: rgba(63, 182, 255, 0.16);
      }
      .e86-rail__section { position: relative; }
      .e86-rail__label {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 9px;
        letter-spacing: 0.22em;
        color: #8aaec7;
        margin-bottom: 6px;
      }
      .e86-rail__label u {
        text-decoration: none;
        color: var(--e86-line);
      }
      .e86-rail__live {
        font-size: 8px;
        letter-spacing: 0.18em;
        padding: 1px 4px;
        border: 1px solid rgba(71, 224, 164, 0.45);
        color: #47e0a4;
      }
      .e86-log__row[data-level="warn"] span { color: #ffb454; }
      .e86-rail__sim {
        font-size: 8px;
        letter-spacing: 0.18em;
        padding: 1px 4px;
        border: 1px solid rgba(109, 144, 171, 0.4);
        color: #6d90ab;
      }
      .e86-spark-row {
        display: grid;
        grid-template-columns: 34px 1fr 46px;
        align-items: center;
        gap: 8px;
        margin-bottom: 7px;
      }
      .e86-spark-row span { font-size: 9px; letter-spacing: 0.14em; color: #a3d2f0; }
      .e86-spark-row b {
        font: 11px/1 var(--e86-mono);
        font-weight: 500;
        text-align: right;
        color: #cfe8fa;
        font-variant-numeric: tabular-nums;
      }
      .e86-net {
        display: flex;
        justify-content: space-between;
        margin-top: 7px;
        padding-top: 6px;
        border-top: 1px dashed rgba(63, 182, 255, 0.14);
        font: 9px/1 var(--e86-mono);
        letter-spacing: 0.1em;
        color: #8fb3cd;
        font-variant-numeric: tabular-nums;
      }
      .e86-spark { width: 100%; height: 26px; display: block; overflow: visible; }
      .e86-spark__base { stroke: rgba(63, 182, 255, 0.22); stroke-width: 1; }
      .e86-spark__grid { stroke: rgba(63, 182, 255, 0.12); stroke-width: 0.5; }
      .e86-spark__line {
        fill: none;
        stroke: var(--e86-glow);
        stroke-width: 1.2;
        stroke-linejoin: round;
        stroke-linecap: round;
        vector-effect: non-scaling-stroke;
        filter: drop-shadow(0 0 3px rgba(89, 224, 255, 0.55));
      }
      .e86-spark__area { fill: rgba(63, 182, 255, 0.14); }
      .e86-rail__gauges { display: flex; flex-direction: column; gap: 6px; }
      .e86-gauge { display: grid; grid-template-columns: 34px 1fr 52px; align-items: center; gap: 8px; }
      .e86-gauge span { font-size: 9px; letter-spacing: 0.14em; color: #a3d2f0; }
      .e86-gauge b {
        font-size: 9px;
        font-weight: 500;
        text-align: right;
        color: #cfe8f8;
        font-variant-numeric: tabular-nums;
      }
      .e86-gauge__bar {
        position: relative;
        height: 5px;
        background: rgba(63, 182, 255, 0.12);
        overflow: hidden;
      }
      .e86-gauge__bar i {
        position: absolute;
        inset: 0 auto 0 0;
        background: linear-gradient(90deg, rgba(63, 182, 255, 0.55), var(--e86-glow));
        box-shadow: 0 0 10px var(--e86-dim);
        transition: width 0.4s ease-out;
      }
      .e86-gauge__bar::after {
        content: "";
        position: absolute;
        inset: 0;
        background-image: repeating-linear-gradient(to right, transparent 0 7px, rgba(4, 8, 15, 0.85) 7px 9px);
        pointer-events: none;
      }
      .e86-rail__label--click { cursor: pointer; user-select: none; }
      .e86-rail__label--click:hover { color: #a6c8de; }
      .e86-rail__label--click:focus-visible { outline: 1px solid rgba(63, 182, 255, 0.5); outline-offset: 2px; }
      .e86-rail__right { display: flex; align-items: center; gap: 7px; }
      .e86-rail__chev { font-style: normal; font-size: 8px; color: #5b7f99; }
      .e86-rail__label--click:hover .e86-rail__chev { color: #8fb3cd; }
      .e86-rail__section[data-collapsed="1"] { padding-bottom: 2px; }
      .e86-rail__body { animation: e86-body-in 0.18s ease-out both; }
      @keyframes e86-body-in {
        from { opacity: 0; transform: translateY(-3px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .e86-linktop { display: flex; align-items: center; gap: 12px; margin: 2px 0 7px; }
      .e86-radar {
        position: relative;
        width: 74px;
        height: 74px;
        flex: none;
        border: 1px solid rgba(63, 182, 255, 0.34);
        border-radius: 50%;
        overflow: hidden;
        background: radial-gradient(circle at 50% 50%, rgba(63, 182, 255, 0.10), rgba(4, 8, 15, 0) 72%);
      }
      .e86-radar__rings {
        position: absolute;
        inset: 0;
        background-image:
          radial-gradient(circle, transparent 0 31%, rgba(63, 182, 255, 0.20) 32%, transparent 33%),
          radial-gradient(circle, transparent 0 61%, rgba(63, 182, 255, 0.16) 62%, transparent 63%),
          linear-gradient(to right, transparent 49.4%, rgba(63, 182, 255, 0.16) 49.6% 50.4%, transparent 50.6%),
          linear-gradient(to bottom, transparent 49.4%, rgba(63, 182, 255, 0.16) 49.6% 50.4%, transparent 50.6%);
      }
      .e86-radar__sweep {
        position: absolute;
        inset: -50%;
        background: conic-gradient(from 0deg, rgba(89, 224, 255, 0.55) 0deg, rgba(89, 224, 255, 0.12) 26deg, transparent 62deg);
        animation: e86-radar-spin 5.2s linear infinite;
      }
      @keyframes e86-radar-spin { to { transform: rotate(360deg); } }
      .e86-radar__blip {
        position: absolute;
        width: 3px;
        height: 3px;
        border-radius: 50%;
        background: #bff3ff;
        box-shadow: 0 0 6px #59e0ff, 0 0 12px rgba(89, 224, 255, 0.6);
        animation: e86-blip 3.4s ease-in-out infinite;
      }
      @keyframes e86-blip {
        0%, 100% { opacity: 0.12; }
        45% { opacity: 1; }
      }
      .e86-sync {
        display: flex;
        align-items: baseline;
        gap: 5px;
        margin: 2px 0 7px;
      }
      .e86-sync b {
        font: 34px/0.9 var(--e86-mono);
        font-weight: 500;
        letter-spacing: -1.5px;
        color: var(--e86-glow);
        text-shadow: 0 0 16px rgba(89, 224, 255, 0.45), 0 0 34px rgba(89, 224, 255, 0.18);
        font-variant-numeric: tabular-nums;
      }
      .e86-sync span {
        font: 10px/1 var(--e86-mono);
        letter-spacing: 0.16em;
        color: #6d90ab;
      }
      .e86-rail__wave {
        display: flex;
        align-items: flex-end;
        gap: 2px;
        height: 34px;
        padding: 2px 0;
        border-top: 1px solid rgba(63, 182, 255, 0.14);
        border-bottom: 1px solid rgba(63, 182, 255, 0.14);
      }
      .e86-rail__wave i {
        flex: 1;
        min-width: 2px;
        background: linear-gradient(to top, rgba(63, 182, 255, 0.18), var(--e86-line));
        height: 18%;
        animation: e86-wave 1.8s ease-in-out infinite alternate;
        opacity: 0.85;
      }
      @keyframes e86-wave {
        from { height: 8%; opacity: 0.45; }
        to { height: 92%; opacity: 1; }
      }
      .e86-log {
        display: flex;
        flex-direction: column;
        gap: 3px;
        max-height: 148px;
        overflow: hidden;
      }
      .e86-log__row {
        display: grid;
        grid-template-columns: 52px 1fr;
        gap: 6px;
        font-size: 9px;
        line-height: 1.45;
        color: #b8d9ec;
        animation: e86-log-in 0.3s ease-out both;
      }
      @keyframes e86-log-in {
        from { opacity: 0; transform: translateY(-3px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .e86-log__row time { color: #6b95b3; font-variant-numeric: tabular-nums; }
      .e86-log__row span { color: #cfe8f8; }
      .e86-log__row:first-child span { color: var(--e86-glow); }
      .e86-rail[data-alert="1"] {
        border-color: rgba(255, 120, 90, 0.55) !important;
        box-shadow: 0 18px 60px rgba(0, 0, 0, 0.55), 0 0 34px rgba(255, 90, 60, 0.22) !important;
      }
      .e86-rail[data-alert="1"] .e86-sync b {
        color: #ff8a5c;
        text-shadow: 0 0 16px rgba(255, 120, 80, 0.5), 0 0 34px rgba(255, 90, 60, 0.2);
      }
      .e86-rail[data-alert="1"] .e86-rail__title b { color: #ffb454; }
      .e86-rail__alarm {
        font-size: 8px;
        letter-spacing: 0.16em;
        color: #ffb454;
        border: 1px solid rgba(255, 180, 84, 0.5);
        padding: 1px 5px;
        margin-left: 8px;
      }
      .e86-rail__stats {
        flex: none;
        display: flex;
        justify-content: space-between;
        gap: 8px;
        padding-top: 6px;
        font: 8px/1 var(--e86-mono);
        letter-spacing: 0.12em;
        color: #7099b8;
        font-variant-numeric: tabular-nums;
      }
      .e86-rail__foot {
        flex: none;
        margin-top: auto;
        display: flex;
        align-items: center;
        gap: 8px;
        padding-top: 8px;
        border-top: 1px solid rgba(63, 182, 255, 0.18);
      }
      .e86-rail__host {
        font-size: 8px;
        letter-spacing: 0.14em;
        color: #7099b8;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .e86-comms {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        border: 1px dashed rgba(109, 144, 171, 0.42);
        background: rgba(8, 23, 38, 0.6);
      }
      .e86-comms button {
        width: 22px;
        height: 22px;
        display: grid;
        place-items: center;
        border: 1px solid rgba(109, 144, 171, 0.42);
        background: transparent;
        color: #4f7593;
        cursor: not-allowed;
        font: inherit;
        padding: 0;
      }
      .e86-comms div { display: flex; flex-direction: column; gap: 1px; }
      .e86-comms b { font-size: 9px; font-weight: 500; color: #7fb2e8; letter-spacing: 0.14em; }
      .e86-comms span { font-size: 8px; color: #4f7593; letter-spacing: 0.1em; }
      /* A floating rail over a centred column always eats the right edge of
         long messages. When the rail is open the shell gets this padding, so
         the whole conversation steps left instead of sliding underneath. */
      /* The shell mounts into <div id="root">. Padding on <body> is ignored by
         its layout, so the root itself has to give up the width. */
      html[data-e86-rail-open="on"] #root,
      html[data-e86-rail-open="on"] body > div:first-child {
        width: calc(100vw - 304px) !important;
        max-width: calc(100vw - 304px) !important;
        right: 304px !important;
        box-sizing: border-box !important;
      }
      html[data-e86-rail-open="on"] body { overflow: hidden !important; }
      html[data-e86-hud="off"] .e86-rail { top: 62px; }
      @media (max-width: 900px) {
        .e86-rail { width: 268px; top: 214px; right: 10px; }
      }
      @media (max-height: 760px) {
        .e86-rail { top: 62px; bottom: 10px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .e86-radar__sweep { animation: none; opacity: 0.35; }
        .e86-radar__blip { animation: none; opacity: 0.8; }
        .e86-hud__sweep, .e86-hud__img, .e86-hud__frame, .e86-hud__frame::after,
        .e86-hud__art, .e86-hud__tear { animation: none !important; }
        /* Signal tremor: two coprime periods so the shake never feels like a loop,
         a 2px tear bar that flashes on the beat, and a hard-stepped offset so it
         reads as interference rather than a wobble. */
      .e86-hud__art { animation: e86-hud-tremor-a 3.7s steps(1, end) infinite; }
      @keyframes e86-hud-tremor-a {
        0%, 82%, 100% { transform: translate(0, 0); }
        83% { transform: translate(-1.5px, 0.5px); }
        84% { transform: translate(1.5px, -1px); }
        85% { transform: translate(-1px, 0.5px); }
        86% { transform: translate(1px, 0); }
      }
      .e86-hud__tear {
        position: absolute;
        left: 0;
        right: 0;
        top: 36%;
        height: 2px;
        pointer-events: none;
        background: linear-gradient(90deg, rgba(160, 240, 255, 0) 0%, rgba(190, 250, 255, 0.95) 40%, rgba(255, 255, 255, 0.9) 52%, rgba(160, 240, 255, 0) 100%);
        mix-blend-mode: screen;
        opacity: 0;
        animation: e86-hud-tear 3.7s steps(1, end) infinite;
      }
      @keyframes e86-hud-tear {
        0%, 82%, 100% { opacity: 0; transform: translateY(0); }
        83% { opacity: 0.95; transform: translateY(7px); }
        84% { opacity: 0.5; transform: translateY(-12px); }
        85% { opacity: 0.15; }
        86% { opacity: 0; }
      }
      .e86-hud__sweep { display: none; }
        .e86-rail { animation: none; }
        .e86-rail__wave i { animation: none; height: 34%; }
        .e86-log__row { animation: none; }
      }
    `;

    const SETTINGS_CSS = `
      .e86-settings {
        font-family: var(--e86-cjk);
        color: #cfe8f8;
        display: flex;
        flex-direction: column;
        gap: 14px;
        max-width: 720px;
      }
      .e86-settings__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding-bottom: 10px;
        border-bottom: 1px solid rgba(63, 182, 255, 0.24);
      }
      .e86-settings__head h3 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        letter-spacing: 0.16em;
        color: #e8f6ff;
      }
      .e86-settings__head p {
        margin: 2px 0 0;
        font-size: 11px;
        color: #6d90ab;
        letter-spacing: 0.06em;
      }
      .e86-settings__badge {
        font-family: var(--e86-mono);
        font-size: 9px;
        letter-spacing: 0.2em;
        color: var(--e86-line);
        border: 1px solid rgba(63, 182, 255, 0.34);
        padding: 3px 7px;
        white-space: nowrap;
      }
      .e86-row {
        display: grid;
        grid-template-columns: 148px 1fr;
        gap: 12px;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px dashed rgba(63, 182, 255, 0.14);
      }
      .e86-row:last-child { border-bottom: none; }
      .e86-row__label { font-size: 12px; color: #9dc4dd; letter-spacing: 0.06em; }
      .e86-row__hint { display: block; font-size: 10px; color: #4f7593; margin-top: 2px; letter-spacing: 0; }
      .e86-control {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: flex-start;
      }
      .e86-switch {
        position: relative;
        width: 38px;
        height: 18px;
        border: 1px solid rgba(63, 182, 255, 0.4);
        background: rgba(8, 23, 38, 0.9);
        cursor: pointer;
        padding: 0;
        transition: background 0.16s, border-color 0.16s;
      }
      .e86-switch i {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 12px;
        height: 12px;
        background: #4f7593;
        transition: transform 0.16s, background 0.16s;
      }
      .e86-switch[aria-pressed="true"] {
        border-color: var(--e86-line);
        background: rgba(63, 182, 255, 0.16);
      }
      .e86-switch[aria-pressed="true"] i {
        transform: translateX(20px);
        background: var(--e86-glow);
        box-shadow: 0 0 10px var(--e86-glow);
      }
      .e86-seg { display: inline-flex; border: 1px solid rgba(63, 182, 255, 0.34); }
      .e86-seg button {
        border: none;
        border-right: 1px solid rgba(63, 182, 255, 0.24);
        background: transparent;
        color: #7fb2e8;
        font: inherit;
        font-size: 11px;
        padding: 5px 10px;
        cursor: pointer;
        letter-spacing: 0.08em;
      }
      .e86-seg button:last-child { border-right: none; }
      .e86-seg button[aria-pressed="true"] {
        background: rgba(63, 182, 255, 0.18);
        color: #e8f6ff;
      }
      .e86-input {
        flex: 1;
        min-width: 160px;
        background: rgba(8, 23, 38, 0.9);
        border: 1px solid rgba(63, 182, 255, 0.28);
        color: #e8f6ff;
        font: inherit;
        font-size: 12px;
        padding: 6px 8px;
        letter-spacing: 0.04em;
      }
      .e86-input:focus {
        outline: none;
        border-color: var(--e86-line);
        box-shadow: 0 0 0 1px var(--e86-dim);
      }
      .e86-preview__panel {
        width: 320px;
        height: 108px;
        padding: 10px 12px;
        box-sizing: border-box;
        border: 1px solid rgba(63, 182, 255, 0.46);
        box-shadow: 0 0 18px rgba(63, 182, 255, 0.16);
      }
      .e86-preview__title {
        font: 10px/1 var(--e86-mono);
        letter-spacing: 0.2em;
        color: #e8f6ff;
        margin-bottom: 8px;
      }
      .e86-preview__row {
        font: 10px/1.7 var(--e86-mono);
        color: #a6c8de;
      }
      .e86-row__hint[data-warn="1"] { color: #ffb454; }
      .e86-thumbs { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
      .e86-thumbs__btn {
        display: flex; flex-direction: column; align-items: center; gap: 3px;
        padding: 3px; cursor: pointer;
        border: 1px solid rgba(63, 182, 255, 0.18);
        background: rgba(6, 16, 27, 0.7);
        transition: border-color 0.15s, box-shadow 0.15s;
      }
      .e86-thumbs__btn--scene img {
        width: 56px;
        height: 34px;
      }
      .e86-thumbs__btn--scene span { font-family: var(--e86-cjk); letter-spacing: 0.04em; font-size: 9px; }
      .e86-thumbs__btn img {
        width: 34px; height: 34px; display: block;
        object-fit: cover; background: #dceefb;
        filter: grayscale(1) contrast(1.05);
      }
      .e86-thumbs__btn span {
        font: 8px/1 var(--e86-mono);
        letter-spacing: 0.06em;
        color: #6d90ab;
      }
      .e86-thumbs__btn:hover { border-color: rgba(63, 182, 255, 0.45); }
      .e86-thumbs__btn[data-on="1"] {
        border-color: var(--e86-line);
        box-shadow: 0 0 10px rgba(63, 182, 255, 0.45);
      }
      .e86-thumbs__btn[data-on="1"] span { color: #cfe8fa; }
      .e86-range {
        -webkit-appearance: none;
        appearance: none;
        width: 240px;
        height: 18px;
        background: transparent;
        cursor: pointer;
      }
      .e86-range::-webkit-slider-runnable-track {
        height: 4px;
        background: linear-gradient(90deg, #0b1a29 0%, #3a688f 100%);
        border: 1px solid rgba(63, 182, 255, 0.34);
      }
      .e86-range::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 12px;
        height: 16px;
        margin-top: -7px;
        background: var(--e86-glow);
        border: 1px solid rgba(4, 8, 15, 0.9);
        box-shadow: 0 0 10px rgba(63, 182, 255, 0.8);
      }
      .e86-range:focus { outline: none; }
      .e86-range__value {
        font: 11px/1 var(--e86-mono);
        color: #9fd8ff;
        min-width: 26px;
        text-align: right;
      }
      .e86-swatch {
        width: 26px;
        height: 26px;
        border: 1px solid rgba(63, 182, 255, 0.3);
        cursor: pointer;
        padding: 0;
        position: relative;
      }
      .e86-swatch[aria-pressed="true"] {
        border-color: #e8f6ff;
        box-shadow: 0 0 12px rgba(63, 182, 255, 0.6);
      }
      .e86-swatch[aria-pressed="true"]::after {
        content: "";
        position: absolute;
        inset: 3px;
        border: 1px solid rgba(4, 8, 15, 0.8);
      }
      .e86-btn {
        border: 1px solid rgba(63, 182, 255, 0.34);
        background: rgba(63, 182, 255, 0.08);
        color: #cfe8f8;
        font: inherit;
        font-size: 11px;
        padding: 6px 12px;
        cursor: pointer;
        letter-spacing: 0.1em;
        transition: background 0.15s, border-color 0.15s, color 0.15s;
      }
      .e86-btn:hover { background: rgba(63, 182, 255, 0.18); border-color: var(--e86-line); color: #e8f6ff; }
      .e86-settings__note {
        font-size: 11px;
        line-height: 1.7;
        color: #6d90ab;
        border-left: 2px solid rgba(63, 182, 255, 0.34);
        padding: 6px 10px;
        background: rgba(8, 23, 38, 0.5);
      }
      .e86-settings__note code {
        font-family: var(--e86-mono);
        font-size: 10px;
        color: #9fd8ff;
        background: rgba(63, 182, 255, 0.1);
        padding: 1px 4px;
      }
    `;

    /* ------------------------------------------------------------- primitives */

    function StyleTag(props) {
      return h('style', { dangerouslySetInnerHTML: { __html: props.css } });
    }

    function Emblem() {
      return h('svg', {
        viewBox: '0 0 100 100',
        className: 'e86-emblem',
        'aria-hidden': true,
        focusable: 'false',
      },
        h('path', {
          d: 'M50 3 L93 26 L93 74 L50 97 L7 74 L7 26 Z',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.6,
          opacity: 0.9,
        }),
        h('path', {
          d: 'M50 11 L85 30 L85 70 L50 89 L15 70 L15 30 Z',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 0.7,
          opacity: 0.5,
        }),
        h('line', { x1: 7, y1: 50, x2: 93, y2: 50, stroke: 'currentColor', strokeWidth: 0.5, opacity: 0.3 }),
        h('text', {
          x: 50,
          y: 58,
          textAnchor: 'middle',
          fontSize: 27,
          fontWeight: 700,
          letterSpacing: 2,
          fill: 'currentColor',
        }, '86'),
        h('text', {
          x: 50,
          y: 73,
          textAnchor: 'middle',
          fontSize: 6,
          letterSpacing: 3.4,
          fill: 'currentColor',
          opacity: 0.72,
        }, 'ZONE')
      );
    }

    function Switch(props) {
      return h('button', {
        type: 'button',
        className: 'e86-switch',
        'aria-pressed': props.value ? 'true' : 'false',
        'aria-label': props.label || 'toggle',
        onClick: () => props.onChange(!props.value),
      }, h('i'));
    }

    function Segmented(props) {
      return h('div', { className: 'e86-seg', role: 'group' },
        props.options.map((option) => h('button', {
          key: option.value,
          type: 'button',
          'aria-pressed': props.value === option.value ? 'true' : 'false',
          onClick: () => props.onChange(option.value),
        }, option.label))
      );
    }

    /* The M1A4 blueprint sits behind everything as a masked tint: the PNG is
       pure alpha, the colour comes from CSS, so it can dim with the theme and
       never fights the text for contrast. A second child carries the scan. */
    function Blueprint() {
      const on = useSetting('blueprint')[0];
      if (!on) return null;
      return h(React.Fragment, null,
        h(StyleTag, { css: BLUEPRINT_CSS }),
        h('div', { className: 'e86-blueprint', 'aria-hidden': true },
          h('div', { className: 'e86-blueprint__sweep' })
        )
      );
    }

    /* ---------------------------------------------------------------- decor */

    function Decor() {
      const enabled = useSetting('enabled')[0];
      const hud = useSetting('hud')[0];
      useDocumentTitle();
      if (!enabled) return h(StyleTag, { css: BASE_CSS });
      return h(React.Fragment, null,
        h(StyleTag, { css: BASE_CSS }),
        h(StyleTag, { css: SURFACE_CSS }),
        h(StyleTag, { css: ACCOUNT_CSS }),
        h(StyleTag, { css: DECOR_CSS }),
        h(Blueprint),
        h('div', { className: 'e86-decor', 'aria-hidden': true },
          h('div', { className: 'e86-decor__grid' }),
          h('div', { className: 'e86-decor__scan' }),
          h('div', { className: 'e86-decor__beam' }),
          h('div', { className: 'e86-decor__vignette' }),
          h('div', { className: 'e86-decor__corner e86-decor__corner--tl' }),
          h('div', { className: 'e86-decor__corner e86-decor__corner--br' })
        ),
        hud ? h(HudAvatar) : null
      );
    }

    /* --------------------------------------------------------- the backdrop */

    /* Nothing to render but the stylesheet: the image itself is a background on
       <html>, set by syncRoot, so it sits behind every shell surface. */
    function Backdrop() {
      const on = useSetting('bg')[0];
      const strength = useSetting('bgStrength')[0];
      if (!on || strength === 'off') return null;
      return h(StyleTag, { css: BG_CSS });
    }

    /* --------------------------------------------------------------- hex rain */

    function HexRain() {
      const on = useSetting('rain')[0];
      React.useEffect(() => {
        if (!on) return undefined;
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
        const canvas = document.createElement('canvas');
        canvas.id = 'e86-rain';
        canvas.setAttribute('aria-hidden', 'true');
        canvas.style.cssText = [
          'position:fixed', 'inset:0', 'width:100%', 'height:100%',
          'z-index:-1', 'pointer-events:none', 'opacity:.45', 'mix-blend-mode:screen',
          'mask-image:radial-gradient(58% 62% at 50% 48%, transparent 0%, transparent 36%, #000 80%)',
          '-webkit-mask-image:radial-gradient(58% 62% at 50% 48%, transparent 0%, transparent 36%, #000 80%)',
        ].join(';');
        document.body.appendChild(canvas);
        const ctx = canvas.getContext('2d');
        const GLYPHS = '0123456789ABCDEF';
        let columns = [];
        let raf = 0;
        let last = 0;

        const resize = () => {
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight;
          const count = Math.ceil(canvas.width / 22);
          columns = Array.from({ length: count }, () => ({
            y: Math.random() * canvas.height,
            speed: 18 + Math.random() * 34,
            glyphs: Array.from({ length: 10 }, () => GLYPHS[Math.floor(Math.random() * 16)]),
          }));
          ctx.font = '13px ui-monospace, Menlo, monospace';
        };

        const draw = (now) => {
          raf = window.requestAnimationFrame(draw);
          if (now - last < 90) return;   // ~11 fps, plenty for rain
          last = now;
          if (document.hidden) return;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          columns.forEach((col, index) => {
            col.y += col.speed * 0.09;
            if (col.y > canvas.height + 40) {
              col.y = -40 - Math.random() * 120;
              col.glyphs = col.glyphs.map(() => GLYPHS[Math.floor(Math.random() * 16)]);
            }
            for (let i = 0; i < col.glyphs.length; i += 1) {
              const y = col.y - i * 16;
              if (y < -20 || y > canvas.height + 20) continue;
              const bright = i === 0;
              ctx.fillStyle = bright ? 'rgba(190,245,255,0.55)' : 'rgba(63,182,255,' + (0.20 - i * 0.012).toFixed(3) + ')';
              ctx.fillText(col.glyphs[i], index * 22, y);
            }
          });
        };

        resize();
        window.addEventListener('resize', resize);
        raf = window.requestAnimationFrame(draw);

        /* A hidden window has no business burning frames. rAF already slows
           down when the tab is backgrounded, but this stops it outright. */
        const onVisibility = () => {
          if (document.hidden) {
            window.cancelAnimationFrame(raf);
            raf = 0;
          } else if (!raf) {
            last = 0;
            raf = window.requestAnimationFrame(draw);
          }
        };
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
          if (raf) window.cancelAnimationFrame(raf);
          window.removeEventListener('resize', resize);
          document.removeEventListener('visibilitychange', onVisibility);
          if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        };
      }, [on]);
      return null;
    }

    /* ----------------------------------------------------------- hero watermark */

    function HeroMark() {
      const on = useSetting('heroMark')[0];
      if (!on) return null;
      return h('div', {
        'aria-hidden': true,
        style: {
          fontFamily: '"Arial Black", Helvetica, sans-serif',
          fontWeight: 900,
          fontSize: 132,
          lineHeight: '1',
          letterSpacing: '-6px',
          color: 'transparent',
          WebkitTextStroke: '1.1px rgba(63, 182, 255, 0.34)',
          userSelect: 'none',
          pointerEvents: 'none',
        },
      }, '86');
    }

    /* -------------------------------------------------------------- status strip */

    function StatusStrip() {
      const on = useSetting('ticker')[0];
      const data = useMetrics(on);
      if (!on) return null;
      const pct = (v) => (Number.isFinite(v) ? Math.round(v) + '%' : '—');
      const item = (label, value) => h('span', { className: 'e86-ticker__item' },
        h('b', null, label), h('i', null, value), h('s', null, '·'));
      return h(React.Fragment, null,
        h(StyleTag, { css: TICKER_CSS }),
        h('div', { className: 'e86-ticker', 'aria-hidden': true },
          h('span', { className: 'e86-ticker__tag' }, 'LINK'),
          h('div', { className: 'e86-ticker__view' },
            h('div', { className: 'e86-ticker__track' },
              item('CPU', pct(data && data.cpu)),
              item('MEM', pct(data && data.memory && data.memory.percent)),
              item('DISK', pct(data && data.disk && data.disk.percent)),
              item('LOAD', data && data.load && Number.isFinite(data.load[0]) ? data.load[0].toFixed(2) : '—'),
              item('UPTIME', data && Number.isFinite(data.uptime) ? Math.floor(data.uptime / 3600) + 'h' : '—'),
              item('PARA-RAID', 'ONLINE'),
              item('ZONE', '86 / 88'),
              item('CPU', pct(data && data.cpu)),
              item('MEM', pct(data && data.memory && data.memory.percent)),
              item('DISK', pct(data && data.disk && data.disk.percent)),
              item('LOAD', data && data.load && Number.isFinite(data.load[0]) ? data.load[0].toFixed(2) : '—'),
              item('UPTIME', data && Number.isFinite(data.uptime) ? Math.floor(data.uptime / 3600) + 'h' : '—'),
              item('PARA-RAID', 'ONLINE'),
              item('ZONE', '86 / 88')
            )
          )
        )
      );
    }

    /* ------------------------------------------------------------- the lockup */

    /* The title card's "86" lockup, pinned where the shell puts its own brand
       row. pointer-events stays none so the sidebar's buttons underneath keep
       working even though the plate paints over them. */
    function LogoPlate() {
      const on = useSetting('logo')[0];
      if (!on) return null;
      return h(React.Fragment, null,
        h(StyleTag, { css: LOGO_CSS }),
        h('div', { className: 'e86-logo', 'aria-hidden': true },
          h('div', { className: 'e86-logo__sweep' }),
          h('span', { className: 'e86-logo__num' }, '86'),
          h('div', { className: 'e86-logo__side' },
            h('span', { className: 'e86-logo__kana' }, '\u30FC\u30A8\u30A4\u30C6\u30A3\u30B7\u30C3\u30AF\u30B9\u30FC'),
            h('span', { className: 'e86-logo__box' }, 'EIGHTY SIX')
          )
        )
      );
    }

    /* --------------------------------------------------------------- the HUD */

    function HudAvatar() {
      const size = 'lg';
      const mode = useSetting('avatarMode')[0];
      const art = useSetting('avatarArt')[0];
      const artRef = React.useRef(null);
      const imgRef = React.useRef(null);

      const source = avatarSrc(art);

      /* The pale card behind the line art is what makes multiply produce a
         bright ID card. When another stylesheet wins, the art blends with the
         dark frame instead and the whole portrait turns grey — so both the
         field and the blend mode are stamped inline with !important. */
      React.useEffect(() => {
        const art = artRef.current;
        const img = imgRef.current;
        if (art) {
          if (mode === 'id') {
            art.style.setProperty('background', 'linear-gradient(160deg, #dceefb 0%, #a6cce6 100%)', 'important');
          } else if (mode === 'duotone') {
            art.style.setProperty('background', 'linear-gradient(160deg, #3fb6ff 0%, #1d6ea8 100%)', 'important');
          } else {
            art.style.setProperty('background', '#04080f', 'important');
          }
          art.style.setProperty('isolation', 'isolate', 'important');
        }
        if (img) {
          img.style.setProperty('mix-blend-mode', mode === 'original' ? 'normal' : 'multiply', 'important');
        }
      }, [mode, size]);
      const [failed, setFailed] = React.useState(false);
      /* A new portrait is a new <img>: clear the failure flag so the fallback
         emblem can be replaced by a working image. */
      React.useEffect(() => { setFailed(false); }, [size, source]);
      return h(React.Fragment, null,
        h(StyleTag, { css: HUD_CSS }),
        h('div', { className: 'e86-hud', 'data-size': size, 'aria-hidden': true },
          h('div', { className: 'e86-hud__frame' },
            h('div', {
              ref: artRef,
              className: 'e86-hud__art',
              'data-mode': mode,
              'data-emblem': failed ? '1' : '0',
            },
              failed
                ? h(Emblem)
                : h('img', {
                    ref: imgRef,
                    className: 'e86-hud__img',
                    src: source,
                    alt: '',
                    draggable: false,
                    onError: () => setFailed(true),
                  })
            ),
            h('div', { className: 'e86-hud__sweep', 'aria-hidden': true }),
            h('div', { className: 'e86-hud__tear', 'aria-hidden': true }),
            h('span', { className: 'e86-hud__corner e86-hud__corner--tl' }),
            h('span', { className: 'e86-hud__corner e86-hud__corner--tr' }),
            h('span', { className: 'e86-hud__corner e86-hud__corner--bl' }),
            h('span', { className: 'e86-hud__corner e86-hud__corner--br' })
          ),
          h('div', { className: 'e86-hud__plate' },
            h('b', null, 'VLADILENA'),
            h('span', null, 'MILIZÉ'),
            h('em', null, 'HANDLER 01')
          ),
          h('div', { className: 'e86-hud__status' },
            h('i'),
            h('span', null, 'PARA-RAID ONLINE')
          )
        )
      );
    }

    /* --------------------------------------------------------------- the rail */

    let lastMetricsError = 0;

    function useMetrics(active) {
      const state = React.useState(null);
      React.useEffect(() => {
        if (!active) return undefined;
        let cancelled = false;
        let timer = null;
        const tick = () => {
          fetch('/86-ui/metrics', { headers: { Accept: 'application/json' } })
            .then((response) => (response.ok ? response.json() : null))
            .then((payload) => {
              if (!cancelled && payload && payload.ok) state[1](payload.data);
            })
            .catch(() => {
              const now = Date.now();
              if (now - lastMetricsError > 30000) {
                lastMetricsError = now;
                emitEvent('warn', '指标轮询失败，保留上次采样');
              }
            })
            .finally(() => {
              if (!cancelled) timer = window.setTimeout(tick, 2000);
            });
        };
        tick();
        return () => {
          cancelled = true;
          if (timer) window.clearTimeout(timer);
        };
      }, [active]);
      return state[0];
    }

    function rateText(bps) {
      if (!Number.isFinite(bps)) return '—';
      if (bps < 1024) return Math.round(bps) + ' B/s';
      return formatBytes(bps) + '/s';
    }

    function formatBytes(bytes) {
      if (!Number.isFinite(bytes) || bytes <= 0) return '—';
      const units = ['B', 'KB', 'MB', 'GB', 'TB'];
      let value = bytes;
      let unit = 0;
      while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
      }
      return value.toFixed(value >= 10 || unit === 0 ? 0 : 1) + units[unit];
    }

    /* Collapsed sections are remembered across reloads; one JSON array in
       localStorage, nothing more. */
    const COLLAPSE_KEY = 'e86:collapsed';

    function useCollapse(id) {
      const state = React.useState(() => {
        try { return (JSON.parse(window.localStorage.getItem(COLLAPSE_KEY) || '[]')).indexOf(id) >= 0; }
        catch (e) { return false; }
      });
      const toggle = () => {
        state[1]((previous) => {
          const next = !previous;
          try {
            const list = JSON.parse(window.localStorage.getItem(COLLAPSE_KEY) || '[]').filter((x) => x !== id);
            if (next) list.push(id);
            window.localStorage.setItem(COLLAPSE_KEY, JSON.stringify(list));
          } catch (e) { /* storage blocked */ }
          return next;
        });
      };
      return [state[0], toggle];
    }

    function RailSection(props) {
      const pair = useCollapse(props.id);
      const collapsed = pair[0];
      const toggle = pair[1];
      return h('div', { className: 'e86-rail__section', 'data-collapsed': collapsed ? '1' : '0' },
        h('div', {
          className: 'e86-rail__label e86-rail__label--click',
          role: 'button',
          tabIndex: 0,
          'aria-expanded': collapsed ? 'false' : 'true',
          onClick: toggle,
          onKeyDown: (event) => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(); }
          },
        },
          h('span', null, props.label),
          h('span', { className: 'e86-rail__right' },
            props.right || null,
            h('i', { className: 'e86-rail__chev' }, collapsed ? '▸' : '▾')
          )
        ),
        collapsed ? null : h('div', { className: 'e86-rail__body' }, props.children)
      );
    }

    /* Sector radar: a rotating sweep plus a few blips. Pure CSS, no canvas. */
    function SectorRadar(props) {
      const blips = props.blips || 3;
      return h('div', { className: 'e86-radar', 'aria-hidden': true },
        h('div', { className: 'e86-radar__rings' }),
        h('div', { className: 'e86-radar__sweep' }),
        Array.from({ length: blips }, (_, index) => h('i', {
          key: index,
          className: 'e86-radar__blip',
          style: {
            left: (28 + index * 17) + '%',
            top: (62 - index * 13) + '%',
            animationDelay: (index * 0.9).toFixed(1) + 's',
          },
        }))
      );
    }

    /* 60 samples at the 2 s poll interval = a two minute window. The polyline is
       built from the tail of the history so a fresh page starts narrow instead
       of drawing a fake flat line. */
    function Sparkline(props) {
      const values = (props.values || []).filter((v) => Number.isFinite(v));
      const width = 200;
      const height = 26;
      if (values.length < 2) {
        return h('svg', { className: 'e86-spark', viewBox: '0 0 ' + width + ' ' + height, preserveAspectRatio: 'none' },
          h('line', { x1: 0, y1: height - 1, x2: width, y2: height - 1, className: 'e86-spark__base' })
        );
      }
      const step = width / Math.max(1, values.length - 1);
      const points = values.map((value, index) => {
        const clamped = Math.max(0, Math.min(100, value));
        const y = height - (clamped / 100) * (height - 2) - 1;
        return (index * step).toFixed(2) + ',' + y.toFixed(2);
      });
      const area = 'M0,' + height + ' L' + points.join(' L') + ' L' + width + ',' + height + ' Z';
      return h('svg', {
        className: 'e86-spark',
        viewBox: '0 0 ' + width + ' ' + height,
        preserveAspectRatio: 'none',
        'aria-hidden': true,
      },
        h('line', { x1: 0, y1: height / 2, x2: width, y2: height / 2, className: 'e86-spark__grid' }),
        h('path', { d: area, className: 'e86-spark__area' }),
        h('polyline', { points: points.join(' '), className: 'e86-spark__line' })
      );
    }

    function Gauge(props) {
      const percent = Number.isFinite(props.percent) ? Math.max(0, Math.min(100, props.percent)) : null;
      return h('div', { className: 'e86-gauge' },
        h('span', null, props.label),
        h('div', { className: 'e86-gauge__bar' },
          h('i', { style: { width: (percent === null ? 0 : percent) + '%' } })
        ),
        h('b', null, percent === null ? '—' : percent.toFixed(0) + '%')
      );
    }

    function SystemMonitor(props) {
      const data = props.data;
      const history = React.useRef([]);
      const [, tick] = React.useState(0);
      const lastAt = React.useRef(0);
      const lastCpu = React.useRef(null);
      React.useEffect(() => {
        if (!data || !Number.isFinite(data.cpu)) return;
        if (lastAt.current === data.updatedAt) return;
        lastAt.current = data.updatedAt;
        history.current = history.current.concat([data.cpu]).slice(-60);
        tick((n) => n + 1);
        const previous = lastCpu.current;
        lastCpu.current = data.cpu;
        if (previous !== null) {
          if (previous <= 85 && data.cpu > 85) emitEvent('warn', 'CPU 越过 85%（' + Math.round(data.cpu) + '%）');
          if (previous > 70 && data.cpu <= 70) emitEvent('info', 'CPU 回落至 ' + Math.round(data.cpu) + '%');
        }
      }, [data]);
      return h(RailSection, {
        id: 'sys',
        label: '系统 / SYSTEM',
        right: h('u', null, data && data.platform ? data.platform.toUpperCase() : 'SYNC'),
      },
        h('div', { className: 'e86-spark-row' },
          h('span', null, 'CPU'),
          h(Sparkline, { values: history.current }),
          h('b', null, data && Number.isFinite(data.cpu) ? Math.round(data.cpu) + '%' : '—')
        ),
        h('div', { className: 'e86-rail__gauges' },
          h(Gauge, { label: 'MEM', percent: data && data.memory ? data.memory.percent : null }),
          h(Gauge, { label: 'DISK', percent: data && data.disk ? data.disk.percent : null })
        ),
        h('div', { className: 'e86-net' },
          h('span', null, '↑ ' + rateText(data && data.network ? data.network.txBps : null)),
          h('span', null, '↓ ' + rateText(data && data.network ? data.network.rxBps : null))
        ),
        h('div', { className: 'e86-rail__label', style: { marginTop: 8, marginBottom: 0 } },
          h('span', null,
            data && data.memory
              ? formatBytes(data.memory.used) + ' / ' + formatBytes(data.memory.total)
              : '等待链路'
          ),
          h('u', null,
            data && data.load && Number.isFinite(data.load[0]) ? data.load[0].toFixed(2) : '—'
          )
        )
      );
    }

    function LinkWave(props) {
      const cpu = props && props.data && Number.isFinite(props.data.cpu) ? props.data.cpu : null;
      /* Link quality is derived, not invented: an idle machine holds the link
         near 99%, a loaded one drops it towards the mid 80s. */
      const sync = cpu === null ? null : Math.max(82, 99.6 - cpu * 0.16);
      const bars = [];
      for (let i = 0; i < 34; i += 1) {
        bars.push(h('i', {
          key: i,
          style: {
            animationDelay: ((i % 7) * 0.13 + (i % 3) * 0.07).toFixed(2) + 's',
            animationDuration: (1.4 + (i % 5) * 0.16).toFixed(2) + 's',
          },
        }));
      }
      return h(RailSection, { id: 'link', label: 'Para-RAID 链路', right: h('u', null, 'SYNC') },
        h('div', { className: 'e86-linktop' },
          h(SectorRadar, { blips: 3 }),
          h('div', { className: 'e86-sync' },
            h('b', null, sync === null ? '—' : sync.toFixed(1)),
            h('span', null, '%')
          )
        ),
        h('div', { className: 'e86-rail__wave' }, bars)
      );
    }

    function EventLog() {
      const rows = useEvents();
      const shown = rows.slice(-7).reverse();
      return h(RailSection, {
        id: 'events',
        label: '事件流',
        right: h('span', { className: 'e86-rail__live' }, 'LIVE'),
      },
        h('div', { className: 'e86-log' },
          shown.length === 0
            ? h('div', { className: 'e86-log__row' },
                h('time', null, '--:--:--'),
                h('span', null, '等待事件…')
              )
            : shown.map((row) => h('div', {
                className: 'e86-log__row',
                key: row.id,
                'data-level': row.level,
              },
                h('time', null, new Date(row.at).toLocaleTimeString('zh-CN', { hour12: false })),
                h('span', null, (row.level === 'warn' ? '⚠ ' : '') + row.text)
              ))
        )
      );
    }

    function CommsStub() {
      return h('div', { className: 'e86-comms' },
        h('button', { type: 'button', disabled: true, title: '音源未接入' }, '▶'),
        h('div', null,
          h('b', null, 'COMMS · 音源未接入'),
          h('span', null, '把音频放进 assets/ 后在此启用')
        )
      );
    }

    /* Three switches that matter often enough to deserve a home on the panel
       itself instead of two clicks away in settings. */
    function QuickToggles() {
      const [scan, setScan] = useSetting('scan');
      const [rain, setRain] = useSetting('rain');
      const [bg, setBg] = useSetting('bg');
      const items = [
        { key: '线', label: '扫描线', value: scan, toggle: () => setScan(!scan) },
        { key: '雨', label: '数据雨', value: rain, toggle: () => setRain(!rain) },
        { key: '图', label: '背景图', value: bg, toggle: () => setBg(!bg) },
      ];
      return h('div', { className: 'e86-quick' },
        items.map((item) => h('button', {
          key: item.key,
          type: 'button',
          className: 'e86-quick__btn',
          'data-on': item.value ? '1' : '0',
          'aria-pressed': item.value ? 'true' : 'false',
          title: item.label + (item.value ? '：开' : '：关'),
          onClick: item.toggle,
        }, item.key)),
        /* ⌘R is not reliable inside the app window — this is the escape hatch. */
        h('button', {
          type: 'button',
          className: 'e86-quick__btn e86-quick__btn--reload',
          title: '重新加载界面',
          onClick: () => window.location.reload(),
        }, '↻')
      );
    }

    function Rail() {
      const [open, setOpen] = useSetting('railOpen');
      const [bright] = useSetting('railBright');
      const railRef = React.useRef(null);
      /* The profile's other skin styles the shell's panels itself, and its
         rules outrank ours. Inline styles with !important are the only thing
         it cannot outrank, so the surface is stamped directly on the node. */
      React.useEffect(() => {
        const el = railRef.current;
        if (!el) return;
        const surface = railSurface(bright);
        el.style.setProperty('background', `linear-gradient(180deg, ${surface.top} 0%, ${surface.bottom} 100%)`, 'important');
        el.style.setProperty('border', '1px solid rgba(63, 182, 255, 0.40)', 'important');
        el.style.setProperty('box-shadow', '0 18px 60px rgba(0, 0, 0, 0.62), 0 0 34px rgba(63, 182, 255, 0.14), 0 0 0 1px rgba(120, 200, 255, 0.08) inset, 0 1px 0 rgba(150, 220, 255, 0.10) inset', 'important');
        el.style.setProperty('backdrop-filter', 'blur(14px) saturate(1.1)', 'important');
        el.style.setProperty('-webkit-backdrop-filter', 'blur(14px) saturate(1.1)', 'important');
        el.style.setProperty('color', '#cfe8f8', 'important');

        /* Same treatment for the type inside: a skin that paints `aside *`
           would otherwise get the last word on every label. */
        const INK = {
          '.e86-rail__title b': '#e8f6ff',
          '.e86-rail__title em': '#a3c4da',
          '.e86-rail__label': '#a6c8de',
          '.e86-rail__label u': '#3fb6ff',
          '.e86-gauge span': '#b8dcf5',
          '.e86-gauge b': '#cfe8f8',
          '.e86-log__row time': '#88b0cb',
          '.e86-log__row span': '#cfe9fa',
          '.e86-rail__host': '#8fb3cd',
          '.e86-rail__sim': '#a6c8de',
          '.e86-rail__close': '#bfe0f5',
          '.e86-comms b': '#9cc8f2',
          '.e86-comms span': '#8fb3cd',
        };
        Object.keys(INK).forEach((selector) => {
          el.querySelectorAll(selector).forEach((node) => {
            node.style.setProperty('color', INK[selector], 'important');
          });
        });
      });
      /* One poll for the whole desk: the rail only mounts when open, so this
         effect is also the on/off switch for the metrics loop. */
      const metrics = useMetrics(open);
      React.useEffect(() => {
        emitEvent('info', open ? '状态台已展开' : '状态台已收起');
      }, [open]);

      /* Supply drop is announced at 03:00 local; the footer counts down to the
         next one instead of printing a static string. */
      const [countdown, setCountdown] = React.useState('');
      React.useEffect(() => {
        if (!open) return undefined;
        const tickText = () => {
          const now = new Date();
          const next = new Date(now);
          next.setHours(3, 0, 0, 0);
          if (next <= now) next.setDate(next.getDate() + 1);
          const total = Math.max(0, Math.floor((next - now) / 1000));
          const h = String(Math.floor(total / 3600)).padStart(2, '0');
          const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
          const sec = String(total % 60).padStart(2, '0');
          setCountdown(h + ':' + m + ':' + sec);
        };
        tickText();
        const timer = window.setInterval(tickText, 1000);
        return () => window.clearInterval(timer);
      }, [open]);

      const cpu = metrics && Number.isFinite(metrics.cpu) ? metrics.cpu : null;
      const disk = metrics && metrics.disk ? metrics.disk.percent : null;
      const alert = (cpu !== null && cpu > 85) || (disk !== null && disk > 90);
      if (!open) return null;
      return h(React.Fragment, null,
        h(StyleTag, { css: RAIL_CSS }),
        h('aside', {
          ref: railRef,
          className: 'e86-rail',
          'data-alert': alert ? '1' : '0',
          'aria-label': '第 86 区 战术状态',
        },
          h('div', { className: 'e86-rail__head' },
            h('div', { className: 'e86-rail__title' },
              h('b', null, 'ZONE 86'),
              h('em', null, 'TACTICAL DESK'),
              alert ? h('span', { className: 'e86-rail__alarm' }, '负载偏高') : null
            ),
            h(QuickToggles),
            h('button', {
              type: 'button',
              className: 'e86-rail__close',
              'aria-label': '收起状态台',
              onClick: () => setOpen(false),
            }, '×')
          ),
          h('div', { className: 'e86-rail__scroll' },
            h(SystemMonitor, { data: metrics }),
            h(LinkWave, { data: metrics }),
            h(EventLog),
            h('div', { className: 'e86-rail__section' }, h(CommsStub))
          ),
          h('div', { className: 'e86-rail__foot' },
            h('div', { className: 'e86-rail__host' },
              metrics && metrics.hostname ? metrics.hostname : 'LOCAL NODE'
            ),
            h('div', { className: 'e86-rail__sim' }, 'SIM UI')
          ),
          h('div', { className: 'e86-rail__stats' },
            h('span', null, 'UPTIME ' + (metrics && Number.isFinite(metrics.uptime) ? Math.floor(metrics.uptime / 3600) + 'h' : '—')),
            h('span', null, 'RSS ' + (metrics && metrics.rss ? formatBytes(metrics.rss) : '—')),
            h('span', null, '补给 ' + (countdown || '--:--:--'))
          )
        )
      );
    }

    function RailToggle() {
      const [open, setOpen] = useSetting('railOpen');
      const [hover, setHover] = React.useState(false);
      const style = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        width: '100%',
        padding: '6px 8px',
        borderRadius: 0,
        border: '1px solid ' + (open ? 'var(--e86-line)' : 'rgba(63, 182, 255, 0.38)'),
        background: open
          ? 'rgba(63, 182, 255, 0.18)'
          : hover ? 'rgba(63, 182, 255, 0.12)' : 'rgba(63, 182, 255, 0.06)',
        color: '#e8f6ff',
        cursor: 'pointer',
        font: 'inherit',
        fontSize: 12,
        letterSpacing: '0.1em',
        boxShadow: open ? '0 0 14px rgba(63, 182, 255, 0.42)' : 'none',
        transition: 'background .15s, box-shadow .15s, border-color .15s',
      };
      return h('div', { className: 'e86-account' },
        h('div', { className: 'e86-account__rank' },
          h('span', { className: 'e86-account__grade' }, 'HANDLER 01'),
          h('em', null, '管制指挥官'),
          h('i', { className: 'e86-account__dot' }),
          h('span', { className: 'e86-account__link' }, 'PARA-RAID')
        ),
        h('button', {
        type: 'button',
        'aria-label': '战术状态台',
        'aria-pressed': open ? 'true' : 'false',
        title: '战术状态台',
        style,
        onMouseEnter: () => setHover(true),
        onMouseLeave: () => setHover(false),
        onClick: () => setOpen(!open),
      },
        h('span', { 'aria-hidden': true, style: { fontSize: 13, lineHeight: 1 } }, '▤'),
        h('span', null, '战术状态')
        )
      );
    }

    /* ------------------------------------------------------- shell copy swap */

    function BrandName() {
      const brand = useSetting('brand')[0];
      return h('span', {
        'data-e86-brand': '',
        style: {
          fontFamily: 'inherit',
          fontWeight: 600,
          letterSpacing: '0.12em',
          color: '#e8f6ff',
        },
      }, brand || HERO_BRAND_DEFAULT);
    }

    /* The window title is owned by the shell and re-rendered on navigation, so
       it is patched with an observer rather than by rendering a slot. The
       original is restored the moment the theme is disarmed. */
    function useDocumentTitle() {
      const title = useSetting('title')[0];
      React.useEffect(() => {
        const original = document.title;
        const applyTitle = () => {
          const desired = title || TITLE_DEFAULT;
          if (document.title !== desired) document.title = desired;
        };
        applyTitle();
        const observer = new MutationObserver(applyTitle);
        const head = document.querySelector('head');
        if (head) observer.observe(head, { childList: true, subtree: true, characterData: true });
        return () => {
          observer.disconnect();
          document.title = original;
        };
      }, [title]);
    }

    /* --------------------------------------------------------- settings page */

    function Row(props) {
      return h('div', { className: 'e86-row', 'data-warn': props.warn ? '1' : '0' },
        h('div', { className: 'e86-row__label' },
          props.label,
          props.hint ? h('span', { className: 'e86-row__hint', 'data-warn': props.warn ? '1' : '0' }, props.hint) : null
        ),
        h('div', { className: 'e86-control' }, props.children)
      );
    }

    function SettingsPage() {
      const [enabled, setEnabled] = useSetting('enabled');
      const [scan, setScan] = useSetting('scan');
      const [grid, setGrid] = useSetting('grid');
      const [vignette, setVignette] = useSetting('vignette');
      const [bg, setBg] = useSetting('bg');
      const [railBright, setRailBright] = useSetting('railBright');
      const [hudBright, setHudBright] = useSetting('hudBright');
      const [rain, setRain] = useSetting('rain');
      const [heroMark, setHeroMark] = useSetting('heroMark');
      const [ticker, setTicker] = useSetting('ticker');
      const [tabStyle, setTabStyle] = useSetting('tabStyle');
      const [blueprint, setBlueprint] = useSetting('blueprint');
      const [bgStrength, setBgStrength] = useSetting('bgStrength');
      const [bgScene, setBgScene] = useSetting('bgScene');
      const [logo, setLogo] = useSetting('logo');
      const [hud, setHud] = useSetting('hud');
      const [avatarMode, setAvatarMode] = useSetting('avatarMode');
      const [avatarArt, setAvatarArt] = useSetting('avatarArt');
      /* Is the host new enough to serve ?art=NN? Two fetches, compared by
         length: if the portrait equals the default, the query is being
         ignored and the picker would silently do nothing. */
      const [portraitReady, setPortraitReady] = React.useState(null);
      React.useEffect(() => {
        let alive = true;
        const sizeOf = (url) => window.fetch(url, { cache: 'no-store' })
          .then((r) => (r.ok ? r.arrayBuffer() : null))
          .then((buf) => (buf ? buf.byteLength : -1))
          .catch(() => -1);
        Promise.all([sizeOf(AVATAR_URL), sizeOf(AVATAR_URL + '?art=01')])
          .then((pair) => {
            if (!alive) return;
            setPortraitReady(pair[0] > 0 && pair[1] > 0 && pair[0] !== pair[1]);
          });
        return () => { alive = false; };
      }, []);
      const [railDefault, setRailDefault] = useSetting('railDefault');
      const [brand, setBrand] = useSetting('brand');
      const [title, setTitle] = useSetting('title');

      return h('div', { className: 'e86-settings' },
        h(StyleTag, { css: SETTINGS_CSS }),
        h('div', { className: 'e86-settings__head' },
          h('div', null,
            h('h3', null, '86 -不存在的战区-'),
            h('p', null, '第 86 区 · 蓝黑扫描层 · 蕾娜 HUD · 战术状态台')
          ),
          h('span', { className: 'e86-settings__badge' }, enabled ? 'ZONE ACTIVE' : 'ZONE OFFLINE')
        ),

        h(Row, { label: '主题总开关', hint: '关闭后所有令牌、装饰与状态台一起撤下' },
          h(Switch, { value: enabled, onChange: setEnabled, label: '主题总开关' })
        ),

        h(Row, { label: '扫描线' },
          h(Switch, { value: scan, onChange: setScan, label: '扫描线' })
        ),
        h(Row, { label: '技术网格' },
          h(Switch, { value: grid, onChange: setGrid, label: '技术网格' })
        ),
        h(Row, { label: '暗角' },
          h(Switch, { value: vignette, onChange: setVignette, label: '暗角' })
        ),

        h(Row, { label: '状态台亮度', hint: '左侧滑杆，实时生效' },
          h('input', {
            type: 'range',
            className: 'e86-range',
            min: 0,
            max: 100,
            step: 1,
            value: railBright,
            'aria-label': '状态台亮度',
            onChange: (event) => setRailBright(Number(event.target.value)),
          }),
          h('b', { className: 'e86-range__value' }, String(railBright))
        ),

        h(Row, { label: '头像亮度', hint: '右侧 HUD 的曝光，实时生效' },
          h('input', {
            type: 'range',
            className: 'e86-range',
            min: 0,
            max: 100,
            step: 1,
            value: hudBright,
            'aria-label': '头像亮度',
            onChange: (event) => setHudBright(Number(event.target.value)),
          }),
          h('b', { className: 'e86-range__value' }, String(hudBright))
        ),

        h(Row, { label: '预览', hint: '下面这块就是状态台的真实底色' },
          h('div', { className: 'e86-preview' },
            h('div', {
              className: 'e86-preview__panel',
              style: { background: `linear-gradient(180deg, ${railSurface(railBright).top} 0%, ${railSurface(railBright).bottom} 100%)` },
            },
              h('div', { className: 'e86-preview__title' }, 'ZONE 86 · TACTICAL DESK'),
              h('div', { className: 'e86-preview__row' }, 'CPU  ■■■■■□□□□□  24%'),
              h('div', { className: 'e86-preview__row' }, '战术日志 · 10:58:49  地形数据 · 已更新')
            )
          )
        ),

        h(Row, { label: 'Hex 数据雨', hint: '只落在四周，中心留空' },
          h(Switch, { value: rain, onChange: setRain, label: 'Hex 数据雨' })
        ),
        h(Row, { label: '空会话 86 水印' },
          h(Switch, { value: heroMark, onChange: setHeroMark, label: '空会话 86 水印' })
        ),
        h(Row, { label: '机体图纸水印', hint: 'M1A4 破坏神三视图，铺在内容区背景' },
          h(Switch, { value: blueprint, onChange: setBlueprint, label: '机体图纸水印' })
        ),
        h(Row, { label: '顶栏标签战术化', hint: '给 对话 / 上下文 / 编队 加编号与批示线' },
          h(Switch, { value: tabStyle, onChange: setTabStyle, label: '顶栏标签战术化' })
        ),
        h(Row, { label: '底部状态条', hint: '真实 CPU / 内存 / 磁盘' },
          h(Switch, { value: ticker, onChange: setTicker, label: '底部状态条' })
        ),

        h(Row, { label: '背景画面', hint: '铁轨 = assets/background.jpg · 花海 = assets/background-flowers.jpg' },
          h('div', { className: 'e86-thumbs' },
            SCENES.map((item) => h('button', {
              key: item.id,
              type: 'button',
              className: 'e86-thumbs__btn e86-thumbs__btn--scene',
              'data-on': bgScene === item.id ? '1' : '0',
              title: item.label,
              onClick: () => setBgScene(item.id),
            },
              h('img', { src: backdropSrc(item.id), alt: item.label, draggable: false }),
              h('span', null, item.label)
            ))
          )
        ),
        h(Row, { label: '背景图', hint: 'assets/background.jpg，缺省时纯色' },
          h(Segmented, {
            value: bgStrength,
            onChange: (next) => {
              setBgStrength(next);
              setBg(next !== 'off');
            },
            options: [
              { value: 'off', label: '关' },
              { value: 'soft', label: '淡' },
              { value: 'mid', label: '中' },
              { value: 'strong', label: '浓' },
            ],
          })
        ),

        h(Row, { label: '左上 86 锁标', hint: '覆盖侧栏品牌行，不拦点击' },
          h(Switch, { value: logo, onChange: setLogo, label: '左上 86 锁标' })
        ),

        h(Row, { label: '右上 HUD 头像', hint: '固定右上角，不拦截点击' },
          h(Switch, { value: hud, onChange: setHud, label: 'HUD 头像' })
        ),
        h(Row, {
          label: '头像',
          warn: portraitReady === false,
          hint: portraitReady === null
            ? '右上角 HUD / 状态台页眉'
            : portraitReady
              ? '右上角 HUD / 状态台页眉'
              : '宿主仍是旧版：?art= 被忽略，五个选项会返回同一张图 —— 重启 DSH 后生效',
        },
          h('div', { className: 'e86-thumbs' },
            PORTRAITS.map((item) => h('button', {
              key: item.id,
              type: 'button',
              className: 'e86-thumbs__btn',
              'data-on': avatarArt === item.id ? '1' : '0',
              title: item.label,
              onClick: () => setAvatarArt(item.id),
            },
              h('img', { src: avatarSrc(item.id), alt: item.label, draggable: false }),
              h('span', null, item.id === '00' ? '原' : item.id)
            ))
          )
        ),
        h(Row, { label: '头像呈现', hint: '线稿双色=墨线发光；ID 卡=纸面发光' },
          h(Segmented, {
            value: avatarMode,
            onChange: setAvatarMode,
            options: [
              { value: 'id', label: 'ID 卡' },
              { value: 'duotone', label: '线稿双色' },
              { value: 'original', label: '原图' },
            ],
          })
        ),

        h(Row, { label: '状态台默认展开' },
          h(Switch, {
            value: railDefault,
            onChange: (next) => {
              setRailDefault(next);
              store.set('railOpen', next);
            },
            label: '状态台默认展开',
          })
        ),

        h(Row, { label: '侧栏名称' },
          h('input', {
            className: 'e86-input',
            value: brand,
            maxLength: 24,
            spellCheck: false,
            onChange: (event) => setBrand(event.target.value),
          })
        ),
        h(Row, { label: '窗口标题' },
          h('input', {
            className: 'e86-input',
            value: title,
            maxLength: 40,
            spellCheck: false,
            onChange: (event) => setTitle(event.target.value),
          })
        ),

        h('div', { className: 'e86-settings__note' },
          '头像：把线稿另存为 ',
          h('code', null, 'assets/avatar.png'),
          '（或 .webp/.jpg/.svg）放在插件目录下，刷新即生效；缺省时显示 86 徽记。',
          h('br'),
          '播放器：接口与面板已就位，音源未接入 —— 放入音频后在此启用。'
        ),

        h('div', { style: { display: 'flex', gap: 10 } },
          h('button', {
            type: 'button',
            className: 'e86-btn',
            onClick: () => store.reset(),
          }, '重置全部设置'),
        )
      );
    }

    /* ----------------------------------------------------------- plugin body */

    return {
      inject: ['slots', 'theme'],
      apply(ctx) {
        store.read();
        syncRoot();

        /* The theme only exists in dark. Our token overrides cover the aliases
           the shell exposes, but bubbles, the composer and code blocks are
           painted from the light-mode palette, so the shell itself has to be
           switched — and put back if the theme is turned off. */
        const APPEARANCE_KEY = 'e86-original-appearance';
        let appearanceOriginal = null;

        const pinDark = () => {
          try {
            if (typeof ctx.theme.getTheme !== 'function' || typeof ctx.theme.setTheme !== 'function') return;
            const snapshot = ctx.theme.getTheme() || {};
            const preference = snapshot.preference;
            if (appearanceOriginal === null && preference && preference !== 'dark') {
              appearanceOriginal = preference;
              try { window.localStorage.setItem(APPEARANCE_KEY, preference); } catch (e) { /* ignore */ }
            }
            if (preference !== 'dark') ctx.theme.setTheme('dark');
          } catch (e) { /* theme service unavailable */ }
        };

        const restoreAppearance = () => {
          try {
            let saved = appearanceOriginal;
            if (!saved) { try { saved = window.localStorage.getItem(APPEARANCE_KEY); } catch (e) { saved = null; } }
            appearanceOriginal = null;
            try { window.localStorage.removeItem(APPEARANCE_KEY); } catch (e) { /* ignore */ }
            if (!saved || saved === 'dark') return;
            if (typeof ctx.theme.getTheme !== 'function') return;
            if ((ctx.theme.getTheme() || {}).preference === 'dark') ctx.theme.setTheme(saved);
          } catch (e) { /* ignore */ }
        };

        try { ctx.on('theme/change', () => { if (store.get('enabled')) pinDark(); }); } catch (e) { /* no events */ }

        let themeDisposers = [];
        let wasEnabled = false;
        let slotDisposers = [];

        const armTheme = () => {
          if (themeDisposers.length > 0) return;
          const tokens = {};
          Object.keys(TOKENS).forEach((key) => { tokens[key] = { light: TOKENS[key], dark: TOKENS[key] }; });
          const layer = ctx.theme.register({
            id: THEME_ID,
            colorScheme: 'dark',
            tokens: Object.keys(TOKENS).reduce((acc, key) => {
              acc[key] = TOKENS[key];
              return acc;
            }, {}),
          });
          const override = ctx.theme.overrideTokens(THEME_ID, tokens);
          themeDisposers = [layer, override];
        };

        const disarmTheme = () => {
          themeDisposers.forEach((dispose) => {
            try { if (typeof dispose === 'function') dispose(); } catch (e) { /* already gone */ }
          });
          themeDisposers = [];
        };

        const armSlots = () => {
          if (slotDisposers.length > 0) return;
          const made = [];
          const keep = (dispose) => { made.push(dispose); };

          ctx.slots.inject('shell.overlay', () => keep(ctx.slots.register(
            { name: 'shell.overlay', id: 'e86-decor', order: -100 },
            Decor
          )));

          ctx.slots.inject('shell.overlay', () => keep(ctx.slots.register(
            { name: 'shell.overlay', id: 'e86-rail', order: 90 },
            Rail
          )));

          ctx.slots.inject('shell.overlay', () => keep(ctx.slots.register(
            { name: 'shell.overlay', id: 'e86-rain', order: -150 },
            HexRain
          )));

          ctx.slots.inject('shell.overlay', () => keep(ctx.slots.register(
            { name: 'shell.overlay', id: 'e86-ticker', order: 120 },
            StatusStrip
          )));

          ctx.slots.inject('conversation.hero.brand.mark', () => keep(ctx.slots.register(
            { name: 'conversation.hero.brand.mark', priority: -100 },
            HeroMark
          )));

          ctx.slots.inject('shell.overlay', () => keep(ctx.slots.register(
            { name: 'shell.overlay', id: 'e86-backdrop', order: -200 },
            Backdrop
          )));

          ctx.slots.inject('shell.overlay', () => keep(ctx.slots.register(
            { name: 'shell.overlay', id: 'e86-logo', order: -110 },
            LogoPlate
          )));

          ctx.slots.inject('sidebar.footer.action', () => keep(ctx.slots.register(
            { name: 'sidebar.footer.action', id: 'e86-rail-toggle', order: 10 },
            RailToggle
          )));

          /* priority is ASCENDING for single-occupant slots: the shell's own
             wordmark registers at 0, so the override has to sit below it. */
          ctx.slots.inject('sidebar.brand.name', () => keep(ctx.slots.register(
            { name: 'sidebar.brand.name', priority: -100 },
            BrandName
          )));

          slotDisposers = made;
        };

        const disarmSlots = () => {
          slotDisposers.forEach((dispose) => {
            try { if (typeof dispose === 'function') dispose(); } catch (e) { /* already gone */ }
          });
          slotDisposers = [];
        };

        const sync = () => {
          if (store.get('enabled')) {
            armTheme();
            armSlots();
            pinDark();
            if (!wasEnabled) emitEvent('info', '主题已启用');
            wasEnabled = true;
          } else {
            if (wasEnabled) emitEvent('info', '主题已关闭');
            wasEnabled = false;
            disarmSlots();
            disarmTheme();
            restoreAppearance();
          }
          /* Last, so the inline translucent base wins over the token layer the
             theme just installed. */
          syncRoot();
          /* And again on the next frames: the shell re-applies its own theme
             tokens once it has mounted, which would put the opaque base back. */
          window.setTimeout(() => { try { syncRoot(); } catch (e) { /* gone */ } }, 60);
          window.setTimeout(() => { try { syncRoot(); } catch (e) { /* gone */ } }, 900);
        };

        /* The settings page lives outside the switch: turning the theme off
           must never remove the control that turns it back on. */
        ctx.slots.inject('settings.section', () => ctx.slots.register(
          { name: 'settings.section', id: 'e86-zone', order: 12, label: '第 86 区' },
          SettingsPage
        ));

        /* One line in devtools so a black backdrop can be diagnosed without
           guessing: 200 = the host is serving it, 404 = no file, 401 = auth. */
        try {
          fetch('/86-ui/background', { cache: 'no-store' })
            .then((r) => console.log('[e86] background route:', r.status))
            .catch((e) => console.log('[e86] background route failed:', e.message));
        } catch (e) { /* offline shell */ }

        /* The other skin paints asynchronously (its art arrives with its own
           render), so sweep for the first dozen seconds instead of once. */
        try {
          let ticks = 0;
          const sweeper = window.setInterval(() => {
            ticks += 1;
            try { syncRoot(true); } catch (e) { /* ignore */ }
            if (ticks > 12) window.clearInterval(sweeper);
          }, 1800);
        } catch (e) { /* no timers */ }

        ctx.effect(function () {
          const off = store.subscribe(sync);
          if (store.get('railDefault')) store.set('railOpen', true);
          sync();
          /* The theme service settles a moment after mount; pin again. */
          window.setTimeout(() => { if (store.get('enabled')) pinDark(); }, 400);
          window.setTimeout(() => { if (store.get('enabled')) pinDark(); }, 1800);
          return function () {
            off();
            disarmSlots();
            disarmTheme();
            const root = document.documentElement;
            if (root) {
              root.removeAttribute('data-e86');
              root.removeAttribute('data-e86-scan');
              root.removeAttribute('data-e86-grid');
              root.removeAttribute('data-e86-vignette');
              root.removeAttribute('data-e86-hud');
              root.style.removeProperty('--e86-line');
              root.style.removeProperty('--e86-glow');
              root.style.removeProperty('--e86-dim');
            }
          };
        });
      },
    };
  },
});
