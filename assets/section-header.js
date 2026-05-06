class StickyHeader extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.header = this;
    this.headerIsAlwaysSticky = this.getAttribute('data-sticky-type') === 'always' || this.getAttribute('data-sticky-type') === 'reduce-logo-size';
    this.headerBounds = {};
    this.setHeaderHeight();

    window.matchMedia('(max-width: 990px)').addEventListener('change', this.setHeaderHeight.bind(this));

    if (this.headerIsAlwaysSticky) this.header.classList.add('shopify-section-header-sticky');

    this.currentScrollTop = 0;
    this.preventReveal = false;
    this.predictiveSearch = this.querySelector('predictive-search');
    this.onScrollHandler = this.onScroll.bind(this);
    this.hideHeaderOnScrollUp = () => (this.preventReveal = true);
    this.addEventListener('preventHeaderReveal', this.hideHeaderOnScrollUp);
    window.addEventListener('scroll', this.onScrollHandler, false);
    this.createObserver();
  }

  setHeaderHeight() {
    document.documentElement.style.setProperty('--header-height', `${this.header.offsetHeight}px`);
  }

  disconnectedCallback() {
    this.removeEventListener('preventHeaderReveal', this.hideHeaderOnScrollUp);
    window.removeEventListener('scroll', this.onScrollHandler);
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
    if (this.predictiveSearch && this.predictiveSearch.isOpen) return;

    if (scrollTop > this.currentScrollTop && scrollTop > this.headerBounds.bottom) {
      this.header.classList.add('scrolled-past-header');
      if (this.preventHide) return;
      requestAnimationFrame(this.hide.bind(this));
    } else if (scrollTop < this.currentScrollTop && scrollTop > this.headerBounds.bottom) {
      this.header.classList.add('scrolled-past-header');
      if (!this.preventReveal) requestAnimationFrame(this.reveal.bind(this));
      else {
        window.clearTimeout(this.isScrolling);
        this.isScrolling = setTimeout(() => {
          this.preventReveal = false;
        }, 66);
        requestAnimationFrame(this.hide.bind(this));
      }
    } else if (scrollTop <= this.headerBounds.top) {
      this.header.classList.remove('scrolled-past-header');
      requestAnimationFrame(this.reset.bind(this));
    }

    this.currentScrollTop = scrollTop;
  }

  hide() {
    if (this.headerIsAlwaysSticky) return;
    this.header.classList.add('shopify-section-header-hidden', 'shopify-section-header-sticky');
    this.closeSearchModal();
  }

  reveal() {
    if (this.headerIsAlwaysSticky) return;
    this.header.classList.add('shopify-section-header-sticky', 'animate');
    this.header.classList.remove('shopify-section-header-hidden');
  }

  reset() {
    if (this.headerIsAlwaysSticky) return;
    this.header.classList.remove('shopify-section-header-hidden', 'shopify-section-header-sticky', 'animate');
  }

  closeSearchModal() {
    this.searchModal = this.searchModal || this.header.querySelector('details-modal');
    this.searchModal?.close(false);
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
    this.drawer?.querySelectorAll('.localization-form__select').forEach((select) => {
      select.addEventListener('change', () => select.form?.submit());
    });
    document.querySelectorAll('.desktop-localization-wrapper .localization-form__select').forEach((select) => {
      select.addEventListener('change', () => select.form?.submit());
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
      trapFocus(this.drawer, this.drawer.querySelector('[data-drawer-close]'));
    } else {
      this.drawer.classList.remove('is-open');
      this.drawer.setAttribute('aria-hidden', 'true');
      this.menuButton?.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('overflow-hidden');
      removeTrapFocus(this.menuButton);
      window.setTimeout(() => {
        this.drawer.hidden = true;
      }, 180);
    }
  }

  handleKeydown(event) {
    if (event.code === 'Escape' && this.drawer?.classList.contains('is-open')) this.toggleDrawer(false);
  }

  listenCartUpdates() {
    document.addEventListener('cart:updated', (event) => {
      const count = event.detail?.cart?.item_count;
      if (typeof count !== 'number') return;
      const bubble = document.querySelector('[data-cart-count]');
      if (!bubble) return;
      bubble.classList.toggle('hidden', count === 0);
      const visibleCount = bubble.querySelector('[aria-hidden="true"]');
      if (visibleCount) visibleCount.textContent = count;
    });
  }
}

if (!customElements.get('sticky-header')) customElements.define('sticky-header', StickyHeader);
document.addEventListener('DOMContentLoaded', () => new SqeHeaderController());
