const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");

const client = jwksClient({
    jwksUri: `https://cognito-idp.${process.env.REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`
});

function getPublicKey(header, callback) {
    client.getSigningKey(header.kid, function (err, key) {
        if (err) {
            callback(err, null);
        } else {
            callback(null, key.publicKey);
        }
    });
}
function Authenticate(req, res, next) {
    const token = req.cookies.accessToken;
    if (!token) {
        return res.status(401).json({ error: "Login to continue" });
    }
    jwt.verify(token, getPublicKey,
        {
            issuer: `https://cognito-idp.${process.env.REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`,
        }, (err, decoded) => {
            if (err) {
                console.log("Authentication error", err.name, err.message);
                return res.status(401).json({ error: "Login to continue" });
            }
            req.user = decoded;
            next();
        });
}


module.exports = Authenticate;