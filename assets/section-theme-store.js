/* Theme Store — client-side tag + search filter
   No page reloads. Tag clicks and search input both filter the same grid.
   URL state mirrored via ?tag=<tag> with history.pushState. */
(function () {
  'use strict';

  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }

  function tokenize(q) {
    return String(q || '').toLowerCase().trim().split(/\s+/).filter(function (t) { return t.length > 0; });
  }

  /* Damerau-Levenshtein distance, capped at limit for early exit. */
  function editDistance(a, b, limit) {
    if (a === b) return 0;
    var la = a.length, lb = b.length;
    if (Math.abs(la - lb) > limit) return limit + 1;
    if (la === 0) return lb;
    if (lb === 0) return la;
    var prev = new Array(lb + 1);
    var curr = new Array(lb + 1);
    for (var j = 0; j <= lb; j++) prev[j] = j;
    for (var i = 1; i <= la; i++) {
      curr[0] = i;
      var rowMin = curr[0];
      for (var j = 1; j <= lb; j++) {
        var cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
        if (i > 1 && j > 1 && a.charCodeAt(i - 1) === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === b.charCodeAt(j - 1)) {
          curr[j] = Math.min(curr[j], prev[j - 2] !== undefined ? prev[j - 2] + cost : Infinity);
        }
        if (curr[j] < rowMin) rowMin = curr[j];
      }
      if (rowMin > limit) return limit + 1;
      var tmp = prev; prev = curr; curr = tmp;
    }
    return prev[lb];
  }

  /* Token matches the search target (any single word in target) when
       - the token is a substring, OR
       - any word in target has edit distance ≤ limit (proportional to token length). */
  function tokenMatches(token, words) {
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (!w) continue;
      if (w.indexOf(token) >= 0) return true;
      if (token.length >= 4) {
        var limit = token.length >= 7 ? 2 : 1;
        if (editDistance(token, w, limit) <= limit) return true;
        // also try substring of word against token (handles "fashon" → "fashion": w='fashion', t='fashon', distance=1)
      }
    }
    return false;
  }

  function searchMatch(query, target) {
    var tokens = tokenize(query);
    if (tokens.length === 0) return true;
    var words = String(target || '').toLowerCase().split(/[^a-z0-9äöüß]+/i).filter(function (w) { return w.length > 0; });
    for (var i = 0; i < tokens.length; i++) {
      if (!tokenMatches(tokens[i], words)) return false;
    }
    return true;
  }

  function tagMatch(activeTag, productTags) {
    if (!activeTag) return true;
    var tags = String(productTags || '').toLowerCase().split(/\s+/);
    for (var i = 0; i < tags.length; i++) {
      if (tags[i] === activeTag) return true;
    }
    return false;
  }

  class ThemeStore extends HTMLElement {
    connectedCallback() {
      this.sectionId = this.dataset.sectionId;
      this.input = this.querySelector('[data-search-input]');
      this.clearBtn = this.querySelector('[data-search-clear]');
      this.grid = this.querySelector('[data-grid]');
      this.noResults = this.querySelector('[data-no-results]');
      this.resetBtn = this.querySelector('[data-reset-filters]');
      this.cards = Array.prototype.slice.call(this.querySelectorAll('[data-product-card]'));
      this.catLinks = Array.prototype.slice.call(this.querySelectorAll('[data-cat-link]'));

      this.activeTag = '';
      this.activeQuery = '';

      this.bindSearch();
      this.bindCatLinks();
      this.bindReset();
      this.bindSidebar();
      this.bindHistory();
      this.applyFromUrl();
      this.updateCounts();
    }

    disconnectedCallback() {
      window.removeEventListener('popstate', this.popstateHandler);
      if (document.body.classList.contains('ts-no-scroll')) {
        document.body.classList.remove('ts-no-scroll');
        document.body.style.overflow = '';
      }
    }

    /* ================ URL state ================ */
    bindHistory() {
      var self = this;
      this.popstateHandler = function () { self.applyFromUrl(); };
      window.addEventListener('popstate', this.popstateHandler);
    }

    applyFromUrl() {
      var tag = '';
      try {
        var p = new URLSearchParams(window.location.search);
        tag = (p.get('tag') || '').toLowerCase();
      } catch (e) { tag = ''; }
      this.setActiveTag(tag, { pushUrl: false });
    }

    pushUrl() {
      var p = new URLSearchParams(window.location.search);
      if (this.activeTag) p.set('tag', this.activeTag);
      else p.delete('tag');
      var qs = p.toString();
      var url = window.location.pathname + (qs ? '?' + qs : '') + window.location.hash;
      try { window.history.pushState({ tag: this.activeTag }, '', url); } catch (e) { /* ignore */ }
    }

    /* ================ Search ================ */
    bindSearch() {
      if (!this.input) return;
      var self = this;
      var run = debounce(function () { self.setQuery(self.input.value); }, 100);
      this.input.addEventListener('input', function () {
        if (self.clearBtn) self.clearBtn.hidden = self.input.value.length === 0;
        run();
      });
      if (this.clearBtn) {
        this.clearBtn.addEventListener('click', function () {
          self.input.value = '';
          self.clearBtn.hidden = true;
          self.setQuery('');
          self.input.focus();
        });
      }
    }

    setQuery(q) {
      this.activeQuery = String(q || '').trim();
      this.applyFilters();
    }

    /* ================ Tag list ================ */
    bindCatLinks() {
      var self = this;
      this.catLinks.forEach(function (link) {
        link.addEventListener('click', function (e) {
          e.preventDefault();
          var tag = (link.dataset.catTag || '').toLowerCase();
          self.setActiveTag(tag, { pushUrl: true });
          // Close the mobile drawer if open
          if (self.classList.contains('theme-store--sidebar-open')) self.toggleSidebar(false);
        });
      });
    }

    setActiveTag(tag, opts) {
      this.activeTag = tag || '';
      // active class + aria
      this.catLinks.forEach(function (link) {
        var t = (link.dataset.catTag || '').toLowerCase();
        var on = t === (tag || '');
        link.classList.toggle('theme-store__cat-link--active', on);
        if (on) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });
      this.applyFilters();
      if (opts && opts.pushUrl) this.pushUrl();
    }

    /* ================ Filtering ================ */
    applyFilters() {
      var visible = 0;
      var tag = this.activeTag;
      var query = this.activeQuery;
      this.cards.forEach(function (card) {
        var matchTag = tagMatch(tag, card.dataset.productTags);
        var matchSearch = searchMatch(query, card.dataset.productSearch);
        if (matchTag && matchSearch) {
          card.removeAttribute('hidden');
          visible++;
        } else {
          card.setAttribute('hidden', '');
        }
      });
      if (this.noResults) this.noResults.hidden = visible !== 0 || this.cards.length === 0;
      if (this.grid) this.grid.classList.toggle('theme-store__grid--empty', visible === 0);
    }

    bindReset() {
      if (!this.resetBtn) return;
      var self = this;
      this.resetBtn.addEventListener('click', function () {
        if (self.input) self.input.value = '';
        if (self.clearBtn) self.clearBtn.hidden = true;
        self.activeQuery = '';
        self.setActiveTag('', { pushUrl: true });
      });
    }

    /* ================ Tag count badges ================ */
    updateCounts() {
      var counts = {};
      var total = this.cards.length;
      this.cards.forEach(function (card) {
        var tags = String(card.dataset.productTags || '').toLowerCase().split(/\s+/);
        for (var i = 0; i < tags.length; i++) {
          var t = tags[i];
          if (!t) continue;
          counts[t] = (counts[t] || 0) + 1;
        }
      });
      this.catLinks.forEach(function (link) {
        var t = (link.dataset.catTag || '').toLowerCase();
        var countEl = link.querySelector('[data-cat-count]');
        if (!countEl) return;
        if (!t) {
          countEl.textContent = total;
        } else {
          countEl.textContent = counts[t] || 0;
        }
      });
    }

    /* ================ Sidebar drawer (mobile) ================ */
    bindSidebar() {
      this.sidebar = this.querySelector('[data-sidebar]');
      this.sidebarOverlay = this.querySelector('[data-sidebar-overlay]');
      this.openBtn = this.querySelector('[data-filter-open]');
      this.closeBtn = this.querySelector('[data-filter-close]');
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
        if (this.closeBtn) {
          var btn = this.closeBtn;
          requestAnimationFrame(function () { btn.focus(); });
        }
      } else {
        this.classList.remove('theme-store--sidebar-open');
        if (this.openBtn) {
          this.openBtn.setAttribute('aria-expanded', 'false');
          this.openBtn.focus();
        }
        document.body.classList.remove('ts-no-scroll');
        document.body.style.overflow = '';
        var self = this;
        setTimeout(function () { if (self.sidebarOverlay) self.sidebarOverlay.hidden = true; }, 250);
      }
    }
  }

  if (!customElements.get('theme-store')) {
    customElements.define('theme-store', ThemeStore);
  }
})();
