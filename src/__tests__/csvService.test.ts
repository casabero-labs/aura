import { beforeEach, describe, expect, it, vi } from 'vitest';
import Papa from 'papaparse';
import { parseCsv } from '../services/csvService';

vi.mock('papaparse', () => ({
  default: {
    parse: vi.fn(),
  },
}));

const mockedParse = vi.mocked(Papa.parse);

describe('parseCsv', () => {
  beforeEach(() => {
    mockedParse.mockReset();
    mockedParse.mockImplementation((_file: any, config: any) => {
      config.complete({
        data: [{ id: 1 }, { id: 2 }],
        meta: { delimiter: ',', fields: ['id'], truncated: false },
        errors: [],
      });
    });
  });

  it('parses the full CSV by default without PapaParse preview limit', async () => {
    const file = new File(['id\n1\n2\n'], 'full.csv', { type: 'text/csv' });

    const parsed = await parseCsv(file);

    expect(parsed.data).toHaveLength(2);
    expect(mockedParse).toHaveBeenCalledTimes(1);
    expect(mockedParse.mock.calls[0][1]).not.toHaveProperty('preview');
  });

  it('supports an explicit preview limit only when requested', async () => {
    const file = new File(['id\n1\n2\n'], 'limited.csv', { type: 'text/csv' });

    await parseCsv(file, 1);

    expect(mockedParse.mock.calls[0][1]).toMatchObject({ preview: 1 });
  });

  it('rejects empty parse results before a profile or score is built', async () => {
    mockedParse.mockImplementation((_file: any, config: any) => {
      config.complete({
        data: [],
        meta: { delimiter: ',', fields: ['id'], truncated: false },
        errors: [],
      });
    });

    await expect(parseCsv(new File(['id\n'], 'vacio.csv', { type: 'text/csv' }))).rejects.toThrow('No se pudo auditar');
  });
});
