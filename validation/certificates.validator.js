const { z } = require("zod");

const certificateSchema = z.object({
    title: z.string().trim().min(2, "Title must be at least 2 characters long").max(100, "Title cannot exceed 100 characters"),
    issuer: z.string().trim().max(100, "Issuer cannot exceed 100 characters").optional(),
    issue_date: z.string().refine((val) => !val || !isNaN(Date.parse(val)), {
        message: "Invalid date format (must be ISO8601 YYYY-MM-DD)",
    }).optional(),
    credential_url: z.string().url("Must be a valid URL").optional(),
    fileKey: z.string().optional(),
    details: z.record(z.any()).optional()
}).strict();

const presignSchema = z.object({
    contentType: z.string().regex(/^[a-zA-Z0-9-]+\/[a-zA-Z0-9-+.]+$/, "Must be a valid MIME type (e.g. image/png)"),
    fileExtension: z.string().regex(/^[a-zA-Z0-9]+$/, "Must be a valid file extension without dots (e.g. png)")
}).strict();

module.exports = {
    certificateSchema,
    presignSchema
};
