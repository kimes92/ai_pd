CREATE TABLE public.shortcuts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  trigger text NOT NULL,
  expansion text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, trigger)
);

ALTER TABLE public.shortcuts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own shortcuts" ON public.shortcuts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own shortcuts" ON public.shortcuts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own shortcuts" ON public.shortcuts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own shortcuts" ON public.shortcuts
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_shortcuts_updated_at
  BEFORE UPDATE ON public.shortcuts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_shortcuts_user_id ON public.shortcuts(user_id);