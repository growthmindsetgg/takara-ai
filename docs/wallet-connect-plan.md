# Wallet connection for the owner app: plan

Status: design only, nothing built in the app yet. Written 2026-11-13. A throwaway prototype proved the library choice (section 5).

People keep asking "where do I connect my NEAR wallet?" Right now the answer is nowhere. Signer and owner transactions run from the NEAR CLI legacy keychain on the operator's machine, and the hosted copy can't sign at all. This plan adds a **Connect wallet** button to the owner app (`web/index.html`, which is also published as `platform/app/index.html`). With it, a policy signer or owner can sign their own transactions in their own wallet, from the local dashboard or from `https://takara-ai.vercel.app/app`. The page and the server never hold a key.

The app still doesn't approve anything by itself. It builds one function call to `treasury.takara-ai-hq.testnet`, the wallet shows it and signs it, and the contract decides. Anyone can press the button. Only an account the contract accepts gets anywhere.

---

## 1. Library choice

### Decision

**`@hot-labs/near-connect@0.12.0`**, loaded as one ES module from jsDelivr. The wallet list is pinned and lives inside the app, so the library doesn't pull the upstream list at runtime.

```js
import { NearConnector } from "https://cdn.jsdelivr.net/npm/@hot-labs/near-connect@0.12.0/+esm";
```

### What was checked (2026-11-13; the cut-off for "at least two weeks old" is 2026-10-30)

