import { Router, type IRouter } from "express";

const VPS_BASE = "http://161.153.29.155:8000";

const proxyRouter: IRouter = Router();

async function vpsRequest(
  path: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  body?: unknown,
): Promise<Response> {
  const url = `${VPS_BASE}${path}`;
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
  method: "GET" | "POST",
  body: unknown,
  res: import("express").Response,
) {
  try {
    const upstream = await vpsRequest(path, method, body);
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
  await jsonProxy("/ai/invoice/extract", "POST", req.body, res);
});

// POST /api/proxy/complete  →  POST VPS /invoices/draft/complete
proxyRouter.post("/complete", async (req, res) => {
  await jsonProxy("/invoices/draft/complete", "POST", req.body, res);
});

// GET /api/proxy/health  →  GET VPS /health
proxyRouter.get("/health", async (_req, res) => {
  await jsonProxy("/health", "GET", undefined, res);
});

// POST /api/proxy/ai-test  →  POST VPS /ai/test
proxyRouter.post("/ai-test", async (req, res) => {
  await jsonProxy("/ai/test", "POST", req.body, res);
});

// GET /api/proxy/invoices  →  GET VPS /invoices
proxyRouter.get("/invoices", async (_req, res) => {
  await jsonProxy("/invoices", "GET", undefined, res);
});

// GET /api/proxy/pdf?path=/invoices/.../pdf
// Streams binary PDF through the proxy so the browser never opens an HTTP URL directly.
proxyRouter.get("/pdf", async (req, res) => {
  const pdfPath = req.query["path"] as string | undefined;
  const fullUrl = req.query["url"] as string | undefined;

  let target: string;
  if (fullUrl) {
    // Accept a full VPS URL — rewrite to use VPS_BASE so we always go through server
    try {
      const parsed = new URL(fullUrl);
      target = `${VPS_BASE}${parsed.pathname}${parsed.search}`;
    } catch {
      target = fullUrl;
    }
  } else if (pdfPath) {
    target = `${VPS_BASE}${pdfPath.startsWith("/") ? "" : "/"}${pdfPath}`;
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
