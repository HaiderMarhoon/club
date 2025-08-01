module.exports = (req, res, next) => {
  if (req.session.user && req.session.user.isAdmin) {
    return next();
  }
  req.flash('error', 'غير مصرح بالوصول');
  res.redirect('/');
};