| Option | Version and publish date (`npm view <pkg> time`) | Loads in a static page with no bundler? | Verdict |
|---|---|---|---|
| `@hot-labs/near-connect` | **0.12.0, 2026-10-26** (17 days). Previous: 0.11.4, 2026-05-11 | Yes. `https://cdn.jsdelivr.net/npm/@hot-labs/near-connect@0.12.0/+esm` returns 200, 61,298 bytes, `cache-control: immutable`, and has **no imports at all** (the package has zero runtime dependencies). `https://esm.sh/@hot-labs/near-connect@0.12.0` also works: a 199-byte stub that points to `/@hot-labs/near-connect@0.12.0/es2022/near-connect.mjs` (60,819 bytes, also no imports). | **Chosen.** One file, no transitive versions to pin. It ships its own wallet chooser and runs each wallet's code in a sandboxed iframe (`sandbox="allow-scripts"`, `srcdoc`). Testnet support is built in (`network: "testnet"` lists only wallets that support testnet). |
| NEAR Wallet Selector (`@near-wallet-selector/core`, `modal-ui`, `my-near-wallet`, `meteor-wallet`, `here-wallet`, `intear-wallet`, `nightly`) | All at 10.1.4, **2025-12-04**. Nothing newer: the project has gone 11 months without a release. | Only just. `esm.sh/@near-wallet-selector/core@10.1.4` imports `@near-js/crypto@^2.3.0`, `@near-js/providers@^2.3.0`, `@near-js/signers@^2.3.0`, `@near-js/transactions@^2.3.0` (caret ranges, so the versions you get can change under you), plus rxjs, borsh and node polyfills. `modal-ui@10.1.4` adds React 18.3.1, react-dom, qrcode, copy-to-clipboard and a 46 KB stylesheet. Each wallet module brings more `@near-js/*` ranges. | Rejected. It's a large dependency graph with unpinned transitive versions, needs React just for the modal, and is a stale release line. |
| `near-api-js` with a hand-written MyNearWallet redirect | 7.4.0, 2026-10-23 (7.5.0 to 7.5.3 are from 2026-11-11, too new) | The `+esm` build loads (82 KB, imports @noble/*, @scure/base, borsh, is-my-json-valid), but **7.x has no `WalletConnection`** (no match in the bundle). The redirect login and sign flow would have to be rebuilt by hand. | Rejected. It only covers MyNearWallet, relies on a legacy redirect protocol, and a login would leave a function-call key in localStorage (see 4.2). |

The app needs no other library. View calls are plain JSON-RPC `fetch`, which `backend/server.mjs` and `platform/lib/core.mjs` already do. Actions use near-connect's own `{ type: "FunctionCall", params }` format.

### The wallet list (manifest) is pinned, not fetched

By default, `NearConnector` fetches `https://raw.githubusercontent.com/hot-dao/near-selector/refs/heads/main/repository/manifest.json`. That URL tracks a branch, so it can change at any time. Each listed wallet's code (its "executor") is then fetched from a URL in that manifest, and most of those also point at `refs/heads/main`. The library caches executor code in IndexedDB under `id:version`, runs the cached copy first, and refreshes it in the background (`SandboxedWallet/executor.js`, `loadCode`).

The plan is to pass our own `manifest` object. It's a filtered copy of upstream commit `b8207d0b303914f264c50be5ac849d5fe028f069` (2026-10-27), with executors pinned to commits where possible:

| Wallet | Executor | Pin |
|---|---|---|
| MyNearWallet | `cdn.jsdelivr.net/gh/hot-dao/near-selector@b8207d0…/repository/mnw.js` (200) | commit 2026-10-27 |
| Nightly | `cdn.jsdelivr.net/gh/hot-dao/near-selector@b8207d0…/repository/nightly.js` (200) | commit 2026-10-27 |
| NEAR CLI | `cdn.jsdelivr.net/gh/near/near-cli-connect@dc5cb123e3a8e42ed095739f4ea058b767a80ad2/dist/near-cli.js` (200) | commit 2026-06-17 |
| Ledger | `cdn.jsdelivr.net/gh/near/near-connect-ledger@8fe249268332fd0c3231fe3e32da3bf0956d9cef/ledger-executor.js` (200) | commit 2026-10-26 |
| Meteor | `raw.githubusercontent.com/Meteor-Wallet/meteor_wallet_sdk/data-storage/storage/meteor-near-connect-latest.js` | **Can't be pinned.** The `data-storage` branch is rewritten by an automated job: the only commit for that file is from 2026-11-11, and the 2026-10-28 commit returns 404. Kept on the upstream URL; it runs in the sandbox. Vendor a reviewed copy before mainnet. |
| Intear | `wallet.intear.tech/near-selector.js` | **Can't be pinned** (hosted by the wallet itself). It runs in the sandbox. |

Left out on purpose: HOT, OKX, Hana, Trezu and NEAR Mobile (no testnet flag), WalletConnect and Unity (they need a WalletConnect project id), and Ethereum wallets (not wanted for a treasury signer).

**MyNearWallet on testnet.** The upstream manifest doesn't mark MyNearWallet as testnet-capable and only allows opening `https://app.mynearwallet.com`. Its executor does have a testnet branch (`new MyNearWalletConnector("https://testnet.mynearwallet.com", {networkId:"testnet", …})`), so our copy sets `features.testnet = true` and adds `https://testnet.mynearwallet.com` to `allowsOpen`. The prototype shows it in the list. **A full MyNearWallet testnet sign-in through near-connect was not tested.** Test it before relying on it.

Every `version` gets a `-takara.N` suffix. Bump N whenever you change an executor URL, otherwise browsers keep running the code cached under the old `id:version`.

The full manifest to paste is in Appendix A.

---

## 2. Which actions a connected wallet can take

Rules from `contract/src/lib.rs`:

- `require_owner` checks the caller is in `owners`, otherwise `E_NOT_OWNER`.
- `require_signer` checks the caller is in `policy.signers`, otherwise `E_NOT_POLICY_SIGNER`.
- `close_commitment` accepts either an owner or a signer. Anyone else gets `E_NOT_POLICY_SIGNER`.
- `require_one_yocto` requires exactly 1 yoctoNEAR attached, otherwise `E_REQUIRES_ONE_YOCTO`.

Gas values are the ones the repo's scripts already used successfully on testnet: `scripts/judge.mjs` (`signer` 30 Tgas, `owner` 60 Tgas) and `backend/server.mjs` (`propose_policy` 60 Tgas). Unused gas is refunded.

Accounts today: owner `takara-ai-hq.testnet`, signer `signer.takara-ai-hq.testnet` (threshold 1), agent `agent.takara-ai-hq.testnet`.

### Policy signer

| Method | Args (JSON) | Gas | Deposit | Contract precondition | Where in the app | Failure codes to map |
|---|---|---|---|---|---|---|
| `accept_commitment` | `{ "commitment_id": "<id>" }` (U64 as string) | 30 Tgas `"30000000000000"` | `"0"` | state `claimed`. Returns a `Decision` JSON. | Approvals card and bill drawer, when `waitsOn.who === "signer"` and there's no frozen vendor change | `E_NOT_POLICY_SIGNER`, `E_NOT_FOUND`, `E_INVALID_TRANSITION` |
| `close_commitment` (claimed) | `{ "commitment_id": "<id>" }` | 30 Tgas | `"0"` | state `claimed` (a signer can't close an accepted bill) | Card or drawer, secondary "Close bill" | `E_NOT_POLICY_SIGNER`, `E_INVALID_TRANSITION` |
| `approve_vendor_change` | `{ "change_id": "<id>" }` (from `b.change.id`) | 30 Tgas | `"0"` | change is `suspended_destination_mismatch`. The cooling-off period starts at approval. | Frozen card (`vendor_change === "suspended_destination_mismatch"`) | `E_NOT_POLICY_SIGNER`, `E_NOT_FOUND`, `E_INVALID_TRANSITION` |
| `reject_vendor_change` | `{ "change_id": "<id>" }` | 30 Tgas | `"0"` | same as above. Also closes the bill if it's still `claimed`. | Frozen card, secondary "Reject change" | same |
| `propose_policy` | `{ "version": <u32>, "hash": "<64 hex>", "expires_at": "<ns as string>", "sealed": "<base64, ≤ 24 KiB>", "diff_hash": "<64 hex>" }` | 60 Tgas `"60000000000000"` | `"0"` | `version > current`, both hashes are 64 lowercase hex, `sealed` uses the base64 charset and is ≤ 24,576 bytes. The proposer's approval counts automatically, so with threshold 1 the policy goes live in the same transaction. Returns the proposal id. | Policy review dialog, "Sign with wallet" | `E_NOT_POLICY_SIGNER`, `E_INVALID_ARGUMENT` |
| `approve_policy` | `{ "proposal_id": <u32> }` (a plain number, not a string) | 30 Tgas | `"0"` | proposal exists, isn't applied yet, its version is above the current one, and this signer hasn't approved it | Only needed when threshold > 1: a "Pending policy versions" list on the Policy page | `E_NOT_POLICY_SIGNER`, `E_NOT_FOUND`, `E_INVALID_TRANSITION`, `E_ALREADY_APPROVED` |

`downgrade_discretionary` (signer, accepted discretionary bill back to claimed) also exists. It's out of scope for this pass; add it later as a drawer action.

### Owner

| Method | Args | Gas | Deposit | Notes | Where |
|---|---|---|---|---|---|
| `pause` | `{}` | 60 Tgas | `"0"` | | Policy page, "Emergency controls" |
| `unpause` | `{}` | 60 Tgas | `"0"` | | The status bar that shows "The treasury is paused", plus Emergency controls |
| `revoke_agent` | `{}` | 60 Tgas | `"0"` | Sets `agent = None` | Emergency controls |
| `set_agent` | `{ "agent": "<account>" }` | 60 Tgas | `"0"` | `E_INVALID_ARGUMENT` if the account is an owner or signer. After this, the engine secret has to be re-bound (README production note), so warn about it. | Emergency controls, behind "Restore agent" |
| `recover` | `{ "amount": "<tUSDC base units, 6 decimals, string>", "to": "<account>" }` | 60 Tgas | **`"1"` (1 yoctoNEAR)** | `E_INSUFFICIENT_BALANCE` if amount is 0 or more than the balance. If the token transfer fails, `on_recover` restores the balance and logs `recovery_completed {ok:false}`. Read that event, because the outer transaction still shows as "successful". | Emergency controls, "Recover funds", with a typed confirmation |
| `close_commitment` (accepted) | `{ "commitment_id": "<id>" }` | 30 Tgas (the same allowlist entry as the signer case; the judge used 60, and either is enough) | `"0"` | Owner only for accepted bills: releases the reservation | Bill drawer for an `accepted` bill, "Release reservation" |

Other owner methods (`set_engine`, `set_secrets`, `rotate_signers`, `reconcile_outflow`) stay CLI-only for now. They're rare, high-impact setup operations.

### Read-only viewers (no role, or not connected)

There are no actions. Every button above shows disabled with the reason. "Try anyway" (3.4) is offered only on the signer actions that work as a demo of the contract refusing (`approve_vendor_change` and `accept_commitment`). Never offer it on `recover`: the visitor gains nothing, and it reads like an attempt to take funds.

### Wallet action allowlist (paste)

```js
// One table drives buttons, wallet calls and labels. Nothing outside it is ever sent.
const TG = (n) => String(n) + "000000000000"; // Tgas -> gas units
const TREASURY_ACTIONS = {
  accept_commitment:     { who: "signer", gas: TG(30), deposit: "0", label: "accept a bill" },
  close_commitment:      { who: "signer|owner", gas: TG(30), deposit: "0", label: "close a bill" },
  approve_vendor_change: { who: "signer", gas: TG(30), deposit: "0", label: "approve a payout destination change" },
  reject_vendor_change:  { who: "signer", gas: TG(30), deposit: "0", label: "reject a payout destination change" },
  propose_policy:        { who: "signer", gas: TG(60), deposit: "0", label: "change the policy" },
  approve_policy:        { who: "signer", gas: TG(30), deposit: "0", label: "approve a policy version" },
  pause:                 { who: "owner",  gas: TG(60), deposit: "0", label: "pause the treasury" },
  unpause:               { who: "owner",  gas: TG(60), deposit: "0", label: "resume the treasury" },
  revoke_agent:          { who: "owner",  gas: TG(60), deposit: "0", label: "revoke the agent" },
  set_agent:             { who: "owner",  gas: TG(60), deposit: "0", label: "set the agent" },
  recover:               { who: "owner",  gas: TG(60), deposit: "1", label: "recover the treasury’s funds" },
};
```

Also add the missing labels (`reject_vendor_change`, `close_commitment`, `unpause`, `set_agent`, `approve_policy`) to the existing `METHOD` map in `web/index.html`, so the Activity feed can name these calls too.

---

## 3. UX

### 3.1 Where the button lives

- **Desktop sidebar.** Add a wallet block directly under the existing `.acctrow` (which shows the treasury account), above the nav. When disconnected it shows a secondary button "Connect wallet". When connected it shows the account in mono, a role badge, and a small menu: Copy account, Switch wallet, Disconnect.
- **Mobile top bar.** Put a compact button before `.envtags` with a wallet icon. It reads "Connect" when disconnected, and the role badge plus a short account name when connected. The **More** sheet repeats the full wallet block.
- Role badges: `Policy signer` (warn tone), `Owner` (accent), `Owner · Policy signer`, `Viewer` (neutral), `Takara agent` (bad tone, with "Don't use the agent key in a browser").

### 3.2 Working out the connected account's role

Use the data the app already loads. `/api/public` returns `owners`, `signers` and `agent` from `get_config`. Add `threshold` and `policy_expires_at` to that response (one line each in `publicLedger()` in `backend/server.mjs` and `platform/lib/core.mjs`).

```js
function walletRoles() {
  const a = WALLET.accountId, p = S.public.data, r = new Set();
  if (!a || !p) return r;
  if ((p.owners || []).includes(a)) r.add("owner");
  if ((p.signers || []).includes(a)) r.add("signer");
  if (p.agent && a === p.agent) r.add("agent");
  return r; // empty set = viewer
}
```

The role only decides what the UI enables. It's never an authorization check: the wallet tells the page the account id without proof. The contract checks `predecessor_account_id` on every call. Never use the role to decide whether to show sealed or owner data (see 4.6).

### 3.3 What each role sees

| Surface | Not connected | Viewer | Policy signer | Owner |
|---|---|---|---|---|
| Approvals card, frozen destination change | "Connect a wallet to approve" (secondary) | Primary disabled, "Only a policy signer can approve. You're connected as alice.testnet." Link button "Try anyway" | **Approve new destination** (primary) + **Reject change**. Approve requires ticking "I confirmed the new destination with the vendor through a known phone number or contact". | Same as viewer, unless also a signer |
| Approvals card, new vendor or over the limit | same | same | **Accept bill** + **Close bill** | viewer-like |
| Bill drawer, accepted bill | none | none | none (signers can't release) | **Release reservation** |
| Policy review dialog | "Connect a policy signer's wallet to sign" | Disabled button "Sign with wallet (policy signer only)" + "Try anyway" | **Sign with wallet** | viewer-like, unless also a signer |
| Emergency controls (Policy page) | Shown read-only: "Owner only (takara-ai-hq.testnet)" | same | same | **Pause / Resume**, **Revoke agent**, **Restore agent**, **Recover funds** |
| Status bar when paused | text only | text only | text only | adds a **Resume** button |

Text changes this requires (update `docs/ux/app-ux-spec.md` to match):

- Principle 23 ("The app never approves… no approve or reject button") becomes: "The app never approves on its own. A policy signer approves in their own wallet; the app only prepares the transaction, and the contract checks who signed."
- `howApproved` (signer case) becomes: "A policy signer approves this in their own wallet. Connect it above. The contract rejects anyone else with E_NOT_POLICY_SIGNER."
- Approvals description becomes: "Everything waiting, who it waits on, how long, and its deadline. A policy signer approves from their own wallet."
- The demo banner drops "Signing is off here". New text: "Hosted demo of a **fictional** treasury on NEAR testnet. Connect a testnet wallet to act. Only the treasury's signer and owner accounts can change anything; the contract refuses everyone else."

Statuses follow the Safe{Wallet} pattern the spec already cites: "Needs your approval" appears only when `walletRoles().has("signer")`. Otherwise keep "Awaiting signer".

### 3.4 Unauthorised accounts: "Try anyway"

Show this as a feature, because it proves the agent and strangers can't approve.

- Under the disabled primary button, a link-style button: **Try anyway as alice.testnet**. Tooltip: "Sends a real testnet transaction. The contract will refuse it. That's the point."
- On refusal, show an inline result in the card (not a red error):

  > **The contract refused.** `alice.testnet` isn't a policy signer (`E_NOT_POLICY_SIGNER`). Nothing changed. [View transaction]

- The refused transaction is public and costs the visitor a little testnet gas. Say so in the tooltip.
- The refusal already shows up correctly in the existing Activity mapping (`FAILS.E_NOT_POLICY_SIGNER`) once it's in the decisions feed (see 3.8).

Verified output for the refusal parser: the judge run's agent attempt, tx `9uNZxPp3BMYJFs9qAxt5kW75qLmCf6iYPG3MGr7is9Cy`, has RPC `tx` status `{"Failure":{"ActionError":{"index":0,"kind":{"FunctionCallError":{"ExecutionError":"Smart contract panicked: E_NOT_POLICY_SIGNER"}}}}}`.

### 3.5 Transaction states

Each card or dialog that sends a transaction moves through these states. Announce each one through the existing `#announce` live region.

| State | UI |
|---|---|
| `confirm` (in the app) | An inline summary inside the card, never a modal (see 3.7): "You're about to call **approve_vendor_change** (change 0) on `treasury.takara-ai-hq.testnet` as `signer.takara-ai-hq.testnet`. Gas 30 Tgas, no deposit. Your wallet will show the same." Buttons: [Continue in wallet] [Cancel] |
| `wallet` | Button reads "Confirm in your wallet…" with a spinner. Cancel isn't possible from here; the wallet owns this step. |
| `submitted` | "Sent. Waiting for finality…" plus the tx hash link as soon as it's known |
| `done` | Toast: "Approved. Cooling-off ends Nov 14, 18:00." plus [View transaction]. Reload `public`, `report` and `decisions`. |
| `refused` | Inline, neutral tone: "The contract refused: {plain reason} (`E_…`)." plus [View transaction] |
| `cancelled` | Inline, quiet tone: "You cancelled in the wallet. Nothing was sent." (near-connect rejects with `"User rejected"` when the chooser is closed, as seen in the prototype) |
| `error` | Inline, `role="alert"`: "Couldn't reach the wallet: {message}. Nothing was sent unless your wallet shows a transaction." plus [Try again] |

Each wallet reports results in its own shape. Some resolve with a `FinalExecutionOutcome` that contains a `Failure`, others throw. So after any outcome that includes a hash, re-check the transaction on chain (RPC `tx`, `wait_until: "FINAL"`) and show the chain's answer. Snippet in 6.3.

### 3.6 Wrong account, wrong network, missing account

- The connector is created with `network: "testnet"`, so only testnet-capable wallets are listed.
- After sign-in: if the account id ends in `.near`, or the wallet reports mainnet, show a banner: "That's a mainnet account. This treasury is on NEAR testnet." Every action stays disabled.
- Check that the account exists with RPC `view_account` on testnet. On `UNKNOWN_ACCOUNT`, say "This account doesn't exist on testnet yet."
- If the account equals `p.agent`, show a red warning: "This is the Takara agent's account. Its key belongs on the server, not in a browser wallet." Disable everything.

### 3.7 Modal dialogs block the wallet chooser (verified)

The policy review (`#pdlg`), the bill drawer (`#drawer`) and the More sheet (`#moresheet`) all open with `showModal()`. near-connect draws its chooser as an ordinary `position: fixed` element on `body`, which sits **under** the top layer and is inert. In the prototype, clicking at a wallet row's position with a modal open hit the `DIALOG`, not the row. With the dialog closed first, the same point hit the row (`SPAN.wallet-address`).

Rule: **close every open modal before calling `connector.connect()` or `wallet.signAndSendTransaction()`.** Show progress in the card or a toast instead, and reopen the dialog only to show an error that needs editing (the policy form). Concretely:

- Policy "Sign with wallet": verify the hashes (6.5) → `pdlg.close()` → toast "Confirm the policy change in your wallet…" → send → toast with the result.
- Drawer actions: `drawer.close()` → run the action → toast with "View bill" (`#/bills/<id>`) to reopen it.
- More-sheet "Connect wallet": `moreSheet.close()` first.

### 3.8 Redirects, returns and the activity feed

- None of the pinned wallets do a full-page redirect through near-connect. They use the sandbox iframe, an extension, a hardware device, the terminal, or a popup via `selector.open` (MyNearWallet, which is limited to `allowsOpen`). On boot, still read `location.search` for legacy return parameters (`transactionHashes`, `errorCode`, `errorMessage`, `account_id`, `all_keys`), handle them, then `history.replaceState` them away. The app routes on `location.hash` (`#/approvals`), so the search string doesn't affect routing.
- Before opening the wallet, save `{ method, args, at }` in `sessionStorage` under `takara.pendingTx`. After a reload, if there's a pending entry and no result, say "A wallet request from this tab didn't report back. Check your wallet's activity." Clear the entry on any final state.
- Popup blockers: an executor that calls `selector.open` does so after the iframe's async start-up. Test that MyNearWallet's popup isn't blocked when opened from a click. If it is, near-connect's sandbox UI shows its own button, which counts as a fresh user gesture.
- The Activity feed is built from `decisions.jsonl` (written by the scripts), so wallet transactions won't show there by themselves. The live views (`public`, `report`) do update, because they read the chain.
  - Locally: add `POST /api/decisions/record { tx, signer }`. The server fetches that transaction itself over RPC, checks that `receiver_id` is the treasury, and appends the record. It never takes the outcome from the client.
  - Hosted: keep a session-only list of the visitor's own wallet transactions in memory and merge it into Activity, labelled "From your wallet, this session".

### 3.9 Copy for the connect states (sidebar block)

- Disconnected: "Connect wallet". Helper text under it: "Signers and owners sign here, in their own wallet."
- Connecting: "Choose a wallet…"
- Connected as signer: account, then "Policy signer · can approve bills and policy changes"
- Connected as viewer: account, then "Viewer · can look, can't change anything"
- Library failed to load (CDN blocked): "Wallets unavailable. Signers can still use the NEAR CLI." The rest of the app is unaffected: the wallet module is optional, and `window.TW` simply never appears.

---

## 4. Security

### 4.1 The hosted demo never holds keys

- Signing happens only in the user's wallet. No private key, seed phrase or access key is typed into, stored in, or sent through the page or the Vercel functions.
- The page never offers "import key", "paste seed phrase", or anything like it.
- `/api/policy/sign` stays the existing 403 stub on Vercel. Policy signing moves to the wallet path, which needs no server endpoint that signs.
- Server endpoints stay read-only views plus `policy/diff`, which seals a candidate policy (see 4.7).
- Hardcode `TREASURY = "treasury.takara-ai-hq.testnet"` in the page and check that it equals `S.public.data.treasury` before sending. A changed API response must not be able to redirect `receiverId`.

### 4.2 Access keys: don't add a function-call key

- near-connect signs in without adding a key (`signInWithoutAddKey`). **Don't pass `signIn` / `addFunctionCallKey`.** The option is deprecated in 0.12.0 anyway. Every action then needs an explicit confirmation in the wallet, with the wallet's own full-access or Ledger key.
- Why that matters here:
  1. A human signature on each approval is the whole defence against business email compromise. A function-call key in browser storage could be used by any XSS to call `approve_vendor_change` silently.
  2. NEAR function-call keys can't attach a deposit. `recover` (1 yoctoNEAR) would need wallet confirmation regardless, which follows the NEP-141 convention.
- **If a wallet insists on a contract at sign-in** (legacy wallet-selector style `contractId`), use `contractId: "treasury.takara-ai-hq.testnet"` and `methodNames: ["get_config"]`. That key can only call a view method as a transaction: no state change, just gas from its 0.25 NEAR allowance. **Never use an empty `methodNames`.** On NEAR, empty means every method on that contract, which would let the key silently call every non-payable signer and owner method. The app never signs with such a key; it always calls `signAndSendTransaction` through the wallet.

### 4.3 CDN, SRI and CSP

- **Pin exact versions** (`@0.12.0`, commit SHAs in the manifest). Never `@latest` or branch URLs, except the two listed exceptions (Meteor, Intear).
- **SRI.** jsDelivr's `+esm` file is generated, and its header says not to use SRI with it (it can be rebuilt). The package itself is CommonJS (`"type": "commonjs"`), so there's no raw ESM file to hash. Two options:
  - Hackathon: use the jsDelivr URL, protected by the pin. The bundle's sha384 on 2026-11-13 was `sha384-f3y9zSYOtg1HHwq/4/hbu8xZ//yn5j2mt8zREsCiLSbSnDHqEPwHEesM83PKy8Lj`, recorded here so a later change can be detected.
  - Before any mainnet use: **vendor the file** as `web/vendor/near-connect-0.12.0.mjs` and `platform/app/vendor/near-connect-0.12.0.mjs`, serve it from the same origin (add a route in `backend/server.mjs`), and check its sha384 in CI. With the file on our own origin, `script-src` no longer needs the CDN host.
- **CSP.** The app is one static file with an inline classic `<script>`. near-connect injects each executor into a `srcdoc` iframe as inline `<script>` tags, and **`srcdoc` iframes inherit the parent page's CSP**. Without per-request nonces (not possible on a static Vercel file), `script-src` needs `'unsafe-inline'`. So CSP here mainly limits *where data can go and what can embed the page*, not inline script. Proposed header for `platform/vercel.json` (route `/app`):

  ```
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  connect-src 'self' https://rpc.testnet.fastnear.com https://cdn.jsdelivr.net https://raw.githubusercontent.com https://wallet.intear.tech https://testnet.nearblocks.io;
  frame-src 'self';
  frame-ancestors 'none';
  object-src 'none';
  base-uri 'none';
  form-action 'none'
  ```

  The prototype ran under this policy (as a `<meta>` tag, minus `frame-ancestors`, which only works as a header): the module loaded, `get_config` was read, and the chooser opened and listed all six wallets with no console violations. **Wallet sign-in under this CSP was not tested.** Because executors inherit `connect-src`, each wallet's own network calls must be allowed. For example, the MyNearWallet executor names `rpc.testnet.near.org` and `helper.testnet.near.org`. Ship it first as `Content-Security-Policy-Report-Only`, sign in with each of the six wallets, add the hosts they actually need, then enforce. Keep the existing `X-Frame-Options: DENY`.
- **Library hardening** (both verified to load in the prototype):
  - The library registers any "debug wallets" it finds in `localStorage["debug-wallets"]`. Pass a `storage` wrapper that ignores that key, so a one-time XSS can't plant a permanent fake wallet.
  - The library accepts `postMessage({type:"near-wallet-injected"})` from any window without checking origin (and would add it as a `ParentFrameWallet`). Add a capture-phase listener that drops such messages unless `e.source === window`. Testing this against a real message from another window wasn't possible; the filter is defensive.

### 4.4 Phishing

- The wallet shows `receiverId` (`treasury.takara-ai-hq.testnet`), the method name and the args. The app's confirm step shows exactly the same three things, so the user can match them.
- The official app hosts are `https://takara-ai.vercel.app/app` and `http://localhost:8787`. List them in the README.
- Testnet tokens are worthless, but the same patterns carry to mainnet. Never request a seed phrase. Never add keys. Recommend a hardware wallet (Ledger is in the list) for the signer account.
- Vendor destination approval is the action phishers target. The required "I confirmed the new destination out of band" checkbox and the existing cooling-off period are the countermeasures. The page shows both destinations side by side, which the existing `compareBoxes` already does.

### 4.5 Wrong network

- Set `network: "testnet"` on the connector, and the RPC to `https://rpc.testnet.fastnear.com` (the same default as the backend).
- Every action stays disabled unless the account is a `.testnet` account (or a 64-hex implicit account) that exists on testnet.
- `receiverId` is the hardcoded testnet treasury. A mainnet build must use a separate constant set (`NETWORK`, `TREASURY`, `RPC`) and a separate manifest filter, never something switched at runtime.

### 4.6 Spoofed identity

The account id near-connect reports comes from the wallet's executor and isn't proven. A malicious executor could claim to be `signer.takara-ai-hq.testnet`. All it would gain is enabled buttons whose transactions it would then have to sign as that account, and it can't. So the role is cosmetic, and that's acceptable. **If a server ever gates data on the connected account** (for example "owners see sealed details"), require NEP-413: `connector.connect({ signMessageParams: { message, recipient, nonce } })`. Verify the signature on the server against one of the account's full-access keys (`view_access_key_list`), with a single-use nonce.

### 4.7 The policy proposal flow and what it trusts

The flow: `POST /api/policy/diff` → the server builds the next policy plaintext, seals it with the ledger key (on the hosted copy, the **fixture** key in `TAKARA_ENGINE_SK`; locally, the owner's key), and returns the diff, the plaintext, the hash and the sealed blob → the browser checks what it can → the wallet signs `propose_policy`.

What the browser can and can't check (snippet in 6.5):

| Field | Checkable in the browser? | If the server lied |
|---|---|---|
| `hash` | **Yes.** The engine defines the policy hash as `sha256(plaintext bytes)` (`engine/src/engine.rs`, `seal_policy_local`), so check `sha256(next_pt) === hash`. | Caught before signing |
| what changed | **Yes.** Compare `JSON.parse(next_pt)` with the current policy fields the page shows; only the edited controls and `version` may differ. | Caught before signing |
| `diff_hash` | **Yes.** `sha256(JSON.stringify(diff))`, the same formula as `backend/server.mjs` | Caught before signing |
| `version` | **Yes.** It must equal `public.policy.version + 1` | Caught before signing |
| `expires_at` | Range check: between now + 1 day and now + 400 days (the server uses 365 days) | Caught before signing |
| `sealed` | **No.** Opening it needs the ledger key. | Fails safe: the engine checks `sha256(opened) == policy_hash` and refuses with `policy_hash_mismatch` (`engine/src/engine.rs` line 175). The worst case is a policy that stops all agent payments until a signer applies a correct version. It can't apply a policy other than the one whose hash the signer signed. |

What you're trusting:

- The server sees the plaintext and holds the sealing key. On the hosted demo that's fictional fixture data and already disclosed. A real business would only ever run `policy/diff` on its own machine (local dashboard); the hosted copy is a demo.
- Returning `next_pt` from the hosted endpoint exposes the fixture's whole policy bundle (vendor registry, roster). That's acceptable for fictional data, and it's already visible through the owner report. In a production build, only the owner's local server returns `next_pt`.
- `sealed` can be up to 24 KiB of transaction args. Wallets show it as an opaque string, and Ledger may call it blind signing. The page's diff table plus the hash check is what the signer actually reviews.
- The proposal's storage (up to ~24 KiB) is paid from the treasury account's balance, not by the signer. Only signers can propose, so spam isn't a concern.

---

## 5. Prototype: what was tested and what happened

Files (scratchpad, not in the repo):
- `C:\Users\Admin\AppData\Local\Temp\claude\a30c1ce7346a809f\fff47e11-6cfd-4037-8282-3e2fdab4e5a3\scratchpad\wallet-proto\index.html`: the page
- `C:\Users\Admin\AppData\Local\Temp\claude\a30c1ce7346a809f\fff47e11-6cfd-4037-8282-3e2fdab4e5a3\scratchpad\wallet-proto\csp.html`: an earlier copy of the page plus the CSP `<meta>` (made before the dialog test and the hardening listeners were added)
- `C:\Users\Admin\AppData\Local\Temp\claude\a30c1ce7346a809f\fff47e11-6cfd-4037-8282-3e2fdab4e5a3\scratchpad\tools\serve.mjs`: a 127.0.0.1 static server

It was served at `http://127.0.0.1:5178/` and driven in the Browser pane.

| Check | Result |
|---|---|
| Load `@hot-labs/near-connect@0.12.0` from `cdn.jsdelivr.net/npm/…/+esm` in a `<script type="module">` with no bundler | Worked, no console errors |
| `new NearConnector({ network: "testnet", manifest: <pinned>, features: { signAndSendTransaction: true }, providers: { testnet: [fastnear] }, autoConnect: false, footerBranding: null, storage })` | Worked. `availableWallets`: meteor-wallet, intear-wallet, mynearwallet, nightly-wallet, ledger, near-cli |
| Browser view call `get_config` on `treasury.takara-ai-hq.testnet` (FastNEAR RPC sends `Access-Control-Allow-Origin: *`) | owners `[takara-ai-hq.testnet]`, signers `[signer.takara-ai-hq.testnet]`, threshold 1, agent `agent.takara-ai-hq.testnet`, not paused, policy v1 |
| Click "Connect wallet" → `connector.connect()` | The "Select wallet" chooser opened (a bottom sheet at phone width) listing Meteor, Intear, MyNearWallet, Nightly, Ledger and NEAR CLI with icons and domains |
| Close the chooser (Escape) | `connect()` rejected with `"User rejected"`, which maps to the `cancelled` state |
| Same page with the proposed CSP as `<meta>` | Chooser opened and listed all six. No CSP violations logged. Executors weren't loaded, because no wallet was picked. |
| `connect()` while a `showModal()` dialog is open | The chooser renders but **can't be used**: the point over a wallet row hits the `DIALOG`. If the dialog is closed first, the row is clickable. This is why 3.7 exists. |
| `storage` wrapper and the `postMessage` filter | Loaded and listed wallets normally (cross-window injection not exercised) |
| Picking a wallet, signing in, signing, sending | **Not done, on purpose.** No wallet was selected, nothing was signed, nothing was sent. The prototype has no send button; it only prints the `approve_vendor_change` payload it *would* send. |

Not verified, for the implementer to test with real wallets on testnet:
- sign-in, `signAndSendTransaction` and result shapes for each of the six wallets
- MyNearWallet testnet through the patched manifest
- popup-blocker behaviour
- the enforced CSP during sign-in

### Signing as the repo's current signer without moving its key

The signer key now sits in the NEAR CLI legacy keychain. The **NEAR CLI** wallet in the chooser keeps it there. The page shows a `near … as-transaction …` command, you run it in your terminal, then paste the transaction hash back into the page. The executor writes the command with `sign-with-keychain` (or `sign-with-ledger`). This repo's keys are in the legacy keychain, so change that part to `sign-with-legacy-keychain` before running it, or import the key into the newer keychain once. That way the hosted site gets real signer transactions with the key never leaving the operator's machine.

---

## 6. Implementation guide (paste-ready)

Files to touch:
- `web/index.html`, then copy to `platform/app/index.html` (the two are identical today)
- `platform/lib/core.mjs`
- `backend/server.mjs`
- `platform/vercel.json`
- `docs/ux/app-ux-spec.md` (text)
- README (official hosts, how to connect)

### 6.1 Wallet module (`web/index.html`, after the existing classic `<script>`)

The classic script stays as it is. The module loads after it (module scripts are deferred), exposes `window.TW`, and announces changes with a `takara:wallet` event. If the CDN is blocked, the module never runs and the app works read-only exactly as it does today.

```html
<script type="module">
import { NearConnector } from "https://cdn.jsdelivr.net/npm/@hot-labs/near-connect@0.12.0/+esm";

const NETWORK = "testnet";
const RPC = "https://rpc.testnet.fastnear.com";
const TREASURY = "treasury.takara-ai-hq.testnet";
const WALLET_MANIFEST = /* Appendix A */ { version: "takara-1", wallets: [] };

// Drop "near-wallet-injected" messages from other windows (the library doesn't check origin).
window.addEventListener("message", (e) => {
  if (e.data && e.data.type === "near-wallet-injected" && e.source !== window) e.stopImmediatePropagation();
}, true);

// localStorage, minus the library's persistent "debug-wallets" hook.
const storage = {
  async get(k) { if (k === "debug-wallets") return null; try { return localStorage.getItem(k); } catch { return null; } },
  async set(k, v) { if (k === "debug-wallets") return; try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
  async remove(k) { try { localStorage.removeItem(k); } catch { /* storage blocked */ } },
};

const connector = new NearConnector({
  network: NETWORK,
  manifest: WALLET_MANIFEST,
  features: { signAndSendTransaction: true },
  providers: { testnet: [RPC] },
  autoConnect: false,
  footerBranding: null,
  storage,
});

const state = { status: "loading", accountId: null, walletName: null };
const emit = () => window.dispatchEvent(new CustomEvent("takara:wallet", { detail: { ...state } }));
const setAccount = (accountId, walletName) => { Object.assign(state, { status: accountId ? "connected" : "ready", accountId: accountId || null, walletName: walletName || null }); emit(); };

connector.on("wallet:signIn", async (e) => {
  const w = await connector.wallet().catch(() => null);
  setAccount(e.accounts[0] && e.accounts[0].accountId, w && w.manifest && w.manifest.name);
});
connector.on("wallet:signOut", () => setAccount(null));

async function rpc(method, params) {
  const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = await r.json();
  if (j.error) throw Object.assign(new Error(j.error.cause ? j.error.cause.name : j.error.message), { rpc: j.error });
  return j.result;
}

window.TW = {
  state,
  TREASURY,
  async connect() { return connector.connect(); },            // rejects with "User rejected" when closed
  async disconnect() { return connector.disconnect(); },
  async accountExists(id) { try { await rpc("query", { request_type: "view_account", finality: "final", account_id: id }); return true; } catch (e) { if (/UNKNOWN_ACCOUNT/.test(e.message)) return false; throw e; } },
  async call(method, args, spec) {                            // spec comes from TREASURY_ACTIONS, never from the server
    const wallet = await connector.wallet();
    const signerId = state.accountId;
    let outcome = null, thrown = null;
    try {
      outcome = await wallet.signAndSendTransaction({
        signerId, receiverId: TREASURY,
        actions: [{ type: "FunctionCall", params: { methodName: method, args, gas: spec.gas, deposit: spec.deposit } }],
      });
    } catch (e) { thrown = e; }
    return settle(outcome, thrown, signerId);
  },
  rpc,
};

/* 6.3 settle() goes here */

connector.getConnectedWallet()
  .then(({ wallet, accounts }) => setAccount(accounts[0] && accounts[0].accountId, wallet.manifest && wallet.manifest.name))
  .catch(() => setAccount(null));
</script>
```

### 6.2 Classic-script glue

```js
let WALLET = { status: "absent", accountId: null };     // "absent" = module not loaded (CDN blocked)
window.addEventListener("takara:wallet", (e) => {
  WALLET = e.detail;
  paintWallet();                    // sidebar block, top-bar button, More sheet
  if (cur) renderView(cur);         // re-render cards so their buttons reflect the role
});

async function connectWallet() {
  for (const d of [pdlg, drawer, moreSheet]) if (d.open) d.close();   // 3.7
  try { await window.TW.connect(); }
  catch (e) { if (!/reject/i.test(String(e && e.message))) toast(`Couldn’t connect: ${e.message}`); }
}
```

Sidebar block (inside `paintAcct()`, below the treasury row):

```js
function walletBlock() {
  if (!window.TW) return h`<p class="sm muted">Wallets unavailable. Signers can still use the NEAR CLI.</p>`;
  if (!WALLET.accountId) return h`<button class="btn btn-secondary" type="button" data-act="wallet-connect">Connect wallet</button><p class="sm muted">Signers and owners sign here, in their own wallet.</p>`;
  const r = walletRoles();
  const label = r.has("agent") ? "Takara agent" : r.has("owner") && r.has("signer") ? "Owner · Policy signer" : r.has("owner") ? "Owner" : r.has("signer") ? "Policy signer" : "Viewer";
  return h`<div class="wal"><span class="mono" translate="no" title="${WALLET.accountId}">${short(WALLET.accountId)}</span>${copyBtn(WALLET.accountId, "connected account")}
    <span class="tag">${label}</span><button class="btn btn-ghost" type="button" data-act="wallet-disconnect">Disconnect</button></div>`;
}
```

### 6.3 Normalising the result

```js
const PANIC = /Smart contract panicked: ([A-Z0-9_]+)|\b(E_[A-Z_]+)\b|Method new is private/;
const B58 = /\b[1-9A-HJ-NP-Za-km-z]{43,44}\b/;

function failureOf(outcome) {
  const all = [outcome && outcome.status, ...((outcome && outcome.receipts_outcome) || []).map((r) => r.outcome && r.outcome.status)];
  const f = all.find((s) => s && s.Failure);
  return f ? JSON.stringify(f.Failure) : null;
}
function codeOf(s) { const m = String(s || "").match(PANIC); return m ? (m[1] || m[2] || "PRIVATE_NEW") : null; }

async function settle(outcome, thrown, signerId) {
  if (thrown) {
    const msg = String((thrown && (thrown.message || thrown)) || "");
    const hash = (msg.match(B58) || [])[0] || null;
    const code = codeOf(msg);
    if (!hash && !code && /reject|cancel|closed|denied/i.test(msg)) return { kind: "cancelled" };
    if (!hash) return code ? { kind: "refused", code, hash: null } : { kind: "error", message: msg };
    outcome = { transaction: { hash } };                       // fall through to the chain check
  }
  const hash = outcome && outcome.transaction && outcome.transaction.hash;
  if (!hash) return { kind: "error", message: "The wallet returned no transaction." };
  // The chain is the source of truth, whatever shape the wallet returned.
  let tx;
  try { tx = await window.TW.rpc("tx", { tx_hash: hash, sender_account_id: signerId, wait_until: "FINAL" }); }
  catch (e) { return { kind: "submitted", hash, note: "Sent, but finality couldn’t be confirmed yet." }; }
  const failure = failureOf(tx);
  if (failure) return { kind: "refused", code: codeOf(failure) || "TX_FAILED", hash, raw: failure };
  const logs = tx.receipts_outcome.flatMap((r) => r.outcome.logs || []);
  const events = logs.filter((l) => l.startsWith("EVENT_JSON:")).map((l) => { try { return JSON.parse(l.slice(11)); } catch { return null; } }).filter(Boolean);
  const recovery = events.find((e) => e.event === "recovery_completed");
  if (recovery && recovery.data && recovery.data[0] && recovery.data[0].ok === false) return { kind: "refused", code: "RECOVERY_REVERTED", hash };
  const sv = tx.status && tx.status.SuccessValue;
  let value = null; try { value = sv ? JSON.parse(atob(sv)) : null; } catch { /* not JSON */ }
  return { kind: "done", hash, value, events };
}
```

Plain-language reasons (reuse the existing `FAILS` map for the Activity feed). For the inline result:

```js
const REFUSAL_TEXT = {
  E_NOT_POLICY_SIGNER: (a) => `${a} isn’t a policy signer`,
  E_NOT_OWNER: (a) => `${a} isn’t an owner`,
  E_INVALID_TRANSITION: () => "this item already moved on (refresh to see its current state)",
  E_NOT_FOUND: () => "this item no longer exists on the treasury",
  E_ALREADY_APPROVED: () => "you already approved this",
  E_INVALID_ARGUMENT: () => "the contract rejected the values",
  E_INSUFFICIENT_BALANCE: () => "the treasury doesn’t hold that much",
  E_REQUIRES_ONE_YOCTO: () => "this call needs exactly 1 yoctoNEAR attached",
  RECOVERY_REVERTED: () => "the token transfer failed, so the funds stayed in the treasury",
};
```

### 6.4 Approval card buttons

`approvalCard(b, m)` gets an action row, built from the table, with an honest disabled state:

```js
function signerActs(b) {
  if (b.c.vendor_change === "suspended_destination_mismatch" && b.change)
    return [["approve_vendor_change", { change_id: String(b.change.id) }, "Approve new destination", "primary"],
            ["reject_vendor_change",  { change_id: String(b.change.id) }, "Reject change", "secondary"]];
  if (b.state === "claimed" && b.waitsOn && b.waitsOn.who === "signer")
    return [["accept_commitment", { commitment_id: b.sid }, "Accept bill", "primary"],
            ["close_commitment",  { commitment_id: b.sid }, "Close bill", "secondary"]];
  return [];
}
function cardActions(b) {
  const acts = signerActs(b); if (!acts.length) return "";
  if (!window.TW) return "";
  if (!WALLET.accountId) return h`<div class="ac-wal"><button class="btn btn-secondary" type="button" data-act="wallet-connect">Connect a wallet to approve</button></div>`;
  const isSigner = walletRoles().has("signer");
  const btn = ([method, args, text, tone]) => h`<button class="btn btn-${tone}" type="button" data-act="wallet-call" data-method="${method}" data-args="${JSON.stringify(args)}" data-sid="${b.sid}"${isSigner ? "" : raw(" disabled")}>${text}</button>`;
  return h`<div class="ac-wal" data-wal="${b.sid}">
    ${b.proposed && isSigner ? h`<label class="chk"><input type="checkbox" data-oob="${b.sid}"> I confirmed the new destination with the vendor through a known contact</label>` : ""}
    <div class="row">${acts.map(btn)}</div>
    ${isSigner ? "" : h`<p class="sm muted">Only a policy signer can do this. You’re connected as ${acct(WALLET.accountId)}. <button class="linkbtn" type="button" data-act="wallet-call" data-try="1" data-method="${acts[0][0]}" data-args="${JSON.stringify(acts[0][1])}" data-sid="${b.sid}">Try anyway</button></p>`}
    <p class="wal-res" role="status" data-res="${b.sid}"></p></div>`;
}
```

Click handler (add to the existing delegated `click` listener):

```js
else if (act === "wallet-connect") connectWallet();
else if (act === "wallet-disconnect") window.TW && window.TW.disconnect();
else if (act === "wallet-call") walletCall(t);

async function walletCall(t) {
  const method = t.dataset.method, spec = TREASURY_ACTIONS[method];
  if (!spec || !window.TW || !WALLET.accountId) return;                       // allowlist only
  if (S.public.data && S.public.data.treasury !== window.TW.TREASURY) return toast("Treasury mismatch. Not sending.");
  if (method === "approve_vendor_change" && !t.dataset.try) {
    const box = $(`[data-oob="${t.dataset.sid}"]`); if (box && !box.checked) { box.focus(); return toast("Confirm the new destination with the vendor first."); }
  }
  const args = JSON.parse(t.dataset.args);
  for (const d of [pdlg, drawer, moreSheet]) if (d.open) d.close();
  const out = $(`[data-res="${t.dataset.sid}"]`);
  const say = (s) => { if (out) out.textContent = s; announce(s); };
  try { sessionStorage.setItem("takara.pendingTx", JSON.stringify({ method, args, at: Date.now() })); } catch { /* storage blocked */ }
  t.disabled = true; say("Confirm in your wallet…");
  const r = await window.TW.call(method, args, spec);
  try { sessionStorage.removeItem("takara.pendingTx"); } catch { /* storage blocked */ }
  t.disabled = false;
  if (r.kind === "done") { toast(`Done: ${spec.label}.`, { href: `https://testnet.nearblocks.io/txns/${r.hash}`, text: "View transaction" }); load("public"); load("report"); load("decisions"); }
  else if (r.kind === "refused") say(`The contract refused: ${(REFUSAL_TEXT[r.code] || (() => humanCode(r.code)))(WALLET.accountId)} (${r.code}). Nothing changed.`);
  else if (r.kind === "cancelled") say("You cancelled in the wallet. Nothing was sent.");
  else if (r.kind === "submitted") say("Sent. Waiting for finality. Refresh in a moment.");
  else say(`Couldn’t reach the wallet: ${r.message}. Nothing was sent unless your wallet shows a transaction.`);
}
```

(`data-args` is escaped by the existing `h` template, so the JSON survives the attribute round trip.)

### 6.5 Policy: server returns the proposal, browser checks it, wallet signs

`platform/lib/core.mjs`, inside `policyDiff` (it already has `randomBytes`. Add `import { createHash } from "node:crypto"`, or extend the existing import):

```js
  diff.version = { from: policy.version, to: next.version };
  const nextPt = JSON.stringify(next);
  const sealed = await runEngine({ v: 1, op: "seal_policy_local", pt: nextPt, eph: randomBytes(32).toString("hex"), sk: ownerKey() });
  const changed = Object.keys(diff).length > 1;
  return {
    diff, next_hash: sealed.hash, signer: D.accounts.signer, current_hash: cfg.policy_hash, hosted_demo: true,
    next_pt: nextPt,                                    // fixture data only; a production build returns this locally only
    propose: changed ? {
      version: diff.version.to,
      hash: sealed.hash,
      expires_at: String(BigInt(Date.now() + 365 * 86400_000) * 1_000_000n),
      sealed: sealed.sealed,
      diff_hash: createHash("sha256").update(JSON.stringify(diff)).digest("hex"),
    } : null,
  };
```

`backend/server.mjs`:

1. In the `/api/policy/diff` route, stop deleting `sealed` and `next_pt`. Return the same `propose` object as above (the local handler already computes `diffHash` in `policySign`; move that into `policyDiff`).
2. Make `currentPolicy()` work after a policy was signed elsewhere. At the moment it throws "local policy copy does not match" once a wallet has applied a new version, because `.secrets/policy.plain.json` is out of date. Fall back to the on-chain sealed policy and repair the local copy:

```js
async function currentPolicy() {
  const cfg = await view(K.T, "get_config");
  const sha = (s) => createHash("sha256").update(s).digest("hex");   // the policy hash is sha256(plaintext) (engine seal_policy_local)
  let pt = existsSync(POLICY_PLAIN) ? readFileSync(POLICY_PLAIN, "utf8") : null;
  if (!pt || sha(pt) !== cfg.policy_hash) {
    const opened = await K.openSealed((await view(K.T, "get_policy")).sealed);   // owner's ledger key, local only
    const candidate = opened && JSON.stringify(opened);
    if (!candidate || sha(candidate) !== cfg.policy_hash) throw new Error("could not reconstruct the on-chain policy");
    pt = candidate; writeFileSync(POLICY_PLAIN, pt);
  }
  return { pt, policy: JSON.parse(pt), cfg };
}
```

(The `sha` check replaces the current engine round trip used only to compute the hash. `JSON.stringify(JSON.parse(pt))` round-trips the compact form `policyDiff` writes. The hash check proves it.)

Browser checks before the wallet opens:

```js
const sha256hex = async (s) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, "0")).join("");

