window.routes = window.routes || {};

class DetailsModal extends HTMLElement {
  constructor() {
    super();
    this.detailsContainer = this.querySelector('details');
    this.summaryToggle = this.querySelector('summary');
    this.closeButton = this.querySelector('.modal__close-button');
    this.onBodyClickEvent = this.onBodyClickEvent.bind(this);
  }

  connectedCallback() {
    this.summaryToggle?.addEventListener('click', this.onSummaryClick.bind(this));
    this.closeButton?.addEventListener('click', () => this.close());
  }

  isOpen() {
    return this.detailsContainer?.hasAttribute('open');
  }

  onSummaryClick(event) {
    event.preventDefault();
    this.isOpen() ? this.close() : this.open(event);
  }

  onBodyClickEvent(event) {
    if (!this.contains(event.target) || event.target.classList.contains('modal-overlay')) this.close(false);
  }

  open(event) {
    this.onBodyClickEvent = this.onBodyClickEvent.bind(this);
    this.detailsContainer?.setAttribute('open', '');
    this.summaryToggle?.setAttribute('aria-expanded', 'true');
    document.body.addEventListener('click', this.onBodyClickEvent);
    document.body.classList.add('overflow-hidden');
    trapFocus(this, this.querySelector('input'));
    event?.target?.closest('details')?.setAttribute('open', true);
  }

  close(focusToggle = true) {
    removeTrapFocus(focusToggle ? this.summaryToggle : null);
    this.detailsContainer?.removeAttribute('open');
    this.summaryToggle?.setAttribute('aria-expanded', 'false');
    document.body.removeEventListener('click', this.onBodyClickEvent);
    document.body.classList.remove('overflow-hidden');
  }
}

class SearchForm extends HTMLElement {
  constructor() {
    super();
    this.input = this.querySelector('input[type="search"]');
    this.resetButton = this.querySelector('button[type="reset"]');

    this.input?.form?.addEventListener('reset', this.onFormReset.bind(this));
    this.input?.addEventListener('input', debounce((event) => this.onChange(event), 300).bind(this));
    this.resetButton?.addEventListener('click', this.onResetButtonClick.bind(this));
  }

  toggleResetButton() {
    if (!this.resetButton) return;
    const resetIsHidden = this.resetButton.classList.contains('hidden');
    if (this.input.value.length > 0 && resetIsHidden) this.resetButton.classList.remove('hidden');
    else if (this.input.value.length === 0 && !resetIsHidden) this.resetButton.classList.add('hidden');
  }

  onChange() {
    this.toggleResetButton();
  }

  shouldResetForm() {
    return !document.querySelector('[aria-selected="true"] a');
  }

  onFormReset(event) {
    event.preventDefault();
    if (this.shouldResetForm()) {
      this.input.value = '';
      this.input.focus();
      this.toggleResetButton();
    }
  }

  onResetButtonClick(event) {
    event.preventDefault();
    this.input.value = '';
    this.input.focus();
    this.toggleResetButton();
  }
}

function debounce(fn, wait) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), wait);
  };
}

function trapFocus(container, elementToFocus = container) {
  const focusableElements = Array.from(
    container.querySelectorAll('a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex^="-"])')
  );
  const first = focusableElements[0];
  const last = focusableElements[focusableElements.length - 1];
  removeTrapFocus();
  window._trapFocusHandler = (event) => {
    if (event.code !== 'Tab') return;
    if (focusableElements.length === 0) {
      event.preventDefault();
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  document.addEventListener('keydown', window._trapFocusHandler);
  elementToFocus?.focus();
}

function removeTrapFocus(elementToFocus = null) {
  if (window._trapFocusHandler) document.removeEventListener('keydown', window._trapFocusHandler);
  window._trapFocusHandler = null;
  elementToFocus?.focus();
}

if (!customElements.get('details-modal')) customElements.define('details-modal', DetailsModal);
if (!customElements.get('search-form')) customElements.define('search-form', SearchForm);
