export const authorize =
  (...allowedRoles) =>
    (req, res, next) => {
      if (req.user.roles?.includes("admin") || req.user.isAdmin) return next();

      if (allowedRoles.some((role) => req.user.roles?.includes(role))) {
        return next();
      }

      const error = new Error(
        "Permission Denied"
      );
      error.statusCode = 403;
      throw error;
    };

export const onlyAdmin = (req, res, next) => {
  if (req.user.isAdmin) {
    return next();
  }
  const error = new Error(
    "Only admins are allowed to perform this action"
  );
  error.statusCode = 403;
  throw error;
};