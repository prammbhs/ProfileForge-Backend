
const getCredlyUserdata = async (username) => {
    try {
        const response = await fetch(`https://www.credly.com/users/${username}/badges.json`);
        if (!response.ok) {
            throw new Error("Failed to fetch credly userdata");
        }
        const payload = await response.json();
        const data = payload?.data || [];

        // Map the results to specific fields
        const mappedData = data.map(item => ({
            badgeName: item.badge_template?.name,
            description: item.badge_template?.description,
            imageUrl: item.badge_template?.image_url,
            issuer: item.issuer?.entities?.[0]?.entity?.name,
            issuerImageUrl: item.issuer?.entities?.[0]?.entity?.image_url,
            issuedOn: item.issued_at,
            skills: item.badge_template?.skills?.map(skill => skill.name) || []
        }));

        return { data: mappedData };
    } catch (error) {
        console.log("credly userdata error", error.name, error.message);
        return null;
    }
};

module.exports = {
    getCredlyUserdata
};