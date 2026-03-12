const { InitiateAuthCommand,
    GetUserCommand,
    GlobalSignOutCommand,
    SignUpCommand,
    ConfirmSignUpCommand,
    DeleteUserCommand,
    ForgotPasswordCommand,
    ConfirmForgotPasswordCommand
} = require("@aws-sdk/client-cognito-identity-provider");
const cognitoClient = require("../utils/cognito");
const { createUser, getUserByCognitoSub } = require("../repositories/users.repository");

//login function
exports.login = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: "All fields are required" })
    }
    try {
        const command = new InitiateAuthCommand({
            AuthFlow: "USER_PASSWORD_AUTH",
            ClientId: process.env.COGNITO_CLIENT_ID,
            AuthParameters: {
                USERNAME: email,
                PASSWORD: password
            }
        })
        const authResponse = await cognitoClient.send(command);
        const { AccessToken, RefreshToken } = authResponse.AuthenticationResult;
        const getUser = new GetUserCommand({
            AccessToken: AccessToken
        })
        const userResponse = await cognitoClient.send(getUser);
        const attributes = {}
        userResponse.UserAttributes.forEach(attr => {
            attributes[attr.Name] = attr.Value;
        })
        let user = await getUserByCognitoSub(attributes.sub);
        if (!user) {
            await createUser({
                cognito_sub: attributes.sub,
                email: attributes.email,
                name: attributes.name,
                profile_image_url: "https://upload.wikimedia.org/wikipedia/commons/9/99/Sample_User_Icon.png?_=20200919003010"
            });
            user = await getUserByCognitoSub(attributes.sub);
        }

        // ── Phase 2: Cache Priming ────────────────────────────────
        // Pre-warm the cache so the parallel dashboard requests hit L1/L2
        const { authCache } = require("../utils/lruCache");
        const { getRedisClient } = require("../utils/redisClient");
        const redis = getRedisClient();
        
        authCache.set(attributes.sub, user.id); // Prime L1
        redis.setex(`auth_sub:${attributes.sub}`, 86400, user.id).catch(() => {}); // Prime L2
        const isProduction = process.env.NODE_ENV === "production" || req.get("host").includes("duckdns.org");

        res
            .cookie("accessToken", AccessToken, {
                httpOnly: true,
                secure: isProduction, 
                sameSite: isProduction ? "none" : "lax",
                maxAge: 60 * 60 * 1000 // 1 hour in ms
            })
            .cookie("refreshToken", RefreshToken, {
                httpOnly: true,
                secure: isProduction,
                sameSite: isProduction ? "none" : "lax",
                maxAge: 60 * 60 * 24 * 5 * 1000 // 5 days in ms
            })
            .json({
                message: "Login successful",
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    profile_image_url: user.profile_image_url
                }
            });
    } catch (error) {
        console.log("cognito login error", error.name, error.message);
        res.status(401).json({ error: error.name, message: error.message });
    }
}

//logout function
exports.logout = async (req, res) => {
    try {
        if (!req.cookies || !req.cookies.accessToken || !req.cookies.refreshToken) {
            return res.status(400).json({ message: "Login to continue." });
        }
        const token = req.cookies.accessToken;
        const command = new GlobalSignOutCommand({
            AccessToken: token
        });
        await cognitoClient.send(command);
        const isProduction = process.env.NODE_ENV === "production" || req.get("host").includes("duckdns.org");
        res.clearCookie("accessToken", { sameSite: isProduction ? "none" : "lax", secure: isProduction });
        res.clearCookie("refreshToken", { sameSite: isProduction ? "none" : "lax", secure: isProduction });
        res.json({ message: "Logout successful" });
    } catch (error) {
        console.log("cognito logout error", error.name, error.message);
        res.status(401).json({ message: "Logout Failed" });
    }
}

//signup function
exports.signup = async (req, res) => {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
        return res.status(400).json({ message: "All fields are required" });
    }
    try {
        const command = new SignUpCommand({
            ClientId: process.env.COGNITO_CLIENT_ID,
            Username: email,
            Password: password,
            UserAttributes: [
                { Name: "email", Value: email },
                { Name: "name", Value: name }
            ]
        });
        await cognitoClient.send(command);
        res.json({ message: "User created successfully" });
    } catch (error) {
        console.log("cognito signup error", error.name, error.message);
        res.status(400).json({ message: "Failed to create user" });
    }
}

//confirm signup function
exports.confirmSignup = async (req, res) => {
    const { email, code } = req.body;
    if (!email || !code) {
        return res.status(400).json({ message: "All fields are required" });
    }
    try {
        const command = new ConfirmSignUpCommand({
            ClientId: process.env.COGNITO_CLIENT_ID,
            Username: email,
            ConfirmationCode: code
        });
        await cognitoClient.send(command);
        res.json({ message: "User confirmed successfully" });
    } catch (error) {
        console.log("cognito confirm signup error", error.name, error.message);
        res.status(400).json({ message: "Failed to confirm user" });
    }
}

//forgot password function
exports.forgotPassword = async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: "Email is required" });
    }
    try {
        const command = new ForgotPasswordCommand({
            ClientId: process.env.COGNITO_CLIENT_ID,
            Username: email
        });
        await cognitoClient.send(command);
        res.json({ message: "Password reset code sent successfully" });
    } catch (error) {
        console.log("cognito forgot password error", error.name, error.message);
        res.status(400).json({ message: "Failed to reset password" });
    }
}
//confirm forgot password function
exports.confirmForgotPassword = async (req, res) => {
    const { email, code, password } = req.body;
    if (!email || !code || !password) {
        return res.status(400).json({ message: "All fields are required" });
    }
    try {
        const command = new ConfirmForgotPasswordCommand({
            ClientId: process.env.COGNITO_CLIENT_ID,
            Username: email,
            ConfirmationCode: code,
            Password: password
        });
        await cognitoClient.send(command);
        res.json({ message: "Password reset successfully" });
    } catch (error) {
        console.log("cognito confirm forgot password error", error.name, error.message);
        res.status(400).json({ message: "Failed to reset password" });
    }
}

