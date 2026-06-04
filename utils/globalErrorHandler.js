class GlobalErrorHandler {
    static initialize(app) {
        app.use(this.handleError);
    }

    static handleError(err, req, res, next) {
        console.error({
            name: err.name,
            message: err.message,
            stack: err.stack,
        });

        if (err.statusCode) {
            res.status(err.statusCode).json({
                error: err.message,
                success: false,
            });
        } else {
            res.status(500).json({
                error: "Internal Server Error",
                success: false,
            });
        }
    }

    static logError(error, context = {}) {
        console.error({
            name: error.name,
            message: error.message,
            stack: error.stack,
            context,
            timestamp: new Date().toISOString(),
        });
    }

    static createCustomError(message, statusCode = 500) {
        const error = new Error(message);
        error.statusCode = statusCode;
        return error;
    }
}

export default GlobalErrorHandler;
