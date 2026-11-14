import { handler, policyDiff } from "../../lib/core.mjs";
export default handler((b, req, ctx) => policyDiff(ctx, b), { methods: ["POST"] });
