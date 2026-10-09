import fs from "node:fs/promises";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { app, BrowserWindow, dialog } from "electron";

// Renderer files built by Forge, read from the asar: `.vite/build/main.cjs` sits next to `.vite/renderer`.
const RENDERER_DIR = path.join(__dirname, "../renderer", MAIN_WINDOW_VITE_NAME);

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".woff2": "font/woff2",
};

// The renderer gets this long to save before the app quits anyway.
const FLUSH_TIMEOUT_MS = 5000;

let hostUrl: string;
let removeHostFile: (() => Promise<void>) | undefined;
let quitting = false;

// Forge builds the renderer with `base: './'` (relative asset paths): only `/` serves `index.html`,
// any other unknown path is a 404 instead of a SPA fallback.
async function serveStatic(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405).end();
    return;
  }
  try {
    const { pathname } = new URL(req.url ?? "/", "http://localhost");
    const file = path.resolve(
      RENDERER_DIR,
      pathname === "/" ? "index.html" : `.${decodeURIComponent(pathname)}`,
    );
    if (!file.startsWith(RENDERER_DIR + path.sep))
      throw new Error("outside_renderer_dir");
    const body = await fs.readFile(file);
    res
      .writeHead(200, {
        "Content-Type":
          CONTENT_TYPES[path.extname(file)] ?? "application/octet-stream",
      })
      .end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
}

// Packaged: the main hosts what the Vite plugin hosts in dev, with the same router and gateway.
async function startHost(): Promise<string> {
  const [{ handle }, { serveApi }, hostFile] = await Promise.all([
    import("@/server/router"),
    import("@/server/node-adapter"),
    import("@/server/host-file"),
  ]);
  const server = http.createServer((req, res) => {
    if (req.url?.startsWith("/api/")) void serveApi(handle, req, res);
    else void serveStatic(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    await hostFile.writeHostFile(url);
    removeHostFile = hostFile.removeHostFile;
  } catch (error) {
    // Discovery is optional: the app must open even when `~/.gallery` is not writable.
    console.error("host_file_write_failed", error);
  }
  return url;
}

// The autosave is debounced: saves a pending edit through the page (no IPC), while the host is still up.
async function flushRenderer(): Promise<void> {
  const window = BrowserWindow.getAllWindows()[0];
  if (!window || window.isDestroyed()) return;
  const timeout = new Promise<void>((resolve) =>
    setTimeout(resolve, FLUSH_TIMEOUT_MS).unref(),
  );
  try {
    await Promise.race([
      window.webContents.executeJavaScript("window.__galleryFlushSave?.()"),
      timeout,
    ]);
  } catch (error) {
    console.error("quit_flush_failed", error);
  }
}

async function createWindow(): Promise<void> {
  // The canvas is rendered by the page; the host stays reachable even when the window is hidden.
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: "#0a0a0a",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  await window.loadURL(hostUrl);
}

// No `Menu.setApplicationMenu`, on purpose: Electron's default menu has the Edit roles (copy, paste,
// select all) that route Cmd+C / Cmd+V to the page on macOS, which `use-canvas-paste` relies on.
async function start(): Promise<void> {
  // In dev the Vite plugin serves the front and the API, and writes `~/.gallery/host.json`.
  hostUrl = MAIN_WINDOW_VITE_DEV_SERVER_URL || (await startHost());
  await createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
}

// Without a window the app would sit in the Dock with nothing to see: say why, then quit.
app
  .whenReady()
  .then(start)
  .catch((error) => {
    console.error("startup_failed", error);
    dialog.showErrorBox(
      "Gallery could not start",
      error instanceof Error ? error.message : String(error),
    );
    app.quit();
  });

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", (event) => {
  if (quitting) return;
  quitting = true;
  event.preventDefault();
  void (async () => {
    await flushRenderer();
    await removeHostFile?.();
    app.quit();
  })();
});

process.on("SIGINT", () => app.quit());
process.on("SIGTERM", () => app.quit());
