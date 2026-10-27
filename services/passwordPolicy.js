// Used for newly created accounts only; existing passwords remain valid.
function strongPassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) return false;
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/];
  return classes.filter((pattern) => pattern.test(password)).length >= 3;
}
module.exports = { strongPassword };
