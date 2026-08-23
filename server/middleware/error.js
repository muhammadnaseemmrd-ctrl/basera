const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  res.status(404);
  next(error);
};

const errorHandler = (error, req, res, next) => {
  const status = error.statusCode || (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);
  res.status(status).json({
    message: error.message || "Server error",
    flaggedFields: error.flaggedFields,
    stack: process.env.NODE_ENV === "production" ? undefined : error.stack
  });
};

module.exports = { notFound, errorHandler };
