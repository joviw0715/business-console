// Stub for next/headers in test environment
export const cookies = vi.fn(() => Promise.resolve({}));
export const headers = vi.fn(() => Promise.resolve(new Headers()));
