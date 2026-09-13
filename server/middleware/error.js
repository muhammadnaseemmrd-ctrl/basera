const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  res.status(404);
  next(error);
};

const errorHandler = (error, req, res, next) => {
  const status = error.statusCode || (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);
  // Previously this only ever surfaced error.stack to the client (and only outside
  // production), meaning a genuine server bug in production left zero trace in the
  // platform's own logs -- only the generic HTTP access line showed up. That's how
  // the Mongoose 9 "next is not a function" hook bug went undetected until it was
  // manually reproduced during live QA; the server logs alone gave no clue. Always
  // log the full error server-side now, regardless of environment or status code.
  console.error(`[${req.method} ${req.originalUrl}] ${status} ${error.message}`, status >= 500 ? error.stack : "");
  res.status(status).json({
    message: error.message || "Server error",
    flaggedFields: error.flaggedFields,
    stack: process.env.NODE_ENV === "production" ? undefined : error.stack
  });
};

module.exports = { notFound, errorHandler };
