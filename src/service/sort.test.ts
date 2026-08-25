import { describe, it, expect } from 'vitest'
import { sortByOwnerAndDate } from './sort'

const make = (overrides: Partial<{ CreatedBy: string; UpdatedBy: string; UpdatedAt: string; Name: string }>) => ({
  CreatedBy: '',
  UpdatedBy: '',
  UpdatedAt: '',
  Name: '',
  ...overrides,
})

describe('sortByOwnerAndDate', () => {
  const me = 'me@example.com'

  it('puts current user items before others', () => {
    const items = [
      make({ Name: 'other', CreatedBy: 'other@x.com', UpdatedAt: '2026-06-01T00:00:00Z' }),
      make({ Name: 'mine', CreatedBy: me, UpdatedAt: '2026-01-01T00:00:00Z' }),
    ]
    const result = sortByOwnerAndDate(items, me)
    expect(result[0].Name).toBe('mine')
    expect(result[1].Name).toBe('other')
  })

  it('matches on UpdatedBy as well as CreatedBy', () => {
    const items = [
      make({ Name: 'other', CreatedBy: 'other@x.com', UpdatedBy: 'other@x.com', UpdatedAt: '2026-06-01T00:00:00Z' }),
      make({ Name: 'mine-updated', CreatedBy: 'other@x.com', UpdatedBy: me, UpdatedAt: '2026-01-01T00:00:00Z' }),
    ]
    const result = sortByOwnerAndDate(items, me)
    expect(result[0].Name).toBe('mine-updated')
  })

  it('within same owner group, sorts by UpdatedAt descending', () => {
    const items = [
      make({ Name: 'old', CreatedBy: me, UpdatedAt: '2026-01-01T00:00:00Z' }),
      make({ Name: 'new', CreatedBy: me, UpdatedAt: '2026-06-01T00:00:00Z' }),
      make({ Name: 'mid', CreatedBy: me, UpdatedAt: '2026-03-01T00:00:00Z' }),
    ]
    const result = sortByOwnerAndDate(items, me)
    expect(result.map(r => r.Name)).toEqual(['new', 'mid', 'old'])
  })

  it('within non-owner group, also sorts by UpdatedAt descending', () => {
    const items = [
      make({ Name: 'A', CreatedBy: 'a@x.com', UpdatedAt: '2026-01-01T00:00:00Z' }),
      make({ Name: 'B', CreatedBy: 'b@x.com', UpdatedAt: '2026-06-01T00:00:00Z' }),
    ]
    const result = sortByOwnerAndDate(items, me)
    expect(result.map(r => r.Name)).toEqual(['B', 'A'])
  })

  it('handles empty email (no user logged in) — pure date sort', () => {
    const items = [
      make({ Name: 'old', CreatedBy: me, UpdatedAt: '2026-01-01T00:00:00Z' }),
      make({ Name: 'new', CreatedBy: 'other@x.com', UpdatedAt: '2026-06-01T00:00:00Z' }),
    ]
    const result = sortByOwnerAndDate(items, '')
    expect(result[0].Name).toBe('new')
    expect(result[1].Name).toBe('old')
  })

  it('handles missing UpdatedAt — those items sort to the end', () => {
    const items = [
      make({ Name: 'no-date', CreatedBy: me }),
      make({ Name: 'has-date', CreatedBy: me, UpdatedAt: '2026-06-01T00:00:00Z' }),
    ]
    const result = sortByOwnerAndDate(items, me)
    expect(result[0].Name).toBe('has-date')
    expect(result[1].Name).toBe('no-date')
  })

  it('does not mutate the original array', () => {
    const items = [
      make({ Name: 'B', CreatedBy: me, UpdatedAt: '2026-01-01T00:00:00Z' }),
      make({ Name: 'A', CreatedBy: me, UpdatedAt: '2026-06-01T00:00:00Z' }),
    ]
    const original = [...items]
    sortByOwnerAndDate(items, me)
    expect(items).toEqual(original)
  })

  it('handles empty array', () => {
    expect(sortByOwnerAndDate([], me)).toEqual([])
  })

  it('combined: owner first + date sort within each group', () => {
    const items = [
      make({ Name: 'other-new', CreatedBy: 'x@x.com', UpdatedAt: '2026-06-15T00:00:00Z' }),
      make({ Name: 'mine-old', CreatedBy: me, UpdatedAt: '2026-01-01T00:00:00Z' }),
      make({ Name: 'other-old', CreatedBy: 'y@x.com', UpdatedAt: '2026-01-01T00:00:00Z' }),
      make({ Name: 'mine-new', CreatedBy: me, UpdatedAt: '2026-06-15T00:00:00Z' }),
    ]
    const result = sortByOwnerAndDate(items, me)
    expect(result.map(r => r.Name)).toEqual([
      'mine-new',    // mine, newest
      'mine-old',    // mine, older
      'other-new',   // not mine, newest
      'other-old',   // not mine, older
    ])
  })
})
