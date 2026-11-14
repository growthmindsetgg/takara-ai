import { handler, policyCurrent } from "../../lib/core.mjs";
export default handler((b, req, ctx) => policyCurrent(ctx));
