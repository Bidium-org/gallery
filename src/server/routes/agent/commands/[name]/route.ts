import { describeCommand, isAvailableCommand } from '@/lib/agent/catalog'

import { fail, succeed } from '../../answer'

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  if (!isAvailableCommand(name)) return fail('unknown_command', `Unknown command: ${name}.`, 400)
  return succeed(describeCommand(name))
}
