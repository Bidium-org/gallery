import type { KeybindingOverride } from '@/types/TSettings'

export type Shortcut = {
  key: string
  shift?: boolean
  display: string
  label: string
}

export const SHORTCUTS = {
  undo: { key: 'z', display: '⌘Z', label: 'Undo' },
  redo: { key: 'z', shift: true, display: '⌘⇧Z', label: 'Redo' },
  redoAlt: { key: 'y', display: '⌘Y', label: 'Redo' },
  copy: { key: 'c', display: '⌘C', label: 'Copy' },
  paste: { key: 'v', display: '⌘V', label: 'Paste' },
  duplicate: { key: 'd', display: '⌘D', label: 'Duplicate' },
  newVersion: { key: 'v', shift: true, display: '⌘⇧V', label: 'New version' },
  delete: { key: 'Backspace', display: '⌫', label: 'Delete' },
} as const satisfies Record<string, Shortcut>

export type ShortcutId = keyof typeof SHORTCUTS

export const REBINDABLE_SHORTCUT_IDS: readonly ShortcutId[] = [
  'undo',
  'redo',
  'copy',
  'duplicate',
  'newVersion',
]

const NODE_HINT_SHORTCUT_IDS: readonly ShortcutId[] = ['copy', 'duplicate', 'delete']
const TEXT_NODE_HINT_SHORTCUT_IDS: readonly ShortcutId[] = [
  'newVersion',
  'copy',
  'duplicate',
  'delete',
]

const KEY_DISPLAY: Record<string, string> = {
  Backspace: '⌫',
  Delete: '⌦',
  Enter: '↩',
  ' ': '␣',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
}

export function shortcutDisplay(key: string, shift?: boolean): string {
    const symbol = KEY_DISPLAY[key] ?? (key.length === 1 ? key.toUpperCase() : key)
    return `⌘${shift ? '⇧' : ''}${symbol}`
}

export type ResolvedShortcuts = {
  byId: Record<ShortcutId, Shortcut>
  nodeHints: Shortcut[]
  textNodeHints: Shortcut[]
}

export function resolveShortcuts(
  overrides: Record<string, KeybindingOverride>,
): ResolvedShortcuts {
  const byId = Object.fromEntries(
    (Object.keys(SHORTCUTS) as ShortcutId[]).map((id) => {
      const base = SHORTCUTS[id]
      const override = overrides[id]
      if (!override) return [id, base]

      const shift = override.shift || undefined
      return [
        id,
        { ...base, key: override.key, shift, display: shortcutDisplay(override.key, shift) },
      ]
    }),
  ) as Record<ShortcutId, Shortcut>

  return {
    byId,
    nodeHints: NODE_HINT_SHORTCUT_IDS.map((id) => byId[id]),
    textNodeHints: TEXT_NODE_HINT_SHORTCUT_IDS.map((id) => byId[id]),
  }
}

export function findShortcutConflict(
  overrides: Record<string, KeybindingOverride>,
  id: ShortcutId,
  candidate: KeybindingOverride,
): Shortcut | null {
  const { byId } = resolveShortcuts(overrides)

  for (const [otherId, shortcut] of Object.entries(byId) as [ShortcutId, Shortcut][]) {
    if (otherId === id || otherId === 'delete') continue
    const sameKey = shortcut.key.toLowerCase() === candidate.key.toLowerCase()
    const sameShift = Boolean(shortcut.shift) === Boolean(candidate.shift)
    if (sameKey && sameShift) return shortcut
  }
  return null
}