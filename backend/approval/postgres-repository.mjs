const STATES = [
  "CONVERSATIONAL_INTAKE", "ATTACHMENTS_RECEIVED", "ASSETS_MATERIALIZED", "INPUT_RECEIVED", "IMAGE_ANALYZED", "BRIEF_READY",
  "DRAFT_GENERATED", "POLICY_REVIEWED", "NEEDS_HUMAN_APPROVAL", "APPROVED",
  "CHANGES_REQUESTED", "REJECTED", "PUBLISHING", "PUBLISHED", "FAILED"
];

function dbError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function assertStateValue(state) {
  if (!STATES.includes(state)) throw dbError(`Unknown workflow state: ${state}`, "INVALID_STATE");
}

function repositoryForClient(client) {
  return {
    async getJobForUpdate(postJobId) {
      const result = await client.query(
        "SELECT post_job_id, tenant_id, page_id, state, current_version FROM jobs WHERE post_job_id = $1 FOR UPDATE",
        [postJobId]
      );
      if (!result.rows[0]) throw dbError("Job not found", "NOT_FOUND");
      return result.rows[0];
    },
    async getVersion(postJobId, version) {
      const result = await client.query(
        "SELECT post_job_id, version, status, document, content_hash, asset_manifest_hash FROM post_versions WHERE post_job_id = $1 AND version = $2",
        [postJobId, version]
      );
      return result.rows[0] || null;
    },
    async insertReviewTask({ reviewId, postJobId, version, tenantId, reviewUrl, createdBy }) {
      await client.query(
        `INSERT INTO review_tasks (review_id, post_job_id, version, tenant_id, status, review_url, created_by)
         VALUES ($1, $2, $3, $4, 'NEEDS_HUMAN_APPROVAL', $5, $6)`,
        [reviewId, postJobId, version, tenantId, reviewUrl, createdBy]
      );
    },
    async updateJobState(postJobId, state) {
      assertStateValue(state);
      await client.query("UPDATE jobs SET state = $2, updated_at = now() WHERE post_job_id = $1", [postJobId, state]);
    },
    async insertApproval(approval) {
      await client.query(
        `INSERT INTO approvals
          (approval_id, post_job_id, version, decision, reviewer_id, reviewer_role,
           reviewer_authenticated, reviewed_content_hash, reviewed_asset_ids,
           reviewed_asset_hash, reviewed_page_id, institutional_attestation,
           reviewer_attestation, reviewed_at, expires_at, review_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12::jsonb, $13::jsonb, $14, $15,
           (SELECT review_id FROM review_tasks WHERE post_job_id = $2 AND version = $3 ORDER BY created_at DESC LIMIT 1))`,
        [approval.approvalId, approval.postJobId, approval.version, approval.decision, approval.reviewerId,
          approval.reviewerRole, approval.reviewerAuthenticated, approval.reviewedContentHash,
          JSON.stringify(approval.reviewedAssetIds), approval.reviewedAssetHash, approval.reviewedPageId,
          JSON.stringify(approval.institutionalAttestation || null), JSON.stringify(approval.reviewerAttestation || null),
          approval.reviewedAt, approval.expiresAt]
      );
    },
    async updateVersionStatus(postJobId, version, status) {
      await client.query("UPDATE post_versions SET status = $3 WHERE post_job_id = $1 AND version = $2", [postJobId, version, status]);
    },
    async updateReviewStatus(postJobId, status, feedback) {
      await client.query("UPDATE review_tasks SET status = $2, review_feedback = $3, updated_at = now() WHERE post_job_id = $1 AND status = 'NEEDS_HUMAN_APPROVAL'", [postJobId, status, feedback || null]);
    },
    async appendAudit({ postJobId, tenantId, actorId, eventType, metadata }) {
      await client.query(
        "INSERT INTO audit_events (post_job_id, tenant_id, actor_id, event_type, metadata) VALUES ($1, $2, $3, $4, $5::jsonb)",
        [postJobId, tenantId, actorId, eventType, JSON.stringify(metadata || {})]
      );
    }
  };
}

export function createPostgresRepository(pool) {
  if (!pool?.connect || !pool?.query) throw new Error("A pg Pool is required");
  return {
    async transaction(callback) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await callback(repositoryForClient(client));
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },
    async getReview(postJobId) {
      const result = await pool.query(
        `SELECT review_id, post_job_id, version, tenant_id, status, review_url,
                created_by, created_at, updated_at
         FROM review_tasks WHERE post_job_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [postJobId]
      );
      if (!result.rows[0]) throw dbError("Review not found", "NOT_FOUND");
      return result.rows[0];
    },
    async getReviewById(reviewId) {
      const result = await pool.query(
        `SELECT review_id, post_job_id, version, tenant_id, status, review_url,
                created_by, created_at, updated_at
         FROM review_tasks WHERE review_id = $1`,
        [reviewId]
      );
      if (!result.rows[0]) throw dbError("Review not found", "NOT_FOUND");
      return result.rows[0];
    },
    async getReviewPreviewById(reviewId) {
      const result = await pool.query(
        `SELECT rt.review_id, rt.post_job_id, rt.version, rt.tenant_id, rt.status,
                rt.review_url, rt.created_by, rt.created_at, rt.updated_at,
                j.page_id, COALESCE(pc.page_name, 'Fanpage') AS page_name,
                pv.document
         FROM review_tasks rt
         JOIN jobs j ON j.post_job_id = rt.post_job_id
         JOIN post_versions pv ON pv.post_job_id = rt.post_job_id AND pv.version = rt.version
         LEFT JOIN page_connections pc ON pc.page_id = j.page_id
         WHERE rt.review_id = $1`,
        [reviewId]
      );
      if (!result.rows[0]) throw dbError("Review not found", "NOT_FOUND");
      const row = result.rows[0];
      const assetIds = row.document.asset_ids ?? [];
      const assets = assetIds.length
        ? (await pool.query(
            "SELECT asset_id, storage_ref, mime_type, byte_size FROM assets WHERE asset_id = ANY($1::text[])",
            [assetIds]
          )).rows
        : [];
      return { ...row, assets };
    }
  };
}

export async function createPool(config = process.env) {
  if (!config.DATABASE_URL) throw new Error("DATABASE_URL is required");
  let Pool;
  try {
    ({ Pool } = await import("pg"));
  } catch {
    throw new Error("PostgreSQL support is optional. Install pg only when enabling the PostgreSQL extension.");
  }
  return new Pool({ connectionString: config.DATABASE_URL });
}
