
// middleware/is-signed-in.js
// Drop-in replacement for the old middleware/is-signed-in.js.
// Relies on attach-user.js having already run globally.
 
const isSignedIn = (req, res, next) => {
  if (req.user) return next();
  res.redirect('/auth/sign-in');
};
 
module.exports = isSignedIn;
 
