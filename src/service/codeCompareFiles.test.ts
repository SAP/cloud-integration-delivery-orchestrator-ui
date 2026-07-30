import { createTwoFilesPatch } from 'diff'
import { describe, expect, it } from 'vitest'

import type { SnapshotFileEntry, SnapshotFilesResponse } from './api'
import { buildCompareFiles } from './codeCompareFiles'

const file = (
  path: string,
  content?: string,
  isBinary = false,
): SnapshotFileEntry => ({
  path,
  content,
  isBinary,
  size: content?.length ?? 0,
})

const snapshot = (
  tenant: string,
  files: SnapshotFileEntry[],
): SnapshotFilesResponse => ({
  snapshotId: tenant === 'DEV' ? 1 : 2,
  artifactId: 'Artifact',
  version: tenant === 'DEV' ? '1.0.0' : '1.0.1',
  tenant,
  files,
})

describe('buildCompareFiles', () => {
  it('classifies changed iflw files case-insensitively and keeps text patches separate', () => {
    const result = buildCompareFiles(
      snapshot('DEV', [
        file('flow/Integration.IFLW', '<old/>'),
        file('script/a.groovy', 'old'),
      ]),
      snapshot('TEST', [
        file('flow/Integration.IFLW', '<new/>'),
        file('script/a.groovy', 'new'),
      ]),
    )

    expect(result.files.map(item => [item.path, item.kind, item.status])).toEqual([
      ['flow/Integration.IFLW', 'bpmn', 'modified'],
      ['script/a.groovy', 'text', 'modified'],
    ])
    expect(result.iflowFiles).toEqual([result.files[0]])
    expect(result.iflowFiles[0]).toMatchObject({
      leftContent: '<old/>',
      rightContent: '<new/>',
    })
    expect(result.iflowFiles[0].patch.split('\n')).toEqual(expect.arrayContaining([
      '--- flow/Integration.IFLW',
      '+++ flow/Integration.IFLW',
    ]))
    expect(result.textPatches).toEqual([result.files[1].patch])
    expect(result.textPatches[0]).toContain('script/a.groovy')
    expect(result.textPatches[0]).not.toContain('Integration.IFLW')
    expect(result.stats).toEqual({
      added: 0,
      deleted: 0,
      modified: 2,
      unchanged: 0,
    })
  })

  it('uses source-to-target direction and sorts iflow files by path', () => {
    const result = buildCompareFiles(
      snapshot('DEV', [file('flows/zeta.iflw', '<old/>')]),
      snapshot('TEST', [file('flows/alpha.iflw', '<new/>')]),
    )

    expect(result.iflowFiles.map(item => [item.path, item.status])).toEqual([
      ['flows/alpha.iflw', 'added'],
      ['flows/zeta.iflw', 'deleted'],
    ])
    expect(result.stats).toEqual({
      added: 1,
      deleted: 1,
      modified: 0,
      unchanged: 0,
    })
  })

  it('uses /dev/null as the old filename for an added empty text file', () => {
    const result = buildCompareFiles(
      snapshot('DEV', []),
      snapshot('TEST', [file('empty-added.txt', undefined)]),
    )

    expect(result.files).toHaveLength(1)
    expect(result.files[0]).toMatchObject({
      path: 'empty-added.txt',
      kind: 'text',
      status: 'added',
    })
    expect(result.files[0].leftContent).toBeUndefined()
    expect(result.files[0].rightContent).toBeUndefined()
    expect(result.textPatches[0].split('\n')).toEqual(expect.arrayContaining([
      '--- /dev/null',
      '+++ empty-added.txt',
    ]))
    expect(result.stats).toEqual({
      added: 1,
      deleted: 0,
      modified: 0,
      unchanged: 0,
    })
  })

  it('uses /dev/null as the new filename for a deleted empty text file', () => {
    const result = buildCompareFiles(
      snapshot('DEV', [file('empty-deleted.txt', '')]),
      snapshot('TEST', []),
    )

    expect(result.files).toHaveLength(1)
    expect(result.files[0]).toMatchObject({
      path: 'empty-deleted.txt',
      kind: 'text',
      status: 'deleted',
      leftContent: '',
    })
    expect(result.files[0].rightContent).toBeUndefined()
    expect(result.textPatches[0].split('\n')).toEqual(expect.arrayContaining([
      '--- empty-deleted.txt',
      '+++ /dev/null',
    ]))
    expect(result.stats).toEqual({
      added: 0,
      deleted: 1,
      modified: 0,
      unchanged: 0,
    })
  })

  it('counts equal non-binary files and skips binary files entirely', () => {
    const result = buildCompareFiles(
      snapshot('DEV', [
        file('same.prop', 'same'),
        file('lib/mixed.jar', 'old'),
        file('lib/source-only.jar', 'binary', true),
      ]),
      snapshot('TEST', [
        file('same.prop', 'same'),
        file('lib/mixed.jar', 'new', true),
      ]),
    )

    expect(result.files).toEqual([])
    expect(result.textPatches).toEqual([])
    expect(result.iflowFiles).toEqual([])
    expect(result.stats).toEqual({
      added: 0,
      deleted: 0,
      modified: 0,
      unchanged: 1,
    })
  })

  it('classifies an empty iflw that exists only in target as added', () => {
    const result = buildCompareFiles(
      snapshot('DEV', []),
      snapshot('TEST', [file('flows/empty-added.iflw', '')]),
    )

    expect(result.iflowFiles).toHaveLength(1)
    expect(result.iflowFiles[0]).toMatchObject({
      path: 'flows/empty-added.iflw',
      kind: 'bpmn',
      status: 'added',
      rightContent: '',
    })
    expect(result.iflowFiles[0].leftContent).toBeUndefined()
    expect(result.stats).toEqual({
      added: 1,
      deleted: 0,
      modified: 0,
      unchanged: 0,
    })
  })

  it('classifies an empty iflw that exists only in source as deleted', () => {
    const result = buildCompareFiles(
      snapshot('DEV', [file('flows/empty-deleted.iflw', '')]),
      snapshot('TEST', []),
    )

    expect(result.iflowFiles).toHaveLength(1)
    expect(result.iflowFiles[0]).toMatchObject({
      path: 'flows/empty-deleted.iflw',
      kind: 'bpmn',
      status: 'deleted',
      leftContent: '',
    })
    expect(result.iflowFiles[0].rightContent).toBeUndefined()
    expect(result.stats).toEqual({
      added: 0,
      deleted: 1,
      modified: 0,
      unchanged: 0,
    })
  })

  it('keeps missing-side content undefined while creating patches from empty strings', () => {
    const result = buildCompareFiles(
      snapshot('DEV', [file('deleted.groovy', 'old')]),
      snapshot('TEST', [file('added.groovy', 'new')]),
    )

    const added = result.files.find(item => item.path === 'added.groovy')
    const deleted = result.files.find(item => item.path === 'deleted.groovy')

    expect(added?.leftContent).toBeUndefined()
    expect(added?.rightContent).toBe('new')
    expect(added?.patch).toBe(createTwoFilesPatch('/dev/null', 'added.groovy', '', 'new'))

    expect(deleted?.leftContent).toBe('old')
    expect(deleted?.rightContent).toBeUndefined()
    expect(deleted?.patch).toBe(createTwoFilesPatch('deleted.groovy', '/dev/null', 'old', ''))
  })
})
