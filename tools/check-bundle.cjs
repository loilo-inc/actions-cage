const audit = require("../build/@loilo-inc/actions-audit-cage");
const deploy = require("../build/@loilo-inc/actions-deploy-cage");
const setup = require("../build/@loilo-inc/actions-setup-cage");
const util = require("util");

function assertExportedAsCJS(action, actionName) {
  if (action !== actionName) {
    throw new Error(
      `${actionName} action should be exported as a string in CJS, but got: ${util.inspect(
        action,
      )}`,
    );
  }
}
assertExportedAsCJS(audit, "audit");
assertExportedAsCJS(deploy, "deploy");
assertExportedAsCJS(setup, "setup");

console.log("All actions are correctly bundled as CJS.");
