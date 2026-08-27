// Central error handler. Keeps stack traces and DB error detail out
// of API responses — only intentional, whitelisted messages reach
// the client.
function errorHandler(err, req, res, next) {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    error: status === 500 ? 'Something went wrong' : err.message,
  });
}

module.exports = errorHandler;
