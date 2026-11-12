import { handler, signDisabled } from "../../lib/core.mjs";
export default handler(() => ({ status: 403, ...signDisabled() }), { methods: ["POST"] });
