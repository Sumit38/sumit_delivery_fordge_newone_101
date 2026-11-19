-- Architecture designs: the architecture Q&A answers and each generated design version
-- for one analysed requirement. A design must be approved before an estimation is made.
-- Removing a requirement (or user) removes its designs.

CREATE TABLE IF NOT EXISTS public.architecture_designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id uuid NOT NULL REFERENCES public.requirements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  version integer NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'superseded')),
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  design jsonb NOT NULL,
  feedback text,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  UNIQUE (requirement_id, version)
);

-- Estimated build hours of a design: a task list per component with low / likely / high hours,
-- proposed by the AI from the design and editable by the user. The estimation uses it.
ALTER TABLE public.architecture_designs ADD COLUMN IF NOT EXISTS effort jsonb;

CREATE INDEX IF NOT EXISTS architecture_designs_requirement_idx
  ON public.architecture_designs (requirement_id, version DESC);

-- Same access rules as the estimations table: each user sees and changes only their own rows.
-- (The app's server routes use the service role and also check user_id themselves.)
ALTER TABLE public.architecture_designs ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_can_view_own_architecture ON public.architecture_designs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY users_can_insert_own_architecture ON public.architecture_designs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY users_can_update_own_architecture ON public.architecture_designs
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY users_can_delete_own_architecture ON public.architecture_designs
  FOR DELETE USING (auth.uid() = user_id);
