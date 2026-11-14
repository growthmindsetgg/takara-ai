# Your steps to go live on NEAR mainnet

Status at a glance. ✅ done · ⏳ your turn · ⬜ later (we'll tell you when)

**Submit by 23:00 UTC** (the form closes at 23:59 UTC on 2026-11-14).

## Done

- ✅ 6 NEAR sent to the funding address (arrived 14:50 UTC)
- ✅ 2 USDC sent to `takara-ai-hq.near` (arrived 14:53 UTC)
- ✅ Refund address for leftovers: **bluetie4517.near**

## Left for you, in order

| # | Step | Status |
|---|---|---|
| 1 | Around **18:00 UTC**, when we send the go: run `node scripts/mainnet-usdc.mjs fund`. It moves 1 USDC into your mainnet treasury | ✅ done |
| 2 | Right after: run `$env:NEAR_NETWORK='mainnet'; node scripts/judge.mjs`. These are the 10 security checks on mainnet and take about 10 minutes. It moves small USDC amounts to your own payee accounts | ✅ **10/10 passed** on mainnet, 15:53 UTC (run fa4a1a16) |
| 3 | Optional, for the video: import the key for `signer.takara-ai-hq.near` (from `.secrets/mainnet/`) into Meteor Wallet, so you can press **Reject** on the Bigagency bill and sign it with a real mainnet wallet | ⬜ optional |
| 4 | Record the video (`docs/demo-script.md`; **DEMO READY: record now** at https://takara-ai.vercel.app/app), post on X (`docs/x-post-draft.md`), then **submit the form by 23:00 UTC**. Form values: tracks **Privacy & Private AI, Autonomous Business, Real-World Money**; repo https://github.com/growthmindsetgg/takara-ai; your mainnet wallet for the prize | ⏳ your turn now |
| 5 | **After** the video and submission, return the leftovers. First run the preview, which moves nothing: `node scripts/mainnet-usdc.mjs sweep --to bluetie4517.near --delete-accounts`. Then run the same line with `--execute` added and type YES. About 3.8 NEAR stays locked in the treasury account as storage | ⬜ last |

## Optional, skip if you're short on time

- 1Click partner key (private payout): sign in at https://partners.near-intents.org and create an API key in the Partner Dashboard. Give it to me and I'll save it safely.
- NEAR AI Cloud API key (Takara really reads invoices). Give it to me and I'll save it safely.

Everything else is done by the team: contract testing and audit, the mainnet treasury deploy, the demo data, the app going live on mainnet, and the docs.

Never paste private keys or seed phrases into chat. Keys live only in `.secrets/mainnet/` (not tracked by git).
