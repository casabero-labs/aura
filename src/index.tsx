import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import OllamaSetupStandalone from './components/OllamaSetupStandalone';
import './index.css';
import './styles/editorial-tokens.css';
import './styles/editorial-foundation.css';
import './styles/editorial-components.css';
import './styles/editorial-surfaces.css';

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
