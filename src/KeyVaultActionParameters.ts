import util = require("util");
import * as core from '@actions/core';
import { FormatType, SecretParser } from 'actions-secret-parser';

export class KeyVaultActionParameters {

    public keyVaultName: string;
    public secretsFilter: string;
    public keyVaultUrl: string;

    public getKeyVaultActionParameters() : KeyVaultActionParameters {
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
            let secrets = new SecretParser(creds, FormatType.JSON);
            let resourceManagerEndpointUrl = secrets.getSecret("$.resourceManagerEndpointUrl", false);
            if (resourceManagerEndpointUrl.endsWith('/')) {
                resourceManagerEndpointUrl = resourceManagerEndpointUrl.substring(0, resourceManagerEndpointUrl.length-1); // need to remove trailing / from resourceManagerEndpointUrl to correctly derive suffix below
            }
            azureKeyVaultDnsSuffix = ".vault" + resourceManagerEndpointUrl.substring(resourceManagerEndpointUrl.indexOf('.')); // keyvault suffix starts with .
        }
        this.keyVaultUrl = util.format("https://%s.%s", this.keyVaultName, azureKeyVaultDnsSuffix);
        return this;
    }
}