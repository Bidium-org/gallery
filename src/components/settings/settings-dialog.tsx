import { Bot, Keyboard, Plug, type LucideIcon } from "lucide-react";

import { AgentSection } from "@/components/settings/agent-section";
import { ModelsSection } from "@/components/settings/models-section";
import { ShortcutsSection } from "@/components/settings/shortcuts-section";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type SettingsSection, useSettingsStore } from "@/stores/settings-store";

const NAV_ITEMS: { id: SettingsSection; label: string; icon: LucideIcon }[] = [
  { id: "models", label: "Models", icon: Bot },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
  { id: "agent", label: "Agent", icon: Plug },
];

export function SettingsDialog() {
  const { settingsDialogOpen, setSettingsDialogOpen, settingsSection, setSettingsSection } =
    useSettingsStore((state) => state);

  return (
    <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
      <DialogContent showCloseButton className="h-[540px] gap-0 overflow-hidden p-0 sm:max-w-3xl">
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
                onClick={() => setSettingsSection(id)}
                className={`justify-start gap-2.5 ${
                  settingsSection === id ? "bg-neutral-800 text-neutral-200" : "text-neutral-500"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Button>
            ))}
          </nav>
          <div className="min-w-0 flex-1 overflow-y-auto p-6">
            {settingsSection === "models" && <ModelsSection />}
            {settingsSection === "shortcuts" && <ShortcutsSection />}
            {settingsSection === "agent" && <AgentSection />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
