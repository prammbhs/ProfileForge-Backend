const { z } = require("zod");

const urlSchema = z.string().url("Must be a valid URL").optional().nullable();

const projectSchema = z.object({
    name: z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
    description: z.string().max(2000, "Description must be less than 2000 characters").optional().nullable(),
    live_link: urlSchema,
    github_link: urlSchema,
    techstack_used: z.array(z.string().max(50, "Technology name must be less than 50 characters")).max(20, "At most 20 technologies allowed").optional().default([]),
    image_links: z.array(z.string().url("Must be a valid URL")).max(5, "At most 5 image links allowed").optional().default([])
});

const updateProjectSchema = z.object({
    name: z.string().min(1, "Name cannot be empty").max(100, "Name must be less than 100 characters").optional(),
    description: z.string().max(2000, "Description must be less than 2000 characters").optional().nullable(),
    live_link: urlSchema,
    github_link: urlSchema,
    techstack_used: z.array(z.string().max(50)).max(20, "At most 20 technologies allowed").optional(),
    image_links: z.array(z.string().url("Must be a valid URL")).max(5, "At most 5 image links allowed").optional()
});

module.exports = {
    projectSchema,
    updateProjectSchema
};
