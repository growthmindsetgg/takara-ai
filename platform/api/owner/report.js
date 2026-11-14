import { handler, report } from "../../lib/core.mjs";
export default handler((b, req, ctx) => report(ctx));
