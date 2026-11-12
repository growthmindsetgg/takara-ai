import { handler, chat } from "../lib/core.mjs";
export default handler((b) => chat(b.q), { methods: ["POST"] });
