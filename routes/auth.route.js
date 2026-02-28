const express = require("express");
const { login, logout, signup, confirmSignup, forgotPassword, confirmForgotPassword } = require("../controllers/auth.controller");
const Authenticate = require("../middleware/auth.middleware");
const { validate } = require("../middleware/schemavalidation.middleware");
const { signupSchema, loginSchema, confirmSignupSchema, forgotPasswordSchema, confirmForgotPasswordSchema } = require("../validation/auth.validator");
const router = express.Router();

router.post("/login", validate(loginSchema), login);
router.post("/signup", validate(signupSchema), signup);
router.post("/logout", Authenticate, logout);
router.post("/confirmsignup", validate(confirmSignupSchema), confirmSignup);
router.post("/forgotpassword", validate(forgotPasswordSchema), forgotPassword);
router.post("/confirmforgotpassword", validate(confirmForgotPasswordSchema), confirmForgotPassword);

module.exports = router;