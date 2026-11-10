import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('S2S identity separation (Edge→P5 vs P5→Edge)', () => {
  it('env schema documents distinct inbound and outbound client IDs', () => {
    const schema = readFileSync(
      resolve(__dirname, '../../../../shared/configuration/environment.schema.ts'),
      'utf8',
    );
    expect(schema).toMatch(/EDGE_P5_S2S_CLIENT_ID/);
    expect(schema).toMatch(/EDGE_P5_INBOUND_S2S_CLIENT_ID/);
    expect(schema).toMatch(/Must NOT equal EDGE_P5_INBOUND_S2S_CLIENT_ID/);
  });

  it('token client uses outbound Edge→P5 credentials only', () => {
    const src = readFileSync(resolve(__dirname, './edge-p5-s2s-token.client.ts'), 'utf8');
    expect(src).toMatch(/EDGE_P5_S2S_CLIENT_ID/);
    expect(src).not.toMatch(/EDGE_P5_INBOUND_S2S_CLIENT_ID/);
  });
});
