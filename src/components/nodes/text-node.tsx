'use client'

import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { NodeProps } from '@xyflow/react'
import { ChevronDown, ChevronLeft, ChevronRight, Image as ImageIcon, Plus, Text } from 'lucide-react'

import { ParamField } from '@/components/models/param-field'
import { BaseNode, nodeBoxClass } from '@/components/nodes/base-node'
import { ModelPicker } from '@/components/nodes/model-picker'
import {
  MentionTextarea,
  type CitableNode,
} from '@/components/nodes/mention-textarea'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { currentVersion } from '@/lib/versioning'
import { useCanvasStore } from '@/stores/canvas-store'
import { useImageModelsStore } from '@/stores/image-models-store'
import { useSettingsStore } from '@/stores/settings-store'
import type { CanvasTextNode } from '@/types/TCanvasNode'
import type { ImageModel, ParamValue } from '@/types/TImageModel'

function getMaxReferences(model: ImageModel): number | null {
  const descriptor = model.supported_parameters['input_references']
  if (descriptor?.type === 'range') return descriptor.max
  return null
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function renderContent(content: string, citableNodes: CitableNode[]): ReactNode {
  const typeByLabel = new Map(
    citableNodes.map((node) => [node.label, node.type]),
  )
  const known = [...typeByLabel.keys()].filter((label) =>
    content.includes(`@${label}`),
  )
  if (known.length === 0) return content

  const regex = new RegExp(`@(${known.map(escapeRegex).join('|')})`, 'g')
  const parts = content.split(regex)

  return parts.map((part, index) => {
    if (index % 2 === 0) return part

    const type = typeByLabel.get(part)
    return (
      <Badge
        key={index}
        className="mx-0.5 h-[18px] border-sky-500/30 bg-sky-500/15 px-1.5 align-baseline text-[11px] text-sky-300"
      >
        {type === 'image' ? <ImageIcon /> : <Text />}
        {part}
      </Badge>
    )
  })
}

export const TextNode = memo(({ id, data, selected }: NodeProps<CanvasTextNode>) => {
  const { label } = data
  const version = currentVersion(data)
  const { prompt, modelId, paramValues = {} } = version
  const {
    nodes,
    connectMention,
    updateTextContent,
    selectModel,
    setParam,
    createVersion,
    navigateVersion,
    generateFromTextNode,
  } = useCanvasStore((state) => state)
  const { models, isLoading: isLoadingModels } = useImageModelsStore(
    (state) => state,
  )
  const defaultModelId = useSettingsStore(
    (state) => state.settings?.defaultModelId,
  )
  const textNodeHints = useSettingsStore(
    (state) => state.resolvedShortcuts.textNodeHints,
  )
  const [draft, setDraft] = useState<string | null>(null)
  const editingRef = useRef<HTMLDivElement>(null)
  const displayRef = useRef<HTMLDivElement>(null)

  const isEditing = draft !== null
  const defaultModel =
    (defaultModelId
      ? models.find((candidate) => candidate.id === defaultModelId)
      : null) ??
    models[0] ??
    null
  const model =
    (modelId ? models.find((candidate) => candidate.id === modelId) : null) ??
    defaultModel
  const maxReferences = model ? getMaxReferences(model) : null
  const parameterEntries = model
    ? Object.entries(model.supported_parameters)
    : []

  const versionIndex =
    data.versions.findIndex((entry) => entry.id === data.currentVersionId) + 1

  const citableNodes: CitableNode[] = nodes
    .filter((node) => node.id !== id)
    .map((node) => ({
      id: node.id,
      label: node.data.label,
      type: node.type,
    }))

  const boxClass = nodeBoxClass(selected, 'border-neutral-800')

  const startEditing = useCallback(() => setDraft(prompt), [prompt])

  const save = useCallback(() => {
    if (draft === null) return
    updateTextContent(id, draft)
    setDraft(null)
  }, [draft, id, updateTextContent])

  useEffect(() => {
    if (!isEditing) return

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement
      if (editingRef.current?.contains(target)) return
      if (target.closest('[data-slot="popover-content"]')) return
      save()
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [isEditing, save])

  useEffect(() => {
    const element = displayRef.current
    if (!element) return

    const onWheel = (event: WheelEvent) => {
      if (element.scrollHeight > element.clientHeight) {
        event.stopPropagation()
      }
    }

    element.addEventListener('wheel', onWheel)
    return () => element.removeEventListener('wheel', onWheel)
  }, [isEditing])

  const flushDraft = useCallback(() => {
    if (draft === null) return
    updateTextContent(id, draft)
    setDraft(null)
  }, [draft, id, updateTextContent])

  const navigate = useCallback(
    (direction: -1 | 1) => {
      flushDraft()
      navigateVersion(id, direction)
    },
    [flushDraft, id, navigateVersion],
  )

  const addVersion = useCallback(() => {
    flushDraft()
    createVersion(id)
  }, [flushDraft, id, createVersion])

  const onMention = useCallback(
    (nodeId: string) => connectMention(nodeId, id),
    [id, connectMention],
  )

  const onSelectModel = useCallback(
    (nextModelId: string) => selectModel(id, nextModelId),
    [id, selectModel],
  )

  const onSetParam = useCallback(
    (name: string, value: ParamValue | null) => setParam(id, name, value),
    [id, setParam],
  )

  const generate = useCallback(() => {
    if (!model) return

    const submittedPrompt = draft ?? prompt
    if (draft !== null) {
      updateTextContent(id, draft)
    }

    void generateFromTextNode(id, { prompt: submittedPrompt, model, maxReferences })
  }, [id, model, draft, prompt, maxReferences, updateTextContent, generateFromTextNode])

  const headerActions = (
    <div className="nodrag flex shrink-0 items-center gap-0.5">
      {data.versions.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Previous version"
            disabled={versionIndex <= 1}
            onClick={() => navigate(-1)}
          >
            <ChevronLeft />
          </Button>
          <span className="text-[11px] text-neutral-500 tabular-nums">
            {versionIndex}/{data.versions.length}
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Next version"
            disabled={versionIndex >= data.versions.length}
            onClick={() => navigate(1)}
          >
            <ChevronRight />
          </Button>
        </>
      )}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="New version"
              onClick={addVersion}
            >
              <Plus />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            New version
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )

  return (
    <BaseNode
      id={id}
      icon={Text}
      label={label}
      selected={selected}
      className="w-[300px]"
      headerActions={headerActions}
      hintShortcuts={textNodeHints}
    >
      {isEditing ? (
        <div
          ref={editingRef}
          className={`nodrag flex flex-col rounded-lg border bg-neutral-900 ${boxClass}`}
        >
          <MentionTextarea
            value={draft}
            onChange={setDraft}
            onSubmit={save}
            citableNodes={citableNodes}
            onMention={onMention}
            autoFocus
            placeholder="Write a prompt, @ to cite a node…"
            className="nodrag nowheel min-h-[100px] resize-none border-0 bg-transparent p-3 text-xs leading-relaxed text-neutral-300 shadow-none focus-visible:ring-0 md:text-xs"
          />
          {parameterEntries.length > 0 && (
            <Collapsible className="border-t border-neutral-800 px-2 py-1.5">
              <CollapsibleTrigger className="group flex w-full items-center justify-between text-[11px] text-neutral-500 hover:text-neutral-300">
                Advanced settings
                <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-1.5 flex flex-col gap-2 pb-1">
                {parameterEntries.map(([name, descriptor]) => (
                  <ParamField
                    key={name}
                    name={name}
                    descriptor={descriptor}
                    value={paramValues[name]}
                    onChange={onSetParam}
                  />
                ))}
                {maxReferences !== null && (
                  <p className="text-[11px] text-neutral-500">
                    up to {maxReferences} reference images
                  </p>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}
          <div className="flex items-center gap-2 border-t border-neutral-800 p-2">
            <ModelPicker
              models={models}
              value={model?.id ?? null}
              onSelect={onSelectModel}
              isLoading={isLoadingModels}
            />
            <Button
              size="sm"
              className="h-7 shrink-0 text-xs"
              onClick={generate}
              disabled={!model}
            >
              Generate
            </Button>
          </div>
        </div>
      ) : (
        <div
          ref={displayRef}
          onDoubleClick={startEditing}
          className={`max-h-[400px] cursor-grab overflow-y-auto rounded-lg border bg-neutral-900 p-3 text-xs leading-relaxed whitespace-pre-wrap text-neutral-300 active:cursor-grabbing ${boxClass}`}
        >
          {prompt ? (
            renderContent(prompt, citableNodes)
          ) : (
            <span className="text-neutral-600">Double-click to edit…</span>
          )}
        </div>
      )}
    </BaseNode>
  )
})

TextNode.displayName = 'TextNode'