async function verifyProposal(d, edits) {
  const p = d.propose; if (!p) throw new Error("nothing to sign");
  if (await sha256hex(d.next_pt) !== p.hash) throw new Error("the policy hash doesn’t match the policy text");
  if (await sha256hex(JSON.stringify(d.diff)) !== p.diff_hash) throw new Error("the diff hash doesn’t match the diff");
  const pub = S.public.data;
  if (!pub || p.version !== pub.policy.version + 1) throw new Error("unexpected policy version");
  const next = JSON.parse(d.next_pt);
  if (next.version !== p.version) throw new Error("policy text has the wrong version");
  for (const k of ["max_auto_pay", "cooling_off_hours", "min_runway_days"]) {
    const want = d.diff[k] ? d.diff[k].to : undefined;
    if (want !== undefined && String(next[k]) !== String(want)) throw new Error(`policy text disagrees with the diff on ${k}`);
  }
  const ms = Number(BigInt(p.expires_at) / 1_000_000n), now = Date.now();
  if (ms < now + 86400_000 || ms > now + 400 * 86400_000) throw new Error("unexpected expiry");
  return { version: p.version, hash: p.hash, expires_at: p.expires_at, sealed: p.sealed, diff_hash: p.diff_hash };
}
```

`/api/policy/current` exposes only the three controls, so the browser can check those fields and `version` but not the rest of the bundle (vendor registry, roster). The table in 4.7 lists what's left on trust. If that gap matters, have `/api/policy/current` also return the current plaintext and compare every field. Then:

```js
async function signPolicyWithWallet() {
  let args;
  try { args = await verifyProposal(pending.d); }
  catch (e) { return paintPolicyDialog(pending.d, { error: e.message }); }
  pdlg.close();                                        // 3.7: the wallet can't be used under a modal
  toast("Confirm the policy change in your wallet…");
  const r = await window.TW.call("propose_policy", args, TREASURY_ACTIONS.propose_policy);
  if (r.kind === "done") {
    PF.edits = null;
    toast(S.public.data.threshold > 1 ? `Proposal ${r.value} created: 1 of ${S.public.data.threshold} approvals.` : `Policy v${args.version} signed and live.`, { href: `https://testnet.nearblocks.io/txns/${r.hash}`, text: "View transaction" });
    load("policy"); load("public"); load("report");
  } else if (r.kind === "refused") { pdlg.showModal(); paintPolicyDialog(pending.d, { error: `the contract refused: ${(REFUSAL_TEXT[r.code] || (() => r.code))(WALLET.accountId)}` }); }
  else if (r.kind !== "cancelled") { pdlg.showModal(); paintPolicyDialog(pending.d, { error: r.message || "not confirmed" }); }
}
```

The `paintPolicyDialog` footer becomes (both hosted and local):
- Not connected: [Close] [Connect a signer’s wallet]. The connect button closes the dialog first.
- Signer: [Cancel] **[Sign with wallet]**. Locally, keep the existing "Sign with local keychain" as a secondary button, for operators without a wallet.
- Viewer: [Close] [Sign with wallet] disabled, with "Policy signer only (signer.takara-ai-hq.testnet)", plus a "Try anyway" link.
- The step indicator stays "1 Proposed → 2 Signed by a policy signer → 3 Live". With threshold > 1, step 2 reads "Signed by 1 of N signers".

Threshold > 1 (not the case today): the contract has `get_proposal(id)` but no list method. Have `/api/public` probe `get_proposal(0…)` until it returns `null` (cap 50) and return the pending, unapplied ones. A future contract change could add `list_proposals`.

### 6.6 Owner emergency controls (Policy page)

A panel "Emergency controls" under "Who can change this". Every button is gated on `walletRoles().has("owner")`. Pause, Resume and Revoke get the inline confirm step. **Recover funds** has two fields: amount in tUSDC, converted to base units with `BigInt(Math.round(x * 1e6))` (as a string), and `to`, defaulting to the owner account. Recover also asks the owner to type the amount again. On `RECOVERY_REVERTED`, show "The token transfer failed (is the recipient registered with the token?). The funds stayed in the treasury." Restore agent warns: "After changing the agent, re-run setup to re-bind the engine secret, or the agent's requests will fail."

---

## 7. Order of work

1. Server: add the `propose` and `next_pt` fields to `policyDiff` (both servers), the `currentPolicy()` fallback, and `threshold`/`policy_expires_at` in `/api/public`. *(Small, unblocks everything.)*
2. Wallet module + sidebar/top-bar/More-sheet block + role badge (6.1, 6.2), using the Appendix A manifest.
3. Approval card and drawer actions with the honest disabled state and "Try anyway" (6.4).
4. Policy dialog wallet signing with browser-side checks (6.5).
5. Emergency controls (6.6).
6. `vercel.json` CSP as Report-Only; manually sign in with each wallet; widen `connect-src`; enforce.
7. Update the UX spec and README text. Copy `web/index.html` to `platform/app/index.html` and deploy.
8. Manual test matrix on testnet:
   - signer (Meteor or the NEAR CLI wallet with the legacy keychain) approves a real frozen change
   - viewer "Try anyway" → `E_NOT_POLICY_SIGNER` shown inline
   - owner pause/resume
   - recover 1 tUSDC
   - cancel in the wallet
   - mainnet account rejected
   - CDN blocked → app stays read-only

---

## Wallet shortlist (2026-11-13)

**Question.** Which wallets in the pinned manifest can sign in and sign a function call on NEAR **testnet** through `@hot-labs/near-connect@0.12.0`, and which suit someone recording a browser demo?

**How it was checked.**
- *Library.* `NearConnector` hides any wallet without `features.testnet` when `network` is `"testnet"`, then passes `network` to the wallet's sign-in. Source: [`build/NearConnector.js`](https://unpkg.com/@hot-labs/near-connect@0.12.0/build/NearConnector.js), the `this.network === "testnet" && !wallet.manifest.features?.testnet` filter.
- *Executors.* Each pinned executor file was read for its testnet code path. The upstream manifest at the pinned commit [`b8207d0`](https://raw.githubusercontent.com/hot-dao/near-selector/b8207d0b303914f264c50be5ac849d5fe028f069/repository/manifest.json) matches the current `main` for all six wallets.
- *Wallet sources.* Each wallet's own repository or docs.
- *In the app.* The local app (`http://localhost:8787`) was opened in the in-app browser. For each wallet: Connect wallet, then Choose wallet, then pick it. No sign-in was attempted and no credentials were entered. The browser pane blocks popups that an automated click opens, so where a wallet tried to open a window, the window's address is the evidence. Screenshots are in the scratchpad `predemo` folder (`wallet-0*.jpg`).

