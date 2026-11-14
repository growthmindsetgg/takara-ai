import { handler, signDisabled } from "../../lib/core.mjs";
export default handler((b, req, ctx) => ({ status: 403, ...signDisabled(ctx) }), { methods: ["POST"] });
