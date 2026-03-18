import { audit } from "../../src";

if (require.main === module) {
  audit();
}

module.exports = "audit";
