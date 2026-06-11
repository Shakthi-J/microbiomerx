-- Run this in Supabase Dashboard → SQL Editor (one time)
-- Creates the private bucket used by MicrobiomeRx for report PDFs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'reports',
  'reports',
  false,
  52428800, -- 50 MB
  array['application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
