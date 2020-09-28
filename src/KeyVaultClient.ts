import * as core from '@actions/core';
import util = require("util");
import { IAuthorizationHandler } from "azure-actions-webclient/lib/AuthHandler/IAuthorizationHandler";
import { ApiResult, ServiceClient, ApiCallback, ToError } from "azure-actions-webclient/lib/AzureRestClient";
import { WebRequest, WebResponse } from "azure-actions-webclient/lib/webClient"
import { AzureKeyVaultSecret } from "./KeyVaultHelper";
import { KeyVaultActionParameters } from './KeyVaultActionParameters';

import fs = require('fs');

export class KeyVaultClient extends ServiceClient {    
    private keyVaultUrl: string;
    private apiVersion: string = "7.0";
    private tokenArgs: string[] = ["--resource", "https://vault.azure.net"];
    private armEndpoint: string;
    private keyVaultActionParameters: KeyVaultActionParameters;
    private authHandler: IAuthorizationHandler;
    
    constructor(endpoint: IAuthorizationHandler, timeOut: number, keyVaultActionParameters: KeyVaultActionParameters) {
        super(endpoint, timeOut);
        this.authHandler = endpoint;
        console.log(`endpoint - "${util.inspect(endpoint, {depth: null})}"`);
        this.armEndpoint = endpoint.baseUrl;
        console.log(`baseUrl "${this.armEndpoint}"`);
        this.keyVaultActionParameters = keyVaultActionParameters;
    }

    public async init() {
        // Create HTTP transport objects
        var httpRequest: WebRequest = {
            method: 'GET',
            headers: {},
            uri: this.armEndpoint + "metadata/endpoints?api-version=1"
        };   

        console.log(`async function httpRequest: "${util.inspect(httpRequest, {depth: null})}"`);
        var temp = this.tokenArgs;
        this.tokenArgs = null;
        console.log(`keyvault action parameters: keyvaultname - "${this.keyVaultActionParameters.keyVaultName}", secretsfilter - "${this.keyVaultActionParameters.secretsFilter}", keyVaultDnsSuffix - "${this.keyVaultActionParameters.keyVaultDnsSuffix}", keyVaultUrl - "${this.keyVaultUrl}"`);
        var token = await this.authHandler.getToken(true, this.tokenArgs);
        console.log(`token - "${util.inspect(token, {depth: null})}"`);
        let armresponse = await this.invokeRequest(httpRequest);
        this.tokenArgs = temp;
        console.log(`armresponse: "${armresponse}"`);
        //fs.writeFileSync("/tmp/test", JSON.stringify(result));
        //var r = JSON.parse(armresponse.body);
        var r = armresponse.body;
        console.log(`r - "${util.inspect(r, {depth: null})}"`);
        var audience = r.authentication.audiences[0];
        console.log(`audience - "${audience}"`);
        var kvResourceId = audience.replace("management","vault");
        console.log(`kvResourceId - "${kvResourceId}"`);
        this.keyVaultUrl = this.keyVaultActionParameters.keyVaultUrl;
        if (this.keyVaultActionParameters.environment == "AzureStack") {
            let resourceId = "https://" + this.keyVaultActionParameters.keyVaultDnsSuffix;
            // https://vault.northwest.azs-longhaul-01.selfhost.corp.microsoft.com
            this.tokenArgs[1] = "https://vault.azlr.onmicrosoft.com/9b2fbd69-3cdc-425e-bb94-5637a7425c02";
            this.apiVersion = "2016-10-01";
            console.log(`tokenArgs - "${this.tokenArgs}"`);
            console.log(`keyvault action parameters: keyvaultname - "${this.keyVaultActionParameters.keyVaultName}", secretsfilter - "${this.keyVaultActionParameters.secretsFilter}", keyVaultDnsSuffix - "${this.keyVaultActionParameters.keyVaultDnsSuffix}", keyVaultUrl - "${this.keyVaultUrl}"`);
            token = await this.authHandler.getToken(true, this.tokenArgs);
            console.log(`token - "${util.inspect(token, {depth: null})}"`);
        }

    }

