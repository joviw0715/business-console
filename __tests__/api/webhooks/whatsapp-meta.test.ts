import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'crypto';

vi.mock('@/lib/whatsapp-bot', () => ({ handleAdminMessage: vi.fn() }));

import { handleAdminMessage } from '@/lib/whatsapp-bot';
import { GET, POST } from '@/app/api/webhooks/whatsapp/meta/route';

const mockHandleAdminMessage = handleAdminMessage as ReturnType<typeof vi.fn>;

function makeGetRequest(params: Record<string, string>) {
  const url = new URL('http://localhost/api/webhooks/whatsapp/meta');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new Request(url.toString());
}

function makePostRequest(body: unknown, headers: Record<string, string> = {}) {
  const rawBody = JSON.stringify(body);
  return new Request('http://localhost/api/webhooks/whatsapp/meta', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: rawBody,
  });
}

function makeSignedPostRequest(body: unknown, secret: string, extraHeaders: Record<string, string> = {}) {
  const rawBody = JSON.stringify(body);
  const sig = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  return new Request('http://localhost/api/webhooks/whatsapp/meta', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': sig, ...extraHeaders },
    body: rawBody,
  });
}

const validPayload = {
  entry: [{
    changes: [{
      value: {
        messages: [{ from: '85298765432', type: 'text', text: { body: 'Hello' } }],
      },
    }],
  }],
};

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.META_WA_VERIFY_TOKEN;
  delete process.env.META_WA_APP_SECRET;
  mockHandleAdminMessage.mockResolvedValue(undefined);
});

describe('GET /api/webhooks/whatsapp/meta — verification handshake', () => {
  it('returns challenge when mode=subscribe and token matches', async () => {
    process.env.META_WA_VERIFY_TOKEN = 'my-token';
    const res = await GET(makeGetRequest({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'my-token',
      'hub.challenge': 'abc123',
    }) as any);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('abc123');
  });

  it('returns 403 when token does not match', async () => {
    process.env.META_WA_VERIFY_TOKEN = 'my-token';
    const res = await GET(makeGetRequest({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'wrong-token',
      'hub.challenge': 'abc123',
    }) as any);
    expect(res.status).toBe(403);
  });

  it('returns 403 when mode is not subscribe', async () => {
    process.env.META_WA_VERIFY_TOKEN = 'my-token';
    const res = await GET(makeGetRequest({
      'hub.mode': 'other',
      'hub.verify_token': 'my-token',
      'hub.challenge': 'abc123',
    }) as any);
    expect(res.status).toBe(403);
  });
});

describe('POST /api/webhooks/whatsapp/meta — incoming messages', () => {
  it('returns 403 when app secret set but signature header is absent', async () => {
    process.env.META_WA_APP_SECRET = 'mysecret';
    const res = await POST(makePostRequest(validPayload) as any);
    expect(res.status).toBe(403);
  });

  it('returns 403 when signature is incorrect', async () => {
    process.env.META_WA_APP_SECRET = 'mysecret';
    const res = await POST(makePostRequest(validPayload, { 'x-hub-signature-256': 'sha256=bad' }) as any);
    expect(res.status).toBe(403);
  });

  it('returns 200 and calls handleAdminMessage with valid HMAC signature', async () => {
    process.env.META_WA_APP_SECRET = 'mysecret';
    const res = await POST(makeSignedPostRequest(validPayload, 'mysecret') as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    await new Promise(r => setTimeout(r, 5));
    expect(mockHandleAdminMessage).toHaveBeenCalledWith({
      from: '85298765432',
      body: 'Hello',
      numMedia: 0,
      mediaUrl: undefined,
      mediaContentType: undefined,
    });
  });

  it('returns 200 when META_WA_APP_SECRET is unset (no signature check)', async () => {
    delete process.env.META_WA_APP_SECRET;
    const res = await POST(makePostRequest(validPayload) as any);
    expect(res.status).toBe(200);
    await new Promise(r => setTimeout(r, 5));
    expect(mockHandleAdminMessage).toHaveBeenCalled();
  });

  it('returns 400 for invalid JSON body', async () => {
    const res = await POST(new Request('http://localhost/api/webhooks/whatsapp/meta', {
      method: 'POST',
      body: 'not-json',
    }) as any);
    expect(res.status).toBe(400);
  });

  it('handleAdminMessage rejection does not affect 200 response', async () => {
    mockHandleAdminMessage.mockRejectedValue(new Error('Bot error'));
    const res = await POST(makePostRequest(validPayload) as any);
    expect(res.status).toBe(200);
  });

  it('dispatches multiple messages in a single entry', async () => {
    const multiPayload = {
      entry: [{
        changes: [{
          value: {
            messages: [
              { from: '111', type: 'text', text: { body: 'Msg1' } },
              { from: '222', type: 'text', text: { body: 'Msg2' } },
            ],
          },
        }],
      }],
    };
    await POST(makePostRequest(multiPayload) as any);
    await new Promise(r => setTimeout(r, 5));
    expect(mockHandleAdminMessage).toHaveBeenCalledTimes(2);
  });

  it('extractMessage: text type returns body and numMedia=0', async () => {
    const payload = {
      entry: [{ changes: [{ value: {
        messages: [{ from: '111', type: 'text', text: { body: 'Test message' } }],
      }}]}],
    };
    await POST(makePostRequest(payload) as any);
    await new Promise(r => setTimeout(r, 5));
    expect(mockHandleAdminMessage).toHaveBeenCalledWith(
      expect.objectContaining({ body: 'Test message', numMedia: 0 })
    );
  });

  it('extractMessage: interactive button_reply returns interactiveReply id', async () => {
    const payload = {
      entry: [{ changes: [{ value: {
        messages: [{ from: '111', type: 'interactive', interactive: {
          button_reply: { id: 'btn_yes', title: 'Yes' },
        }}],
      }}]}],
    };
    await POST(makePostRequest(payload) as any);
    await new Promise(r => setTimeout(r, 5));
    expect(mockHandleAdminMessage).toHaveBeenCalledWith(
      expect.objectContaining({ body: 'btn_yes', numMedia: 0 })
    );
  });

  it('extractMessage: image type returns numMedia=1', async () => {
    const payload = {
      entry: [{ changes: [{ value: {
        messages: [{ from: '111', type: 'image', image: { id: 'img123', mime_type: 'image/jpeg' } }],
      }}]}],
    };
    await POST(makePostRequest(payload) as any);
    await new Promise(r => setTimeout(r, 5));
    expect(mockHandleAdminMessage).toHaveBeenCalledWith(
      expect.objectContaining({ numMedia: 1, mediaUrl: 'meta-media:img123' })
    );
  });

  it('extractMessage: unknown type returns empty body and numMedia=0', async () => {
    const payload = {
      entry: [{ changes: [{ value: {
        messages: [{ from: '111', type: 'location', location: { lat: 1, lon: 2 } }],
      }}]}],
    };
    await POST(makePostRequest(payload) as any);
    await new Promise(r => setTimeout(r, 5));
    expect(mockHandleAdminMessage).toHaveBeenCalledWith(
      expect.objectContaining({ body: '', numMedia: 0 })
    );
  });
});
