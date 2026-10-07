import { NextResponse } from 'next/server'

import { getSettings, updateSettings } from '@/lib/database'
import type { Settings } from '@/types/TSettings'

export async function GET() {
  try {
    const settings = await getSettings()
    return NextResponse.json(settings)
  } catch (error) {
    console.error('settings_read_failed', error)
    return NextResponse.json(
      { error: 'Failed to read settings' },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const partial = (await request.json()) as Partial<Settings>
    const settings = await updateSettings(partial)
    return NextResponse.json(settings)
  } catch (error) {
    console.error('settings_update_failed', error)
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 },
    )
  }
}