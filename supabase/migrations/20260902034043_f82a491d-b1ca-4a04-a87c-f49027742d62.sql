DROP POLICY IF EXISTS "Authenticated can read identifier signals" ON public.group_identifier_signals;

CREATE POLICY "Admins or identifier owners can read signals"
ON public.group_identifier_signals
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.group_identifiers gi
    WHERE gi.id = group_identifier_signals.identifier_id
      AND gi.created_by = auth.uid()
  )
);