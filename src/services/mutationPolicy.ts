import { VerificationChecklist } from '../types';

export function isFourCheckGateComplete(checklist: VerificationChecklist): boolean {
  return (
    checklist.locationAndTime &&
    checklist.mediaAndDate &&
    checklist.independentSource &&
    checklist.hazardStillPresent
  );
}

/**
 * Applies a server-backed state change only after the request resolves.
 * A rejected request never reaches commit, which prevents false success in the UI.
 */
export async function commitAfterServerAcknowledgement<T>(
  request: () => Promise<T>,
  commit: (acknowledged: T) => void
): Promise<T> {
  const acknowledged = await request();
  commit(acknowledged);
  return acknowledged;
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}
