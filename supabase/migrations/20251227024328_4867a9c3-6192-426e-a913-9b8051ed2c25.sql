-- Add category and is_public columns to notes table
ALTER TABLE public.notes 
ADD COLUMN category text,
ADD COLUMN is_public boolean DEFAULT false NOT NULL;

-- Create policy for viewing public notes (authenticated users can see all public notes)
CREATE POLICY "Authenticated users can view public notes" 
ON public.notes 
FOR SELECT 
TO authenticated
USING (is_public = true);

-- Create index for better query performance
CREATE INDEX idx_notes_category ON public.notes(category);
CREATE INDEX idx_notes_is_public ON public.notes(is_public);