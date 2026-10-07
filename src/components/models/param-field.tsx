import type { CapabilityDescriptor, ParamValue } from '@/types/TImageModel'

export function ParamField({
  name,
  descriptor,
  value,
  onChange,
}: {
  name: string
  descriptor: CapabilityDescriptor
  value: ParamValue | undefined
  onChange: (name: string, value: ParamValue | null) => void
}) {
  return (
    <label className="flex items-center justify-between gap-4 text-xs">
      <span className="text-neutral-300">{name}</span>

      {descriptor.type === 'enum' && (
        <select
          value={typeof value === 'string' ? value : ''}
          onChange={(event) =>
            onChange(name, event.target.value === '' ? null : event.target.value)
          }
          className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs text-neutral-200"
        >
          <option value="">default</option>
          {descriptor.values.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      )}

      {descriptor.type === 'range' && (
        <input
          type="number"
          min={descriptor.min}
          max={descriptor.max}
          value={typeof value === 'number' ? value : ''}
          onChange={(event) =>
            onChange(name, event.target.value === '' ? null : Number(event.target.value))
          }
          placeholder={`${descriptor.min}–${descriptor.max}`}
          className="w-28 rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs text-neutral-200 placeholder:text-neutral-600"
        />
      )}

      {descriptor.type === 'boolean' && (
        <input
          type="checkbox"
          checked={value === true}
          onChange={(event) => onChange(name, event.target.checked ? true : null)}
        />
      )}
    </label>
  )
}