do $$
declare u uuid:=gen_random_uuid();
begin
 insert into auth.users(id,email,phone,raw_user_meta_data) values(u,null,'+989121234567','{"full_name":"Phone User","username":"phone.user"}'::jsonb);
 if not exists(select 1 from public.profiles where id=u and email is null and phone='+989121234567' and username='phone.user') then raise exception 'phone profile bootstrap failed';end if;
 if not exists(select 1 from public.organizations where owner_user_id=u) then raise exception 'phone organization bootstrap failed';end if;
 if not exists(select 1 from public.licenses where user_id=u and max_companies=1 and max_users=1) then raise exception 'phone license bootstrap failed';end if;
end $$;
