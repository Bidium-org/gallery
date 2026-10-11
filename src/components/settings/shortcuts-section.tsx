import { useCallback, useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  findShortcutConflict,
  REBINDABLE_SHORTCUT_IDS,
  shortcutDisplay,
  SHORTCUTS,
  type ShortcutId,
} from "@/lib/shortcuts";
import { useSettingsStore } from "@/stores/settings-store";
import type { KeybindingOverride } from "@/types/TSettings";

export function ShortcutsSection() {
  const { settings, setKeybinding, resetKeybindings } = useSettingsStore((state) => state);
  const [capturingId, setCapturingId] = useState<ShortcutId | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);

  const keybindings = settings?.keybindings ?? {};

  const stopCapture = useCallback(() => {
    setCapturingId(null);
    setConflict(null);
  }, []);

  useEffect(() => {
    if (!capturingId) return;

    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === "Escape") {
        stopCapture();
        return;
      }
      if (["Meta", "Control", "Shift", "Alt"].includes(event.key)) return;
      if (!event.metaKey && !event.ctrlKey) return;

      const candidate: KeybindingOverride = {
        key: event.key.toLowerCase(),
        shift: event.shiftKey || undefined,
      };

      const conflicting = findShortcutConflict(keybindings, capturingId, candidate);
      if (conflicting) {
        setConflict(`Already used by ${conflicting.label}`);
        return;
      }

      void setKeybinding(capturingId, candidate);
      stopCapture();
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [capturingId, keybindings, setKeybinding, stopCapture]);

  if (!settings) {
    return <div className="h-8 w-full animate-pulse rounded-lg bg-neutral-800" />;
  }

  const hasOverrides = Object.keys(keybindings).length > 0;

  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold text-neutral-200">Shortcuts</h2>
      <p className="mb-3 text-[11px] text-neutral-500">
        Click a shortcut to rebind it. New bindings must include ⌘.
      </p>

      <div className="flex flex-col divide-y divide-neutral-800 rounded-lg border border-neutral-800 bg-neutral-900">
        {REBINDABLE_SHORTCUT_IDS.map((id) => {
          const base = SHORTCUTS[id];
          const override = keybindings[id];
          const display = override ? shortcutDisplay(override.key, override.shift) : base.display;
          const isCapturing = capturingId === id;

          return (
            <div key={id} className="flex items-center justify-between px-3 py-2">
              <span className="text-xs text-neutral-300">{base.label}</span>

              <div className="flex items-center gap-1.5">
                {isCapturing ? (
                  <span className="rounded-md border border-sky-500/50 bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-300">
                    Press ⌘ + key…
                  </span>
                ) : (
                  <button
                    onClick={() => {
                      setConflict(null);
                      setCapturingId(id);
                    }}
                    className={`rounded-md border px-2 py-0.5 text-[11px] transition-colors ${
                      override
                        ? "border-sky-500/40 text-sky-300 hover:bg-sky-500/10"
                        : "border-neutral-700 text-neutral-400 hover:bg-neutral-800"
                    }`}
                  >
                    {display}
                  </button>
                )}

                {override && !isCapturing && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Reset ${base.label}`}
                    onClick={() => void setKeybinding(id, null)}
                    className="text-neutral-500 hover:text-neutral-300"
                  >
                    <RotateCcw />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {conflict && <p className="px-1 pt-1.5 text-[11px] text-red-400">{conflict}</p>}

      {hasOverrides && (
        <Button
          variant="outline"
          size="xs"
          onClick={() => void resetKeybindings()}
          className="mt-3"
        >
          <RotateCcw />
          Reset all to defaults
        </Button>
      )}
    </section>
  );
}
