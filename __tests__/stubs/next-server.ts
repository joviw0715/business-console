// Stub for next/server in test environment
export class NextResponse {
  static json(body: unknown, init?: ResponseInit) {
    const status = init?.status ?? 200;
    const bodyStr = JSON.stringify(body);
    return {
      status,
      headers: new Headers({ 'Content-Type': 'application/json', ...(init?.headers as Record<string, string> ?? {}) }),
      json: async () => JSON.parse(bodyStr),
      text: async () => bodyStr,
      _body: body,
    };
  }
  constructor(body: string, init?: ResponseInit) {
    return {
      status: init?.status ?? 200,
      headers: new Headers(init?.headers as HeadersInit ?? {}),
      text: async () => body,
      json: async () => JSON.parse(body),
      _body: body,
    };
  }
}

export class NextRequest extends Request {
  constructor(url: string, init?: RequestInit) {
    super(url, init);
  }
}
