// middleware/require-signed-in.js
const requireSignedIn = (req, res, next) => {
  if (req.user) return next();
  req.flash('error', 'يجب تسجيل الدخول أولاً');
  res.redirect('/auth/sign-in');
};

module.exports = requireSignedIn;