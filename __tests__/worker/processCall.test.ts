import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({ default: { query: vi.fn() } }));
vi.mock('@/lib/credentials', () => ({ getAccountCredentials: vi.fn() }));
vi.mock('@/lib/sip-provider', () => ({ getSipProvider: vi.fn() }));
vi.mock('twilio', () => ({
  default: vi.fn(() => ({
    calls: { create: vi.fn() },
  })),
}));
vi.mock('ioredis', () => ({ default: vi.fn(() => ({ on: vi.fn(), quit: vi.fn() })) }));
vi.mock('bullmq', () => ({
  Worker: vi.fn(() => ({ on: vi.fn() })),
  Queue: vi.fn(() => ({ on: vi.fn(), getJobCounts: vi.fn(), getFailed: vi.fn(() => []) })),
}));
vi.mock('@/lib/queue', () => ({ getQueueName: vi.fn(() => 'test-queue') }));

import pool from '@/lib/db';
import { getAccountCredentials } from '@/lib/credentials';
import { getSipProvider } from '@/lib/sip-provider';
import twilio from 'twilio';
import { processCall } from '@/worker/processCall';

const mockQuery = pool.query as ReturnType<typeof vi.fn>;
const mockGetCreds = getAccountCredentials as ReturnType<typeof vi.fn>;
const mockGetSipProvider = getSipProvider as ReturnType<typeof vi.fn>;
const mockTwilio = twilio as ReturnType<typeof vi.fn>;

const defaultCreds = {
  twilioAccountSid: 'ACtest',
  twilioAuthToken: 'auth_test',
  twilioPhoneNumber: '+85200000000',
  webhookBaseUrl: 'https://console.example.com',
  voiceProvider: 'auto' as const,
};

function makeJob(overrides: Partial<{
  contactId: number; campaignId: number; accountId: number;
  phone: string; voiceId: string; greetingText: string;
  systemPrompt: string; callTimeoutSec: number;
}> = {}) {
  return {
    id: 'job-1',
    data: {
      contactId: 1, campaignId: 1, accountId: 1,
      phone: '+85299999999',
      voiceId: 'Cantonese_GentleLady',
      greetingText: 'Hello',
      systemPrompt: 'You are helpful.',
      callTimeoutSec: 30,
      ...overrides,
    },
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCreds.mockResolvedValue(defaultCreds);
  mockGetSipProvider.mockResolvedValue(null); // no FreeSWITCH by default
  mockQuery.mockResolvedValue({ rows: [] });
  // Default Twilio mock returns a call SID
  mockTwilio.mockReturnValue({
    calls: { create: vi.fn().mockResolvedValue({ sid: 'CA_TWILIO_SID' }) },
  });
});

describe('processCall — Twilio path', () => {
  it('uses Twilio when getSipProvider returns null', async () => {
    await processCall(makeJob());
    expect(mockTwilio).toHaveBeenCalledWith('ACtest', 'auth_test');
  });

  it('sets contact status to "calling" before dialling', async () => {
    await processCall(makeJob());
    const firstCall = mockQuery.mock.calls[0];
    expect(firstCall[0]).toContain("status = 'calling'");
    expect(firstCall[1]).toContain(1); // contactId
  });

  it('saves call_sid to contact after Twilio call created', async () => {
    await processCall(makeJob());
    const secondCall = mockQuery.mock.calls[1];
    expect(secondCall[0]).toContain('call_sid');
    expect(secondCall[1][0]).toBe('CA_TWILIO_SID');
  });

  it('normalizes phone without leading + by adding one', async () => {
    await processCall(makeJob({ phone: '85299999999' }));
    const twilioClient = mockTwilio.mock.results[0].value;
    const createArgs = twilioClient.calls.create.mock.calls[0][0];
    expect(createArgs.to).toBe('+85299999999');
  });

  it('phone already with + is not doubled', async () => {
    await processCall(makeJob({ phone: '+85299999999' }));
    const twilioClient = mockTwilio.mock.results[0].value;
    const createArgs = twilioClient.calls.create.mock.calls[0][0];
    expect(createArgs.to).toBe('+85299999999');
  });
});

describe('processCall — FreeSWITCH path', () => {
  it('uses FreeSWITCH when sip provider is available', async () => {
    const mockInitiateCall = vi.fn().mockResolvedValue('CA_FS_SID');
    mockGetSipProvider.mockResolvedValue({ initiateCall: mockInitiateCall });

    await processCall(makeJob());

    expect(mockInitiateCall).toHaveBeenCalled();
    expect(mockTwilio).not.toHaveBeenCalled();
    // call_sid should be the FS SID
    const updateCall = mockQuery.mock.calls[1];
    expect(updateCall[1][0]).toBe('CA_FS_SID');
  });

  it('falls back to Twilio when FreeSWITCH fails and voiceProvider is auto', async () => {
    mockGetSipProvider.mockResolvedValue({
      initiateCall: vi.fn().mockRejectedValue(new Error('FS connection failed')),
    });

    await processCall(makeJob());

    expect(mockTwilio).toHaveBeenCalled();
    const updateCall = mockQuery.mock.calls[1];
    expect(updateCall[1][0]).toBe('CA_TWILIO_SID');
  });

  it('does NOT fall back when voiceProvider is "freeswitch" (hard-set)', async () => {
    mockGetCreds.mockResolvedValue({ ...defaultCreds, voiceProvider: 'freeswitch' });
    mockGetSipProvider.mockResolvedValue({
      initiateCall: vi.fn().mockRejectedValue(new Error('FS down')),
    });

    await expect(processCall(makeJob())).rejects.toThrow('FS down');
    expect(mockTwilio).not.toHaveBeenCalled();
  });
});
