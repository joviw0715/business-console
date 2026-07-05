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
  // First query is now the campaign-status guard. Default to 'running' so tests proceed normally.
  mockQuery
    .mockResolvedValueOnce({ rows: [{ status: 'running' }] }) // campaign status check
    .mockResolvedValue({ rows: [] }); // all subsequent queries
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
    // calls[0] is now the campaign-status guard; calls[1] is the 'calling' update
    const callingCall = mockQuery.mock.calls[1];
    expect(callingCall[0]).toContain("status = 'calling'");
    expect(callingCall[1]).toContain(1); // contactId
  });

  it('saves call_sid to contact after Twilio call created', async () => {
    await processCall(makeJob());
    // calls[2] is the call_sid update
    const sidCall = mockQuery.mock.calls[2];
    expect(sidCall[0]).toContain('call_sid');
    expect(sidCall[1][0]).toBe('CA_TWILIO_SID');
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
    // calls[0]=campaign check, calls[1]=status 'calling', calls[2]=call_sid update
    const updateCall = mockQuery.mock.calls[2];
    expect(updateCall[1][0]).toBe('CA_FS_SID');
  });

  it('falls back to Twilio when FreeSWITCH fails and voiceProvider is auto', async () => {
    mockGetSipProvider.mockResolvedValue({
      initiateCall: vi.fn().mockRejectedValue(new Error('FS connection failed')),
    });

    await processCall(makeJob());

    expect(mockTwilio).toHaveBeenCalled();
    const updateCall = mockQuery.mock.calls[2];
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

describe('processCall — campaign status guard', () => {
  it('skips dialling and resets contact to pending when campaign is paused', async () => {
    vi.resetAllMocks();
    mockGetCreds.mockResolvedValue(defaultCreds);
    mockGetSipProvider.mockResolvedValue(null);
    mockTwilio.mockReturnValue({ calls: { create: vi.fn().mockResolvedValue({ sid: 'CA_SHOULD_NOT_BE_CALLED' }) } });
    mockQuery
      .mockResolvedValueOnce({ rows: [{ status: 'paused' }] }) // campaign check
      .mockResolvedValue({ rows: [] });

    await processCall(makeJob());

    // Twilio constructor should never have been called
    expect(mockTwilio).not.toHaveBeenCalled();

    // Should have reset the contact to 'pending'
    const resetCall = mockQuery.mock.calls[1];
    expect(resetCall[0]).toContain("status = 'pending'");
  });

  it('skips dialling when campaign is done', async () => {
    vi.resetAllMocks();
    mockGetCreds.mockResolvedValue(defaultCreds);
    mockGetSipProvider.mockResolvedValue(null);
    mockTwilio.mockReturnValue({ calls: { create: vi.fn().mockResolvedValue({ sid: 'CA_SHOULD_NOT_BE_CALLED' }) } });
    mockQuery
      .mockResolvedValueOnce({ rows: [{ status: 'done' }] })
      .mockResolvedValue({ rows: [] });

    await processCall(makeJob());

    expect(mockTwilio).not.toHaveBeenCalled();
  });
});
