// middleware/is-admin.js
// Drop-in replacement for the old middleware/is-admin.js.
// Relies on attach-user.js having already run globally.

module.exports = function isAdmin(req, res, next) {
  if (req.user && req.user.isAdmin) {
    return next();
  }
  req.flash('error', 'غير مصرح بالوصول');
  res.redirect('/');
};