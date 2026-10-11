import { useCallback, useState, type KeyboardEvent } from 'react'
import { Panel } from '@xyflow/react'
import { ChevronDown, Pencil, Plus, Settings, Trash2 } from 'lucide-react'

import { ConfirmDialog } from '@/components/dialogs/confirm-dialog'
import { SettingsDialog } from '@/components/settings/settings-dialog'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useCanvasStore } from '@/stores/canvas-store'
import { useSettingsStore } from '@/stores/settings-store'
import type { CanvasMeta } from '@/types/TCanvas'

export function SideBar() {
  const {
    canvasId,
    canvasName,
    canvasList,
    newCanvas,
    loadCanvas,
    renameCanvas,
    removeCanvas,
  } = useCanvasStore((state) => state)
  const setSettingsDialogOpen = useSettingsStore(
    (state) => state.setSettingsDialogOpen,
  )
  const [open, setOpen] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<CanvasMeta | null>(null)

  const startRename = useCallback((meta: CanvasMeta) => {
    setRenamingId(meta.id)
    setRenameDraft(meta.name)
  }, [])

  const saveRename = useCallback(() => {
    if (renamingId === null) return
    const id = renamingId
    const name = renameDraft
    setRenamingId(null)
    renameCanvas(id, name).catch((error: unknown) =>
      console.error('canvas_rename_failed', id, error),
    )
  }, [renamingId, renameDraft, renameCanvas])

  const onRenameKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') event.currentTarget.blur()
    if (event.key === 'Escape') {
      event.stopPropagation()
      setRenamingId(null)
    }
  }, [])

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return
    void removeCanvas(deleteTarget.id)
    setDeleteTarget(null)
  }, [deleteTarget, removeCanvas])

  return (
    <Panel position="top-left" className="mt-4 ml-4">
      <TooltipProvider>
        <div className="flex items-center gap-1.5">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="max-w-[220px]">
                <span className="truncate">{canvasName}</span>
                <ChevronDown className="h-3 w-3 text-neutral-500" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-[240px] gap-1 border-neutral-800 bg-neutral-950 p-1.5"
            >
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => {
                  void newCanvas()
                  setOpen(false)
                }}
              >
                <Plus />
                New canvas
              </Button>

              {canvasList.length === 0 ? (
                <p className="px-2.5 py-1 text-xs text-neutral-600">No saved canvases</p>
              ) : (
                <div className="flex flex-col">
                  {canvasList.map((meta) => (
                    <div key={meta.id} className="group flex items-center gap-1">
                      {renamingId === meta.id ? (
                        <input
                          value={renameDraft}
                          onChange={(event) => setRenameDraft(event.target.value)}
                          onBlur={saveRename}
                          onKeyDown={onRenameKeyDown}
                          autoFocus
                          className="nodrag h-7 min-w-0 flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-2 text-xs text-neutral-200 outline-none"
                        />
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            loadCanvas(meta.id).catch((error: unknown) =>
                              console.error('canvas_load_failed', meta.id, error),
                            )
                            setOpen(false)
                          }}
                          className={`min-w-0 flex-1 justify-start ${
                            meta.id === canvasId ? 'text-sky-300' : ''
                          }`}
                        >
                          <span className="truncate">{meta.name}</span>
                        </Button>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={`Rename ${meta.name}`}
                            onClick={() => startRename(meta)}
                            className="shrink-0 text-neutral-500 opacity-0 transition-opacity group-hover:opacity-100 hover:text-neutral-200"
                          >
                            <Pencil />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Rename</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={`Delete ${meta.name}`}
                            onClick={() => setDeleteTarget(meta)}
                            className="shrink-0 text-neutral-500 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400"
                          >
                            <Trash2 />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete</TooltipContent>
                      </Tooltip>
                    </div>
                  ))}
                </div>
              )}
            </PopoverContent>
          </Popover>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Settings"
                onClick={() => setSettingsDialogOpen(true)}
              >
                <Settings />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Settings</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      <SettingsDialog />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setDeleteTarget(null)
        }}
        title="Delete canvas?"
        description={`This deletes "${deleteTarget?.name ?? ''}" and all its images. This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
      />
    </Panel>
  )
}