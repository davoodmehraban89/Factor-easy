-- ELI-3/ELI-2 FK index hardening from production performance advisor.
create index if not exists organization_invitation_roles_role_idx on public.organization_invitation_roles(role_id);
create index if not exists organization_invitations_accepted_by_idx on public.organization_invitations(accepted_by);
create index if not exists organization_invitations_invited_by_idx on public.organization_invitations(invited_by);
create index if not exists organization_invitations_unit_idx on public.organization_invitations(unit_id);
create index if not exists organization_member_roles_assigned_by_idx on public.organization_member_roles(assigned_by);
create index if not exists organization_roles_created_by_idx on public.organization_roles(created_by);
