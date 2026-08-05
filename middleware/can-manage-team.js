module.exports = function canManageTeam(req, res, next) {
  if (req.user && (req.user.isAdmin || req.user.isCoach)) return next();
  if (req.accepts('json')) return res.status(403).json({ success: false, message: 'ليس لديك صلاحية تعديل بيانات الفريق.' });
  req.flash('error', 'ليس لديك صلاحية تعديل بيانات الفريق.');
  return res.redirect('/');
};
