import React, { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { AIConfig, ProviderProgressEvent, SettingsSectionId } from '../types';
import { getChromeAiDiagnostic } from '../services/aiProvider';
import type { ChromeAiDiagnostic } from '../services/aiProvider';
import { OllamaProvider } from '../services/providers/ollamaProvider';
import type { OllamaModel } from '../services/providers/ollamaProvider';
import OllamaSetupWizard from './OllamaSetupWizard';
import { DEFAULT_OLLAMA_MODEL_ID } from '../services/modelRegistry';
import { migrateFormalModelId } from '../services/aiConfigStorage';
import { refreshOllamaModelCatalog } from '../services/ollamaModelCatalog';
import GeneralSection from './settings/GeneralSection';
import ProvidersSection, { DEFAULT_OLLAMA_ENDPOINT, isProviderChoice, type ProviderChoice } from './settings/ProvidersSection';
import EvidenceSection, { migrateLegacyInputMode } from './settings/EvidenceSection';
import PrivacySection from './settings/PrivacySection';
import AdvancedDiagnosticsSection from './settings/AdvancedDiagnosticsSection';

interface SettingsPanelProps {
  config: AIConfig;
  onSave: (config: AIConfig) => void;
  onClose: () => void;
  section: SettingsSectionId;
  onSectionChange?: (section: SettingsSectionId) => void;
  theme: 'dark' | 'light';
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  config, onSave, onClose, section, onSectionChange, theme,
}) => {
  const [localConfig, setLocalConfig] = useState<AIConfig>(() => ({
    ...config,
    inputMode: migrateLegacyInputMode(config.inputMode),
  }));
  const [chromeDiagnostic, setChromeDiagnostic] = useState<ChromeAiDiagnostic | null>(null);
  const [chromeProgress, setChromeProgress] = useState<ProviderProgressEvent | null>(null);
  const [isPreparingChrome, setIsPreparingChrome] = useState(false);
  const [ollamaConnected, setOllamaConnected] = useState<boolean | null>(null);
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [ollamaLoading, setOllamaLoading] = useState(false);
  const [ollamaPullProgress, setOllamaPullProgress] = useState<ProviderProgressEvent | null>(null);
  const [showOllamaWizard, setShowOllamaWizard] = useState(false);
  const [ollamaPullModel, setOllamaPullModel] = useState('');

  const isDirty = JSON.stringify(localConfig) !== JSON.stringify({ ...config, inputMode: migrateLegacyInputMode(config.inputMode) });

  useEffect(() => {
    sessionStorage.removeItem('aura_ollama_setup_started');
    void checkChromeDiagnostic();
    void checkOllamaConnection();
  }, []);

  // Cambiar de página de Configuración empieza por su título, no a mitad de la anterior.
  useEffect(() => {
    if (typeof window.scrollTo === 'function') window.scrollTo({ top: 0 });
  }, [section]);

  useEffect(() => {
    if (chromeDiagnostic?.status === 'downloading' && !chromeProgress) {
      setChromeProgress({
        stage: 'downloading',
        message: 'Gemini Nano se está descargando. Mantén Chrome abierto. Si no avanza, revisa espacio en disco.',
      });
    }
  }, [chromeDiagnostic, chromeProgress]);

  const checkChromeDiagnostic = async () => {
    try {
      const diag = await getChromeAiDiagnostic();
      setChromeDiagnostic(diag);
      if (diag.status !== 'downloading') setChromeProgress(null);
    } catch (err: any) {
      setChromeDiagnostic({
        apiSurface: 'none',
        status: 'error',
        message: err?.message || 'No se pudo verificar Chrome AI.',
        actions: ['Reinicia Chrome e intenta verificar de nuevo.'],
      });
    }
  };

  const checkOllamaConnection = async () => {
    setOllamaConnected(null);
    try {
      const baseUrl = localConfig.ollamaBaseUrl || DEFAULT_OLLAMA_ENDPOINT;
      const snapshot = await refreshOllamaModelCatalog(baseUrl);
      setOllamaConnected(true);
      setOllamaModels(snapshot.models);
    } catch {
      setOllamaConnected(false);
      setOllamaModels([]);
    }
  };

  const setProviderType = (type: ProviderChoice) => {
    if (type === 'ollama') {
      const savedEndpoint = localStorage.getItem('aura_ollama_endpoint');
      const savedModel = migrateFormalModelId(localStorage.getItem('aura_ollama_model') ?? undefined);
      setLocalConfig({
        ...localConfig,
        providerType: 'ollama',
        model: savedModel || localConfig.ollamaModel || DEFAULT_OLLAMA_MODEL_ID,
        ollamaBaseUrl: savedEndpoint || localConfig.ollamaBaseUrl || DEFAULT_OLLAMA_ENDPOINT,
      });
      if (ollamaConnected !== true) sessionStorage.setItem('aura_ollama_setup_started', 'true');
      return;
    }
    setLocalConfig({ ...localConfig, providerType: 'chrome', model: 'gemini-nano', cloudProvider: undefined });
  };

  const handlePrepareChrome = async () => {
    setIsPreparingChrome(true);
    setChromeProgress({ stage: 'downloading', progress: 0, message: 'Iniciando descarga de Gemini Nano...' });
    try {
      const { ChromePromptProvider } = await import('../services/providers/chromeProvider');
      const provider = new ChromePromptProvider();
      await provider.preloadModel((progress, message) => {
        setChromeProgress({ stage: 'downloading', progress, message: message || `Descargando Gemini Nano ${progress}%` });
      });
      setChromeProgress({ stage: 'completed', progress: 100, message: 'Gemini Nano listo para usar.' });
      await checkChromeDiagnostic();
    } catch (err: any) {
      setChromeProgress({
        stage: 'error',
        progress: 0,
        message: `${err?.message || 'Falló la preparación de Gemini Nano'}. Revisa espacio libre en disco y chrome://on-device-internals.`,
      });
    } finally {
      setIsPreparingChrome(false);
    }
  };

  const handleFetchOllamaModels = async () => {
    setOllamaLoading(true);
    await checkOllamaConnection();
    setOllamaLoading(false);
  };

  const handleUseOllamaModel = (modelName: string) => {
    setLocalConfig({ ...localConfig, model: modelName, ollamaModel: modelName });
  };

  const handleOllamaPull = async () => {
    const model = ollamaPullModel || localConfig.model || DEFAULT_OLLAMA_MODEL_ID;
    setOllamaPullProgress({ stage: 'downloading', progress: 0, message: 'Iniciando descarga...' });
    try {
      const baseUrl = localConfig.ollamaBaseUrl || DEFAULT_OLLAMA_ENDPOINT;
      const provider = new OllamaProvider(model, localConfig.temperature, baseUrl);
      await provider.pullModel(model, (progress, message) => {
        setOllamaPullProgress({ stage: 'downloading', progress, message });
      });
      setOllamaPullProgress({ stage: 'completed', progress: 100, message: `Modelo ${model} listo.` });
      await handleFetchOllamaModels();
    } catch (err: any) {
      setOllamaPullProgress({ stage: 'error', progress: 0, message: err?.message || 'No se pudo descargar el modelo.' });
    }
  };

  const handleSave = () => {
    onSave(localConfig);
    onClose();
  };

  const handleCancel = () => {
    setLocalConfig({ ...config, inputMode: migrateLegacyInputMode(config.inputMode) });
    onClose();
  };

  const activeProviderType: ProviderChoice = isProviderChoice(localConfig.providerType) ? localConfig.providerType : 'chrome';

  return (
    <main className="settings-workspace" data-testid="settings-workspace">
      <div className="settings-workspace-body">
        {section === 'general' && (
          <GeneralSection theme={theme} />
        )}

        {section === 'ia' && (
          <ProvidersSection
            config={localConfig}
            onChange={setLocalConfig}
            setProviderType={setProviderType}
            onSectionChange={onSectionChange}
            chromeDiagnostic={chromeDiagnostic}
            chromeProgress={chromeProgress}
            isPreparingChrome={isPreparingChrome}
            onCheckChrome={checkChromeDiagnostic}
            onPrepareChrome={handlePrepareChrome}
            ollamaConnected={ollamaConnected}
            ollamaModels={ollamaModels}
            ollamaLoading={ollamaLoading}
            onTestOllama={handleFetchOllamaModels}
            onOpenOllamaWizard={() => setShowOllamaWizard(true)}
            onUseOllamaModel={handleUseOllamaModel}
          />
        )}

        {section === 'evidencia' && (
          <EvidenceSection
            inputMode={localConfig.inputMode}
            onChange={(mode) => setLocalConfig({ ...localConfig, inputMode: mode })}
          />
        )}

        {section === 'privacidad' && (
          <PrivacySection activeProviderType={activeProviderType} />
        )}

        {section === 'diagnostico' && (
          <AdvancedDiagnosticsSection
            config={localConfig}
            setProviderType={setProviderType}
            chromeDiagnostic={chromeDiagnostic}
            chromeProgress={chromeProgress}
            isPreparingChrome={isPreparingChrome}
            onCheckChrome={checkChromeDiagnostic}
            onPrepareChrome={handlePrepareChrome}
            ollamaConnected={ollamaConnected}
            ollamaModels={ollamaModels}
            ollamaLoading={ollamaLoading}
            onTestOllama={handleFetchOllamaModels}
            onOpenOllamaWizard={() => setShowOllamaWizard(true)}
            ollamaPullModel={ollamaPullModel}
            onOllamaPullModelChange={setOllamaPullModel}
            ollamaPullProgress={ollamaPullProgress}
            onOllamaPull={handleOllamaPull}
          />
        )}
      </div>

      {isDirty && (
        <div className="settings-save-bar settings-save-bar--sticky" data-testid="settings-save-bar">
          <button onClick={handleCancel} className="btn-s">Cancelar</button>
          <button onClick={handleSave} className="btn-p"><Save size={14} /> Guardar cambios</button>
        </div>
      )}

      {showOllamaWizard && (
        <div className="modal-overlay" onClick={(event) => { if (event.target === event.currentTarget) setShowOllamaWizard(false); }}>
          <div className="modal-container modal-container--lg">
            <OllamaSetupWizard
              endpoint={localConfig.ollamaBaseUrl}
              onReady={async (diagnostic) => {
                const model = diagnostic.details.selectedModel ?? localConfig.model;
                setLocalConfig({ ...localConfig, model, ollamaModel: model });
                setOllamaConnected(true);
                const snapshot = await refreshOllamaModelCatalog(localConfig.ollamaBaseUrl);
                setOllamaModels(snapshot.models);
                setShowOllamaWizard(false);
              }}
              onCancel={() => setShowOllamaWizard(false)}
            />
          </div>
        </div>
      )}
    </main>
  );
};

export default SettingsPanel;
