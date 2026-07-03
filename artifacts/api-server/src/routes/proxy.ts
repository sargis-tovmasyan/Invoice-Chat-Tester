import { Router, type IRouter } from "express";

const DEFAULT_BACKEND_BASE = "http://161.153.29.155:8000";
const VPS_BASE = (process.env.DOCUMENT_API_BASE_URL ?? process.env.VPS_BASE_URL ?? DEFAULT_BACKEND_BASE).replace(/\/$/, "");

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
  method: "GET" | "POST" | "DELETE",
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

proxyRouter.post("/extract", async (req, res) => {
  await jsonProxy("/ai/invoice/extract", "POST", req.body, res);
});

proxyRouter.post("/chat", async (req, res) => {
  await jsonProxy("/ai/chat", "POST", req.body, res);
});

proxyRouter.post("/complete", async (req, res) => {
  await jsonProxy("/invoices/draft/complete", "POST", req.body, res);
});

proxyRouter.get("/health", async (_req, res) => {
  await jsonProxy("/health", "GET", undefined, res);
});

proxyRouter.get("/invoices", async (_req, res) => {
  await jsonProxy("/invoices", "GET", undefined, res);
});

proxyRouter.delete("/invoices", async (_req, res) => {
  await jsonProxy("/invoices", "DELETE", undefined, res);
});

proxyRouter.get("/pdf", async (req, res) => {
  const pdfPath = req.query["path"] as string | undefined;
  const fullUrl = req.query["url"] as string | undefined;

  let target: string;
  if (fullUrl) {
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
    const cd = upstream.headers.get("content-disposition") ?? 'inline; filename="invoice.pdf"';
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
