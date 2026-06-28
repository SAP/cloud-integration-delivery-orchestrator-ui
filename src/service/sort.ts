/**
 * Sort delivery requests: current user's items first, then by UpdatedAt descending.
 * Does not mutate the input array.
 */
export function sortByOwnerAndDate<T extends { CreatedBy?: string; UpdatedBy?: string; UpdatedAt?: string }>(
  items: T[],
  currentUserEmail: string
): T[] {
  return [...items].sort((a, b) => {
    const aIsMine = (a.CreatedBy === currentUserEmail || a.UpdatedBy === currentUserEmail) ? 0 : 1
    const bIsMine = (b.CreatedBy === currentUserEmail || b.UpdatedBy === currentUserEmail) ? 0 : 1
    if (aIsMine !== bIsMine) return aIsMine - bIsMine
    return new Date(b.UpdatedAt || 0).getTime() - new Date(a.UpdatedAt || 0).getTime()
  })
}
