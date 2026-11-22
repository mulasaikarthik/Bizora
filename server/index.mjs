// HTTP server for Bizora. Node built-ins only. JSON in and out.
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildForecast,
  buildReminders,
  buildSummary,
  decorateInvoice,
  normaliseExpense,
  todayISO,
} from './domain.mjs';
import * as store from './store.mjs';
import { getUserFromHeader, getAuthenticatedSupabase } from './supabase.mjs';

const MAX_BODY_BYTES = 100 * 1024;
const FORECAST_HORIZONS = [30, 60, 90];

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function send(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...extraHeaders,
  });
  res.end(body);
}

function sendError(res, status, code, error, fields) {
  const payload = { error, code };
  if (fields) payload.fields = fields;
  send(res, status, payload);
}

// Store result: {ok:true,value} -> status; {ok:false,status,code,error,fields?} -> error body.
function sendResult(res, result, okStatus = 200) {
  if (!result.ok) {
    sendError(res, result.status ?? 422, result.code, result.error, result.fields);
    return;
  }
  send(res, okStatus, result.value);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let rejected = false;
    req.on('data', (chunk) => {
      if (rejected) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        rejected = true;
        reject(new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Request body is larger than 100KB'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (rejected) return;
      const text = Buffer.concat(chunks).toString('utf8');
      if (text.trim() === '') {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(text));
      } catch {
        reject(new HttpError(400, 'BAD_JSON', 'Request body is not valid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function decorateAll(db, invoices) {
  const today = todayISO();
  return (invoices || []).map((inv) => decorateInvoice(inv, db.payments, db.clients, today));
}

function findById(list, id) {
  return (list || []).find((x) => x.id === id);
}

// ---------- handlers: each takes (ctx) and writes the response ----------

const handlers = {
  health(ctx) {
    send(ctx.res, 200, { status: 'ok', time: new Date().toISOString() });
  },

  async state(ctx) {
    const db = await store.loadDb(ctx.userContext);
    send(ctx.res, 200, {
      clients: db.clients,
      invoices: decorateAll(db, db.invoices),
      payments: db.payments,
      expenses: db.expenses.map(normaliseExpense),
      shoots: db.shoots,
      notifications: db.notifications,
      settings: db.settings,
    });
  },

  async summary(ctx) {
    const db = await store.loadDb(ctx.userContext);
    send(ctx.res, 200, buildSummary({
      invoices: db.invoices,
      payments: db.payments,
      expenses: db.expenses,
      today: todayISO(),
    }));
  },

  async reminders(ctx) {
    const db = await store.loadDb(ctx.userContext);
    send(ctx.res, 200, buildReminders({
      invoices: db.invoices,
      payments: db.payments,
      clients: db.clients,
      today: todayISO(),
    }));
  },

  async sendReminder(ctx) {
    const result = await store.markReminderSent(ctx.params[0], ctx.userContext);
    if (!result.ok) return sendResult(ctx.res, result);
    const db = await store.loadDb(ctx.userContext);
    send(ctx.res, 200, decorateInvoice(result.value, db.payments, db.clients, todayISO()));
  },

  async forecast(ctx) {
    const horizonRaw = ctx.query.get('horizon') ?? '30';
    const lateRaw = ctx.query.get('lateDays') ?? '0';
    const horizon = /^\d+$/.test(horizonRaw) ? Number(horizonRaw) : NaN;
    const lateDays = /^\d+$/.test(lateRaw) ? Number(lateRaw) : NaN;
    const fields = {};
    if (!FORECAST_HORIZONS.includes(horizon)) fields.horizon = 'horizon must be 30, 60 or 90';
    if (!(lateDays >= 0 && lateDays <= 60)) fields.lateDays = 'lateDays must be an integer from 0 to 60';
    if (Object.keys(fields).length > 0) {
      return sendError(ctx.res, 400, 'INVALID_QUERY', Object.values(fields)[0], fields);
    }
    const db = await store.loadDb(ctx.userContext);
    try {
      send(ctx.res, 200, buildForecast({
        invoices: db.invoices,
        payments: db.payments,
        expenses: db.expenses,
        today: todayISO(),
        horizon,
        lateDays,
      }));
    } catch (err) {
      if (err instanceof RangeError) return sendError(ctx.res, 400, 'INVALID_QUERY', err.message);
      throw err;
    }
  },

  // clients
  async listClients(ctx) {
    const db = await store.loadDb(ctx.userContext);
    send(ctx.res, 200, db.clients);
  },
  async createClient(ctx) {
    sendResult(ctx.res, await store.createClient(await readBody(ctx.req), ctx.userContext), 201);
  },
  async getClient(ctx) {
    const db = await store.loadDb(ctx.userContext);
    const client = findById(db.clients, ctx.params[0]);
    if (!client) return sendError(ctx.res, 404, 'NOT_FOUND', 'Client not found');
    send(ctx.res, 200, client);
  },
  async updateClient(ctx) {
    sendResult(ctx.res, await store.updateClient(ctx.params[0], await readBody(ctx.req), ctx.userContext));
  },
  async deleteClient(ctx) {
    sendResult(ctx.res, await store.deleteClient(ctx.params[0], ctx.userContext));
  },

  // invoices
  async listInvoices(ctx) {
    const db = await store.loadDb(ctx.userContext);
    send(ctx.res, 200, decorateAll(db, db.invoices));
  },
  async createInvoice(ctx) {
    const result = await store.createInvoice(await readBody(ctx.req), ctx.userContext);
    if (!result.ok) return sendResult(ctx.res, result);
    const db = await store.loadDb(ctx.userContext);
    send(ctx.res, 201, decorateInvoice(result.value, db.payments, db.clients, todayISO()));
  },
  async getInvoice(ctx) {
    const db = await store.loadDb(ctx.userContext);
    const inv = findById(db.invoices, ctx.params[0]);
    if (!inv) return sendError(ctx.res, 404, 'NOT_FOUND', 'Invoice not found');
    send(ctx.res, 200, decorateInvoice(inv, db.payments, db.clients, todayISO()));
  },
  async updateInvoice(ctx) {
    const result = await store.updateInvoice(ctx.params[0], await readBody(ctx.req), ctx.userContext);
    if (!result.ok) return sendResult(ctx.res, result);
    const db = await store.loadDb(ctx.userContext);
    send(ctx.res, 200, decorateInvoice(result.value, db.payments, db.clients, todayISO()));
  },
  async deleteInvoice(ctx) {
    sendResult(ctx.res, await store.deleteInvoice(ctx.params[0], ctx.userContext));
  },
  async sendInvoice(ctx) {
    const result = await store.sendInvoice(ctx.params[0], ctx.userContext);
    if (!result.ok) return sendResult(ctx.res, result);
    const db = await store.loadDb(ctx.userContext);
    send(ctx.res, 200, decorateInvoice(result.value, db.payments, db.clients, todayISO()));
  },
  async recordInvoicePayment(ctx) {
    sendResult(ctx.res, await store.recordPayment(ctx.params[0], await readBody(ctx.req), ctx.userContext), 201);
  },

  // payments
  async listPayments(ctx) {
    const db = await store.loadDb(ctx.userContext);
    send(ctx.res, 200, db.payments);
  },
  async createPayment(ctx) {
    const body = await readBody(ctx.req);
    const invoiceId = body && typeof body === 'object' && !Array.isArray(body) ? body.invoiceId : undefined;
    sendResult(ctx.res, await store.recordPayment(invoiceId, body, ctx.userContext), 201);
  },

  // expenses
  async listExpenses(ctx) {
    const db = await store.loadDb(ctx.userContext);
    send(ctx.res, 200, db.expenses.map(normaliseExpense));
  },
  async createExpense(ctx) {
    sendResult(ctx.res, await store.createExpense(await readBody(ctx.req), ctx.userContext), 201);
  },
  async updateExpense(ctx) {
    sendResult(ctx.res, await store.updateExpense(ctx.params[0], await readBody(ctx.req), ctx.userContext));
  },
  async deleteExpense(ctx) {
    sendResult(ctx.res, await store.deleteExpense(ctx.params[0], ctx.userContext));
  },

  // settings
  async getSettings(ctx) {
    const db = await store.loadDb(ctx.userContext);
    send(ctx.res, 200, db.settings);
  },
  async updateSettings(ctx) {
    sendResult(ctx.res, await store.updateSettings(await readBody(ctx.req), ctx.userContext));
  },
};

const ID = '([^/]+)';
const routes = [
  ['GET', '/api/health', handlers.health],
  ['GET', '/api/state', handlers.state],
  ['GET', '/api/summary', handlers.summary],
  ['GET', '/api/reminders', handlers.reminders],
  ['POST', `/api/reminders/${ID}/send`, handlers.sendReminder],
  ['GET', '/api/forecast', handlers.forecast],

  ['GET', '/api/clients', handlers.listClients],
  ['POST', '/api/clients', handlers.createClient],
  ['GET', `/api/clients/${ID}`, handlers.getClient],
  ['PUT', `/api/clients/${ID}`, handlers.updateClient],
  ['DELETE', `/api/clients/${ID}`, handlers.deleteClient],

  ['GET', '/api/invoices', handlers.listInvoices],
  ['POST', '/api/invoices', handlers.createInvoice],
  ['GET', `/api/invoices/${ID}`, handlers.getInvoice],
  ['PUT', `/api/invoices/${ID}`, handlers.updateInvoice],
  ['DELETE', `/api/invoices/${ID}`, handlers.deleteInvoice],
  ['POST', `/api/invoices/${ID}/send`, handlers.sendInvoice],
  ['POST', `/api/invoices/${ID}/payments`, handlers.recordInvoicePayment],

  ['GET', '/api/payments', handlers.listPayments],
  ['POST', '/api/payments', handlers.createPayment],

  ['GET', '/api/expenses', handlers.listExpenses],
  ['POST', '/api/expenses', handlers.createExpense],
  ['PUT', `/api/expenses/${ID}`, handlers.updateExpense],
  ['DELETE', `/api/expenses/${ID}`, handlers.deleteExpense],

  ['GET', '/api/settings', handlers.getSettings],
  ['PUT', '/api/settings', handlers.updateSettings],
].map(([method, pattern, handler]) => ({ method, re: new RegExp(`^${pattern}$`), handler }));

function matchRoute(method, pathname) {
  let pathMatched = false;
  for (const route of routes) {
    const m = route.re.exec(pathname);
    if (!m) continue;
    pathMatched = true;
    if (route.method === method) return { route, params: m.slice(1).map(decodeURIComponent) };
  }
  return { route: null, pathMatched };
}

async function handle(req, res) {
  // CORS support
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, 'http://localhost');
  const found = matchRoute(req.method, url.pathname);
  if (!found.route) {
    if (found.pathMatched) {
      return sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
    }
    return sendError(res, 404, 'NOT_FOUND', 'Not found');
  }
  try {
    const user = await getUserFromHeader(req.headers.authorization);
    const supabase = getAuthenticatedSupabase(req.headers.authorization);
    const userContext = user ? { user, supabase } : null;
    await found.route.handler({
      req,
      res,
      params: found.params,
      query: url.searchParams,
      user,
      supabase,
      userContext,
    });
  } catch (err) {
    if (err instanceof HttpError) {
      if (err.status === 413) {
        return send(res, 413, { error: err.message, code: err.code }, { Connection: 'close' });
      }
      return sendError(res, err.status, err.code, err.message);
    }
    console.error(err);
    sendError(res, 500, 'INTERNAL_ERROR', 'Something went wrong');
  }
}

// Returns an http.Server. Call .listen(port) yourself (tests use port 0).
export function createServer() {
  return http.createServer((req, res) => {
    handle(req, res);
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const port = Number(process.env.PORT) || 4000;
  const server = createServer();
  server.listen(port, () => {
    console.log(`Bizora API listening on http://localhost:${port}`);
  });
}