| Wallet | Testnet sign-in and function call | Evidence (primary source, plus what the app showed) | Demo fit | Decision |
|---|---|---|---|---|
| **Meteor** | Yes | Executor ([`meteor-near-connect-latest.js`](https://raw.githubusercontent.com/Meteor-Wallet/meteor_wallet_sdk/data-storage/storage/meteor-near-connect-latest.js)) routes testnet to `https://wallet.meteorwallet.app/connect/testnet`, and its testnet RPC is `test.rpc.fastnear.com`. The upstream manifest marks `testnet: true`, so no patch is needed. In the app, the "Meteor Connect" panel loaded with a Meteor Web button and a mobile QR code, and no console errors. | Web wallet, extension or phone. Nothing to install for the web flow. | **Keep: recommended default** (first in the list) |
| **MyNearWallet** | Yes, with our manifest patch | Executor ([`mnw.js` @ b8207d0](https://cdn.jsdelivr.net/gh/hot-dao/near-selector@b8207d0b303914f264c50be5ac849d5fe028f069/repository/mnw.js)) has `testnet: new MyNearWalletConnector("https://testnet.mynearwallet.com", {networkId: "testnet", …})` and picks it from the network near-connect passes. In the app, picking it tried to open a popup to **`testnet.mynearwallet.com`** (blocked only because the click was automated). That domain answers 200. | Web wallet, nothing to install. It needs popups allowed for the app's site. | **Keep** (second). Our copy sets `features.testnet` and allows `https://testnet.mynearwallet.com`. |
| **Intear** | Yes | Executor ([`wallet.intear.tech/near-selector.js`](https://wallet.intear.tech/near-selector.js)) calls `requestConnection({ networkId, … })`. The wallet repo ([INTEARnear/wallet](https://github.com/INTEARnear/wallet), `network_context.rs`) has `Network::Testnet`, and its UI lets you pick `.testnet` names. In the app, the "Connect Intear Wallet" chooser loaded (Web, App, Web Beta, Self-Hosted), and Web tried to open `wallet.intear.tech`. | Web wallet, nothing to install. | **Keep** (third) |
| **NEAR CLI** | Yes | Executor ([`near-cli.js` @ dc5cb12](https://cdn.jsdelivr.net/gh/near/near-cli-connect@dc5cb123e3a8e42ed095739f4ea058b767a80ad2/dist/near-cli.js)) builds `near … network-config testnet` commands. In the app, "Connect with NEAR CLI, step 1 of 3" loaded. | Needs near-cli-rs and a terminal, so it's clunky on camera. It is the only option that keeps a key in the operator's CLI keychain, which is where this repo's Signer key lives. | **Keep, last, for operators** |
| Nightly | Not verified | Executor ([`nightly.js` @ b8207d0](https://cdn.jsdelivr.net/gh/hot-dao/near-selector@b8207d0b303914f264c50be5ac849d5fe028f069/repository/nightly.js)) has a testnet RPC config, but `connect` sends no network to the extension and uses whatever account is active there. In the app, without the extension, the panel stayed blank after 10 s: a dead end on camera. | Chrome extension only. | **Removed** |
| Ledger | Yes, in code | Executor ([`ledger-executor.js` @ 8fe2492](https://cdn.jsdelivr.net/gh/near/near-connect-ledger@8fe249268332fd0c3231fe3e32da3bf0956d9cef/ledger-executor.js)) has a testnet RPC and WebHID/WebUSB. Not exercised in the app, because there was no device. | Needs the hardware device and the NEAR app on it. | **Removed** |

**Result.** `WALLET_MANIFEST` in `web/index.html` is now `takara-2`: Meteor, MyNearWallet, Intear, NEAR CLI, in that order. The chooser lists them in manifest order.
- No executor URL changed, so the `-takara.1` version suffixes stay.
- Security is unchanged: the manifest is still pinned, not fetched, and the role gating and the policy hash check are untouched.

**Which account does what.** The connect pre-sheet now says this before the chooser opens:
- **Approvals** need `signer.takara-ai-hq.testnet`.
- **Owner actions** need `takara-ai-hq.testnet`.

**Still open.**
- A real testnet sign-in and an `accept_commitment` signature have not been run through any of the three web wallets. Do one dry run before recording.
- Using a web wallet as the Signer means importing the Signer's key into that wallet. The founder does that; this pass never handled keys.
- Otherwise, use the NEAR CLI entry with the key that is already in the keychain.

---

## Appendix A: pinned testnet wallet manifest (paste into `WALLET_MANIFEST`)

> Superseded on 2026-11-13 by the shortlist above: the live manifest in `web/index.html` (`takara-2`) keeps Meteor, MyNearWallet, Intear and NEAR CLI, in that order. Nightly and Ledger below are kept for the record only.

Generated from upstream `hot-dao/near-selector@b8207d0b303914f264c50be5ac849d5fe028f069/repository/manifest.json`. It keeps six testnet wallets, pins executors where an immutable commit exists, patches MyNearWallet for testnet, and suffixes versions with `-takara.1`.

```json
{
  "version": "takara-1",
  "wallets": [
    {
      "id": "meteor-wallet", "name": "Meteor Wallet",
      "icon": "https://raw.githubusercontent.com/Meteor-Wallet/meteor_wallet_sdk/main/assets/meteor-logo-svg.svg",
      "description": "The most simple and secure wallet to manage your crypto, access DeFi, and explore Web3",
      "website": "https://meteorwallet.app/", "version": "1.1.1-takara.1",
      "executor": "https://raw.githubusercontent.com/Meteor-Wallet/meteor_wallet_sdk/data-storage/storage/meteor-near-connect-latest.js",
      "type": "sandbox",
      "features": { "signMessage": true, "signInWithoutAddKey": true, "signInAndSignMessage": true, "signAndSendTransaction": true, "signAndSendTransactions": true, "signInWithFunctionCallKey": true, "signDelegateActions": true, "mainnet": true, "testnet": true },
      "platform": { "web": "https://wallet.meteorwallet.app", "chrome": "https://chromewebstore.google.com/detail/meteor-wallet/pcndjhkinnkaohffealmlmhaepkpmgkb", "android": "https://play.google.com/store/apps/details?id=app.meteorwallet.v2", "ios": "https://apps.apple.com/us/app/meteor-wallet/id6739558223" },
      "permissions": { "storage": true, "allowsOpen": ["https://chromewebstore.google.com", "https://wallet.meteorwallet.app", "https://meteorwallet.app", "meteorwallet://", "meteorwalletdev://"], "external": ["meteorCom", "meteorComV2"] }
    },
    {
      "id": "intear-wallet", "name": "Intear Wallet",
      "icon": "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='49.152' height='49.152' viewBox='0 0 36.864 36.864' fill='%230079fb'><path d='M18.487 32.306c-4.599.067-8.487-3.315-9.181-7.846-.278-1.81.068-3.077.628-4.791 1.403-4.291 3.971-8.695 6.427-12.51l.949-1.478c.309-.484.487-1.03 1.115-1.125.512.052.64.423.897.807 2.484 3.706 8.36 13.272 8.334 17.704-.029 5.044-4.068 9.27-9.169 9.238zm-.063-25.712c-2.557 3.771-4.933 7.827-6.631 12.055-.838 2.086-1.485 3.738-1.052 5.983.693 3.599 3.997 6.409 7.684 6.303 4.346.06 7.767-3.49 7.827-7.766.042-2.97-3.226-9.081-4.764-11.757-.373-.65-2.709-4.575-3.064-4.818zM13.18 24.15c-.768.067-.771-.701-.769-1.27.004-1.585.41-2.564.69-3.114.179-.512.807-1.39 1.38-1.807.334-.208.836-.51 1.137-.21.362.547.163.6-.06.906a6.14 6.14 0 0 0-1.754 4.195c-.003.577.098 1.181-.625 1.299zm7.543 5.012c-.598-.034-.626-.334-.735-.811.143-.444.303-.695.753-.698 1.166-.664 2.362-1.655 2.564-3.328.194-.569.104-1.219.864-1.332.852 0 .743 1.326.622 1.885-.923 2.883-2.483 3.648-4.068 4.284z'/></svg>",
      "description": "A fast and secure wallet for everyday interactions with dapps",
      "website": "https://intea.rs/", "version": "1.0.0-takara.1",
      "executor": "https://wallet.intear.tech/near-selector.js",
      "type": "sandbox",
      "features": { "signMessage": true, "signTransaction": false, "signAndSendTransaction": true, "signAndSendTransactions": true, "signInWithoutAddKey": true, "verifyOwner": false, "testnet": true, "signDelegateActions": true, "signInAndSignMessage": true, "signInWithFunctionCallKey": true },
      "platform": { "web": "https://wallet.intear.tech" },
      "permissions": { "storage": true, "location": true, "allowsOpen": ["https://wallet.intear.tech", "https://staging.wallet.intear.tech", "http://intearwallet.local", "https://intearwallet.local", "http://intearwallet.localhost:3000", "intear://", "https://logout-bridge-service.intear.tech"] }
    },
    {
      "id": "mynearwallet", "name": "MyNearWallet",
      "icon": "https://storage.herewallet.app/upload/d0544304123d10518af961a15d5722ff1cef7abf62155f830e6d733e41f7da4b.png",
      "description": "Web wallet for NEAR.",
      "website": "https://mynearwallet.com", "version": "1.0.0-takara.1",
      "executor": "https://cdn.jsdelivr.net/gh/hot-dao/near-selector@b8207d0b303914f264c50be5ac849d5fe028f069/repository/mnw.js",
      "type": "sandbox",
      "platform": { "web": "https://app.mynearwallet.com" },
      "features": { "signMessage": true, "signInWithoutAddKey": true, "signInAndSignMessage": true, "signInWithFunctionCallKey": true, "signAndSendTransaction": true, "signAndSendTransactions": true, "testnet": true },
      "permissions": { "storage": true, "allowsOpen": ["https://app.mynearwallet.com", "https://testnet.mynearwallet.com"] }
    },
    {
      "id": "nightly-wallet", "name": "Nightly Wallet",
      "icon": "https://storage.herewallet.app/upload/6947eb5c14c65a715fb49a08e5937dcecc994bf224b3869b9878bd7a7db068f9.webp",
      "description": "Surf through the multichain Metaverse with Nightly",
      "website": "https://nightly.app", "version": "1.0.0-takara.1",
      "executor": "https://cdn.jsdelivr.net/gh/hot-dao/near-selector@b8207d0b303914f264c50be5ac849d5fe028f069/repository/nightly.js",
      "type": "sandbox",
      "platform": { "chrome": "https://chromewebstore.google.com/detail/nightly/fiikommddbeccaoicoejoniammnalkfa" },
      "permissions": { "storage": true, "external": ["nightly.near"], "allowsOpen": ["https://nightly.app", "https://chromewebstore.google.com/detail/nightly/fiikommddbeccaoicoejoniammnalkfa"] },
      "features": { "signMessage": true, "signInWithoutAddKey": true, "signInAndSignMessage": true, "signInWithFunctionCallKey": true, "signAndSendTransaction": true, "signAndSendTransactions": true, "testnet": true }
    },
    {
      "id": "ledger", "name": "Ledger",
      "icon": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20768.91%20669.35%22%3E%3Cpath%20style%3D%22stroke%3A%23000%22%20d%3D%22M-2.876-2.76h774.662v674.871H-2.876z%22%2F%3E%3Cpath%20d%3D%22M150.057%20422.845v115.877h176.334v-25.698H175.749v-90.179zm443.103%200v90.179H442.519v25.692h176.334V422.845zM326.647%20246.504v176.334h115.872v-23.174H352.34v-153.16zm-176.59-115.877v115.877h25.692v-90.185h150.642v-25.692zm292.462%200v25.692H593.16v90.185h25.693V130.627z%22%20style%3D%22fill%3A%23fff%22%2F%3E%3C%2Fsvg%3E",
      "description": "Sign transactions using hardware Ledger devices",
      "website": "https://ledger.com", "version": "1.0.0-takara.1",
      "executor": "https://cdn.jsdelivr.net/gh/near/near-connect-ledger@8fe249268332fd0c3231fe3e32da3bf0956d9cef/ledger-executor.js",
      "type": "sandbox", "platform": {},
      "features": { "signMessage": true, "signInWithoutAddKey": true, "signInAndSignMessage": true, "signInWithFunctionCallKey": true, "signAndSendTransaction": true, "signAndSendTransactions": true, "signDelegateActions": true, "mainnet": true, "testnet": true },
      "permissions": { "storage": true, "usb": true, "hid": true, "bluetooth": true }
    },
    {
      "id": "near-cli", "name": "NEAR CLI",
      "icon": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='12' fill='%231a1a2e'/%3E%3Cpolyline points='18 40 28 30 18 20' fill='none' stroke='%2300d4aa' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cline x1='32' y1='42' x2='46' y2='42' stroke='%2300d4aa' stroke-width='3' stroke-linecap='round'/%3E%3C/svg%3E",
      "description": "Sign transactions using near-cli-rs in your terminal",
      "website": "https://near.cli.rs", "version": "1.0.0-takara.1",
      "executor": "https://cdn.jsdelivr.net/gh/near/near-cli-connect@dc5cb123e3a8e42ed095739f4ea058b767a80ad2/dist/near-cli.js",
      "type": "sandbox", "platform": {},
      "features": { "signMessage": true, "signInWithoutAddKey": true, "signInAndSignMessage": true, "signAndSendTransaction": true, "signAndSendTransactions": true, "signDelegateActions": true, "signInWithFunctionCallKey": true, "mainnet": true, "testnet": true },
      "permissions": { "storage": true, "clipboardWrite": true }
    }
  ]
}
```
