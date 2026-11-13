// Takara AI read-only chat: plain-owner-language answers over the deterministic engine report.
// Shared by the local server (backend/server.mjs) and the hosted platform (platform/lib/core.mjs,
// a byte-identical copy written by scripts/build-platform.mjs). Pure: every input comes from deps.
//
// It never moves money, approves anything or changes a vendor record. Figures come from the
// engine report; no model writes a number. Times are emitted as ISO strings so the app renders
// them in the reader's own time zone.
//
//   spendable = treasury balance − paid, settling (settled_outflow) − reserved

const NF = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const n = (x) => { const v = Number(String(x).replace(/,/g, "")); return (v < 0 ? "−" : "") + NF.format(Math.abs(v)); };
const DAY = 86400000;
const day = (d) => new Date(d * DAY).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const iso = (ms) => new Date(ms).toISOString();
const nsMs = (ns) => { try { return Number(BigInt(ns) / 1000000n); } catch { return null; } };
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const list = (a) => (a.length <= 1 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`);

/** The display name of a bill's payee: never a raw id such as "new:6a77…". */
export function payeeName(c) {
  const vid = String(c.vendor_id || "");
  if (vid.startsWith("new:")) { const head = String(c.destination || "").split(".")[0]; return head ? head.split(/[-_]/).map(cap).join(" ") : "a new vendor"; }
  return String(c.vendor || "").replace(/\s*\((fictional[^)]*)\)\s*$/i, "").replace(/\s*\(team member\)\s*$/i, "").trim() || "this payee";
}
const kindOf = (c) => {
  const vid = String(c.vendor_id || "");
  if (vid === "payroll" || c.priority === "critical") return "payroll";
  if (vid.startsWith("member:")) return "reimbursement";
  if (c.recurrence) return "subscription";
  return "invoice";
};
/** "Ana’s 400 USDC reimbursement", "the 600 USDC Payroll run", "Bigagency’s 900 USDC invoice". */
function billPhrase(c, sym) {
  const nm = payeeName(c), amt = `${n(c.amount)} ${sym}`, k = kindOf(c);
  if (k === "payroll") return `the ${amt} ${nm}`;
  if (k === "reimbursement") return `${nm}’s ${amt} reimbursement`;
  if (k === "subscription") return `${nm}’s ${amt} subscription bill`;
  return `${nm}’s ${amt} invoice`;
}
const STATE_WORD = { claimed: "not reserved yet", accepted: "reserved", settled: "paid, settling", closed: "closed" };

/** The reconciled equation, the same one the app and the product page show. */
export function equation(f, sym = "USDC") {
  const bal = Number(f.treasury_balance), paid = Number(f.settled_outflow) || 0, res = Number(f.reserved) || 0, sp = Number(f.spendable);
  return `${n(bal)} in treasury${paid ? ` − ${n(paid)} paid, settling` : ""} − ${n(res)} reserved = ${n(sp)} ${sym} spendable`;
}

const REFUSAL_PLAIN = {
  duplicate_evidence: "the same invoice had already been recorded, so the copy was refused and no bill was created",
  nonce_used: "a payment authorization that had already been used was sent again, so the contract refused it",
  authorization_mismatch: "the payment details didn’t match what was authorized, so the contract refused it",
  below_min_runway: "paying it would have left less than your minimum runway",
  commitment_not_accepted: "it hadn’t been accepted yet, so it couldn’t be paid",
};

/**
 * @param {string} q the owner's question
 * @param {object} deps
 *   report(): engine report { commitments, figures, symbol }
 *   decisions(): recorded decisions, oldest first
 *   openSealed(sealed): opens a sealed detail with the owner's ledger key, or null
 *   vendorChanges(): contract list_vendor_changes()
 *   policy(): { max_auto_pay (in USDC), cooling_off_hours, min_runway_days } or null
 *   explorer(tx): explorer URL
 *   agentName: the agent's display name
 */
export async function answer(q, deps) {
  const text = String(q ?? "").toLowerCase().slice(0, 500);
  const AG = deps.agentName || "Banto";
  if (/\b(pay|send|approve|accept|transfer|change|update|set|raise|delete|withdraw)\b/.test(text) && !/why|what|which|how much|show|list|can we|any/.test(text)) {
    return { answer: "I can only answer questions here. Approve or reject in Approvals: one click, signed in your wallet. Policy changes need a Signer’s signature on the Policy page.", link: { href: "#/approvals", text: "Open Approvals" }, sources: [] };
  }
  const rep = await deps.report();
  const sym = rep.symbol || "USDC", f = rep.figures || {};
  const open = rep.commitments.filter((c) => c.state !== "closed");
  const byId = Object.fromEntries(rep.commitments.map((c) => [String(c.id), c]));
  const sp = Number(f.spendable);
  let pol = null; try { pol = await deps.policy(); } catch { pol = null; }
  const dueTxt = (c) => (c.due_day > 0 ? `due ${day(c.due_day)}` : "no due date");
  const engine = [{ query: "engine report (deterministic)" }];

  // ---------- why was X blocked / why is X waiting
  if (/\bwhy\b|blocked|refused|rejected|denied|\bheld\b|waiting|stuck/.test(text)) {
    const amount = text.match(/(\d[\d,]*(?:\.\d+)?)/)?.[1]?.replace(/,/g, "");
    const decs = deps.decisions();
    const refusals = decs.filter((d) => d.value && typeof d.value === "object" && d.value.ok === false && d.value.reason).reverse();
    const all = amount ? open.filter((c) => Number(c.amount) === Number(amount)) : [];
    const unpaid = all.filter((c) => c.state !== "settled");
    const cands = unpaid.length ? unpaid : all; // a bill still in flight explains "why" better than a paid one
    let bill = null, ref = null;
    if (amount) {
      ref = refusals.find((d) => cands.some((c) => String(c.id) === String(d.value.commitment_id))) || null;
      bill = ref ? byId[String(ref.value.commitment_id)] : cands.find((c) => c.state === "claimed") || cands[0] || null;
    } else { ref = refusals[0] || null; bill = ref ? byId[String(ref.value.commitment_id)] : null; }
    if (!bill && !ref) return { answer: amount ? `No open bill for ${n(amount)} ${sym}. ${AG} has nothing blocked or waiting at that amount.` : "Nothing has been blocked yet.", sources: [] };
    const v = ref ? ref.value : null;
    const src = ref && ref.tx ? [{ tx: ref.tx, url: deps.explorer(ref.tx) }] : engine;
    const at = ref ? Date.parse(ref.at) : null;
    if (v && v.reason === "would_break_commitments") {
      const detail = v.detail ? await deps.openSealed(v.detail).catch(() => null) : null;
      const blockers = (v.blocking || []).map((id) => byId[String(id)]).filter(Boolean).map((c) => `${payeeName(c)} (${n(c.amount)} ${sym}, ${dueTxt(c)})`);
      const lines = [`${cap(billPhrase(bill, sym))} was blocked at ${iso(at)} because paying it would have broken money reserved for ${list(blockers) || "other bills"}.`];
      if (detail && detail.shortfall) lines.push(`Only ${n(detail.spendable)} ${sym} was spendable then, ${n(detail.shortfall)} ${sym} short.`);
      if (bill.state === "settled") lines.push(`It went through later, after the treasury was topped up, and is now paid, settling.`);
      else if (bill.state === "accepted") lines.push(`It has since been accepted and its money is reserved.`);
      return { answer: lines.join(" "), reason: v.reason, sources: src };
    }
    if ((v && v.reason === "needs_signer_acceptance") || (bill && bill.state === "claimed" && bill.new_vendor_over_limit)) {
      const lim = pol ? `${n(pol.max_auto_pay)} ${sym}` : "the auto-pay";
      const after = sp - Number(bill.amount);
      const why = bill.new_vendor_over_limit || String(bill.vendor_id || "").startsWith("new:") ? `It is the first bill from ${payeeName(bill)} and it is above your ${lim} auto-pay limit` : `It is above your ${lim} auto-pay limit`;
      return { answer: `${cap(billPhrase(bill, sym))}, ${dueTxt(bill)}, is waiting on a Signer. ${why}, so ${AG} can’t accept it on its own. Nothing is reserved until a Signer approves it in Approvals. ${after < 0 ? `Approving it today would leave ${n(after)} ${sym} spendable (${n(sp)} − ${n(bill.amount)}), so the treasury needs more funds first.` : `Approving it leaves ${n(after)} ${sym} spendable.`}`, link: { href: "#/approvals", text: "Open Approvals" }, sources: src };
    }
    if ((v && (v.reason === "vendor_change_cooling_off" || v.reason === "vendor_destination_mismatch")) || (bill && bill.proposed_destination)) {
      const changes = await deps.vendorChanges().catch(() => []);
      const ch = changes.find((x) => String(x.commitment_id) === String(bill.id));
      const decided = ch && ch.decided_at ? nsMs(ch.decided_at) : null;
      const ends = decided != null && pol ? decided + pol.cooling_off_hours * 3600000 : null;
      const nowMs = deps.now ?? Date.now();
      const tail = ch && (ch.settlement_status || ch.status) === "suspended_destination_mismatch" ? "Payment stays frozen until a Signer approves or rejects the new address." : decided != null ? (ends && ends <= nowMs ? `A Signer approved the new address at ${iso(decided)} and the ${pol.cooling_off_hours}-hour cooling-off ended at ${iso(ends)}, so it can now be paid when due.` : `A Signer approved the new address at ${iso(decided)}. Payment stays frozen until the ${pol ? `${pol.cooling_off_hours}-hour ` : ""}cooling-off ends${ends ? ` at ${iso(ends)}` : ""}, so a hijacked approval can still be caught.`) : "Payment stays frozen until the cooling-off period ends.";
      return { answer: `${cap(billPhrase(bill, sym))}, ${dueTxt(bill)}, is held. Its invoice asked to pay ${bill.proposed_destination || "a new account"} instead of ${bill.destination}, the address on file. ${tail}`, sources: src };
    }
    if (v && REFUSAL_PLAIN[v.reason]) {
      const target = byId[String(v.commitment_id ?? v.original)];
      return { answer: `${target ? cap(billPhrase(target, sym)) : "A bill"}: ${REFUSAL_PLAIN[v.reason]}${at ? ` (${iso(at)})` : ""}.`, sources: src };
    }
    if (bill && bill.state === "claimed") {
      return { answer: `${cap(billPhrase(bill, sym))}, ${dueTxt(bill)}, is waiting for ${AG}’s policy check, which accepts it within policy or refuses it with a reason. Nobody needs to act.${bill.injection_flagged ? " Its text contained instructions for the agent; they were ignored." : ""} Nothing is reserved yet.`, sources: engine };
    }
    return { answer: `${cap(billPhrase(bill, sym))} isn’t blocked: it is ${STATE_WORD[bill.state] || bill.state}.`, sources: engine };
  }

  // ---------- what renews next month
  if (/renew|next month|subscription|recurring/.test(text) && !/afford/.test(text)) {
    const now = new Date(deps.now ?? Date.now()), y = now.getUTCFullYear(), mo = now.getUTCMonth();
    const from = Date.UTC(y, mo + 1, 1) / DAY, to = Date.UTC(y, mo + 2, 0) / DAY;
    const month = new Date(Date.UTC(y, mo + 1, 1)).toLocaleString("en-US", { month: "long", timeZone: "UTC" });
    const seen = new Set();
    const items = open.filter((c) => c.recurrence && c.due_day >= from && c.due_day <= to).sort((a, b) => a.due_day - b.due_day || a.id - b.id)
      .filter((c) => { const k = `${c.vendor_id}|${c.amount}|${c.due_day}|${c.state}`; if (seen.has(k)) return false; seen.add(k); return true; });
    if (!items.length) return { answer: `Nothing recurring is due in ${month}.`, sources: engine };
    const left = items.filter((c) => c.state !== "settled"), leftSum = left.reduce((a, c) => a + Number(c.amount), 0);
    const allRes = left.every((c) => c.state === "accepted");
    return { answer: `In ${month}: ${items.map((c) => `${payeeName(c)}${kindOf(c) === "payroll" && !/payroll/i.test(payeeName(c)) ? " (payroll)" : ""}, ${n(c.amount)} ${sym} on ${day(c.due_day)}, ${STATE_WORD[c.state] || c.state}`).join("; ")}. ${leftSum ? `${n(leftSum)} ${sym} is still to pay, ${allRes ? "all of it already reserved" : "not all of it reserved yet"}.` : "All of it is already paid."}`, sources: engine };
  }

  // ---------- can we afford a contractor
  if (/afford|hire|another contractor/.test(text)) {
    const m = text.match(/(\d[\d,]*(?:\.\d+)?)\s*(k\b)?/);
    if (!m) return { answer: "Tell me the amount, for example: can we afford a contractor at 2,000 a month?", sources: [] };
    const amt = Number(m[1].replace(/,/g, "")) * (m[2] ? 1000 : 1);
    const per = /year|annual/.test(text) ? "year" : /week/.test(text) ? "week" : "month";
    const daily = amt / { year: 365, week: 7, month: 30 }[per];
    const avail = Number(f.treasury_balance) - (Number(f.settled_outflow) || 0), burn = Number(f.daily_recurring_burn) || 0;
    const next = Math.floor(avail / (burn + daily));
    const floor = pol && Number.isFinite(Number(pol.min_runway_days)) ? Number(pol.min_runway_days) : null;
    const lead = floor == null ? "" : next < floor ? "Not safely. " : next < floor * 2 ? "Only just. " : "Yes. ";
    const vs = floor == null ? "" : next < floor ? `, below your ${floor}-day minimum, so ${AG} would refuse discretionary payments` : next < floor * 2 ? `, close to your ${floor}-day minimum` : `, well above your ${floor}-day minimum`;
    const first = per === "month" && amt > sp ? ` The first month alone (${n(amt)} ${sym}) is more than the ${n(sp)} ${sym} you can spend today, so you’d need to add funds first.` : "";
    return { answer: `${lead}Runway would fall from ${f.runway_days ?? "n/a"} days to ${next} days${vs}. A contractor at ${n(amt)} ${sym} a ${per} adds about ${n(daily)} ${sym} a day to the ${n(burn)} ${sym} a day your recurring bills already cost.${first} Today: ${equation(f, sym)}.`, figures: f, sources: [{ query: "runway = (treasury balance − paid, settling) / (daily recurring bills + new daily cost)" }] };
  }

  // ---------- what is reserved
  if (/reserv|envelope|set aside/.test(text)) {
    const acc = open.filter((c) => c.state === "accepted").sort((a, b) => (a.priority === "critical" ? -1 : 0) - (b.priority === "critical" ? -1 : 0) || a.due_day - b.due_day);
    if (!acc.length) return { answer: `Nothing is reserved. Spendable: ${equation(f, sym)}.`, figures: f, sources: engine };
    return { answer: `${n(f.reserved)} ${sym} is reserved in ${acc.length} envelope${acc.length === 1 ? "" : "s"}: ${acc.map((c) => `${payeeName(c)} ${n(c.amount)} ${sym} (${dueTxt(c)}${c.vendor_change === "approved_cooling_off" ? ", frozen until its cooling-off ends" : ""})`).join("; ")}. Reserved money can’t be spent on anything else. ${equation(f, sym)}.`, figures: f, sources: engine };
  }

  // ---------- what is spendable
  if (/spend|balance|runway|how much|available|cash/.test(text)) {
    const floor = pol ? Number(pol.min_runway_days) : null;
    return { answer: `${n(sp)} ${sym} is spendable: ${equation(f, sym)}. “Paid, settling” is money already sent that the balance hasn’t caught up with yet. Runway is ${f.runway_days ?? "n/a"} days${floor != null ? ` against your ${floor}-day minimum` : ""}.`, figures: f, queries: rep.queries, sources: engine };
  }

  // ---------- payout changes
  if (/vendor|destination|suspend|cooling|change|address/.test(text)) {
    const changes = await deps.vendorChanges().catch(() => []);
    if (!changes.length) return { answer: "No payout address changes. Every vendor is paid at the address on file.", sources: [] };
    const out = changes.map((ch) => {
      const c = byId[String(ch.commitment_id)]; if (!c) return null;
      const s = ch.settlement_status || ch.status, decided = ch.decided_at ? nsMs(ch.decided_at) : null;
      const ends = decided != null && pol ? decided + pol.cooling_off_hours * 3600000 : null;
      const past = ends != null && ends <= (deps.now ?? Date.now());
      const state = s === "suspended_destination_mismatch" ? "Payment is frozen until a Signer approves or rejects it." : s === "approved_cooling_off" ? (past ? `A Signer approved it at ${iso(decided)} and the cooling-off ended at ${iso(ends)}, so it can be paid when due.` : `A Signer approved it at ${iso(decided)}; payment stays frozen until the cooling-off ends${ends ? ` at ${iso(ends)}` : ""}.`) : s === "rejected" ? "A Signer rejected it, so nothing will be paid to the new address." : "";
      return `${payeeName(c)}’s invoice for ${n(c.amount)} ${sym} (${dueTxt(c)}) asked to be paid at ${c.proposed_destination || "a new address"} instead of ${c.destination}. ${state}`;
    }).filter(Boolean);
    return { answer: `${out.length === 1 ? "One payout change." : `${out.length} payout changes.`} ${out.join(" ")}`, sources: [] };
  }

  // ---------- list bills
  if (/commitment|bills?\b|invoice|list|pending|claimed|accepted|what.*due/.test(text)) {
    const groups = [["Waiting", (c) => c.state === "claimed"], ["Reserved", (c) => c.state === "accepted"], ["Paid, settling", (c) => c.state === "settled"]];
    const lines = groups.map(([label, fn]) => {
      const g = new Map();
      for (const c of open.filter(fn).sort((a, b) => (a.due_day || 1e9) - (b.due_day || 1e9) || a.id - b.id)) { const k = `${payeeName(c)}|${c.amount}|${c.due_day}`; g.set(k, { c, x: (g.get(k)?.x || 0) + 1 }); }
      if (!g.size) return null;
      return `${label}: ${[...g.values()].map(({ c, x }) => `${payeeName(c)} ${n(c.amount)} ${sym}${x > 1 ? ` ×${x}` : ""}${c.due_day > 0 ? ` (${day(c.due_day)})` : ""}`).join("; ")}.`;
    }).filter(Boolean);
    return { answer: `${open.length} bills.\n${lines.join("\n")}`, sources: engine };
  }

  return { answer: 'Try: "Why was the 400 payment blocked?", "What renews next month?", "Can we afford a contractor at 2,000 a month?", "What is spendable?" or "Any payout changes?". I answer questions; approving happens in Approvals.', sources: [] };
}
