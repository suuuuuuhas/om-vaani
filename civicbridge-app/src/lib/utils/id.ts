/**
 * Generates a synthetic case id like CB-2026-48213.
 * `uniqueness` lets callers exclude ids already in the local store.
 */
export function generateCaseId(
  now: Date = new Date(),
  isTaken: (id: string) => boolean = () => false
): string {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const n = Math.floor(10000 + Math.random() * 90000);
    const id = `CB-${now.getFullYear()}-${n}`;
    if (!isTaken(id)) return id;
  }
  // Practically unreachable; deterministic suffix keeps the format contract.
  return `CB-${now.getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
}

export const CASE_ID_PATTERN = /^CB-\d{4}-\d{5}$/;
