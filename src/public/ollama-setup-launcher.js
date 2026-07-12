(() => {
  const SETUP_TRIGGER_SELECTOR = '[data-testid="ollama-open-setup"], a[href^="/ollama-setup.html"]';
  const SETUP_WINDOW_NAME = 'aura-ollama-setup';

  const getReturnPath = () => {
    const path = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    return path.startsWith('/') ? path : '/';
  };

  const buildSetupUrl = () => {
    const url = new URL('/', window.location.origin);
    url.searchParams.set('view', 'ollama-setup');
    url.searchParams.set('return', getReturnPath());
    url.searchParams.set('source', 'aura-interface');
    return url.toString();
  };

  const refreshOllamaStatus = () => {
    const retryButton = document.querySelector('[data-testid="ollama-retry-connection"]');
    if (retryButton instanceof HTMLButtonElement && !retryButton.disabled) {
      retryButton.click();
    }
  };

  const openOllamaSetup = () => {
    const setupWindow = window.open(buildSetupUrl(), SETUP_WINDOW_NAME);

    if (!setupWindow) {
      window.location.assign(buildSetupUrl());
      return null;
    }

    setupWindow.focus();

    const watcher = window.setInterval(() => {
      if (!setupWindow.closed) return;
      window.clearInterval(watcher);
      window.focus();
      window.setTimeout(refreshOllamaStatus, 250);
    }, 500);

    return setupWindow;
  };

  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type !== 'aura:ollama-ready'
      && event.data?.type !== 'aura:ollama-setup-closed') return;

    window.setTimeout(refreshOllamaStatus, 150);
  });

  document.addEventListener('click', (event) => {
    const origin = event.target;
    const trigger = origin instanceof Element ? origin.closest(SETUP_TRIGGER_SELECTOR) : null;
    if (!trigger) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openOllamaSetup();
  }, true);

  window.__AURA_OPEN_OLLAMA_SETUP__ = openOllamaSetup;
})();
