const { z } = require("zod");

const emailValidation = z.string()
    .trim()
    .email("Invalid email address")
    .max(255, "Email cannot exceed 255 characters");

const passwordValidation = z.string()
    .min(6, "Password must be at least 6 characters long")
    .max(128, "Password cannot exceed 128 characters");

const signupSchema = z.object({
    name: z.string()
        .trim()
        .min(3, "Name must be at least 3 characters long")
        .max(100, "Name cannot exceed 100 characters")
        .regex(/^[a-zA-Z0-9\s.,'-]+$/, "Name contains invalid characters"),
    email: emailValidation,
    password: passwordValidation,
}).strict();

const loginSchema = z.object({
    email: emailValidation,
    password: passwordValidation,
}).strict();

const confirmSignupSchema = z.object({
    email: emailValidation,
    code: z.string()
        .min(6, "Code must be 6 digits")
        .max(6, "Code must be 6 digits")
        .regex(/^[0-9]+$/, "Code must be numeric"),
}).strict();

const forgotPasswordSchema = z.object({
    email: emailValidation,
}).strict();

const confirmForgotPasswordSchema = z.object({
    email: emailValidation,
    code: z.string()
        .min(6, "Code must be 6 digits")
        .max(6, "Code must be 6 digits")
        .regex(/^[0-9]+$/, "Code must be numeric"),
    password: passwordValidation,
}).strict();

module.exports = { signupSchema, loginSchema, confirmSignupSchema, forgotPasswordSchema, confirmForgotPasswordSchema };