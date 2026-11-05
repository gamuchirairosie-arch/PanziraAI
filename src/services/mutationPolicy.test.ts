import { describe, expect, it, vi } from 'vitest';
import {
  commitAfterServerAcknowledgement,
  isFourCheckGateComplete,
} from './mutationPolicy';

describe('server acknowledgement policy', () => {
  it('does not commit UI state when the API request fails', async () => {
    const commit = vi.fn();

    await expect(
      commitAfterServerAcknowledgement(
        async () => {
          throw new Error('backend unavailable');
        },
        commit
      )
    ).rejects.toThrow('backend unavailable');

    expect(commit).not.toHaveBeenCalled();
  });

  it('commits the exact server response after acknowledgement', async () => {
    const serverRecord = { id: 'PZ-SERVER-1001', workflowStatus: 'lead' };
    const commit = vi.fn();

    await expect(
      commitAfterServerAcknowledgement(async () => serverRecord, commit)
    ).resolves.toBe(serverRecord);

    expect(commit).toHaveBeenCalledOnce();
    expect(commit).toHaveBeenCalledWith(serverRecord);
  });
});

describe('four-check editorial gate', () => {
  it('stays locked when any required check is incomplete', () => {
    expect(
      isFourCheckGateComplete({
        locationAndTime: true,
        mediaAndDate: true,
        independentSource: false,
        hazardStillPresent: true,
      })
    ).toBe(false);
  });

  it('opens only when all four checks are complete', () => {
    expect(
      isFourCheckGateComplete({
        locationAndTime: true,
        mediaAndDate: true,
        independentSource: true,
        hazardStillPresent: true,
      })
    ).toBe(true);
  });
});
