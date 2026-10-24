GRANT UPDATE, DELETE ON public.glossary_terms TO authenticated;

CREATE POLICY "Authenticated users can update glossary terms"
ON public.glossary_terms FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete glossary terms"
ON public.glossary_terms FOR DELETE TO authenticated
USING (auth.uid() IS NOT NULL);
