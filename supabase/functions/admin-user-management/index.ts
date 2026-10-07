import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Content-Type":"application/json"};
const json=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:cors});
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json(405,{error:"method_not_allowed"});
 const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const auth=req.headers.get("Authorization")||"";
 const caller=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false}});
 const {data:{user},error:userErr}=await caller.auth.getUser();
 if(userErr||!user)return json(401,{error:"unauthorized"});
 const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:profile}=await admin.from("profiles").select("role").eq("id",user.id).single();
 if(profile?.role!=="admin")return json(403,{error:"admin_required"});
 let body:any={};try{body=await req.json()}catch{return json(400,{error:"invalid_json"})}
 const action=String(body.action||"");
 if(action==="create"){
   const full_name=String(body.full_name||"").trim().slice(0,120),username=String(body.username||"").trim().toLowerCase();
   const password=String(body.password||"");if(password.length<8||!/[A-Za-z]/.test(password)||!/[0-9]/.test(password))return json(400,{error:"weak_password"});
   const email=String(body.email||"").trim().toLowerCase(),phone=String(body.phone||"").trim();
   if(!email&&!phone)return json(400,{error:"email_or_phone_required"});
   const attrs:any={password,user_metadata:{full_name,username}};if(email){attrs.email=email;attrs.email_confirm=true}else{attrs.phone=phone;attrs.phone_confirm=true}
   const {data,error}=await admin.auth.admin.createUser(attrs);if(error)return json(400,{error:error.message});
   return json(200,{ok:true,user_id:data.user?.id});
 }
 if(action==="set_password"){
   const target=String(body.user_id||""),password=String(body.password||"");
   if(!target)return json(400,{error:"user_id_required"});
   if(password.length<8||!/[A-Za-z]/.test(password)||!/[0-9]/.test(password))return json(400,{error:"weak_password"});
   const {error}=await admin.auth.admin.updateUserById(target,{password,user_metadata:{force_password_change:true}});if(error)return json(400,{error:error.message});
   return json(200,{ok:true});
 }
 return json(400,{error:"unsupported_action"});
});