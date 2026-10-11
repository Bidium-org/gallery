import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Panel,
  SelectionMode,
  useReactFlow,
} from "@xyflow/react";
import { ImageUp, Plus, Text } from "lucide-react";

import { ImageNode } from "./nodes/image-node";
import { TextNode } from "./nodes/text-node";
import { ErrorNode } from "./nodes/error-node";
import { SideBar } from "./sidebar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCanvasPaste } from "@/hooks/use-canvas-paste";
import { useCanvasShortcuts } from "@/hooks/use-canvas-shortcuts";
import { uploadImages } from "@/lib/upload-images";
import { isEdgeVisible } from "@/lib/versioning";
import { useAgentLit } from "@/stores/agent-highlight-store";
import { useCanvasStore } from "@/stores/canvas-store";

const nodeTypes = {
  image: ImageNode,
  text: TextNode,
  error: ErrorNode,
};

const isFileDrag = (event: DragEvent) => event.dataTransfer.types.includes("Files");

function Flow() {
  const {
    nodes,
    edges,
    canvasId,
    viewport,
    initialize,
    setViewport,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addTextNode,
    addDroppedImages,
  } = useCanvasStore((state) => state);
  useCanvasShortcuts();
  useCanvasPaste();

  const agentLit = useAgentLit();
  const highlightedNodeIds = new Set([
    ...nodes.filter((node) => node.selected).map((node) => node.id),
    ...Object.keys(agentLit),
  ]);
  const displayEdges = edges
    .filter((edge) => isEdgeVisible(edge, nodes))
    .map((edge) => {
      const highlighted =
        (edge.selected ?? false) ||
        highlightedNodeIds.has(edge.source) ||
        highlightedNodeIds.has(edge.target);
      return {
        ...edge,
        style: highlighted ? { stroke: "#38bdf8", strokeWidth: 2 } : undefined,
      };
    });

  const [menuOpen, setMenuOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragDepth = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const appliedCanvasRef = useRef<string | null | undefined>(undefined);
  const { screenToFlowPosition, setViewport: applyViewport } = useReactFlow();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    if (appliedCanvasRef.current === canvasId) return;
    appliedCanvasRef.current = canvasId;
    void applyViewport(viewport);
  }, [canvasId, viewport, applyViewport]);

  const viewportCenter = useCallback(
    () =>
      screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      }),
    [screenToFlowPosition],
  );

  const onDragEnter = useCallback((event: DragEvent) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    dragDepth.current += 1;
    setIsDragOver(true);
  }, []);

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const onDragLeave = useCallback((event: DragEvent) => {
    if (!isFileDrag(event)) return;
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setIsDragOver(false);
    }
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      dragDepth.current = 0;
      setIsDragOver(false);

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const files = Array.from(event.dataTransfer.files).filter((file) =>
        file.type.startsWith("image/"),
      );
      if (files.length === 0) return;

      uploadImages(files)
        .then((uploaded) => addDroppedImages(uploaded, position))
        .catch((error) => console.error("image_upload_failed", error));
    },
    [screenToFlowPosition, addDroppedImages],
  );

  const addTextAtCenter = useCallback(() => {
    addTextNode(viewportCenter());
    setMenuOpen(false);
  }, [viewportCenter, addTextNode]);

  const openFilePicker = useCallback(() => {
    setMenuOpen(false);
    fileInputRef.current?.click();
  }, []);

  const onFilesPicked = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []).filter((file) =>
        file.type.startsWith("image/"),
      );
      event.target.value = "";
      if (files.length === 0) return;

      const position = viewportCenter();
      uploadImages(files)
        .then((uploaded) => addDroppedImages(uploaded, position))
        .catch((error) => console.error("image_upload_failed", error));
    },
    [viewportCenter, addDroppedImages],
  );

  return (
    <div
      className="relative h-full w-full"
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={onFilesPicked}
        className="hidden"
      />
      <ReactFlow
        nodes={nodes}
        edges={displayEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onMoveEnd={(_event, nextViewport) => setViewport(nextViewport)}
        nodeTypes={nodeTypes}
        colorMode="dark"
        fitView
        minZoom={0.05}
        maxZoom={4}
        selectionOnDrag
        panOnDrag={false}
        panActivationKeyCode="Space"
        panOnScroll
        zoomOnScroll={false}
        selectionMode={SelectionMode.Partial}
        defaultEdgeOptions={{ style: { strokeWidth: 2 } }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="#333" />
        <SideBar />
        <Panel position="bottom-center" className="mb-6">
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                aria-label="Add node"
                className="h-11 w-11 rounded-full border-neutral-700 bg-neutral-900 text-neutral-300 shadow-xl hover:bg-neutral-800 hover:text-white [&_svg]:size-5"
              >
                <Plus />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="center"
              className="w-[160px] gap-0.5 border-neutral-800 bg-neutral-950 p-1.5"
            >
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={openFilePicker}
              >
                <ImageUp />
                File
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={addTextAtCenter}
              >
                <Text />
                Text
              </Button>
            </PopoverContent>
          </Popover>
        </Panel>
      </ReactFlow>

      {isDragOver && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-sky-500/10 ring-2 ring-inset ring-sky-500">
          <div className="rounded-lg border border-sky-500/40 bg-neutral-950/80 px-4 py-2 text-sm text-sky-300">
            Drop images to add them to the canvas
          </div>
        </div>
      )}
    </div>
  );
}

export function Canvas() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  );
}
