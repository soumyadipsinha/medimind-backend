export function accessQuery(req) {
  const { status, ...restQuery } = req.query;
  const techParams = ["page", "pageSize", "offset", "limit", "search", "sortModel", "filterModel", "groupKeys", "groupFields"];
  const filteredRestQuery = Object.fromEntries(
    Object.entries(restQuery).filter(
      ([k, v]) =>
        v !== "" &&
        v !== null &&
        v !== undefined &&
        !techParams.some((tp) => k === tp || k.startsWith(`${tp}[`))
    )
  );
  
  const query = {
    projectId: req.projectId,
    ...filteredRestQuery,
  };

  const isAdmin =
    req.user.roles?.includes("admin") || req.user.isAdmin;


  if (status === "active") {
    query.isActive = true;
  } else if (status === "inactive") {
    // only admin can access inactive
    if (isAdmin) {
      query.isActive = false;
    } else {
      query.isActive = true; // force active for non-admin
    }
  } else {
    // No status passed
    if (!isAdmin) {
      query.isActive = true;
    }
    // if admin → do nothing (gets both)
  }

  // Restricted to company
  if (req.companyId) {
    query.company = req.companyId;
  }

  return query;
}
