const fetch = require("node-fetch");

const getGithubUserdata = async (username) => {
    try {
        const headers = {
            "Accept": "application/vnd.github.v3+json"
        };
        if (process.env.GITHUB_TOKEN) {
            headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
        }

        const response = await fetch(`https://api.github.com/users/${username}`, { headers });
        if (!response.ok) {
            throw new Error("Failed to fetch github userdata");
        }
        const userData = await response.json();

        let allRepos = [];
        let page = 1;
        while (true) {
            const separator = userData.repos_url.includes('?') ? '&' : '?';
            const reposUrl = `${userData.repos_url}${separator}per_page=100&page=${page}`;
            const repoResponse = await fetch(reposUrl, { headers });

            if (!repoResponse.ok) {
                if (allRepos.length > 0) break;
                throw new Error("Failed to fetch github repo data");
            }
            const repoDataPage = await repoResponse.json();

            if (!Array.isArray(repoDataPage) || repoDataPage.length === 0) {
                break;
            }
            allRepos = allRepos.concat(repoDataPage);
            page++;
        }

        const repoDataNeed = await Promise.all(allRepos.map(async (repo) => {
            const cleanCommitsUrl = repo.commits_url.replace('{/sha}', '');
            const commitResponse = await fetch(`${cleanCommitsUrl}?per_page=3`, { headers });

            let commitDataNeed = [];
            if (commitResponse.ok) {
                const commitData = await commitResponse.json();
                if (Array.isArray(commitData)) {
                    commitDataNeed = commitData.map((commit) => {
                        return {
                            sha: commit.sha,
                            description: commit.commit?.message || "No description",
                            url: commit.url,
                            committer: commit.commit?.committer?.name || "Unknown",
                            date: commit.commit?.committer?.date || "",
                        }
                    });
                }
            }

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
        }));

        const followersResponse = await fetch(userData.followers_url, { headers });
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
            followers_count: userData.followers,
            following_count: userData.following,
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