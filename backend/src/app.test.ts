import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';

describe('the API', () => {
  it('answers GET /api/health', async () => {
    const res = await request(createApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('404s an unknown /api route as JSON', async () => {
    const res = await request(createApp()).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'not_found' });
  });

  it('404s an unknown non-/api route as JSON too — the app is API-only now', async () => {
    const res = await request(createApp()).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'not_found' });
  });

  describe('CORS', () => {
    const corsOrigin = 'https://bookly.example';

    it('echoes the allowed origin and allows credentials', async () => {
      const res = await request(createApp({ corsOrigin }))
        .get('/api/health')
        .set('Origin', corsOrigin);
      expect(res.headers['access-control-allow-origin']).toBe(corsOrigin);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('sends no Allow-Origin header to an unlisted origin', async () => {
      const res = await request(createApp({ corsOrigin }))
        .get('/api/health')
        .set('Origin', 'https://elsewhere.example');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
      // cors doesn't reject server-side for a mismatched origin — it just
      // omits the header. The browser is what refuses to hand the response to
      // page script without it. supertest still sees 200.
      expect(res.status).toBe(200);
    });
  });
});
