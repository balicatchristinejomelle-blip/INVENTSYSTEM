import type { MaterialRequest } from './types';

const key = (value: string | undefined) => (value || '').trim().toUpperCase();

/** Read-only explicit relationship lookup. Never guess approval from material or delivery status. */
export function linkedMaterialRequest(requests: readonly MaterialRequest[], reference: string | undefined) {
  const value = key(reference);
  if (!value) return undefined;
  const matches = requests.filter(request => key(request.refNo) === value || key(request.id) === value);
  return matches.length === 1 ? matches[0] : undefined;
}

export const approvedMaterialRequest = (request: MaterialRequest | undefined) => key(request?.status) === 'APPROVED';
