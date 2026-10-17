-- The default Supabase storage host returns 402 after the storage quota is
-- exceeded. The same public objects are served from the project domain, so
-- generator style cards can load the previews that were already made.
update public.templates
set
  preview_url = replace(preview_url, 'https://kjlsocejpmnzhhduyumy.supabase.co', 'https://supabase.thedigitalgifter.com'),
  previewurl = replace(previewurl, 'https://kjlsocejpmnzhhduyumy.supabase.co', 'https://supabase.thedigitalgifter.com'),
  preview_image_url = replace(preview_image_url, 'https://kjlsocejpmnzhhduyumy.supabase.co', 'https://supabase.thedigitalgifter.com'),
  thumbnail_url = replace(thumbnail_url, 'https://kjlsocejpmnzhhduyumy.supabase.co', 'https://supabase.thedigitalgifter.com'),
  thumbnailurl = replace(thumbnailurl, 'https://kjlsocejpmnzhhduyumy.supabase.co', 'https://supabase.thedigitalgifter.com')
where preview_url like '%kjlsocejpmnzhhduyumy.supabase.co%'
   or previewurl like '%kjlsocejpmnzhhduyumy.supabase.co%'
   or preview_image_url like '%kjlsocejpmnzhhduyumy.supabase.co%'
   or thumbnail_url like '%kjlsocejpmnzhhduyumy.supabase.co%'
   or thumbnailurl like '%kjlsocejpmnzhhduyumy.supabase.co%';
