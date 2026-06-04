import ActivityLog from "../api/activity-log/activity-log.model.js";

async function addActivityLog(req, action, type = "neutral") {
  const activityLog = new ActivityLog({
    user: req.user.id,
    action,
    projectId: req.projectId,
    type,
  });
  await activityLog.save();
}

export default addActivityLog;
