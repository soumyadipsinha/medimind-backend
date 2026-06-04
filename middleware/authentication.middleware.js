import jwt from "jsonwebtoken";
import User from "../api/user/user.model.js";

export const verify = async (req, res, next) => {
    const cookieToken = req.cookies.accessToken;
    const authHeader = req.headers.authorization || "";
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const token = cookieToken || bearerToken;
    if (!token) {
        console.warn(`Auth failed: No token found for ${req.method} ${req.url}`);
        return res.status(401).json({ message: "Unauthorized: No token provided" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Repair missing name for older tokens (Auto-Repair)
        if (!decoded.name && decoded.id) {
            try {
                const user = await User.findById(decoded.id).select("name");
                if (user) {
                    decoded.name = user.name;
                }
            } catch (dbErr) {
                console.error("Failed to fetch user name for token repair:", dbErr);
            }
        }

        req.user = decoded;

        next();
    } catch (err) {
        console.warn(`Auth failed: Invalid token for ${req.method} ${req.url}: ${err.message}`);
        return res.status(401).json({ message: "Unauthorized: Invalid session" });
    }
};
