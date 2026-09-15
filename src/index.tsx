import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import OllamaSetupStandalone from './components/OllamaSetupStandalone';
import './styles/casabero-editorial.tokens.css';
import './styles/editorial-foundations.css';
import './styles/editorial-shell.css';
import './styles/editorial-audit.css';
import './styles/editorial-remediation.css';
import './styles/editorial-lab.css';

document.documentElement.dataset.casaberoTheme = 'editorial';
if (!document.documentElement.dataset.theme) {
  const saved = localStorage.getItem('aura_theme');
  document.documentElement.dataset.theme = saved === 'dark' ? 'dark' : 'light';
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const params = new URLSearchParams(window.location.search);
const isOllamaSetupView = params.get('view') === 'ollama-setup';

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    {isOllamaSetupView ? <OllamaSetupStandalone /> : <App />}
  </React.StrictMode>,
);
