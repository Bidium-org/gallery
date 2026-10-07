import type { Shortcut } from '@/lib/shortcuts'

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size))
  }
  return rows
}

export function NodeShortcuts({ shortcuts }: { shortcuts: Shortcut[] }) {
  return (
    <div className="mt-1.5 flex flex-col gap-1 text-[11px] whitespace-nowrap text-neutral-600">
      {chunk(shortcuts, 3).map((row, index) => (
        <div key={index} className="flex justify-center gap-4">
          {row.map((shortcut) => (
            <span key={shortcut.label}>
              {shortcut.display} {shortcut.label}
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}