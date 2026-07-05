// Stub for next/navigation in test environment
export const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
export const useRouter = vi.fn();
export const usePathname = vi.fn(() => '/');
export const useSearchParams = vi.fn();
