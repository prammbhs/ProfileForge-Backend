const cron = require('node-cron');
const { getOutdatedProfiles, updateProfileData } = require('../repositories/externalProfile.repository');
const { fetchPlatformData } = require('../services/externalProfile.service');
const { getOrComputeStats } = require('../controllers/codingStats.controller');
const { getOrComputeBadges } = require('../controllers/badges.controller');
const delay = (ms) => new Promise(res => setTimeout(res, ms));

const startSyncService = () => {
    console.log("Starting External Profile Sync Service...");

    // Run every 6 hours to check for outdated profiles
    cron.schedule('0 */6 * * *', async () => {
        try {
            console.log("[Sync Service] Checking for outdated external profiles...");

            // Fetch at most 10 profiles that are >24 hours old
            // We order by last_sync_at ASC so the oldest get synced first.
            const outdatedProfiles = await getOutdatedProfiles(10);

            if (outdatedProfiles.length === 0) {
                console.log("[Sync Service] No outdated profiles found.");
                return;
            }

            console.log(`[Sync Service] Found ${outdatedProfiles.length} outdated profiles to sync. Processing sequentially...`);

            for (const profile of outdatedProfiles) {
                try {
                    console.log(`[Sync Service] Syncing profile for user ${profile.user_id} on ${profile.platform}...`);

                    const rawPlatformData = await fetchPlatformData(profile.platform, profile.username);

                    if (rawPlatformData) {
                        // Update DB including last_sync_at with raw data
                        await updateProfileData(profile.user_id, profile.platform, rawPlatformData);
                        // Proactively compute stats and badges for this user (force refresh since profile data just updated)
                        await Promise.all([
                            getOrComputeStats(profile.user_id, true).catch(e => console.error(`[Sync Service] Stats compute error for user ${profile.user_id}:`, e.message)),
                            getOrComputeBadges(profile.user_id, true).catch(e => console.error(`[Sync Service] Badges compute error for user ${profile.user_id}:`, e.message))
                        ]);
                        console.log(`[Sync Service] Successfully synced profile for user ${profile.user_id} on ${profile.platform}.`);
                    } else {
                        console.log(`[Sync Service] Failed to fetch data for user ${profile.user_id} on ${profile.platform}.`);
                    }

                } catch (err) {
                    console.error(`[Sync Service] Error syncing profile ID ${profile.id}:`, err.message);
                }

                // Add a 5 second delay between processing each profile to dodge rate limit bans
                await delay(5000);
            }

            console.log("[Sync Service] Finished processing batch.");

        } catch (error) {
            console.error("[Sync Service] Error in cron job execution:", error.message);
        }
    });
};

module.exports = startSyncService;
