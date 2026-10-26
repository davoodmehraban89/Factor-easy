const allowedOrigins = new Set(["https://factoreasy.ir", "https://www.factoreasy.ir"]);
const allowedHeaders = "authorization,apikey,content-type,x-client-info";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const recoveryRedirect = "https://factoreasy.ir/?finora_recovery=1";
const recoveryFields = new Set(["action", "user_id", "organization_id"]);
const provisionErrors = new Set(["email_exists", "user_already_exists", "phone_exists", "unexpected_failure", "validation_failed", "weak_password"]);

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://factoreasy.ir",
    "Access-Control-Allow-Headers": allowedHeaders,
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  };
}
function reply(status, body, origin) {
  return new Response(JSON.stringify(body), {status, headers: cors(origin)});
}
function validEmail(raw) {
  return typeof raw === "string" && raw.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(raw);
}
function strongPassword(value) {
  return value.length >= 12 && value.length <= 128 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value) && /[^A-Za-z\d]/.test(value);
}
class AuthorizationReadError extends Error {}
async function readOne(query) {
  try {
    const {data, error} = await query.maybeSingle();
    if (error) throw new AuthorizationReadError();
    return data;
  } catch {
    throw new AuthorizationReadError();
  }
}
async function readRows(query) {
  try {
    const {data, error} = await query;
    if (error || (data !== null && !Array.isArray(data))) throw new AuthorizationReadError();
    return data || [];
  } catch {
    throw new AuthorizationReadError();
  }
}
function permitsManagement(permission) {
  return ["core", "full_suite"].includes(permission.module_key) && Array.isArray(permission.capabilities) && permission.capabilities.includes("configure");
}
async function canRequestOrganizationRecovery(server, actorId, targetId, organizationId) {
  const organization = await readOne(server.from("organizations").select("id,status").eq("id", organizationId).eq("status", "active"));
  if (!organization) return false;
  const [actor, target] = await Promise.all([
    readOne(server.from("organization_members").select("id,is_owner").eq("organization_id", organizationId).eq("user_id", actorId).eq("status", "active")),
    readOne(server.from("organization_members").select("id").eq("organization_id", organizationId).eq("user_id", targetId).eq("status", "active")),
  ]);
  if (!actor || !target) return false;
  if (actor.is_owner === true) return true;
  const direct = await readRows(server.from("member_module_permissions").select("module_key,capabilities").eq("organization_id", organizationId).eq("member_id", actor.id));
  if (direct.some(permitsManagement)) return true;
  const assignments = await readRows(server.from("organization_member_roles").select("role_id").eq("organization_id", organizationId).eq("member_id", actor.id).eq("active", true));
  const assignedIds = assignments.map(row => row.role_id).filter(id => typeof id === "string" && uuid.test(id));
  if (!assignedIds.length) return false;
  const roles = await readRows(server.from("organization_roles").select("id").eq("organization_id", organizationId).in("id", assignedIds).eq("active", true));
  if (!roles.length) return false;
  const permissions = await readRows(server.from("organization_role_permissions").select("module_key,capabilities").eq("organization_id", organizationId).in("role_id", roles.map(row => row.id)));
  return permissions.some(permitsManagement);
}

