'use client'

import { useState } from 'react'
import { Bot, Keyboard, type LucideIcon } from 'lucide-react'

import { ModelsSection } from '@/components/settings/models-section'
import { ShortcutsSection } from '@/components/settings/shortcuts-section'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useSettingsStore } from '@/stores/settings-store'

type Section = 'models' | 'shortcuts'

const NAV_ITEMS: { id: Section; label: string; icon: LucideIcon }[] = [
  { id: 'models', label: 'Models', icon: Bot },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
]

export function SettingsDialog() {
  const { settingsDialogOpen, setSettingsDialogOpen } = useSettingsStore(
    (state) => state,
  )
  const [activeSection, setActiveSection] = useState<Section>('models')

  return (
    <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
      <DialogContent
        showCloseButton
        className="h-[540px] gap-0 overflow-hidden p-0 sm:max-w-3xl"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="flex min-h-0 flex-1">
          <nav className="flex w-44 shrink-0 flex-col gap-0.5 border-r border-neutral-800 p-2">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
              <Button
                key={id}
                variant="ghost"
                size="sm"
                onClick={() => setActiveSection(id)}
                className={`justify-start gap-2.5 ${
                  activeSection === id
                    ? 'bg-neutral-800 text-neutral-200'
                    : 'text-neutral-500'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Button>
            ))}
          </nav>
          <div className="min-w-0 flex-1 overflow-y-auto p-6">
            {activeSection === 'models' && <ModelsSection />}
            {activeSection === 'shortcuts' && <ShortcutsSection />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}