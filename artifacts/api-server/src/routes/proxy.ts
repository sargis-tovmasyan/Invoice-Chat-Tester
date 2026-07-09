import { Router, type IRouter } from "express";

const DEFAULT_VPS_BASE = "http://129.146.79.201:8000";

const proxyRouter: IRouter = Router();

function resolveBase(req: import("express").Request): string {
  const header = req.headers["x-api-base"];
  const val = Array.isArray(header) ? header[0] : header;
  return (val && val.trim()) ? val.trim().replace(/\/$/, "") : DEFAULT_VPS_BASE;
}

async function vpsRequest(
  path: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown,
  base?: string,
): Promise<Response> {
  const url = `${base ?? DEFAULT_VPS_BASE}${path}`;
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
  };
  if (body !== undefined && method !== "GET") {
    opts.body = JSON.stringify(body);
  }
  return fetch(url, opts);
}

async function jsonProxy(
  path: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  body: unknown,
  res: import("express").Response,
  req: import("express").Request,
) {
  try {
    const upstream = await vpsRequest(path, method, body, resolveBase(req));
    let data: unknown;
    const ct = upstream.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      data = await upstream.json();
    } else {
      const text = await upstream.text();
      data = { raw_response: text };
    }
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(502).json({ error: "Proxy error", detail: String(err) });
  }
}

// POST /api/proxy/extract  →  POST VPS /ai/invoice/extract
proxyRouter.post("/extract", async (req, res) => {
  await jsonProxy("/ai/invoice/extract", "POST", req.body, res, req);
});

// POST /api/proxy/chat  →  POST VPS /ai/chat
proxyRouter.post("/chat", async (req, res) => {
  await jsonProxy("/ai/chat", "POST", req.body, res, req);
});

// POST /api/proxy/complete  →  POST VPS /invoices/draft/complete
proxyRouter.post("/complete", async (req, res) => {
  await jsonProxy("/invoices/draft/complete", "POST", req.body, res, req);
});

// GET /api/proxy/health  →  GET VPS /health
proxyRouter.get("/health", async (req, res) => {
  await jsonProxy("/health", "GET", undefined, res, req);
});

// POST /api/proxy/ai-test  →  POST VPS /ai/test
proxyRouter.post("/ai-test", async (req, res) => {
  await jsonProxy("/ai/test", "POST", req.body, res, req);
});

// GET /api/proxy/invoices  →  GET VPS /invoices
proxyRouter.get("/invoices", async (req, res) => {
  await jsonProxy("/invoices", "GET", undefined, res, req);
});

proxyRouter.post("/chat-threads", async (req, res) => {
  await jsonProxy("/chat-threads", "POST", req.body, res, req);
});

proxyRouter.get("/chat-threads", async (req, res) => {
  const query = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  await jsonProxy(`/chat-threads${query}`, "GET", undefined, res, req);
});

proxyRouter.get("/chat-threads/:chatId/session-memory", async (req, res) => {
  await jsonProxy(`/chat-threads/${encodeURIComponent(req.params.chatId)}/session-memory`, "GET", undefined, res, req);
});

proxyRouter.delete("/chat-threads/:chatId/session-memory/document-scope", async (req, res) => {
  await jsonProxy(`/chat-threads/${encodeURIComponent(req.params.chatId)}/session-memory/document-scope`, "DELETE", undefined, res, req);
});

proxyRouter.get("/chat-threads/:chatId", async (req, res) => {
  await jsonProxy(`/chat-threads/${encodeURIComponent(req.params.chatId)}`, "GET", undefined, res, req);
});

proxyRouter.patch("/chat-threads/:chatId", async (req, res) => {
  await jsonProxy(`/chat-threads/${encodeURIComponent(req.params.chatId)}`, "PATCH", req.body, res, req);
});

proxyRouter.delete("/chat-threads/:chatId", async (req, res) => {
  await jsonProxy(`/chat-threads/${encodeURIComponent(req.params.chatId)}`, "DELETE", undefined, res, req);
});

// GET /api/proxy/pdf?path=/invoices/.../pdf
// Streams binary PDF through the proxy so the browser never opens an HTTP URL directly.
proxyRouter.get("/pdf", async (req, res) => {
  const pdfPath = req.query["path"] as string | undefined;
  const fullUrl = req.query["url"] as string | undefined;
  const base = resolveBase(req);

  let target: string;
  if (fullUrl) {
    // Accept a full VPS URL — rewrite to use resolved base so we always go through server
    try {
      const parsed = new URL(fullUrl);
      target = `${base}${parsed.pathname}${parsed.search}`;
    } catch {
      target = fullUrl;
    }
  } else if (pdfPath) {
    target = `${base}${pdfPath.startsWith("/") ? "" : "/"}${pdfPath}`;
  } else {
    res.status(400).json({ error: "Provide ?path= or ?url= query parameter" });
    return;
  }

  try {
    const upstream = await fetch(target);
    const ct = upstream.headers.get("content-type") ?? "application/pdf";
    const cd =
      upstream.headers.get("content-disposition") ??
      'inline; filename="invoice.pdf"';
    res.setHeader("Content-Type", ct);
    res.setHeader("Content-Disposition", cd);

    if (!upstream.body) {
      res.status(502).end();
      return;
    }

    const reader = upstream.body.getReader();
    const pump = async (): Promise<void> => {
      const { done, value } = await reader.read();
      if (done) {
        res.end();
        return;
      }
      res.write(value);
      return pump();
    };
    await pump();
  } catch (err) {
    if (!res.headersSent) {
      res.status(502).json({ error: "PDF proxy error", detail: String(err) });
    }
  }
});

export default proxyRouter;
