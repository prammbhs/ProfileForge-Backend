exports.validate = (schema) => (req, res, next) => {
    try {
        schema.parse(req.body);
        next();
    } catch (err) {
        return res.status(400).json({
            message: "Invalid input",
            errors: err.issues ? err.issues.map(e => `${e.path.join('.')}: ${e.message}`) : [{ message: err.message }]
        });
    }
};