export function createAdminUserManagementHandler({createClient, getEnv, logger = console}) {
  return async function handleAdminUserManagement(request) {
    const origin = request.headers.get("Origin");
    if (origin && !allowedOrigins.has(origin)) return reply(403, {error: "origin_not_allowed"}, origin);
    if (request.method === "OPTIONS") return new Response(null, {status: 204, headers: cors(origin)});
    if (request.method !== "POST") return reply(405, {error: "method_not_allowed"}, origin);
    const bearer = request.headers.get("Authorization") || "";
    if (!/^Bearer\s+[^\s]+$/i.test(bearer)) return reply(401, {error: "unauthorized"}, origin);
    const projectUrl = getEnv("SUPABASE_URL");
    const anon = getEnv("SUPABASE_ANON_KEY");
    const service = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    if (!projectUrl || !anon || !service) return reply(503, {error: "server_configuration_missing"}, origin);
    try {
      const authOptions = {auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, flowType: "implicit"}};
      const caller = createClient(projectUrl, anon, authOptions);
      const token = bearer.replace(/^Bearer\s+/i, "");
      const {data: {user}, error: userError} = await caller.auth.getUser(token);
      if (userError || !user || !uuid.test(user.id)) return reply(401, {error: "unauthorized"}, origin);
      const server = createClient(projectUrl, service, authOptions);
      const profile = await readOne(server.from("profiles").select("id,role").eq("id", user.id));
      if (!profile || profile.id !== user.id) throw new AuthorizationReadError();
      const raw = await request.text();
      if (raw.length > 8192) return reply(413, {error: "payload_too_large"}, origin);
      let body;
      try { body = JSON.parse(raw); } catch { return reply(400, {error: "invalid_json"}, origin); }
      if (!body || typeof body !== "object" || Array.isArray(body)) return reply(400, {error: "invalid_json"}, origin);
      if (body.action === "send_recovery") {
        const target = body.user_id;
        const organizationId = body.organization_id ?? null;
        if (Object.keys(body).some(key => !recoveryFields.has(key)) || typeof target !== "string" || !uuid.test(target) || (organizationId !== null && (typeof organizationId !== "string" || !uuid.test(organizationId)))) {
          return reply(400, {error: "invalid_recovery_request"}, origin);
        }
        // Membership management never grants control of a user's global Auth password.
        if (profile.role !== "admin" && (!organizationId || !await canRequestOrganizationRecovery(server, user.id, target, organizationId))) {
          return reply(403, {error: "organization_access_denied"}, origin);
        }
        const {data, error: targetError} = await server.auth.admin.getUserById(target);
        const targetUser = data?.user;
        if (targetError || targetUser?.id !== target || !validEmail(targetUser.email) || typeof targetUser.email_confirmed_at !== "string" || !Number.isFinite(Date.parse(targetUser.email_confirmed_at))) {
          return reply(400, {error: "recovery_target_unavailable"}, origin);
        }
        let recoveryError;
        try {
          ({error: recoveryError} = await caller.auth.resetPasswordForEmail(targetUser.email, {redirectTo: recoveryRedirect}));
        } catch {
          recoveryError = {code: "request_failed"};
        }
        const audit = {actor: user.id, user_id: target, organization_id: organizationId, outcome: "requested"};
        if (recoveryError) {
          const limited = recoveryError.status === 429 || ["over_email_send_rate_limit", "over_request_rate_limit"].includes(recoveryError.code);
          logger.info("finora_admin_recovery_failed", {...audit, outcome: limited ? "rate_limited" : "failed"});
          return reply(limited ? 429 : 502, {error: limited ? "recovery_rate_limited" : "recovery_failed"}, origin);
        }
        logger.info("finora_admin_recovery_requested", audit);
        return reply(200, {ok: true}, origin);
      }
      if (body.action !== "create") return reply(400, {error: "unsupported_action"}, origin);
      if (profile?.role !== "admin") return reply(403, {error: "admin_required"}, origin);
      const email = String(body.email || "").trim().toLowerCase();
      const phone = String(body.phone || "").trim();
      const fullName = String(body.full_name || "").trim();
      const username = String(body.username || "").trim().toLowerCase();
      const password = String(body.temporary_password || "");
      if ((!email && !phone) || (email && !validEmail(email)) || (phone && !/^\+[1-9][0-9]{7,14}$/.test(phone))) return reply(400, {error: "invalid_email_or_phone"}, origin);
      if (fullName.length > 120 || username && !/^[a-z0-9_.-]{3,40}$/.test(username)) return reply(400, {error: "invalid_profile"}, origin);
      if (!strongPassword(password)) return reply(400, {error: "weak_temporary_password"}, origin);
      const credentials = email ? {email, email_confirm: true} : {phone, phone_confirm: true};
      const {data: created, error: createError} = await server.auth.admin.createUser({
        ...credentials,
        password,
        user_metadata: {full_name: fullName, username: username || (email ? email.split("@")[0] : phone.replace(/[^0-9]/g, "")), temporary_credential: true},
      });
      if (createError || !created?.user?.id) return reply(400, {error: provisionErrors.has(createError?.code) ? createError.code : "provision_failed"}, origin);
      logger.info("finora_admin_user_provisioned", {actor: user.id, user_id: created.user.id});
      return reply(201, {ok: true, user_id: created.user.id}, origin);
    } catch (error) {
      if (error instanceof AuthorizationReadError) return reply(503, {error: "authorization_unavailable"}, origin);
      logger.error("admin_user_management_failed", "internal_error");
      return reply(500, {error: "internal_error"}, origin);
    }
  };
}
