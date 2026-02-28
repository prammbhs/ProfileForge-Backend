const { getUserByCognitoSub, updateProfileImage, updateName, deleteUser } = require("../repositories/users.repository");
const { DeleteUserCommand } = require("@aws-sdk/client-cognito-identity-provider");
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