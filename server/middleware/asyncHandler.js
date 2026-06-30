// Wraps async route handlers so thrown errors reach the global error middleware
// instead of leaving the request hanging.
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
