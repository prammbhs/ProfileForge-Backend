const { fetch } = require("node-fetch");

const getGithubUserdata = async (username) => {
    try {
        const response = await fetch(`https://api.github.com/users/${username}`);
        if (!response.ok) {
            throw new Error("Failed to fetch github userdata");
        }
        const userData = await response.json();
        const repoResponse = await fetch(userData.repos_url);
        if (!repoResponse.ok) {
            throw new Error("Failed to fetch github repo data");
        }
        const repoData = await repoResponse.json();
        const repoDataNeed = repoData.map(async (repo) => {
            const commitResponse = await fetch(repo.commits_url + "?per_page=3");
            if (!commitResponse.ok) {
                throw new Error("Failed to fetch github commit data");
            }
            const commitData = await commitResponse.json();
            const commitDataNeed = commitData.map((commit) => {
                return {
                    sha: commit.sha,
                    description: commit.commit.message,
                    url: commit.url,
                    committer: commit.commit.committer.name,
                    date: commit.commit.committer.date,
                }
            });
            return {
                name: repo.name,
                description: repo.description,
                url: repo.html_url,
                commits: commitDataNeed,
                forks: repo.forks,
                stars: repo.stargazers_count,
                language: repo.language,
                created_at: repo.created_at,
                updated_at: repo.updated_at
            }
        });
        const followersResponse = await fetch(userData.followers_url);
        if (!followersResponse.ok) {
            throw new Error("Failed to fetch github followers data");
        }
        const followersData = await followersResponse.json();
        const followerDataNeed = followersData.map((follower) => {
            return {
                username: follower.login,
                avatar_url: follower.avatar_url,
                profile_url: follower.html_url
            }
        });
        const dataNeed = {
            username: userData.login,
            name: userData.name,
            avatar_url: userData.avatar_url,
            bio: userData.bio,
            email: userData.email,
            public_repos: userData.public_repos,
            followers: userData.followers,
            following: userData.following,
            repos: repoDataNeed,
            followers: followerDataNeed,

        }
        return dataNeed;
    } catch (error) {
        console.log("github userdata error", error.name, error.message);
        return null;
    }
};

module.exports = {
    getGithubUserdata
};