const { getUserByCognitoSub, updateProfileImage, updateName, deleteUser, updateEmail: updateEmailRepo } = require("../repositories/users.repository");
const { DeleteUserCommand, UpdateUserAttributesCommand, VerifyUserAttributeCommand } = require("@aws-sdk/client-cognito-identity-provider");
const cognitoClient = require("../utils/cognito");

exports.getUser = async (req, res) => {
    try {
        const user = await getUserByCognitoSub(req.user.sub);
        if (!user) return res.status(404).json({ message: "User not found" });

        res.json(user);
    } catch (error) {
        console.log("user controller error", error.name, error.message);
        res.status(500).json({ message: "Failed to get user" });
    }
}

exports.updateProfileImage = async (req, res) => {
    try {

        const currentUser = await getUserByCognitoSub(req.user.sub);
        if (!currentUser) return res.status(404).json({ message: "User not found" });
        const updatedUser = await updateProfileImage(currentUser.id, req.file.path);
        res.json(updatedUser);
    } catch (error) {
        console.log("user controller error", error.name, error.message);
        res.status(500).json({ message: "Failed to update profile image" });
    }
}

exports.updateName = async (req, res) => {
    try {
        const currentUser = await getUserByCognitoSub(req.user.sub);
        if (!currentUser) return res.status(404).json({ message: "User not found" });

        const updatedUser = await updateName(currentUser.id, req.body.name);
        res.json(updatedUser);
    } catch (error) {
        console.log("user controller error", error.name, error.message);
        res.status(500).json({ message: "Failed to update name" });
    }
}

exports.deleteUser = async (req, res) => {
    try {
        const currentUser = await getUserByCognitoSub(req.user.sub);
        if (!currentUser) return res.status(404).json({ message: "User not found" });

        const command = new DeleteUserCommand({
            AccessToken: req.cookies.accessToken
        });
        await cognitoClient.send(command);

        await deleteUser(currentUser.id);

        res.clearCookie("accessToken");
        res.clearCookie("refreshToken");
        res.json({ message: "User deleted successfully" });
    } catch (error) {
        console.log("cognito delete user error", error.name, error.message);
        res.status(401).json({ message: "Failed to delete user" });
    }
}

exports.updateEmail = async (req, res) => {
    try {
        const currentUser = await getUserByCognitoSub(req.user.sub);
        if (!currentUser) return res.status(404).json({ message: "User not found" });

        const { email } = req.body;
        if (!email) return res.status(400).json({ message: "Email is required" });

        // Update Cognito - This triggers an OTP to the new email address 
        const command = new UpdateUserAttributesCommand({
            AccessToken: req.cookies.accessToken,
            UserAttributes: [{ Name: 'email', Value: email }]
        });
        const response = await cognitoClient.send(command);

        // Do NOT update local DB yet. Wait for verification code successfully applied.
        res.json({ 
            message: "Verification code sent to new email address.", 
            codeDeliveryDetails: response.CodeDeliveryDetailsList 
        });
    } catch (error) {
        console.log("updateEmail error", error.name, error.message);
        res.status(500).json({ message: error.message || "Failed to update email" });
    }
}

exports.verifyEmailOTP = async (req, res) => {
    try {
        const currentUser = await getUserByCognitoSub(req.user.sub);
        if (!currentUser) return res.status(404).json({ message: "User not found" });

        const { code, email } = req.body;
        if (!code || !email) return res.status(400).json({ message: "Verification code and new email required" });

        // Verify the code with Cognito
        const command = new VerifyUserAttributeCommand({
            AccessToken: req.cookies.accessToken,
            AttributeName: 'email',
            Code: code
        });
        await cognitoClient.send(command);

        // Update local DB since Cognito successfully updated and verified the attribute
        const updatedUser = await updateEmailRepo(currentUser.id, email);
        res.json({ message: "Email updated successfully", user: updatedUser });
    } catch (error) {
        console.log("verifyEmailOTP error", error.name, error.message);
        res.status(500).json({ message: error.message || "Invalid or Expired verification code." });
    }
}