import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set(["https://factoreasy.ir","https://www.factoreasy.ir"]);
const allowedHeaders = "authorization,apikey,content-type,x-client-info";
const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://factoreasy.ir",
  "Access-Control-Allow-Headers": allowedHeaders,
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Vary": "Origin",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
});
function reply(status: number, body: unknown, origin: string|null) {
  return new Response(JSON.stringify(body),{status,headers:cors(origin)});
}
function validEmail(raw: string) {
  return raw.length<=254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(raw);
}
function strongPassword(value: string) {
  return value.length>=12 && value.length<=128 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value) && /[^A-Za-z\d]/.test(value);
}
Deno.serve(async (request: Request) => {
  const origin=request.headers.get("Origin");
  if(origin && !allowedOrigins.has(origin))return reply(403,{error:"origin_not_allowed"},origin);
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors(origin)});
  if(request.method!=="POST")return reply(405,{error:"method_not_allowed"},origin);
  const bearer=request.headers.get("Authorization")||"";
  if(!/^Bearer\s+[^\s]+$/i.test(bearer))return reply(401,{error:"unauthorized"},origin);
  const projectUrl=Deno.env.get("SUPABASE_URL");
  const anon=Deno.env.get("SUPABASE_ANON_KEY");
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!projectUrl||!anon||!service)return reply(503,{error:"server_configuration_missing"},origin);
  try {
    const caller=createClient(projectUrl,anon,{auth:{persistSession:false,autoRefreshToken:false}});
    const token=bearer.replace(/^Bearer\s+/i,"");
    const {data:{user},error:userError}=await caller.auth.getUser(token);
    if(userError||!user)return reply(401,{error:"unauthorized"},origin);
    const server=createClient(projectUrl,service,{auth:{persistSession:false,autoRefreshToken:false}});
    // A server-fetched global admin role is mandatory. Client-side flags never grant access.
    const {data:profile,error:profileError}=await server.from("profiles").select("id,role").eq("id",user.id).single();
    if(profileError||profile?.role!=="admin")return reply(403,{error:"admin_required"},origin);
    const raw=await request.text();
    if(raw.length>8192)return reply(413,{error:"payload_too_large"},origin);
    let body: Record<string,unknown>;
    try {body=JSON.parse(raw)} catch {return reply(400,{error:"invalid_json"},origin)}
    if(body?.action==="set_password"){
      const target=String(body.user_id||"");
      const newPassword=String(body.password||"");
      if(!/^[0-9a-f-]{36}$/i.test(target)||!strongPassword(newPassword))return reply(400,{error:"invalid_password_reset_request"},origin);
      const {error}=await server.auth.admin.updateUserById(target,{password:newPassword,user_metadata:{force_password_change:true}});
      if(error)return reply(400,{error:"password_reset_failed"},origin);
      console.info("finora_admin_password_updated",{actor:user.id,user_id:target});
      return reply(200,{ok:true},origin);
    }
    if(body?.action!=="create")return reply(400,{error:"unsupported_action"},origin);
    const email=String(body.email||"").trim().toLowerCase();
    const phone=String(body.phone||"").trim();
    const fullName=String(body.full_name||"").trim();
    const username=String(body.username||"").trim().toLowerCase();
    const password=String(body.temporary_password||"");
    if((!email&&!phone)||(email&&!validEmail(email))||(phone&&!/^\+[1-9][0-9]{7,14}$/.test(phone)))return reply(400,{error:"invalid_email_or_phone"},origin);
    if(fullName.length>120||username && !/^[a-z0-9_.-]{3,40}$/.test(username))return reply(400,{error:"invalid_profile"},origin);
    if(!strongPassword(password))return reply(400,{error:"weak_temporary_password"},origin);
    const credentials=email?{email,email_confirm:true}:{phone,phone_confirm:true};
    const {data:created,error:createError}=await server.auth.admin.createUser({
      ...credentials,
      password,
      user_metadata:{full_name:fullName,username:username||(email?email.split("@")[0]:phone.replace(/[^0-9]/g,"")),temporary_credential:true},
    });
    if(createError||!created?.user?.id)return reply(400,{error:createError?.code||"provision_failed"},origin);
    // Existing Auth trigger provisions ordinary profile, organization and trial license.
    console.info("finora_admin_user_provisioned",{actor:user.id,user_id:created.user.id});
    return reply(201,{ok:true,user_id:created.user.id},origin);
  } catch(error) {
    console.error("admin_user_management_failed",error instanceof Error?error.name:"unexpected");
    return reply(500,{error:"internal_error"},origin);
  }
});
