-- 0008 — Leituras para a gestão de equipe e o aceite de convite (Fase 3, passo 7).
-- Escritas continuam nas funções da 0007 (create_invitation, accept_invitation...).

-- Detalhes do convite para quem vai aceitá-lo. Só responde se o e-mail CONFIRMADO de quem
-- pergunta for o do convite; qualquer outro caso devolve vazio (mesma resposta de token
-- inexistente, para não revelar convites alheios).
create function public.get_my_invitation(p_token text)
returns table (
  organization_name text,
  role public.member_role,
  invited_by_name text,
  expires_at timestamptz,
  needs_password boolean
)
language sql stable security definer
set search_path = ''
as $$
  select o.name,
         i.role,
         coalesce(p.full_name, 'A equipe da clínica'),
         i.expires_at,
         -- O Supabase grava uma senha aleatória nas contas criadas por convite, então "senha vazia"
         -- não serve. A conta nasce com needs_password=true (invitation-email.ts) e o aceite limpa.
         coalesce((u.raw_user_meta_data ->> 'needs_password')::boolean, false)
    from public.invitations i
    join public.organizations o on o.id = i.organization_id
    join auth.users u on u.id = (select auth.uid())
    left join public.profiles p on p.user_id = i.invited_by
   where i.token_hash = extensions.digest(coalesce(p_token, ''), 'sha256')
     and i.accepted_at is null
     and i.revoked_at is null
     and i.expires_at > now()
     and u.email_confirmed_at is not null
     and u.email::extensions.citext = i.email;
$$;

-- Equipe da clínica. Qualquer membro ativo vê nomes e papéis; o e-mail (dado pessoal)
-- só aparece para quem gerencia membros.
create function public.list_team(p_org uuid)
returns table (
  membership_id uuid,
  user_id uuid,
  full_name text,
  email text,
  role public.member_role,
  status public.member_status,
  is_professional boolean,
  joined_at timestamptz
)
language sql stable security definer
set search_path = ''
as $$
  select m.id,
         m.user_id,
         coalesce(p.full_name, 'Sem nome'),
         case when app.has_perm(p_org, 'members.manage') then u.email::text end,
         m.role,
         m.status,
         exists (select 1 from public.professionals pr
                  where pr.organization_id = p_org and pr.user_id = m.user_id and pr.active),
         m.created_at
    from public.memberships m
    join auth.users u on u.id = m.user_id
    left join public.profiles p on p.user_id = m.user_id
   where m.organization_id = p_org
     and app.is_member(p_org)
   order by (m.status = 'active') desc, p.full_name;
$$;

-- E-mail de um convite ainda válido, para reenviar o link de acesso a quem ainda não entrou
-- (o link do e-mail vale 1 hora; o convite, 7 dias). Só o servidor (chave secreta) chama:
-- o e-mail nunca é devolvido a quem está no navegador.
create function public.invitation_email_for_token(p_token text) returns text
language sql stable security definer
set search_path = ''
as $$
  select i.email::text from public.invitations i
   where i.token_hash = extensions.digest(coalesce(p_token, ''), 'sha256')
     and i.accepted_at is null and i.revoked_at is null and i.expires_at > now();
$$;

revoke execute on function public.get_my_invitation(text), public.list_team(uuid) from public, anon;
grant execute on function public.get_my_invitation(text), public.list_team(uuid) to authenticated;

revoke execute on function public.invitation_email_for_token(text) from public, anon, authenticated;
grant execute on function public.invitation_email_for_token(text) to service_role;
