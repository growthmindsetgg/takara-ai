import { handler, publicLedger } from "../lib/core.mjs";
export default handler((b, req, ctx) => publicLedger(ctx));
