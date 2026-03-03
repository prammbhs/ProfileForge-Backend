const fetch = require("node-fetch");

const getGithubEvents = async (username) => {
    try {
        const headers = {
            "Accept": "application/vnd.github.v3+json"
        };
        if (process.env.GITHUB_TOKEN) {
            headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
        }

        const response = await fetch(`https://api.github.com/users/${username}/events/public`, { headers });

        if (!response.ok) {
            throw new Error(`Failed to fetch github events data for ${username}. Status: ${response.status}`);
        }

        const eventsData = await response.json();

        return eventsData;

    } catch (error) {
        console.error("github events error", error.name, error.message);
        return null;
    }
};

module.exports = {
    getGithubEvents
};
