const { CognitoIdentityProvider } = require("@aws-sdk/client-cognito-identity-provider");

const cognitoClient = new CognitoIdentityProvider({
  region: process.env.REGION,
});

module.exports = cognitoClient;