const { pool } = require("../utils/postgreClient");
const { getCachedBadges, upsertCachedBadges } = require("../repositories/badges.repository");

const getOrComputeBadges = async (userId, forceRefresh = false) => {
    try {
        // 1. Check DB Cache
        const cached = await getCachedBadges(userId);
        if (cached && !forceRefresh) {
            const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
            if (new Date(cached.last_synced_at) > twelveHoursAgo) {
                return cached.badges; // Fresh cache hit
            }
        }

        // 2. Cache Miss or Expired: Compute from external_profiles
        const { rows: profiles } = await pool.query(
            "SELECT platform, platform_data FROM external_profiles WHERE user_id = $1 AND platform IN ('credly', 'leetcode')", 
            [userId]
        );

        const badgesMap = {};
        let badgeCounter = 1;

        profiles.forEach(profile => {
            if (profile.platform === 'credly') {
                const badgeArray = profile.platform_data?.data || [];
                badgeArray.forEach((badge) => {
                    badgesMap[badgeCounter++] = {
                        name: badge.badgeName || "Unknown Badge",
                        image: badge.imageUrl || "",
                        description: badge.description || "",
                        skills: badge.skills || [],
                        issuerName: badge.issuer || "",
                        issuerImageUrl: badge.issuerImageUrl || ""
                    };
                });
            } else if (profile.platform === 'leetcode') {
                const leetcodeData = profile.platform_data || {};
                const badges = leetcodeData.badges || [];
                
                badges.forEach(badge => {
                    let imageUrl = badge.icon || "";
                    if (imageUrl && !imageUrl.startsWith('http')) {
                        imageUrl = `https://leetcode.com${imageUrl}`;
                    }

                    badgesMap[badgeCounter++] = {
                        name: badge.displayName || "LeetCode Achievement",
                        image: imageUrl,
                        description: "LeetCode Badge",
                        skills: [],
                        issuerName: "LeetCode",
                        issuerImageUrl: "https://leetcode.com/static/images/LeetCode_logo_rvs.png"
                    };
                });
            }
        });

        // 3. Upsert into caching table
        await upsertCachedBadges(userId, badgesMap);

        return badgesMap;

    } catch (error) {
        console.error("Error generating badges cache:", error);
        throw error;
    }
};

const getBadgesController = async (req, res) => {
    try {
        const userId = req.user.internalId;
        const badges = await getOrComputeBadges(userId);
        res.status(200).json(badges);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch aggregated badges" });
    }
};

const getPublicBadges = async (userId) => {
    try {
        return await getOrComputeBadges(userId);
    } catch (error) {
        return null;
    }
};

module.exports = {
    getBadgesController,
    getPublicBadges,
    getOrComputeBadges
};
