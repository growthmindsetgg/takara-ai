import { handler, policyDiff } from "../../lib/core.mjs";
export default handler((b) => policyDiff(b), { methods: ["POST"] });
