const { fetch } = require("node-fetch");

const getCredlyUserdata = async (username) => {
    try {
        const response = await fetch(`https://www.credly.com/users/${username}/badges.json`);
        if (!response.ok) {
            throw new Error("Failed to fetch credly userdata");
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.log("credly userdata error", error.name, error.message);
        return null;
    }
};

module.exports = {
    getCredlyUserdata
};