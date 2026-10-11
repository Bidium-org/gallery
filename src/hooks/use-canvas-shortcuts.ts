import { useEffect } from "react";

import type { Shortcut } from "@/lib/shortcuts";
import { useCanvasStore } from "@/stores/canvas-store";
import { useSettingsStore } from "@/stores/settings-store";

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable
  );
}

function matches(shortcut: Shortcut, event: KeyboardEvent): boolean {
  return (
    event.key.toLowerCase() === shortcut.key.toLowerCase() &&
    event.shiftKey === (shortcut.shift ?? false)
  );
}

export function useCanvasShortcuts() {
  const undo = useCanvasStore((state) => state.undo);
  const redo = useCanvasStore((state) => state.redo);
  const copySelection = useCanvasStore((state) => state.copySelection);
  const duplicateSelection = useCanvasStore((state) => state.duplicateSelection);
  const createVersionForSelection = useCanvasStore((state) => state.createVersionForSelection);
  const byId = useSettingsStore((state) => state.resolvedShortcuts.byId);
  const settingsDialogOpen = useSettingsStore((state) => state.settingsDialogOpen);

  useEffect(() => {
    const copyShortcut = byId.copy;
    const handlers: [Shortcut, () => void][] = [
      [byId.undo, undo],
      [byId.redo, redo],
      [byId.redoAlt, redo],
      [byId.copy, copySelection],
      [byId.duplicate, duplicateSelection],
      [byId.newVersion, createVersionForSelection],
    ];

    const onKeyDown = (event: KeyboardEvent) => {
      if (settingsDialogOpen) return;
      if (!(event.metaKey || event.ctrlKey)) return;
      if (isEditableTarget(event.target)) return;

      for (const [shortcut, handler] of handlers) {
        if (!matches(shortcut, event)) continue;

        if (shortcut === copyShortcut && window.getSelection()?.toString()) return;

        event.preventDefault();
        handler();
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    byId,
    settingsDialogOpen,
    undo,
    redo,
    copySelection,
    duplicateSelection,
    createVersionForSelection,
  ]);
}
