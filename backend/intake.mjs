// Invoice intake. Turns a forwarded document into a sealed claim for the engine.
//
//  - Sender identity (From address, domain, DKIM result) is read from the mail headers by this
//    code, never by a model.
//  - The model (NEAR AI Cloud, TEE-hosted, attestation verified against a fresh nonce) only
//    copies raw strings out of the body. It never chooses vendor, priority or state; the engine
//    resolves those deterministically and ignores any extra keys.
//  - Without NEAR_AI_API_KEY, a deterministic offline parser is used and the claim says so.
//  - The plaintext claim exists only in memory here and is sealed to the engine key before it
//    leaves this process. Nothing is retained after the call returns.
import { createHash } from "node:crypto";
import { sealTo } from "../scripts/lib/engine.mjs";
import { parseWithNearAI } from "./nearai.mjs";

export function parseEmail(raw) {
  const text = raw.replace(/\r\n/g, "\n");
  const split = text.indexOf("\n\n");
  const head = split >= 0 ? text.slice(0, split) : "";
  const body = split >= 0 ? text.slice(split + 2) : text;
  const header = (name) => head.match(new RegExp(`^${name}:\\s*(.+)$`, "im"))?.[1]?.trim() ?? "";
  const from = header("From");
  const email = (from.match(/<([^>]+)>/)?.[1] ?? from).trim().toLowerCase();
  const domain = email.split("@")[1] ?? "";
  const dkim = dkimResult(head, domain);
  const subject = header("Subject");
  return { email, domain, dkim, subject, body };
}

/**
 * DKIM verdict from OUR receiving server only: the first Authentication-Results header whose
 * authserv-id is ours, and inside it one clause that says dkim=pass for exactly the From domain.
 * Headers added by anyone else (a sender can write any header) are ignored.
 */
export const MTA_ID = process.env.TAKARA_MTA_ID ?? "mx.takara.example";
export function dkimResult(head, domain) {
  if (!domain) return "fail";
  const unfolded = head.replace(/\n[ \t]+/g, " ");
  const ours = unfolded.split("\n").find((l) => {
    const m = l.match(/^Authentication-Results:\s*([^;\s]+)\s*;/i);
    return m && m[1].toLowerCase() === MTA_ID;
  });
  if (!ours) return "fail";
  const clauses = ours.slice(ours.indexOf(";") + 1).split(";");
  const ok = clauses.some((c) => {
    const m = c.trim().match(/^dkim=pass\b.*?\bheader\.d=([A-Za-z0-9.-]+)\s*$/i) ?? c.trim().match(/^dkim=pass\b.*?\bheader\.d=([A-Za-z0-9.-]+)(?:\s|$)/i);
    return m && m[1].toLowerCase() === domain;
  });
  return ok ? "pass" : "fail";
}

/** Deterministic fallback extractor (labelled as such in the claim). */
export function offlineParse(body, subject) {
  const line = (re) => body.match(re)?.[1]?.trim() ?? "";
  const amountLine = line(/^(?:Total net pay|Amount due|Amount|Total)\s*:\s*(.+)$/im);
  return {
    vendor_name: line(/^FICTIONAL TEST DOCUMENT\s*-\s*(.+)$/im),
    tax_id: line(/^Tax ID\s*:\s*(.+)$/im),
    invoice_number: line(/^Invoice(?: number)?\s*:?\s*([A-Z]{2,4}-[\w-]+)/im),
    amount: amountLine,
    currency: /USDC/i.test(amountLine) ? "USDC" : /USD|\$/.test(amountLine) ? "USD" : "",
    due_date: line(/^(?:Due date|Due|Pay date)\s*:\s*(\d{4}-\d{2}-\d{2})/im),
    destination: line(/(?:Pay to|Remit to|Payout account)[^:\n]*\(NEAR\)\s*:\s*([a-z0-9._-]+)/im) || line(/(?:Pay to|Remit to|Payout account)[^:\n]*:\s*([a-z0-9._-]+\.testnet)/im),
    destination_chain: "near",
    recurrence: line(/^(?:Recurring|Billing|Billed)\s*:?\s*(monthly|weekly)/im),
    memo: line(/^(?:Notes|Memo)\s*:\s*(.+)$/im),
    purpose: line(/^Purpose\s*:\s*(.+)$/im) || subject,
  };
}

const FIELD_KEYS = ["vendor_name", "tax_id", "invoice_number", "amount", "currency", "due_date", "destination", "destination_chain", "recurrence", "memo", "purpose"];

/** Keep only known keys, as strings. A model-invented `vendor_id` or `priority` is dropped here
 *  and would be ignored by the engine anyway. */
export function sanitizeFields(f) {
  const out = {};
  for (const k of FIELD_KEYS) out[k] = typeof f?.[k] === "string" ? f[k].slice(0, 500) : "";
  return out;
}

export async function intakeDocument(rawBytes, { enginePk, useNearAI = !!process.env.NEAR_AI_API_KEY } = {}) {
  const raw = Buffer.isBuffer(rawBytes) ? rawBytes.toString("utf8") : String(rawBytes);
  const docSha = createHash("sha256").update(rawBytes).digest("hex");
  const mail = parseEmail(raw);
  const kind = /^payment request/i.test(mail.subject) ? "payment_request" : "invoice";

  let fields;
  let nearai = { parser: "offline-deterministic", note: "NEAR_AI_API_KEY not set; fixture parser used" };
  if (useNearAI) {
    const r = await parseWithNearAI(mail.body);
    if (!r.evidence.verified) throw new Error(`NEAR AI parse not verified; refusing to use it: ${JSON.stringify(r.evidence.signature)}`);
    fields = r.fields;
    nearai = r.evidence;
  } else {
    fields = offlineParse(mail.body, mail.subject);
  }
  const claim = { v: 1, kind, doc_sha256: docSha, sender: { email: mail.email, domain: mail.domain, dkim: mail.dkim }, fields: sanitizeFields(fields), nearai };
  const sealed = await sealTo(enginePk, JSON.stringify(claim));
  // Return the public summary only; the plaintext claim is not retained.
  return { sealed, doc_sha256: docSha, kind, sender: claim.sender, parser: nearai.parser ?? "near-ai-cloud", nearai_verified: nearai.verified ?? false };
}
