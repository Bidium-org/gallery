import { z } from "zod";

const DEFAULT_TIMEOUT_MS = 10_000;
const EXAMPLE_ID = "c0ffee00-1111-4222-8333-444455556666";
const EXAMPLE_OTHER_ID = "c0ffee00-5555-4666-8777-888899990000";

type Entry<A extends z.ZodObject, R extends z.ZodObject | undefined> = {
  description: string;
  args: A;
  example: z.input<A>;
  // What the renderer receives when the host step rewrites the arguments (`add_image`).
  relayed?: R;
  timeoutMs?: number;
};

const defineCommand = <A extends z.ZodObject, R extends z.ZodObject | undefined = undefined>(
  entry: Entry<A, R>,
): Entry<A, R> => entry;

const id = (what: string) => z.string().min(1).describe(what);
const ids = (what: string) => z.array(z.string().min(1)).min(1).describe(what);
const label = (what: string) => z.string().min(1).describe(what);
const position = z
  .strictObject({
    x: z.number().describe("Horizontal flow coordinate."),
    y: z.number().describe("Vertical flow coordinate."),
  })
  .describe("Flow coordinates, as stored in nodes and returned by get_canvas (not screen pixels).");

const noArgs = z.strictObject({});

export const catalog = {
  ping: defineCommand({
    description: "Checks that a renderer is connected and answers.",
    args: noArgs,
    example: {},
  }),

  sleep: defineCommand({
    description: "Waits, then answers. Dev only: used to test timeouts and disconnections.",
    args: z.strictObject({
      ms: z.number().int().min(0).optional().describe("Milliseconds to wait. Default 1000."),
    }),
    example: { ms: 1000 },
  }),

  get_canvas: defineCommand({
    description:
      "Returns the open canvas: id (null for a draft), name, viewport, nodes and edges. Nodes carry id, type, label, position and size; text nodes add prompt, modelId (null: the default model), params, inputs, versionCount and currentVersionId; image nodes add path and status; error nodes add error. Edges are the ones of the current versions only.",
    args: noArgs,
    example: {},
  }),

  list_models: defineCommand({
    description:
      "Lists the image models: id, name, supportedParameters and maxReferences (null: no cap).",
    args: noArgs,
    example: {},
  }),

  list_canvases: defineCommand({
    description: "Lists the saved canvases: id, name and updatedAt.",
    args: noArgs,
    example: {},
  }),

  open_canvas: defineCommand({
    description: "Opens a saved canvas. This changes what the human sees.",
    args: z.strictObject({ id: id("Id of the canvas, from list_canvases.") }),
    example: { id: EXAMPLE_ID },
  }),

  new_canvas: defineCommand({
    description:
      "Opens an empty canvas. It is a draft with no id until its first node is added. This changes what the human sees.",
    args: noArgs,
    example: {},
  }),

  rename_canvas: defineCommand({
    description: "Renames a saved canvas.",
    args: z.strictObject({
      id: id("Id of the canvas, from list_canvases."),
      name: z.string().trim().min(1).describe("New name."),
    }),
    example: { id: EXAMPLE_ID, name: "Moodboard" },
  }),

  add_text_node: defineCommand({
    description:
      "Adds a text node holding a prompt. Writing @label of another node in the prompt wires that node to this one, as when the human types it. Returns the node id.",
    args: z.strictObject({
      position,
      prompt: z.string().optional().describe("Prompt text. Default empty."),
      label: label('Node label. Default "Text".').optional(),
    }),
    example: {
      position: { x: 0, y: 0 },
      prompt: "A small red cube on a white table",
      label: "Cube",
    },
  }),

  add_image: defineCommand({
    description:
      "Adds local image files as image nodes, like dropping them on the canvas. Only image files are accepted. Returns, per image, the node id and the absolute path of its stored copy.",
    args: z.strictObject({
      paths: z
        .array(z.string().refine((path) => path.startsWith("/"), "must be an absolute path"))
        .min(1)
        .describe("Absolute paths of the image files."),
      position: position.describe("Position of the first image; the next ones cascade by 40 px."),
    }),
    relayed: z.strictObject({
      files: z.array(z.strictObject({ name: z.string(), url: z.string() })),
      position,
    }),
    example: {
      paths: ["/Users/me/Pictures/reference.png"],
      position: { x: 0, y: 0 },
    },
  }),

  duplicate_nodes: defineCommand({
    description:
      "Duplicates nodes with the edges between them, as copy and paste does. Returns copies: a map from each original id to its copy id.",
    args: z.strictObject({ ids: ids("Ids of the nodes to duplicate.") }),
    example: { ids: [EXAMPLE_ID] },
  }),

  move_node: defineCommand({
    description: "Moves a node to a position.",
    args: z.strictObject({ id: id("Id of the node."), position }),
    example: { id: EXAMPLE_ID, position: { x: 400, y: 120 } },
  }),

  delete_nodes: defineCommand({
    description: "Deletes nodes and every edge touching them. The human can undo it with Cmd+Z.",
    args: z.strictObject({ ids: ids("Ids of the nodes to delete.") }),
    example: { ids: [EXAMPLE_ID] },
  }),

  rename_node: defineCommand({
    description: "Changes the label of a node. The @label mentions of it in prompts follow.",
    args: z.strictObject({
      id: id("Id of the node."),
      label: label("New label."),
    }),
    example: { id: EXAMPLE_ID, label: "Reference" },
  }),

  set_prompt: defineCommand({
    description:
      "Replaces the prompt of a text node (its current version). Writing @label of another node wires it, removing one unwires it.",
    args: z.strictObject({
      id: id("Id of a text node."),
      prompt: z.string().describe("New prompt text."),
    }),
    example: { id: EXAMPLE_ID, prompt: "A small blue cube on a white table" },
  }),

  set_model: defineCommand({
    description:
      "Selects the image model of a text node (its current version). Resets its parameters.",
    args: z.strictObject({
      id: id("Id of a text node."),
      modelId: id("Id of the model, from list_models."),
    }),
    example: { id: EXAMPLE_ID, modelId: "openai/gpt-image-2.5-sunburst" },
  }),

  set_param: defineCommand({
    description:
      "Sets a generation parameter of a text node (its current version), or clears it with null. Names and allowed values are in the supportedParameters of its model.",
    args: z.strictObject({
      id: id("Id of a text node."),
      name: id("Parameter name."),
      value: z
        .union([z.string(), z.number(), z.boolean(), z.null()])
        .describe("Parameter value, or null to clear it."),
    }),
    example: { id: EXAMPLE_ID, name: "aspect_ratio", value: "16:9" },
  }),

  create_version: defineCommand({
    description:
      "Adds a version to a text node, copied from the current one, and makes it current. Returns versionId.",
    args: z.strictObject({ id: id("Id of a text node.") }),
    example: { id: EXAMPLE_ID },
  }),

  navigate_version: defineCommand({
    description: "Makes the previous or next version of a text node current. Returns versionId.",
    args: z.strictObject({
      id: id("Id of a text node."),
      direction: z
        .union([z.literal(-1), z.literal(1)])
        .describe("-1 for the previous version, 1 for the next."),
    }),
    example: { id: EXAMPLE_ID, direction: -1 },
  }),

  connect_nodes: defineCommand({
    description:
      "Draws an edge from a source node to a target node, on the current version of the target when it is a text node. Wiring the same pair twice returns the existing edge. Returns edgeId.",
    args: z
      .strictObject({
        source: id("Id of the node that feeds."),
        target: id("Id of the node that receives."),
      })
      .refine((args) => args.source !== args.target, "source and target must be different nodes"),
    example: { source: EXAMPLE_ID, target: EXAMPLE_OTHER_ID },
  }),

  delete_edge: defineCommand({
    description: "Deletes an edge. The @label mention it stood for is removed from the prompts.",
    args: z.strictObject({ id: id("Id of the edge, from get_canvas.") }),
    example: { id: EXAMPLE_ID },
  }),

  generate: defineCommand({
    description:
      "Generates images from a text node, using its current version and the nodes wired to it. Spends OpenRouter credits and takes a while. Returns, per image, the node id and the absolute path of the file.",
    args: z.strictObject({ id: id("Id of a text node.") }),
    example: { id: EXAMPLE_ID },
    timeoutMs: 110_000,
  }),
};

