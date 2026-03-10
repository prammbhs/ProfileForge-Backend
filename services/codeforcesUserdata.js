const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchCodeforcesApi = async (url, attempt = 1) => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Codeforces API Error: ${response.status}`);
        }

        const data = await response.json();
        if (data.status !== "OK") {
            throw new Error(`Codeforces API returned status ${data.status}: ${data.comment}`);
        }
        return data.result;
    } catch (error) {
        if (attempt < 3) {
            const backoff = 500 * Math.pow(2, attempt - 1);
            await delay(backoff);
            return fetchCodeforcesApi(url, attempt + 1);
        }
        throw error;
    }
};

const getCodeforcesUserdata = async (username) => {
    try {
        const [userInfoRes, userStatusRes] = await Promise.all([
            fetchCodeforcesApi(`https://codeforces.com/api/user.info?handles=${username}`),
            fetchCodeforcesApi(`https://codeforces.com/api/user.status?handle=${username}`)
        ]);

        const profile = userInfoRes[0];
        const allSubmissions = userStatusRes || [];

        // Filter and deduplicate OK submissions (AC)
        const okSubmissions = allSubmissions.filter(sub => sub.verdict === "OK");
        const uniqueProblemsMap = new Map();

        okSubmissions.forEach(sub => {
            if (sub.problem && sub.problem.contestId) {
                // Unique problem ID: contestId + index (e.g., 2207A)
                const problemKey = `${sub.problem.contestId}${sub.problem.index}`;
                if (!uniqueProblemsMap.has(problemKey)) {
                    uniqueProblemsMap.set(problemKey, sub.problem);
                }
            }
        });

        const solvedProblems = Array.from(uniqueProblemsMap.values());

        return {
            profile: {
                handle: profile.handle,
                rating: profile.rating,
                maxRating: profile.maxRating,
                rank: profile.rank,
                maxRank: profile.maxRank,
                avatar: profile.titlePhoto,
                organization: profile.organization,
            },
            solvedProblems: solvedProblems,
            totalSolved: solvedProblems.length
        };

    } catch (error) {
        console.error("Codeforces userdata error:", error.message);
        return null;
    }
};

module.exports = {
    getCodeforcesUserdata
};
