-- Only a 256-bit token and its matching email can discover the invitation's tenant.
CREATE FUNCTION lookup_invitation(token text, recipient text) RETURNS TABLE(id uuid, tenant_id uuid)
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
 SELECT i.id, i.tenant_id FROM public.invitations i
 WHERE i.token_hash=token AND i.email=recipient AND i.accepted_at IS NULL AND i.expires_at>now()
$$;
REVOKE ALL ON FUNCTION lookup_invitation(text,text) FROM PUBLIC;
