import { handler, decisions } from "../lib/core.mjs";
export default handler((b, req, ctx) => decisions(ctx).slice(-200).reverse());
