import { handler, chat } from "../lib/core.mjs";
export default handler((b, req, ctx) => chat(ctx, b.q), { methods: ["POST"] });
