/**
 * Casabero Editorial 1.2 tokens for generated artifacts.
 *
 * PDF/SVG consumers use the built-in jsPDF families so exports remain
 * portable when the web fonts are unavailable or remote loading is blocked.
 */
export const EDITORIAL_ARTIFACT_THEME = {
  colors: {
    canvas: '#FFFFFF',
    white: '#FFFFFF',
    ink: '#191919',
    muted: '#6B6B67',
    line: '#D9D9D4',
    surface: '#F7F7F4',
    surfaceQuiet: '#FBFBF9',
    faint: '#6B6B67',
    border: '#D9D9D4',
    panel: '#F7F7F4',
    accent: '#191919',
    accentSoft: '#FBFBF9',
    critical: '#8A241B',
    warning: '#7A4B00',
    info: '#315B72',
    good: '#176B5C',
  },
  fonts: {
    reading: 'times',
    operation: 'helvetica',
    data: 'courier',
  },
} as const;

export type EditorialArtifactTheme = typeof EDITORIAL_ARTIFACT_THEME;
