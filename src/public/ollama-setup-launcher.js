(() => {
  const SETUP_TRIGGER_SELECTOR = '[data-testid="ollama-open-setup"], a[href^="/ollama-setup.html"]';
  const SETUP_WINDOW_NAME = 'aura-ollama-setup';
  const ENHANCE_INTERVAL_MS = 500;

  const getReturnPath = () => {
    const path = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    return path.startsWith('/') ? path : '/';
  };

  const buildSetupUrl = () => {
    const url = new URL('/ollama-setup.html', window.location.origin);
    url.searchParams.set('return', getReturnPath());
    url.searchParams.set('source', 'aura-interface');
    return url.toString();
  };

  const getCurrentTheme = () => {
    return document.documentElement.getAttribute('data-theme')
      || localStorage.getItem('aura_theme')
      || localStorage.getItem('theme')
      || '';
  };

  const enhanceSetupWindow = (setupWindow) => {
    if (!setupWindow || setupWindow.closed) return false;

    try {
      const setupDocument = setupWindow.document;
      if (!setupDocument?.head || !setupDocument?.body) return false;

      setupDocument.documentElement.dataset.auraIntegrated = 'true';
      const theme = getCurrentTheme();
      if (theme === 'dark' || theme === 'light') {
        setupDocument.documentElement.setAttribute('data-theme', theme);
      }

      if (!setupDocument.getElementById('aura-ollama-integrated-styles')) {
        const stylesheet = setupDocument.createElement('link');
        stylesheet.id = 'aura-ollama-integrated-styles';
        stylesheet.rel = 'stylesheet';
        stylesheet.href = '/ollama-setup-aura.css';
        setupDocument.head.appendChild(stylesheet);
      }

      setupDocument.title = 'AURA · Asistente de Ollama local';

      const topbar = setupDocument.querySelector('.topbar');
      if (topbar && !setupDocument.getElementById('aura-setup-context')) {
        const context = setupDocument.createElement('div');
        context.id = 'aura-setup-context';
        context.className = 'aura-setup-context';
        context.innerHTML = '<span>Configuración</span><strong>Ollama local</strong>';
        const brand = topbar.querySelector('.brand');
        brand?.insertAdjacentElement('afterend', context);
      }

      const hero = setupDocument.querySelector('.hero');
      if (hero && !setupDocument.getElementById('aura-window-note')) {
        const note = setupDocument.createElement('div');
        note.id = 'aura-window-note';
        note.className = 'aura-window-note';
        note.innerHTML = '<strong>Asistente conectado con AURA</strong><span>Esta pestaña puede permanecer abierta mientras pruebas la conexión. Al cerrarla, AURA volverá a comprobar Ollama.</span>';
        hero.insertAdjacentElement('afterend', note);
      }

      const backButton = setupDocument.getElementById('back-btn');
      if (backButton && backButton.dataset.auraIntegrated !== 'true') {
        backButton.dataset.auraIntegrated = 'true';
        backButton.setAttribute('type', 'button');
        backButton.textContent = 'Cerrar y volver a AURA';
        backButton.setAttribute('aria-label', 'Cerrar el asistente y volver a AURA');
        backButton.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          localStorage.setItem('aura_ollama_setup_completed', 'true');
          setupWindow.close();
          window.focus();
        }, true);
      }

      return true;
    } catch {
      return false;
    }
  };

  const refreshOllamaStatus = () => {
    if (localStorage.getItem('aura_ollama_setup_completed') !== 'true') return;
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

    const enhance = () => {
      enhanceSetupWindow(setupWindow);
    };

    setupWindow.addEventListener('load', enhance);
    window.setTimeout(enhance, 50);

    const watcher = window.setInterval(() => {
      if (setupWindow.closed) {
        window.clearInterval(watcher);
        window.focus();
        window.setTimeout(refreshOllamaStatus, 250);
        return;
      }
      enhanceSetupWindow(setupWindow);
    }, ENHANCE_INTERVAL_MS);

    return setupWindow;
  };

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
