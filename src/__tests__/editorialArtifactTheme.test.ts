import { describe, expect, it } from 'vitest';
import { EDITORIAL_ARTIFACT_THEME } from '../services/editorialArtifactTheme';
import { buildSnapshotSvg } from '../services/evidenceArchive';

describe('Casabero Editorial artifact theme', () => {
  it('expone los tokens normativos y familias portables de los artefactos', () => {
    expect(EDITORIAL_ARTIFACT_THEME.colors).toEqual(expect.objectContaining({
      canvas: '#FFFFFF',
      ink: '#191919',
      muted: '#6B6B67',
      line: '#D9D9D4',
      surface: '#F7F7F4',
    }));
    expect(EDITORIAL_ARTIFACT_THEME.fonts).toEqual({
      reading: 'times',
      operation: 'helvetica',
      data: 'courier',
    });
  });

  it('genera snapshots SVG con la misma dirección Editorial', () => {
    const svg = buildSnapshotSvg('evidence', 'Run summary', [['status', 'verified']]);

    expect(svg).toContain('#FFFFFF');
    expect(svg).toContain('#191919');
    expect(svg).toContain('#D9D9D4');
    expect(svg).toContain('Source Sans 3');
    expect(svg).toContain('Times New Roman');
    expect(svg).toContain('Courier New');
    expect(svg).not.toContain('Showcase Ink');
    expect(svg).not.toContain('Playfair Display');
    expect(svg).not.toContain('JetBrains Mono');
  });
});
