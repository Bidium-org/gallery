type Args = Record<string, unknown>

const isString = (value: unknown): value is string => typeof value === 'string'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function targetIds(args: Args): string[] {
  const ids = [args.id, args.source, args.target].filter(isString)
  if (Array.isArray(args.ids)) ids.push(...args.ids.filter(isString))
  return ids
}

export function createdIds(result: unknown): string[] {
  const items = Array.isArray(result) ? result : [result]
  return items.flatMap((item) => {
    if (!isRecord(item)) return []
    const ids = isString(item.id) ? [item.id] : []
    if (isRecord(item.copies)) ids.push(...Object.values(item.copies).filter(isString))
    return ids
  })
}
