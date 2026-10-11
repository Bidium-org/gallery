import { describeCommand, isAvailableCommand } from '@/lib/agent/catalog'

import { fail, succeed } from '@/server/agent/answer'

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  if (!isAvailableCommand(name)) return fail('unknown_command', `Unknown command: ${name}.`)
  return succeed(describeCommand(name))
}
