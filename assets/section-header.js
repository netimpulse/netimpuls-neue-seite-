/* SQE / Dawn-style header interactions and real Shopify predictive search. */
(function () {
  'use strict';

  const ON_CHANGE_DEBOUNCE_TIMER = 300;

  class DetailsModal extends HTMLElement {
    constructor() {
      super();
      this.detailsContainer = this.querySelector('details');
      this.summaryToggle = this.querySelector('summary');
      this.closeButton = this.querySelector('button[type="button"]');
      this.onBodyClickEvent = this.onBodyClickEvent.bind(this);
    }

    connectedCallback() {
      if (!this.detailsContainer || !this.summaryToggle) return;
      this.summaryToggle.setAttribute('role', 'button');
      this.summaryToggle.addEventListener('click', this.onSummaryClick.bind(this));
      this.summaryToggle.addEventListener('keyup', (event) => {
        if (event.code && event.code.toUpperCase() === 'SPACE') event.preventDefault();
      });
      this.closeButton?.addEventListener('click', this.close.bind(this));
    }

    onSummaryClick(event) {
      event.preventDefault();
      event.target.closest('details').hasAttribute('open') ? this.close() : this.open(event);
    }

    onBodyClickEvent(event) {
      if (!this.contains(event.target) || event.target.classList.contains('modal-overlay')) this.close(false);
    }

    open(event) {
      this.onBodyClickEvent = this.onBodyClickEvent.bind(this);
      event?.target.closest('details').setAttribute('open', true);
      document.body.addEventListener('click', this.onBodyClickEvent);
      document.body.classList.add('overflow-hidden');
      const input = this.querySelector('input[type="search"]');
      setTimeout(() => input?.focus(), 100);
    }

    close(focusToggle = true) {
      this.detailsContainer?.removeAttribute('open');
      document.body.removeEventListener('click', this.onBodyClickEvent);
      document.body.classList.remove('overflow-hidden');
      if (focusToggle) this.summaryToggle?.focus();
    }
  }

  class SearchForm extends HTMLElement {
    connectedCallback() {
      this.input = this.querySelector('input[type="search"]');
      this.resetButton = this.querySelector('button[type="reset"]');
      if (!this.input) return;

      this.input.form?.addEventListener('reset', this.onFormReset.bind(this));
      this.input.addEventListener('input', () => this.toggleResetButton());
      this.toggleResetButton();
    }

    toggleResetButton() {
      const resetIsHidden = this.resetButton?.classList.contains('hidden');
      if (this.input.value.length > 0 && resetIsHidden) this.resetButton.classList.remove('hidden');
      else if (this.input.value.length === 0 && !resetIsHidden) this.resetButton.classList.add('hidden');
    }

    onFormReset(event) {
      event.preventDefault();
      this.input.value = '';
      this.input.focus();
      this.toggleResetButton();
      this.dispatchEvent(new CustomEvent('input-reset', { bubbles: true }));
    }
  }

  class PredictiveSearch extends SearchForm {
    connectedCallback() {
      super.connectedCallback();
      this.cachedResults = {};
      this.predictiveSearchResults = this.querySelector('[data-predictive-search]');
      this.statusElement = this.querySelector('.predictive-search-status');
      this.form = this.querySelector('form');
      this.abortController = new AbortController();
      this.searchTerm = '';

      this.input?.addEventListener('input', this.debounce((event) => this.onChange(event), ON_CHANGE_DEBOUNCE_TIMER).bind(this));
      this.input?.addEventListener('focus', this.onFocus.bind(this));
      this.input?.addEventListener('keydown', this.onKeydown.bind(this));
      this.form?.addEventListener('submit', this.onFormSubmit.bind(this));
      this.addEventListener('input-reset', this.closeResults.bind(this));
    }

    getQuery() {
      return this.input.value.trim();
    }

    onChange() {
      const newSearchTerm = this.getQuery();
      if (!newSearchTerm.length) {
        this.closeResults(true);
        return;
      }
      this.getSearchResults(newSearchTerm);
    }

    onFormSubmit(event) {
      if (!this.getQuery().length || this.querySelector('[aria-selected="true"] a')) event.preventDefault();
    }

    onFocus() {
      const currentSearchTerm = this.getQuery();
      if (!currentSearchTerm.length) return;
      if (this.searchTerm !== currentSearchTerm) this.onChange();
      else if (this.getAttribute('results') === 'true') this.openResults();
      else this.getSearchResults(currentSearchTerm);
    }

    onKeydown(event) {
      if (!this.getAttribute('open')) return;
      switch (event.code) {
        case 'ArrowUp':
          event.preventDefault();
          this.switchOption('up');
          break;
        case 'ArrowDown':
          event.preventDefault();
          this.switchOption('down');
          break;
        case 'Enter':
          this.selectOption();
          break;
        case 'Escape':
          this.closeResults(true);
          break;
      }
    }

    switchOption(direction) {
      const selectedElement = this.querySelector('[aria-selected="true"]');
      const allVisibleElements = Array.from(this.querySelectorAll('li, button.predictive-search__search-for-button')).filter(
        (element) => element.offsetParent !== null
      );
      if (!allVisibleElements.length) return;

      let activeElementIndex = allVisibleElements.indexOf(selectedElement);
      if (direction === 'up') activeElementIndex = activeElementIndex <= 0 ? allVisibleElements.length - 1 : activeElementIndex - 1;
      else activeElementIndex = activeElementIndex === allVisibleElements.length - 1 ? 0 : activeElementIndex + 1;

      if (selectedElement) selectedElement.setAttribute('aria-selected', 'false');
      const activeElement = allVisibleElements[activeElementIndex];
      activeElement.setAttribute('aria-selected', 'true');
      this.input.setAttribute('aria-activedescendant', activeElement.id);
    }

    selectOption() {
      const selectedLink = this.querySelector('[aria-selected="true"] a, button[aria-selected="true"]');
      selectedLink?.click();
    }

    getSearchResults(searchTerm) {
      const queryKey = searchTerm.replace(' ', '-').toLowerCase();
      this.searchTerm = searchTerm;
      this.setLiveRegionLoadingState();

      if (this.cachedResults[queryKey]) {
        this.renderSearchResults(this.cachedResults[queryKey]);
        return;
      }

      this.abortController.abort();
      this.abortController = new AbortController();

      const predictiveSearchUrl = this.dataset.predictiveSearchUrl || '/search/suggest';
      const url = `${predictiveSearchUrl}?q=${encodeURIComponent(searchTerm)}&resources[type]=product,collection,page,article&resources[limit]=6&section_id=predictive-search`;

      fetch(url, { signal: this.abortController.signal })
        .then((response) => {
          if (!response.ok) throw new Error(response.status);
          return response.text();
        })
        .then((text) => {
          const resultsMarkup = new DOMParser()
            .parseFromString(text, 'text/html')
            .querySelector('#shopify-section-predictive-search')?.innerHTML || text;
          this.cachedResults[queryKey] = resultsMarkup;
          this.renderSearchResults(resultsMarkup);
        })
        .catch((error) => {
          if (error?.name === 'AbortError') return;
          this.closeResults(true);
        });
    }

    setLiveRegionLoadingState() {
      this.statusElement?.setAttribute('aria-hidden', 'false');
      if (this.statusElement) this.statusElement.textContent = this.dataset.loadingText || 'Loading';
      this.predictiveSearchResults?.setAttribute('open', '');
      this.setAttribute('loading', true);
    }

    renderSearchResults(resultsMarkup) {
      if (!this.predictiveSearchResults) return;
      this.predictiveSearchResults.innerHTML = resultsMarkup;
      this.setAttribute('results', true);
      this.removeAttribute('loading');
      if (this.statusElement) {
        this.statusElement.textContent = '';
        this.statusElement.setAttribute('aria-hidden', 'true');
      }
      this.openResults();
    }

    openResults() {
      this.setAttribute('open', true);
      this.input?.setAttribute('aria-expanded', 'true');
      this.predictiveSearchResults?.setAttribute('open', '');
    }

    closeResults(clearSearchTerm = false) {
      if (clearSearchTerm) this.searchTerm = '';
      this.removeAttribute('open');
      this.input?.setAttribute('aria-expanded', 'false');
      this.input?.removeAttribute('aria-activedescendant');
      this.predictiveSearchResults?.removeAttribute('open');
    }

    debounce(fn, wait) {
      let timeout;
      return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), wait);
      };
    }
  }

  class StickyHeader extends HTMLElement {
    connectedCallback() {
      this.header = this;
      this.headerIsAlwaysSticky = this.getAttribute('data-sticky-type') === 'always';
      this.headerBounds = {};
      this.currentScrollTop = 0;
      this.onScrollHandler = this.onScroll.bind(this);
      this.setHeaderHeight();
      if (this.headerIsAlwaysSticky) this.classList.add('shopify-section-header-sticky');
      window.addEventListener('resize', this.setHeaderHeight.bind(this));
      window.addEventListener('scroll', this.onScrollHandler, false);
      this.createObserver();
    }

    disconnectedCallback() {
      window.removeEventListener('scroll', this.onScrollHandler);
    }

    setHeaderHeight() {
      document.documentElement.style.setProperty('--header-height', `${this.offsetHeight}px`);
    }

    createObserver() {
      const observer = new IntersectionObserver((entries, observerInstance) => {
        this.headerBounds = entries[0].intersectionRect;
        observerInstance.disconnect();
      });
      observer.observe(this.header);
    }

    onScroll() {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      if (this.querySelector('predictive-search[open]')) return;

      if (this.headerIsAlwaysSticky) {
        this.classList.add('shopify-section-header-sticky');
        return;
      }

      if (scrollTop > this.currentScrollTop && scrollTop > this.headerBounds.bottom) {
        this.classList.add('shopify-section-header-hidden', 'shopify-section-header-sticky');
      } else if (scrollTop < this.currentScrollTop && scrollTop > this.headerBounds.bottom) {
        this.classList.add('shopify-section-header-sticky', 'animate');
        this.classList.remove('shopify-section-header-hidden');
      } else if (scrollTop <= this.headerBounds.top) {
        this.classList.remove('shopify-section-header-hidden', 'shopify-section-header-sticky', 'animate');
      }

      this.currentScrollTop = scrollTop;
    }
  }

  class SqeHeaderController {
    constructor() {
      this.drawer = document.querySelector('#HeaderDrawer');
      this.menuButton = document.querySelector('[aria-controls="HeaderDrawer"]');
      this.handleKeydown = this.handleKeydown.bind(this);
      this.bindEvents();
      this.listenCartUpdates();
    }

    bindEvents() {
      this.menuButton?.addEventListener('click', () => this.toggleDrawer(true));
      this.drawer?.querySelectorAll('[data-drawer-close]').forEach((button) => button.addEventListener('click', () => this.toggleDrawer(false)));
      this.drawer?.querySelectorAll('.menu-drawer__menu-item--button').forEach((button) => {
        button.addEventListener('click', () => {
          const expanded = button.getAttribute('aria-expanded') === 'true';
          button.setAttribute('aria-expanded', String(!expanded));
          const submenu = button.nextElementSibling;
          if (!submenu) return;
          expanded ? submenu.setAttribute('hidden', '') : submenu.removeAttribute('hidden');
        });
      });
      document.addEventListener('keydown', this.handleKeydown);
    }

    toggleDrawer(open) {
      if (!this.drawer) return;
      if (open) {
        this.drawer.hidden = false;
        requestAnimationFrame(() => this.drawer.classList.add('is-open'));
        this.drawer.setAttribute('aria-hidden', 'false');
        this.menuButton?.setAttribute('aria-expanded', 'true');
        document.body.classList.add('overflow-hidden');
      } else {
        this.drawer.classList.remove('is-open');
        this.drawer.setAttribute('aria-hidden', 'true');
        this.menuButton?.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('overflow-hidden');
        setTimeout(() => {
          this.drawer.hidden = true;
        }, 180);
      }
    }

    handleKeydown(event) {
      if (event.key === 'Escape' && this.drawer && !this.drawer.hidden) this.toggleDrawer(false);
    }

    listenCartUpdates() {
      document.addEventListener('cart:update', (event) => {
        const count = event.detail && typeof event.detail.count === 'number' ? event.detail.count : null;
        const bubble = document.querySelector('[data-cart-count]');
        if (count === null || !bubble) return;
        bubble.classList.toggle('hidden', count === 0);
        bubble.querySelector('[aria-hidden="true"]').textContent = String(count);
      });
    }
  }

  if (!customElements.get('details-modal')) customElements.define('details-modal', DetailsModal);
  if (!customElements.get('search-form')) customElements.define('search-form', SearchForm);
  if (!customElements.get('predictive-search')) customElements.define('predictive-search', PredictiveSearch);
  if (!customElements.get('sticky-header')) customElements.define('sticky-header', StickyHeader);

  document.addEventListener('DOMContentLoaded', () => new SqeHeaderController());
})();
