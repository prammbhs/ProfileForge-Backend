const { getUserByCognitoSub } = require("../repositories/users.repository");
const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");
const Redis = require("ioredis");

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

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
        }, async (err, decoded) => {
            if (err) {
                console.log("Authentication error", err.name, err.message);
                return res.status(401).json({ error: "Login to continue" });
            }
            try {
                const cacheKey = `auth_sub:${decoded.sub}`;
                let internalId = await redis.get(cacheKey);

                if (!internalId) {
                    const internalUser = await getUserByCognitoSub(decoded.sub);
                    if (!internalUser) {
                        return res.status(401).json({ error: "User not found in system" });
                    }
                    internalId = internalUser.id;
                    // Cache the user ID for 24 hours
                    await redis.setex(cacheKey, 86400, internalId);
                }

                decoded.internalId = internalId;
                req.user = decoded;
                next();
            } catch (dbError) {
                console.error("Database error in auth middleware", dbError);
                return res.status(500).json({ error: "Internal server error during authentication" });
            }
        });
}


module.exports = Authenticate;