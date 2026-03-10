const { pool } = require("../utils/postgreClient");
const { getCodingStatsCache, upsertCodingStatsCache } = require("../repositories/codingStats.repository");

const parseLeetCodeStats = (platformData, stats) => {
    if (!platformData || !platformData.submitStatsGlobal || !platformData.submitStatsGlobal.acSubmissionNum) return;

    // Total Solved and Difficulties
    platformData.submitStatsGlobal.acSubmissionNum.forEach(item => {
        if (item.difficulty === "All") {
            stats.totalSolved += item.count;
        } else if (item.difficulty === "Easy") {
            stats.easy += item.count;
        } else if (item.difficulty === "Medium") {
            stats.medium += item.count;
        } else if (item.difficulty === "Hard") {
            stats.hard += item.count;
        }
    });

    // Topic Extraction
    if (platformData.topicInfo) {
        ['advanced', 'intermediate', 'fundamental'].forEach(level => {
            if (platformData.topicInfo[level]) {
                platformData.topicInfo[level].forEach(topic => {
                    stats.topics[topic.tagName] = (stats.topics[topic.tagName] || 0) + topic.problemsSolved;
                });
            }
        });
    }
};

const parseCodeforcesStats = (platformData, stats) => {
    if (!platformData || !platformData.solvedProblems) return;

    const solvedProblems = platformData.solvedProblems;
    stats.totalSolved += solvedProblems.length;

    solvedProblems.forEach(problem => {
        // Difficulty Mapping
        if (problem.rating !== undefined) {
            if (problem.rating < 1300) stats.easy += 1;
            else if (problem.rating <= 1700) stats.medium += 1;
            else stats.hard += 1;
        } else if (problem.index) {
            // Fallback to Index if unrated
            const indexLetter = problem.index.charAt(0).toUpperCase();
            if (indexLetter === 'A' || indexLetter === 'B') stats.easy += 1;
            else if (indexLetter === 'C') stats.medium += 1;
            else stats.hard += 1;
        }

        // Topic Extraction
        if (problem.tags && Array.isArray(problem.tags)) {
            problem.tags.forEach(tag => {
                // Capitalize first letter to normalize a bit against LeetCode ("dynamic programming" -> "Dynamic programming")
                const normalizedTag = tag.charAt(0).toUpperCase() + tag.slice(1);
                stats.topics[normalizedTag] = (stats.topics[normalizedTag] || 0) + 1;
            });
        }
    });
};

const getOrComputeStats = async (userId) => {
    try {
        // 1. Check PostgreSQL Cache
        const cached = await getCodingStatsCache(userId);

        if (cached) {
            const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
            if (new Date(cached.last_synced_at) > twelveHoursAgo) {
                return cached.stats; // Return fresh cached data
            }
        }

        // 2. Cache Miss or Expired: Compute Fresh Stats
        const { rows: profiles } = await pool.query('SELECT platform, platform_data FROM external_profiles WHERE user_id = $1', [userId]);

        const stats = {
            totalSolved: 0,
            easy: 0,
            medium: 0,
            hard: 0,
            topics: {}
        };

        profiles.forEach(profile => {
            if (profile.platform === 'leetcode') {
                parseLeetCodeStats(profile.platform_data, stats);
            } else if (profile.platform === 'codeforces') {
                parseCodeforcesStats(profile.platform_data, stats);
            }
        });

        const sortedTopics = Object.keys(stats.topics)
            .map(tag => ({ tag, count: stats.topics[tag] }))
            .sort((a, b) => b.count - a.count);

        stats.topics = sortedTopics;

        // 3. Upsert to cache and return
        await upsertCodingStatsCache(userId, stats);
        return stats;

    } catch (error) {
        console.error("Error generating coding stats:", error);
        throw error;
    }
};

exports.getCodingStatsController = async (req, res) => {
    try {
        const userId = req.user.internalId;
        const stats = await getOrComputeStats(userId);
        res.status(200).json(stats);
    } catch (error) {
        res.status(500).json({ error: "Failed to generate coding stats" });
    }
};

exports.getPublicCodingStats = async (userId) => {
    try {
        return await getOrComputeStats(userId);
    } catch (error) {
        return null; // Don't crash API keys fetching portfolio data
    }
};
