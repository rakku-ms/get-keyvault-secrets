"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const util = require("util");
const core = __importStar(require("@actions/core"));
const actions_secret_parser_1 = require("actions-secret-parser");
class KeyVaultActionParameters {
    getKeyVaultActionParameters() {
        this.keyVaultName = core.getInput("keyvault");
        this.secretsFilter = core.getInput("secrets");
        if (!this.keyVaultName) {
            core.setFailed("Vault name not provided.");
        }
        if (!this.secretsFilter) {
            core.setFailed("Secret filter not provided.");
        }
        var azureKeyVaultDnsSuffix = "vault.azure.net";
        let environment = core.getInput("environment");
        if (environment == "AzureStack") {
            let creds = core.getInput('creds', { required: true });
            let secrets = new actions_secret_parser_1.SecretParser(creds, actions_secret_parser_1.FormatType.JSON);
            let resourceManagerEndpointUrl = secrets.getSecret("$.resourceManagerEndpointUrl", false);
            if (resourceManagerEndpointUrl.endsWith('/')) {
                resourceManagerEndpointUrl = resourceManagerEndpointUrl.substring(0, resourceManagerEndpointUrl.length - 1); // need to remove trailing / from resourceManagerEndpointUrl to correctly derive suffix below
            }
            azureKeyVaultDnsSuffix = ".vault" + resourceManagerEndpointUrl.substring(resourceManagerEndpointUrl.indexOf('.')); // keyvault suffix starts with .
        }
        this.keyVaultUrl = util.format("https://%s.%s", this.keyVaultName, azureKeyVaultDnsSuffix);
        return this;
    }
}
exports.KeyVaultActionParameters = KeyVaultActionParameters;
