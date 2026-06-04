import axios from "axios";
import http from "http";
import https from "https";

// ⭐ Persistent connections for better performance
const axiosInstance = axios.create({
    httpAgent: new http.Agent({ keepAlive: true }),
    httpsAgent: new https.Agent({ keepAlive: true }),
});

class SharepointService {
    constructor() {
        this.token = null;
        this.tokenExpiry = null;
        this.queue = [];
        this.isProcessing = false;
    }

    /*
        LAZY CONFIG LOADER (Ensures DOTENV has run)
   */
    _loadConfig() {
        this.tenantId = process.env.SHAREPOINT_TENANT_ID;
        this.clientId = process.env.SHAREPOINT_CLIENT_ID;
        this.clientSecret = process.env.SHAREPOINT_CLIENT_SECRET;

        if (!this.tenantId || !this.clientId || !this.clientSecret) {
            throw new Error("Sharepoint Credentials (TenantId, ClientId, or Secret) are missing in environment variables");
        }
    }

    /*
        TOKEN MANAGER (SHARED FOR ALL DRIVES)
   */
    async getAccessToken() {
        if (!this.tenantId) this._loadConfig();

        if (this.token && this.tokenExpiry && Date.now() < this.tokenExpiry) {
            return this.token;
        }

        const url = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;

        const params = new URLSearchParams();
        params.append("client_id", this.clientId);
        params.append("client_secret", this.clientSecret);
        params.append("grant_type", "client_credentials");
        params.append("scope", "https://graph.microsoft.com/.default");

        const res = await axiosInstance.post(url, params);

        this.token = res.data.access_token;
        this.tokenExpiry = Date.now() + (res.data.expires_in - 60) * 1000;

        return this.token;
    }

    /*
        GRAPH REQUEST WITH RETRY
   */
    async graphRequest(config, retries = 3) {
        try {
            const token = await this.getAccessToken();

            return await axiosInstance({
                ...config,
                headers: {
                    Authorization: `Bearer ${token}`,
                    ...(config.headers || {}),
                },
            });
        } catch (err) {
            if (retries > 0) {
                console.log("Retrying Graph API...");
                await new Promise(r => setTimeout(r, 1000));
                return this.graphRequest(config, retries - 1);
            }
            console.error(err.response?.data || err.message);
            throw err;
        }
    }

    /*
        DRIVE BASE URL
   */
    getDriveBaseUrl(driveId) {
        if (!driveId) throw new Error("driveId required");
        return `https://graph.microsoft.com/v1.0/drives/${driveId}`;
    }

    /*
        CREATE FOLDER IF NOT EXISTS
   */
    async ensureFolder(driveId, folderPath) {
        const baseUrl = this.getDriveBaseUrl(driveId);

        const parts = folderPath.split("/");
        let currentPath = "";

        for (const part of parts) {
            currentPath = currentPath ? `${currentPath}/${part}` : part;

            try {
                await this.graphRequest({
                    method: "GET",
                    url: `${baseUrl}/root:/${currentPath}`,
                });
            } catch {
                await this.graphRequest({
                    method: "POST",
                    url: `${baseUrl}/root:/${currentPath}:/children`,
                    data: {
                        name: part,
                        folder: {},
                        "@microsoft.graph.conflictBehavior": "replace",
                    },
                });
            }
        }
    }

    /*
        SMALL FILE UPLOAD
   */
    async uploadSmallFile(driveId, folderPath, fileName, buffer) {
        const baseUrl = this.getDriveBaseUrl(driveId);

        await this.ensureFolder(driveId, folderPath);

        const url = `${baseUrl}/root:/${folderPath}/${fileName}:/content`;

        const res = await this.graphRequest({
            method: "PUT",
            url,
            data: buffer,
            headers: {
                "Content-Type": "application/octet-stream",
            },
        });

        return res.data;
    }

    /*
        LARGE FILE UPLOAD (CHUNK SESSION)
   */
    async uploadLargeFile(driveId, folderPath, fileName, buffer) {
        const baseUrl = this.getDriveBaseUrl(driveId);

        await this.ensureFolder(driveId, folderPath);

        const sessionRes = await this.graphRequest({
            method: "POST",
            url: `${baseUrl}/root:/${folderPath}/${fileName}:/createUploadSession`,
            data: {
                item: {
                    "@microsoft.graph.conflictBehavior": "replace",
                    name: fileName,
                },
            },
        });

        const uploadUrl = sessionRes.data.uploadUrl;

        const chunkSize = 5 * 1024 * 1024;
        let start = 0;

        let lastRes;
        while (start < buffer.length) {
            const end = Math.min(start + chunkSize, buffer.length);

            lastRes = await axiosInstance.put(uploadUrl, buffer.slice(start, end), {
                headers: {
                    "Content-Length": end - start,
                    "Content-Range": `bytes ${start}-${end - 1}/${buffer.length}`,
                },
            });

            start = end;
        }

        return lastRes.data;
    }

    /*
        BULK UPLOAD (AUTO SMALL/LARGE)
   */
    async bulkUpload(driveId, folderPath, files) {
        const results = [];

        for (const file of files) {
            if (file.buffer.length < 4 * 1024 * 1024) {
                const res = await this.uploadSmallFile(
                    driveId,
                    folderPath,
                    file.name,
                    file.buffer
                );
                results.push(res);
            } else {
                const res = await this.uploadLargeFile(
                    driveId,
                    folderPath,
                    file.name,
                    file.buffer
                );
                results.push(res);
            }
        }

        return results;
    }

