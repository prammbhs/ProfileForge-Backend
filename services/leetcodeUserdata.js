
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper to execute any GraphQL query against LeetCode
const fetchLeetcodeGraphQL = async (query, variables, attempt = 1) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
        const response = await fetch("https://leetcode.com/graphql", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Origin": "https://leetcode.com",
                "Referer": "https://leetcode.com",
                "User-Agent": "ProfileForge/1.0"
            },
            body: JSON.stringify({
                query: query,
                variables: variables
            }),
            signal: controller.signal
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Failed to fetch leetcode graphql data (status ${response.status}): ${errorBody}`);
        }

        const data = await response.json();
        return data.data;
    } catch (error) {
        if (attempt < 3) {
            const backoff = 500 * Math.pow(2, attempt - 1);
            await delay(backoff);
            return fetchLeetcodeGraphQL(query, variables, attempt + 1);
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
};

const getLeetcodeProfile = async (username) => {
    const query = `
        query getUserProfile($username: String!) {
            matchedUser(username: $username) {
                username
                profile {
                    realName
                    aboutMe
                    userAvatar
                    ranking
                    reputation
                    skillTags
                }
            }
        }
    `;
    const data = await fetchLeetcodeGraphQL(query, { username });
    return data.matchedUser;
};

const getLeetcodeBadges = async (username) => {
    const query = `
        query getUserBadges($username: String!) {
            matchedUser(username: $username) {
                activeBadge {
                    displayName
                    icon
                }
                badges {
                    id
                    displayName
                    icon
                    creationDate
                }
            }
        }
    `;
    const data = await fetchLeetcodeGraphQL(query, { username });
    return data.matchedUser;
};

const getLeetcodeSubmissions = async (username) => {
    const query = `
        query getRecentSubmissions($username: String!) {
            recentSubmissionList(username: $username, limit: 15) {
                title
                titleSlug
                statusDisplay
                lang
                timestamp
            }
        }
    `;
    const data = await fetchLeetcodeGraphQL(query, { username });
    return data.recentSubmissionList;
};

const getLeetcodeStats = async (username) => {
    const query = `
        query getUserStats($username: String!) {
            matchedUser(username: $username) {
                submitStatsGlobal {
                    acSubmissionNum {
                        difficulty
                        count
                        submissions
                    }
                }
            }
        }
    `;
    const data = await fetchLeetcodeGraphQL(query, { username });
    return data.matchedUser;
};

const getLeetcodeTopics = async (username) => {
    const query = `
        query getSkillStats($username: String!) {
            matchedUser(username: $username) {
                tagProblemCounts {
                    advanced {
                        tagName
                        tagSlug
                        problemsSolved
                    }
                    intermediate {
                        tagName
                        tagSlug
                        problemsSolved
                    }
                    fundamental {
                        tagName
                        tagSlug
                        problemsSolved
                    }
                }
            }
        }
    `;
    const data = await fetchLeetcodeGraphQL(query, { username });
    return data.matchedUser;
};

const getLeetcodeUserdata = async (username) => {
    try {
        const [profileData, badgesData, submissionsData, statsData, topicsData] = await Promise.all([
            getLeetcodeProfile(username),
            getLeetcodeBadges(username),
            getLeetcodeSubmissions(username),
            getLeetcodeStats(username),
            getLeetcodeTopics(username)
        ]);

        if (!profileData) {
            return null; // Username doesn't exist
        }

        return {
            username: profileData.username,
            realName: profileData.profile?.realName,
            about: profileData.profile?.aboutMe,
            avatar: profileData.profile?.userAvatar,
            ranking: profileData.profile?.ranking,
            contributionPoints: profileData.profile?.reputation,
            skills: profileData.profile?.skillTags || [],
            activeBadge: badgesData?.activeBadge,
            badges: badgesData?.badges || [],
            submitStatsGlobal: statsData?.submitStatsGlobal || {},
            recentSubmissionList: submissionsData || [],
            topicInfo: topicsData?.tagProblemCounts || {}
        };
    } catch (error) {
        console.log("leetcode userdata error", error.name, error.message);
        return null;
    }
};

module.exports = {
    getLeetcodeUserdata,
    getLeetcodeProfile,
    getLeetcodeBadges,
    getLeetcodeSubmissions,
    getLeetcodeStats,
    getLeetcodeTopics,
    fetchLeetcodeGraphQL
};