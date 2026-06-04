import IORedis from "ioredis";

export const connection = new IORedis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

export async function invalidateTagCache(projectId) {
  if (connection) {
    try {
      await connection.del(`tag_stats_${projectId}`);
    } catch (err) {
      console.error("Redis del error", err);
    }
  }
}

export async function invalidateDocumentCache(projectId) {
  if (connection) {
    try {
      if (projectId) {
        await connection.del(`document_stats_v3_${projectId}`);
      }
    } catch (err) {
      console.error("Redis del error", err);
    }
  }
}

export async function invalidatePunchCache(projectId) {
  if (connection) {
    try {
      if (projectId) {
        await connection.del(`punch_stats_v2_${projectId}`);
      }
    } catch (err) {
      console.error("Redis del error", err);
    }
  }
}
export async function invalidateITRCache(projectId) {
  if (connection) {
    try {
      if (projectId) {
        await connection.del(`itr_stats_${projectId}`);
      }
    } catch (err) {
      console.error("Redis del error", err);
    }
  }
}

export async function invalidateDCNCache(projectId) {
  if (connection) {
    try {
      if (projectId) {
        await connection.del(`dcn_stats_${projectId}`);
      }
    } catch (err) {
      console.error("Redis del error", err);
    }
  }
}

export async function invalidateMocCache(projectId) {
  if (connection) {
    try {
      if (projectId) {
        await connection.del(`moc_stats_${projectId}`);
      }
    } catch (err) {
      console.error("Redis del error", err);
    }
  }
}

export async function invalidateExceptionCache(projectId) {
  if (connection) {
    try {
      if (projectId) {
        await connection.del(`exception_stats_${projectId}`);
      }
    } catch (err) {
      console.error("Redis del error", err);
    }
  }
}
