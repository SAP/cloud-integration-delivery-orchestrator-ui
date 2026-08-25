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
  // Direction: target(old/baseline) → source(new/delivering)
  // left = target content, right = source content

  it('classifies changed iflw files case-insensitively and keeps text patches separate', () => {
    const result = buildCompareFiles(
      snapshot('DEV', [
        file('flow/Integration.IFLW', '<new/>'),
        file('script/a.groovy', 'new'),
      ]),
      snapshot('TEST', [
        file('flow/Integration.IFLW', '<old/>'),
        file('script/a.groovy', 'old'),
      ]),
    )

    expect(result.files.map(item => [item.path, item.kind, item.status])).toEqual([
      ['flow/Integration.IFLW', 'bpmn', 'modified'],
      ['script/a.groovy', 'text', 'modified'],
    ])
    expect(result.iflowFiles).toEqual([result.files[0]])
    expect(result.iflowFiles[0]).toMatchObject({
      leftContent: '<old/>',   // target = old
      rightContent: '<new/>',  // source = new
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

  it('uses target-to-source direction: source-only=added, target-only=deleted', () => {
    const result = buildCompareFiles(
      snapshot('DEV', [file('flows/zeta.iflw', '<new/>')]),    // source: delivering this
      snapshot('TEST', [file('flows/alpha.iflw', '<old/>')]),  // target: has this baseline
    )

    expect(result.iflowFiles.map(item => [item.path, item.status])).toEqual([
      ['flows/alpha.iflw', 'deleted'],  // only in target → will be removed
      ['flows/zeta.iflw', 'added'],     // only in source → being added
    ])
    expect(result.stats).toEqual({
      added: 1,
      deleted: 1,
      modified: 0,
      unchanged: 0,
    })
  })

  it('uses /dev/null as the old filename for a file only in source (added)', () => {
    const result = buildCompareFiles(
      snapshot('DEV', [file('new-file.txt', 'content')]),  // source has it
      snapshot('TEST', []),                                  // target doesn't
    )

    expect(result.files).toHaveLength(1)
    expect(result.files[0]).toMatchObject({
      path: 'new-file.txt',
      kind: 'text',
      status: 'added',
    })
    expect(result.files[0].leftContent).toBeUndefined()   // no target content
    expect(result.files[0].rightContent).toBe('content')  // source content
    expect(result.textPatches[0].split('\n')).toEqual(expect.arrayContaining([
      '--- /dev/null',
      '+++ new-file.txt',
    ]))
    expect(result.stats).toEqual({
      added: 1,
      deleted: 0,
      modified: 0,
      unchanged: 0,
    })
  })

  it('uses /dev/null as the new filename for a file only in target (deleted)', () => {
    const result = buildCompareFiles(
      snapshot('DEV', []),                                      // source doesn't have it
      snapshot('TEST', [file('old-file.txt', 'baseline')]),    // target has it
    )

    expect(result.files).toHaveLength(1)
    expect(result.files[0]).toMatchObject({
      path: 'old-file.txt',
      kind: 'text',
      status: 'deleted',
      leftContent: 'baseline',  // target content (old)
    })
    expect(result.files[0].rightContent).toBeUndefined()
    expect(result.textPatches[0].split('\n')).toEqual(expect.arrayContaining([
      '--- old-file.txt',
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
        file('lib/mixed.jar', 'new'),
        file('lib/source-only.jar', 'binary', true),
      ]),
      snapshot('TEST', [
        file('same.prop', 'same'),
        file('lib/mixed.jar', 'old', true),
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

  it('classifies an iflw only in source as added', () => {
    const result = buildCompareFiles(
      snapshot('DEV', [file('flows/new.iflw', '<bpmn/>')]),  // source delivering
      snapshot('TEST', []),                                    // target has nothing
    )

    expect(result.iflowFiles).toHaveLength(1)
    expect(result.iflowFiles[0]).toMatchObject({
      path: 'flows/new.iflw',
      kind: 'bpmn',
      status: 'added',
      rightContent: '<bpmn/>',  // source = right
    })
    expect(result.iflowFiles[0].leftContent).toBeUndefined()
    expect(result.stats).toEqual({
      added: 1,
      deleted: 0,
      modified: 0,
      unchanged: 0,
    })
  })

  it('classifies an iflw only in target as deleted', () => {
    const result = buildCompareFiles(
      snapshot('DEV', []),                                           // source doesn't have it
      snapshot('TEST', [file('flows/legacy.iflw', '<old-bpmn/>')]), // target has it
    )

    expect(result.iflowFiles).toHaveLength(1)
    expect(result.iflowFiles[0]).toMatchObject({
      path: 'flows/legacy.iflw',
      kind: 'bpmn',
      status: 'deleted',
      leftContent: '<old-bpmn/>',  // target = left
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
      snapshot('DEV', [file('source-only.groovy', 'new')]),   // source: added
      snapshot('TEST', [file('target-only.groovy', 'old')]),  // target: deleted
    )

    const added = result.files.find(item => item.path === 'source-only.groovy')
    const deleted = result.files.find(item => item.path === 'target-only.groovy')

    expect(added?.leftContent).toBeUndefined()     // no target content
    expect(added?.rightContent).toBe('new')         // source content
    expect(added?.patch).toBe(createTwoFilesPatch('/dev/null', 'source-only.groovy', '', 'new'))

    expect(deleted?.leftContent).toBe('old')        // target content
    expect(deleted?.rightContent).toBeUndefined()   // no source content
    expect(deleted?.patch).toBe(createTwoFilesPatch('target-only.groovy', '/dev/null', 'old', ''))
  })
})
