const {
    addActivityEvent,
    incrementHeatmapCount,
    purgePlatformActivityEvents
} = require("../repositories/heatmap.repository");

/**
 * Triggers on both profile /add and background /sync loops.
 * 1. Purges all existing timeline events for this user+platform
 * 2. Parses the raw platform data into standardized activity_events
 * 3. Builds up the heatmap tables
 */
const categorizeAndIngestPlatformData = async (userId, externalProfileId, platform, rawData) => {
    try {
        // ALWAYS purge the platform's trace first. This prevents duplicating commits 
        // over and over again on daily syncs because github timelines don't cleanly diff.
        // (Note: Currently purges entire heatmap cache for this user in Heatmap Repo, to be rebuilt instantly)
        if (userId) {
            await purgePlatformActivityEvents(userId, platform);
        }

        const aggregatedEventsMap = new Map(); // used to unique-increment daily heatmaps later
        let parsedEvents = [];

        switch (platform.toLowerCase()) {
            case 'github':
                // Parse commits
                if (rawData.profile && rawData.profile.repos) {
                    rawData.profile.repos.forEach(repo => {
                        if (repo.commits && repo.commits.length > 0) {
                            repo.commits.forEach(commit => {
                                const dayDate = commit.date.substring(0, 10); // YYYY-MM-DD
                                parsedEvents.push({
                                    category: "projects",
                                    activityType: "commit",
                                    activityDate: dayDate,
                                    title: `Commit in ${repo.name}`,
                                    url: commit.url,
                                    metadata: { sha: commit.sha, description: commit.description }
                                });
                            });
                        }
                    });
                }

                // Parse GitHub public events timeline
                if (rawData.events && Array.isArray(rawData.events)) {
                    rawData.events.forEach(event => {
                        const dayDate = event.created_at.substring(0, 10);
                        let title = `GitHub ${event.type}`;
                        let url = `https://github.com/${event.repo?.name}`;

                        if (event.type === 'PushEvent') title = `Pushed to ${event.repo.name}`;
                        if (event.type === 'CreateEvent') title = `Created ${event.payload.ref_type} ${event.repo.name}`;

                        parsedEvents.push({
                            category: "learning", // Or 'projects'
                            activityType: event.type,
                            activityDate: dayDate,
                            title: title,
                            url: url,
                            metadata: event.payload
                        });
                    });
                }
                break;

            case 'leetcode':
                if (rawData.recentSubmissionList && Array.isArray(rawData.recentSubmissionList)) {
                    rawData.recentSubmissionList.forEach(sub => {
                        // Leetcode timestamps are raw unix seconds
                        const dateObj = new Date(sub.timestamp * 1000);
                        const dayDate = dateObj.toISOString().substring(0, 10);

                        if (sub.statusDisplay === 'Accepted') {
                            parsedEvents.push({
                                category: "coding",
                                activityType: "solved_problem",
                                activityDate: dayDate,
                                title: `Solved ${sub.title}`,
                                url: `https://leetcode.com/submissions/detail/${sub.titleSlug}`,
                                metadata: { lang: sub.lang }
                            });
                        }
                    });
                }
                break;

            case 'credly':
                // rawData is an object like { data: [{ badgeObject }] }
                if (rawData.data && Array.isArray(rawData.data)) {
                    rawData.data.forEach(badge => {
                        const dayDate = badge.issued_at_date || badge.issued_at.substring(0, 10);
                        parsedEvents.push({
                            category: "certificates",
                            activityType: "badge",
                            activityDate: dayDate,
                            title: `Earned ${badge.badge_template?.name || 'Badge'}`,
                            url: badge.badge_template?.url || '',
                            metadata: { issuer: badge.issuer?.entities?.[0]?.entity?.name }
                        });
                    });
                }
                break;

            default:
                break;
        }

        // Run the DB Upserts
        for (const ev of parsedEvents) {
            if (userId) {
                // 1. Insert into Timeline
                await addActivityEvent(
                    userId,
                    externalProfileId,
                    platform.toLowerCase(),
                    ev.category,
                    ev.activityType,
                    ev.activityDate,
                    ev.title,
                    ev.url,
                    ev.metadata
                );

                // 2. Track daily heatmap totals
                // This will execute an UPSERT mapping +1 to the user's specific calendar day.
                // We track it in memory so we only hit the DB once per unique date, or just hit it sequentially.
                // For simplicity, we just hit incrementHeatmapCount. (Can be optimized to batch later).
                await incrementHeatmapCount(userId, ev.activityDate);
            }
        }

        return rawData; // pass the original schema down the chain untouched for legacy DB requirements
    } catch (e) {
        console.error(`Categorization & Ingestion Error for ${platform}:`, e.message);
        return rawData;
    }
};

module.exports = {
    categorizeAndIngestPlatformData
};
