import { Router, type IRouter } from "express";

const DEFAULT_VPS_BASE = "http://129.146.79.201:8000";

const proxyRouter: IRouter = Router();

function resolveBase(req: import("express").Request): string {
  const header = req.headers["x-api-base"];
  const val = Array.isArray(header) ? header[0] : header;
  return (val && val.trim()) ? val.trim().replace(/\/$/, "") : DEFAULT_VPS_BASE;
}

function appendUpstreamCookies(upstream: Response, res: import("express").Response): void {
  const headers = upstream.headers as Headers & {
    getSetCookie?: () => string[];
    raw?: () => Record<string, string[]>;
  };

  const cookies = headers.getSetCookie?.() ?? headers.raw?.()["set-cookie"] ?? [];
  if (cookies.length > 0) {
    res.append("Set-Cookie", cookies);
    return;
  }

  const singleCookie = upstream.headers.get("set-cookie");
  if (singleCookie) res.append("Set-Cookie", singleCookie);
}

async function vpsRequest(
  path: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  body: unknown,
  req: import("express").Request,
  base?: string,
): Promise<Response> {
  const url = `${base ?? DEFAULT_VPS_BASE}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const authorization = req.headers.authorization;
  if (authorization) headers.Authorization = Array.isArray(authorization) ? authorization[0] : authorization;

  const cookie = req.headers.cookie;
  if (cookie) headers.Cookie = cookie;

  const opts: RequestInit = { method, headers };
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
    const upstream = await vpsRequest(path, method, body, req, resolveBase(req));
    appendUpstreamCookies(upstream, res);

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

proxyRouter.post("/auth/register", async (req, res) => {
  await jsonProxy("/auth/register", "POST", req.body, res, req);
});

proxyRouter.post("/auth/login", async (req, res) => {
  await jsonProxy("/auth/login", "POST", req.body, res, req);
});

proxyRouter.post("/auth/refresh", async (req, res) => {
  await jsonProxy("/auth/refresh", "POST", req.body, res, req);
});

proxyRouter.post("/auth/logout", async (req, res) => {
  await jsonProxy("/auth/logout", "POST", req.body, res, req);
});

proxyRouter.get("/auth/me", async (req, res) => {
  await jsonProxy("/auth/me", "GET", undefined, res, req);
});

proxyRouter.patch("/auth/me/email", async (req, res) => {
  await jsonProxy("/auth/me/email", "PATCH", req.body, res, req);
});

proxyRouter.patch("/auth/me/password", async (req, res) => {
  await jsonProxy("/auth/me/password", "PATCH", req.body, res, req);
});

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
    const headers: Record<string, string> = {};
    const authorization = req.headers.authorization;
    if (authorization) headers.Authorization = Array.isArray(authorization) ? authorization[0] : authorization;
    const cookie = req.headers.cookie;
    if (cookie) headers.Cookie = cookie;

    const upstream = await fetch(target, { headers });
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
