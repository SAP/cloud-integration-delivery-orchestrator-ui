import { createTwoFilesPatch } from 'diff'

import type {
  SnapshotFileEntry,
  SnapshotFilesResponse,
} from './api'

export type CompareFileKind = 'text' | 'bpmn'
export type CompareFileStatus = 'added' | 'deleted' | 'modified'

export interface CompareFileItem {
  path: string
  kind: CompareFileKind
  status: CompareFileStatus
  patch: string
  leftContent?: string
  rightContent?: string
}

export interface CompareFileStats {
  added: number
  deleted: number
  modified: number
  unchanged: number
}

export interface CompareFilesResult {
  files: CompareFileItem[]
  textPatches: string[]
  iflowFiles: CompareFileItem[]
  stats: CompareFileStats
}

const isIflow = (path: string) => path.toLowerCase().endsWith('.iflw')

export function buildCompareFiles(
  source: SnapshotFilesResponse,
  target: SnapshotFilesResponse,
): CompareFilesResult {
  const sourceMap = new Map<string, SnapshotFileEntry>()
  const targetMap = new Map<string, SnapshotFileEntry>()
  source.files.forEach(item => sourceMap.set(item.path, item))
  target.files.forEach(item => targetMap.set(item.path, item))

  const files: CompareFileItem[] = []
  const stats: CompareFileStats = {
    added: 0,
    deleted: 0,
    modified: 0,
    unchanged: 0,
  }

  const paths = [...new Set([
    ...sourceMap.keys(),
    ...targetMap.keys(),
  ])].sort((a, b) => a.localeCompare(b))

  for (const path of paths) {
    const left = sourceMap.get(path)
    const right = targetMap.get(path)

    if (left?.isBinary || right?.isBinary) continue

    const leftContent = left?.content ?? ''
    const rightContent = right?.content ?? ''

    if (left && right && leftContent === rightContent) {
      stats.unchanged += 1
      continue
    }

    const status: CompareFileStatus = !left
      ? 'added'
      : !right
        ? 'deleted'
        : 'modified'
    const oldFileName = status === 'added' ? '/dev/null' : path
    const newFileName = status === 'deleted' ? '/dev/null' : path

    stats[status] += 1
    files.push({
      path,
      kind: isIflow(path) ? 'bpmn' : 'text',
      status,
      patch: createTwoFilesPatch(
        oldFileName,
        newFileName,
        leftContent,
        rightContent,
      ),
      leftContent: left?.content,
      rightContent: right?.content,
    })
  }

  return {
    files,
    textPatches: files
      .filter(item => item.kind === 'text')
      .map(item => item.patch),
    iflowFiles: files.filter(item => item.kind === 'bpmn'),
    stats,
  }
}
