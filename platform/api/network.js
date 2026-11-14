// Which networks are live (testnet / mainnet) and the default the app opens on. Public, no keys.
import { handler, networkStatus } from "../lib/core.mjs";
export default handler(() => networkStatus(), { net: false });