export type CommandName = keyof typeof catalog;
type CatalogEntry<N extends CommandName> = (typeof catalog)[N];

export type CommandArgs<N extends CommandName> = z.output<CatalogEntry<N>["args"]>;
type Relayed<N extends CommandName> = Exclude<CatalogEntry<N>["relayed"], undefined>;
export type RendererArgs<N extends CommandName> = [Relayed<N>] extends [never]
  ? CommandArgs<N>
  : z.output<Relayed<N>>;

const DEV_ONLY: ReadonlySet<string> = new Set<CommandName>(["sleep"]);

export function isAvailableCommand(name: string): name is CommandName {
  return Object.hasOwn(catalog, name) && (!DEV_ONLY.has(name) || import.meta.env.DEV);
}

export function commandTimeoutMs(name: CommandName): number {
  return catalog[name].timeoutMs ?? DEFAULT_TIMEOUT_MS;
}

// The refusal names each wrong field: `position.x: Invalid input: expected number, received string`.
export function parseCommandArgs(
  name: CommandName,
  args: unknown,
): { ok: true; args: unknown } | { ok: false; message: string } {
  const schema: z.ZodType = catalog[name].args;
  const parsed = schema.safeParse(args);
  if (parsed.success) return { ok: true, args: parsed.data };
  const message = parsed.error.issues
    .map((issue) =>
      issue.path.length > 0 ? `${issue.path.join(".")}: ${issue.message}` : issue.message,
    )
    .join("; ");
  return { ok: false, message };
}

export function listCommands(): { name: CommandName; description: string }[] {
  return (Object.keys(catalog) as CommandName[])
    .filter(isAvailableCommand)
    .map((name) => ({ name, description: catalog[name].description }));
}

export function describeCommand(name: CommandName) {
  const entry = catalog[name];
  return {
    name,
    description: entry.description,
    schema: z.toJSONSchema(entry.args),
    example: entry.example,
    timeoutMs: commandTimeoutMs(name),
  };
}
