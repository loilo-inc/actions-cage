import { deploy } from "../../src";

if (require.main === module) {
  deploy();
}

module.exports = "deploy";
