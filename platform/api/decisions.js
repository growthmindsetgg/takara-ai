import { handler, decisions } from "../lib/core.mjs";
export default handler(() => decisions().slice(-60).reverse());