    public async invokeRequest(request: WebRequest): Promise<WebResponse> {
        try {
            console.log(`request 29: "${util.inspect(request, {depth: null})}"`)
            var response = await this.beginRequest(request, this.tokenArgs);
            console.log(`response 29: "${util.inspect(response, {depth: null})}"`)
            return response;
        } catch(exception) {
            console.log(`exception 33: "${util.inspect(exception, {depth: null})}"`)
            throw exception;
        }
    }
    
    public getSecrets(nextLink: string, callback: ApiCallback) {
        if (!callback) {
            core.debug("Callback Cannot Be Null");
            throw new Error("Callback Cannot Be Null");
        }

        // Create HTTP transport objects
        var url = nextLink;
        if (!url)
        {
            url = this.getRequestUriForbaseUrl(
                this.keyVaultUrl,
                '/secrets',
                {},
                ['maxresults=25'],
                this.apiVersion);
        }

        var httpRequest: WebRequest = {
            method: 'GET',
            headers: {},
            uri: url,
        }        

        console.log("Downloading Secrets From", url);
        
        this.invokeRequest(httpRequest).then(async (response: WebResponse) => {
            var result = [];
            if (response.statusCode == 200) {
                if (response.body.value) {
                    result = result.concat(response.body.value);
                }
                
                if (response.body.nextLink) {
                    var nextResult = await this.accumulateResultFromPagedResult(response.body.nextLink);
                    if (nextResult.error) {
                        return new ApiResult(nextResult.error);
                    }
                    result = result.concat(nextResult.result);

                    var listOfSecrets = this.convertToAzureKeyVaults(result);
                    return new ApiResult(null, listOfSecrets);
                }
                else {
                    var listOfSecrets = this.convertToAzureKeyVaults(result);
                    return new ApiResult(null, listOfSecrets);
                }
            }
            else {
                return new ApiResult(ToError(response));
            }
        }).then((apiResult: ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    public getSecretValue(secretName: string, callback: ApiCallback) {
        if (!callback) {
            core.debug("Callback Cannot Be Null");
            throw new Error("Callback Cannot Be Null");
        }

        // Create HTTP transport objects
        var httpRequest: WebRequest = {
            method: 'GET',
            headers: {},
            uri: this.getRequestUriForbaseUrl(
                this.keyVaultUrl,
                '/secrets/{secretName}',
                {
                    '{secretName}': secretName
                },
                [],
                this.apiVersion
            )
        };   
        console.log(`httpRequest: "${httpRequest.uri}"`)     

        this.invokeRequest(httpRequest).then(async (response: WebResponse) => {
            console.log(`response 115: "${util.inspect(response, {depth: null})}"`)
            if (response.statusCode == 200) {
                var result = response.body.value;
                console.log(`response value 119: "${util.inspect(result, {depth: null})}"`)
                return new ApiResult(null, result);
            }
            else if (response.statusCode == 400) {
                return new ApiResult('Get Secret Failed Because Of Invalid Characters', secretName);
            }
            else {
                return new ApiResult(ToError(response));
            }
        }).then((apiResult: ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    private convertToAzureKeyVaults(result: any[]): AzureKeyVaultSecret[] {
        var listOfSecrets: AzureKeyVaultSecret[] = [];
        result.forEach((value: any, index: number) => {
            var expires;
            if (value.attributes.exp)
            {
                expires = new Date(0);
                expires.setSeconds(parseInt(value.attributes.exp));
            }

            var secretIdentifier: string = value.id;
            var lastIndex = secretIdentifier.lastIndexOf("/");
            var name: string = secretIdentifier.substr(lastIndex + 1, secretIdentifier.length);

            var azkvSecret: AzureKeyVaultSecret = {
                name: name,
                contentType: value.contentType,
                enabled: value.attributes.enabled,
                expires: expires
            };

            listOfSecrets.push(azkvSecret);
        });

        return listOfSecrets;
    }
}