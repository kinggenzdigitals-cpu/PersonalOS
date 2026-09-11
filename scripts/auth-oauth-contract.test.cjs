const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const googleButton = fs.readFileSync(
  path.join(process.cwd(), "src/components/auth/google-button.tsx"),
  "utf8",
);
const methodsCard = fs.readFileSync(
  path.join(process.cwd(), "src/components/account/sign-in-methods-card.tsx"),
  "utf8",
);
const changePassword = fs.readFileSync(
  path.join(process.cwd(), "src/app/change-password/page.tsx"),
  "utf8",
);

assert.match(googleButton, /prompt:\s*["']select_account["']/, "Google OAuth must force the account chooser");
assert.match(methodsCard, /getUserIdentities\(/, "Account settings must read linked identities");
assert.match(methodsCard, /linkIdentity\(/, "Account settings must link Google to the current user");
assert.match(methodsCard, /prompt:\s*["']select_account["']/, "Google linking must also show the account chooser");
assert.match(changePassword, /Google\/Gmail password/, "Create-password copy must never imply access to the Gmail password");

console.log("auth OAuth contract checks passed");
