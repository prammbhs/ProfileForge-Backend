const { pool } = require("../utils/postgreClient");
const { getCachedBadges, upsertCachedBadges } = require("../repositories/badges.repository");

const getOrComputeBadges = async (userId) => {
    try {
        // 1. Check DB Cache
        const cached = await getCachedBadges(userId);
        if (cached) {
            const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
            if (new Date(cached.last_synced_at) > twelveHoursAgo) {
                return cached.badges; // Fresh cache hit
            }
        }

        // 2. Cache Miss or Expired: Compute from external_profiles
        // Currently, we're relying predominantly on Credly for badges. 
        const { rows: profiles } = await pool.query("SELECT platform, platform_data FROM external_profiles WHERE user_id = $1 AND platform = 'credly'", [userId]);

        const badgesMap = {};

        profiles.forEach(profile => {
            if (profile.platform === 'credly') {
                const badgeArray = profile.platform_data?.data || [];

                badgeArray.forEach((badge, index) => {
                    // Map arrays into the specified keyed object format.
                    // If the item lacks a distinct unique ID in the credly payload, 
                    // user requested { id_1: { name, image, description, skills, issuer .. } } format.
                    // We'll use a 1-based index (or fallback ID if available).
                    const uniqueId = index + 1;

                    badgesMap[uniqueId] = {
                        name: badge.badgeName || "Unknown Badge",
                        image: badge.imageUrl || "",
                        description: badge.description || "",
                        skills: badge.skills || [],
                        issuerName: badge.issuer || "",
                        issuerImageUrl: badge.issuerImageUrl || ""
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

exports.getBadgesController = async (req, res) => {
    try {
        const userId = req.user.internalId;
        const badges = await getOrComputeBadges(userId);
        res.status(200).json(badges);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch aggregated badges" });
    }
};

exports.getPublicBadges = async (userId) => {
    try {
        return await getOrComputeBadges(userId);
    } catch (error) {
        return null; // Ensure this doesn't crash the unified API Key route
    }
};
