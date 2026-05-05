/* Theme Store — predictive search dropdown + sidebar drawer */
(function () {
  'use strict';

  var ROOT_URL = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
  function rootify(path) {
    if (ROOT_URL.length > 1) return ROOT_URL.replace(/\/$/, '') + path;
    return path;
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function tokenize(q) {
    return String(q || '').trim().split(/\s+/).filter(function (t) { return t.length > 0; });
  }

  function highlight(text, tokens) {
    var safe = escapeHtml(text);
    if (!tokens || tokens.length === 0) return safe;
    var pattern = tokens
      .map(function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); })
      .filter(function (t) { return t.length > 0; })
      .join('|');
    if (!pattern) return safe;
    try {
      var re = new RegExp('(' + pattern + ')', 'ig');
      return safe.replace(re, '<mark>$1</mark>');
    } catch (e) {
      return safe;
    }
  }

  /* Single suggest call. Pass `wildcard: true` to append a star to each token
     for prefix-style matching — Shopify storefront search supports this for
     better partial-match / typo tolerance. */
  function fetchSuggest(query, opts) {
    opts = opts || {};
    var q = query;
    if (opts.wildcard) {
      var toks = tokenize(query).map(function (t) { return t.length >= 2 ? t + '*' : t; });
      q = toks.join(' ');
    }
    var params = new URLSearchParams();
    params.set('q', q);
    params.set('resources[type]', 'product');
    params.set('resources[limit]', String(opts.limit || 8));
    params.set('resources[options][unavailable_products]', 'last');
    return fetch(rootify('/search/suggest.json') + '?' + params.toString(), {
      headers: { 'Accept': 'application/json' },
      credentials: 'same-origin'
    }).then(function (r) {
      if (!r.ok) throw new Error('suggest http ' + r.status);
      return r.json();
    }).then(function (data) {
      var products = (data && data.resources && data.resources.results && data.resources.results.products) || [];
      return products;
    });
  }

  function renderResults(els, products, query) {
    var list = els.list;
    var tokens = tokenize(query);
    list.innerHTML = '';
    if (!products || products.length === 0) {
      els.empty.hidden = false;
      els.footer.hidden = true;
      return;
    }
    els.empty.hidden = true;
    var frag = document.createDocumentFragment();
    products.forEach(function (p, idx) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.className = 'theme-store__suggest-item';
      a.href = p.url || '#';
      a.setAttribute('role', 'option');
      a.id = 'ts-suggest-opt-' + idx;
      a.tabIndex = -1;

      var imgSrc = '';
      if (typeof p.image === 'string') imgSrc = p.image;
      else if (p.image && p.image.url) imgSrc = p.image.url;
      else if (p.featured_image) imgSrc = p.featured_image;

      if (imgSrc) {
        // Ask Shopify CDN for a small, retina-sized variant (44px @2x = 88).
        // Replace any existing width param; otherwise append.
        var sized = imgSrc;
        try {
          if (/cdn\.shopify\.com|cdn\.shopifycdn\.net/.test(sized)) {
            if (/[?&]width=/.test(sized)) {
              sized = sized.replace(/([?&])width=\d+/, '$1width=88');
            } else {
              sized += (sized.indexOf('?') >= 0 ? '&' : '?') + 'width=88';
            }
          }
        } catch (e) { /* keep original */ }

        var img = document.createElement('img');
        img.className = 'theme-store__suggest-img';
        img.alt = '';
        img.loading = 'lazy';
        img.width = 44;
        img.height = 44;
        img.src = sized;
        a.appendChild(img);
      } else {
        var ph = document.createElement('span');
        ph.className = 'theme-store__suggest-img';
        a.appendChild(ph);
      }

      var text = document.createElement('span');
      text.className = 'theme-store__suggest-text';
      var title = document.createElement('span');
      title.className = 'theme-store__suggest-title';
      title.innerHTML = highlight(p.title || '', tokens);
      text.appendChild(title);
      var meta = document.createElement('span');
      meta.className = 'theme-store__suggest-meta';
      var metaParts = [];
      if (p.product_type && String(p.product_type).trim()) metaParts.push(escapeHtml(p.product_type));
      if (p.vendor && String(p.vendor).trim()) metaParts.push(escapeHtml(p.vendor));
      if (typeof p.price === 'string' && p.price.trim()) metaParts.push(p.price);
      if (metaParts.length > 0) {
        meta.innerHTML = metaParts.join(' · ');
        text.appendChild(meta);
      }
      a.appendChild(text);

      li.appendChild(a);
      frag.appendChild(li);
    });
    list.appendChild(frag);
    els.footer.hidden = false;
  }

  class ThemeStore extends HTMLElement {
    connectedCallback() {
      this.sectionId = this.dataset.sectionId;
      this.form = this.querySelector('[data-search-form]');
      this.input = this.querySelector('[data-search-input]');
      this.suggestEls = {
        wrap: this.querySelector('[data-suggest]'),
        list: this.querySelector('[data-suggest-list]'),
        loading: this.querySelector('[data-suggest-loading]'),
        empty: this.querySelector('[data-suggest-empty]'),
        footer: this.querySelector('[data-suggest-footer]'),
        all: this.querySelector('[data-suggest-all]')
      };
      this.sidebar = this.querySelector('[data-sidebar]');
      this.sidebarOverlay = this.querySelector('[data-sidebar-overlay]');
      this.openBtn = this.querySelector('[data-filter-open]');
      this.closeBtn = this.querySelector('[data-filter-close]');

      this.activeIndex = -1;
      this.handleKeyDown = this.handleKeyDown.bind(this);
      this.handleDocumentClick = this.handleDocumentClick.bind(this);

      this.bindSearch();
      this.bindSidebar();
    }

    disconnectedCallback() {
      document.removeEventListener('keydown', this.handleKeyDown);
      document.removeEventListener('click', this.handleDocumentClick);
      if (document.body.classList.contains('ts-no-scroll')) {
        document.body.classList.remove('ts-no-scroll');
        document.body.style.overflow = '';
      }
    }

    bindSearch() {
      if (!this.input || !this.form) return;
      var self = this;
      var run = debounce(function () { self.runSuggest(); }, 180);

      this.input.addEventListener('input', run);
      this.input.addEventListener('focus', function () {
        if (self.input.value.trim().length >= 2) self.runSuggest();
      });
      this.input.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown') { e.preventDefault(); self.moveActive(1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); self.moveActive(-1); }
        else if (e.key === 'Enter' && self.activeIndex >= 0) {
          var items = self.suggestEls.list.querySelectorAll('a.theme-store__suggest-item');
          if (items[self.activeIndex]) {
            e.preventDefault();
            window.location.href = items[self.activeIndex].href;
          }
        } else if (e.key === 'Escape') {
          self.closeSuggest();
          self.input.blur();
        }
      });

      document.addEventListener('keydown', this.handleKeyDown);
      document.addEventListener('click', this.handleDocumentClick);

      if (this.suggestEls.all) {
        this.suggestEls.all.addEventListener('click', function (e) {
          e.preventDefault();
          self.form.submit();
        });
      }
    }

    runSuggest() {
      var q = this.input.value.trim();
      if (q.length < 2) {
        this.closeSuggest();
        return;
      }
      this.openSuggest();
      this.suggestEls.loading.hidden = false;
      this.suggestEls.empty.hidden = true;
      this.suggestEls.footer.hidden = true;
      var self = this;
      var fetchId = (this.fetchId = (this.fetchId || 0) + 1);

      fetchSuggest(q, { limit: 8 }).then(function (products) {
        if (fetchId !== self.fetchId) return;
        if (products && products.length > 0) {
          self.suggestEls.loading.hidden = true;
          renderResults(self.suggestEls, products, q);
          self.updateAllResultsLink(q);
          return null;
        }
        // Typo / partial-match fallback: wildcard each token
        return fetchSuggest(q, { limit: 8, wildcard: true }).then(function (alt) {
          if (fetchId !== self.fetchId) return;
          self.suggestEls.loading.hidden = true;
          renderResults(self.suggestEls, alt || [], q);
          self.updateAllResultsLink(q);
        });
      }).catch(function () {
        if (fetchId !== self.fetchId) return;
        self.suggestEls.loading.hidden = true;
        renderResults(self.suggestEls, [], q);
        self.updateAllResultsLink(q);
      });
    }

    updateAllResultsLink(q) {
      if (!this.suggestEls.all) return;
      var p = new URLSearchParams();
      p.set('q', q);
      p.set('type', 'product');
      this.suggestEls.all.href = rootify('/search') + '?' + p.toString();
    }

    openSuggest() {
      this.suggestEls.wrap.hidden = false;
      this.input.setAttribute('aria-expanded', 'true');
    }
    closeSuggest() {
      this.suggestEls.wrap.hidden = true;
      this.input.setAttribute('aria-expanded', 'false');
      this.activeIndex = -1;
      this.input.removeAttribute('aria-activedescendant');
    }
    moveActive(delta) {
      var items = this.suggestEls.list.querySelectorAll('a.theme-store__suggest-item');
      if (items.length === 0) return;
      this.activeIndex = (this.activeIndex + delta + items.length) % items.length;
      for (var i = 0; i < items.length; i++) {
        var el = items[i];
        if (i === this.activeIndex) {
          el.classList.add('theme-store__suggest-item--active');
          this.input.setAttribute('aria-activedescendant', el.id);
          el.scrollIntoView({ block: 'nearest' });
        } else {
          el.classList.remove('theme-store__suggest-item--active');
        }
      }
    }
    handleKeyDown(e) {
      if (e.key === 'Escape' && !this.suggestEls.wrap.hidden) {
        this.closeSuggest();
      }
    }
    handleDocumentClick(e) {
      if (!this.contains(e.target)) this.closeSuggest();
    }

    /* ========= Sidebar drawer (mobile) ========= */
    bindSidebar() {
      if (!this.sidebar) return;
      var self = this;
      if (this.openBtn) this.openBtn.addEventListener('click', function () { self.toggleSidebar(true); });
      if (this.closeBtn) this.closeBtn.addEventListener('click', function () { self.toggleSidebar(false); });
      if (this.sidebarOverlay) this.sidebarOverlay.addEventListener('click', function () { self.toggleSidebar(false); });
      this.sidebarKeyHandler = function (e) {
        if (e.key === 'Escape' && self.classList.contains('theme-store--sidebar-open')) {
          self.toggleSidebar(false);
        }
      };
      document.addEventListener('keydown', this.sidebarKeyHandler);
    }

    toggleSidebar(open) {
      if (open) {
        this.classList.add('theme-store--sidebar-open');
        if (this.sidebarOverlay) this.sidebarOverlay.hidden = false;
        if (this.openBtn) this.openBtn.setAttribute('aria-expanded', 'true');
        document.body.classList.add('ts-no-scroll');
        document.body.style.overflow = 'hidden';
        // Move focus into drawer for keyboard users
        if (this.closeBtn) {
          var btn = this.closeBtn;
  