    /*
        CREATE PUBLIC SHARE LINK
   */
    async createShareLink(driveId, itemId) {
        const baseUrl = this.getDriveBaseUrl(driveId);

        const res = await this.graphRequest({
            method: "POST",
            url: `${baseUrl}/items/${itemId}/createLink`,
            data: {
                type: "view",
                scope: "anonymous",
            },
        });

        return res.data.link.webUrl;
    }


    /*
      STREAM FILE CONTENT (CDN STYLE)
  */
    async streamFile(driveId, itemId, req, res, fallbackContentType, totalFileSize) {
        const token = await this.getAccessToken();

        const axiosConfig = {
            method: "GET",
            url: `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/content`,
            responseType: "stream",
            headers: {
                Authorization: `Bearer ${token}`,
                ...(req.headers.range && { Range: req.headers.range }),
            },
            validateStatus: () => true,
        };

        const response = await axiosInstance(axiosConfig);

        // SOCKET PROGRESS TRACKING
        const socketId = req.query.socketId;
        const currentSize = parseInt(response.headers['content-length'] || 0);

        // Check if start of file
        let isBeginning = true;
        const contentRange = response.headers['content-range'];
        if (contentRange) {
            const rangeStart = parseInt(contentRange.split(' ')[1]?.split('-')[0] || "0");
            if (rangeStart > 0) isBeginning = false;
        }

        if (socketId && currentSize > 1024 && isBeginning) {
            try {
                const { getIO } = await import("../config/socket.js");
                const io = getIO();
                let loaded = 0;

                response.data.on("data", (chunk) => {
                    loaded += chunk.length;
                    const progress = Math.round((loaded / currentSize) * 100);
                    io.to(socketId).emit("preview-progress", {
                        itemId,
                        progress: Math.min(progress, 100),
                        status: progress >= 100 ? 'completed' : 'loading'
                    });
                });
            } catch (err) {
                console.error("Socket Progress Error:", err.message);
            }
        }

        res.status(response.status);

        // Copy only essential headers to avoid conflicts
        const essentialHeaders = [
            'content-length',
            'content-range',
            'accept-ranges',
            'etag',
            'last-modified'
        ];

        essentialHeaders.forEach(header => {
            if (response.headers[header]) {
                res.set(header, response.headers[header]);
            }
        });

        // ⭐ Handle Content-Type with fallback
        const ct = response.headers['content-type'];
        if (ct && ct !== 'application/octet-stream') {
            res.set('Content-Type', ct);
        } else if (fallbackContentType) {
            res.set('Content-Type', fallbackContentType);
        }

        // ⭐ Force inline preview
        res.set('Content-Disposition', 'inline');

        // ⭐ Browser Cache Headers (Optimize CDN style)
        res.set('Cache-Control', 'public, max-age=31536000, immutable');

        response.data.pipe(res);
    }

    /*
        GET FILE BUFFER (For internal processing)
    */
    async getFileBuffer(driveId, itemId) {
        const token = await this.getAccessToken();

        const axiosConfig = {
            method: "GET",
            url: `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/content`,
            responseType: "arraybuffer",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        };

        const response = await axiosInstance(axiosConfig);
        return Buffer.from(response.data);
    }

    /*
        UPDATE LIST ITEM FIELDS (METADATA)
   */
    async updateListItemFields(driveId, itemId, fields) {
        const baseUrl = this.getDriveBaseUrl(driveId);

        return this.graphRequest({
            method: "PATCH",
            url: `${baseUrl}/items/${itemId}/listItem/fields`,
            data: fields,
        });
    }

    /*
        GET LIST COLUMNS (FOR DISCOVERY)
   */
    async getListColumns(driveId) {
        const baseUrl = this.getDriveBaseUrl(driveId);
        const res = await this.graphRequest({
            method: "GET",
            url: `${baseUrl}/list/columns`,
        });
        return res.data.value;
    }

    /*
        SET PERMISSION (VIEW / EDIT)
   */
    async setPermission(driveId, itemId, role = "view") {
        const baseUrl = this.getDriveBaseUrl(driveId);

        const roles = role === "edit" ? ["write"] : ["read"];

        return this.graphRequest({
            method: "POST",
            url: `${baseUrl}/items/${itemId}/invite`,
            data: {
                requireSignIn: false,
                roles,
                sendInvitation: false,
            },
        });
    }

    /*
        DELETE FILE
   */
    async deleteFile(driveId, itemId) {
        const baseUrl = this.getDriveBaseUrl(driveId);
        return this.graphRequest({
            method: "DELETE",
            url: `${baseUrl}/items/${itemId}`,
        });
    }

    /*
        SIMPLE QUEUE SYSTEM
   */
    addToQueue(task) {
        this.queue.push(task);
        this.processQueue();
    }

    async processQueue() {
        if (this.isProcessing) return;

        this.isProcessing = true;

        while (this.queue.length) {
            const task = this.queue.shift();

            try {
                await task();
            } catch (err) {
                console.error("Queue Task Failed:", err.message);
            }
        }

        this.isProcessing = false;
    }
}

// ⭐ Export Singleton Instance
export default new SharepointService();
