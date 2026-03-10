const { getGithubUserdata } = require("./githubUserdata");
const { getLeetcodeUserdata } = require("./leetcodeUSerdata");
const { getCredlyUserdata } = require("./credlyUserdata");
const { getCodeforcesUserdata } = require("./codeforcesUserdata");

const fetchPlatformData = async (platform, username) => {
    switch (platform.toLowerCase()) {
        case 'github':
            const githubData = await getGithubUserdata(username);
            if (!githubData) return null;

            return {
                profile: githubData,
                events: [] // Keep empty array format just in case frontend still expects it
            };
        case 'leetcode':
            return await getLeetcodeUserdata(username);
        case 'credly':
            if (username.includes(',')) {
                const usernames = username.split(',').map(u => u.trim());
                const allData = await Promise.all(usernames.map(u => getCredlyUserdata(u)));

                let mergedData = [];
                allData.forEach(result => {
                    if (result && result.data && Array.isArray(result.data)) {
                        mergedData = mergedData.concat(result.data);
                    } else if (Array.isArray(result)) {
                        mergedData = mergedData.concat(result);
                    }
                });
                return { data: mergedData };
            } else {
                return await getCredlyUserdata(username);
            }
        case 'codeforces':
            return await getCodeforcesUserdata(username);
        default:
            throw new Error(`Unsupported platform: ${platform}`);
    }
};

const generateProfileUrl = (platform, username) => {
    const firstUsername = username.includes(',') ? username.split(',')[0].trim() : username;
    switch (platform.toLowerCase()) {
        case 'github':
            return `https://github.com/${firstUsername}`;
        case 'leetcode':
            return `https://leetcode.com/u/${firstUsername}`;
        case 'credly':
            return `https://www.credly.com/users/${firstUsername}`;
        case 'codeforces':
            return `https://codeforces.com/profile/${firstUsername}`;
        default:
            return '';
    }
};

module.exports = {
    fetchPlatformData,
    generateProfileUrl
};
