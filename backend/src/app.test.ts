import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';

describe('the API', () => {
  it('answers GET /api/health', async () => {
    const res = await request(createApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('sends no CORS header — the app is same-origin by construction', async () => {
    const res = await request(createApp())
      .get('/api/health')
      .set('Origin', 'https://elsewhere.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('404s an unknown /api route as JSON', async () => {
    const res = await request(createApp()).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'not_found' });
  });
});
