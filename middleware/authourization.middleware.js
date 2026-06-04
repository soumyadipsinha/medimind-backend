import ProjectMember from "../api/master-data/project-member/project-member.model.js";

export const authorize =
  (...allowedRoles) =>
    (req, res, next) => {
      if (req.user.roles?.includes("admin") || req.user.isAdmin) return next();

      if (allowedRoles.some((role) => req.user.roles.includes(role))) {
        return next();
      }

      const error = new Error("Permission Denied");
      error.statusCode = 403;
      throw error;
    };

export const onlyAdmin = (req, res, next) => {
  if (req.user.isAdmin) {
    return next();
  }
  const error = new Error("Only admins are allowed to perform this action");
  error.statusCode = 403;
  throw error;
};

export async function projectContext(req, res, next) {
  const projectId = req.headers["x-project-id"] || req.query.projectId;
  if (!projectId) {
    return res.status(400).send("ProjectId missing");
  }

  if (req.user.isAdmin) {
    req.projectId = projectId;
    return next();
  }

  const membership = await ProjectMember.findOne({
    userId: req.user.id,
    projectId,
  });

  if (!membership) {
    return res.status(403).send("Not a project member");
  }

  req.projectId = projectId;
  req.user.roles = membership.roles;

  next();
}

export const companyContext = (req, res, next) => {
  if (req.user?.isAdmin || req.user.roles?.includes("admin")) {
    return next();
  }

  if (req.user?.company) {
    req.companyId = req.user.company;
    return next();
  }

  next();
};
