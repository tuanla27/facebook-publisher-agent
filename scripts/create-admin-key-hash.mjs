import { generateAdminKey, hashAdminKey } from "../backend/approval/admin-key.mjs";

const key = generateAdminKey();
console.log("Admin key (show once; store it in a password manager):");
console.log(key);
console.log("");
console.log("Add only this hash to .env:");
console.log(`ADMIN_KEY_HASH=${hashAdminKey(key)}`);
