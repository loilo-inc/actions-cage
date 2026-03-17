const audit = require("../build/@loilo-inc/actions-audit-cage");
const deploy = require("../build/@loilo-inc/actions-deploy-cage");
const setup = require("../build/@loilo-inc/actions-setup-cage");

function assertExportedAsCJS(action, actionName) {
  if (action !== actionName) {
    throw new Error(
      `${actionName} action should be exported as a string in CJS, but got: ${action}`,
    );
  }
}
assertExportedAsCJS(audit, "audit");
assertExportedAsCJS(deploy, "deploy");
assertExportedAsCJS(setup, "setup");

console.log("All actions are correctly bundled as CJS.");
