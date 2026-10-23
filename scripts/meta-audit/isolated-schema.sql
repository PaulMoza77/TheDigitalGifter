-- LOCAL-ONLY schema snapshot: no customer rows. Never apply to a remote database.
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
--
-- PostgreSQL database dump
--

\restrict d40rJSuff2ahmgbCd6khJK4SNly96R3XaIATVPin717jQYdGujeW1oVjrgOiqap

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: christmas_v2_checkout_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.christmas_v2_checkout_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    stripe_session_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: christmas_v2_email_deliveries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.christmas_v2_email_deliveries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    kind text NOT NULL,
    provider_message_id text,
    status text DEFAULT 'queued'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT christmas_email_deliveries_kind_chk CHECK ((kind = ANY (ARRAY['starter_ready'::text, 'magic_ready'::text, 'ultimate_ready'::text, 'partial_failure'::text]))),
    CONSTRAINT christmas_email_deliveries_status_chk CHECK ((status = ANY (ARRAY['queued'::text, 'sent'::text, 'skipped'::text, 'failed'::text])))
);


--
-- Name: christmas_v2_funnel_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.christmas_v2_funnel_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_name text NOT NULL,
    funnel_session_id uuid NOT NULL,
    event_id uuid,
    idempotency_key text NOT NULL,
    device_type text,
    pathname text,
    amount_cents integer,
    product text,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    utm_content text,
    utm_term text,
    campaign_id text,
    adset_id text,
    ad_id text,
    has_meta_click boolean,
    referrer_host text,
    funnel_variant text DEFAULT 'christmas_v2'::text,
    funnel_version text DEFAULT 'christmas_v2'::text,
    failure_category text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: christmas_v2_generation_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.christmas_v2_generation_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    claimed_at timestamp with time zone,
    finished_at timestamp with time zone,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT christmas_generation_jobs_status_chk CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'held'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: christmas_v2_order_scenes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.christmas_v2_order_scenes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    scene_key text NOT NULL,
    scene_number integer NOT NULL,
    title text NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    progress_percent integer DEFAULT 0 NOT NULL,
    replicate_prediction_id text,
    model_name text,
    attempts integer DEFAULT 0 NOT NULL,
    last_error text,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    result_bucket text,
    result_path text,
    result_content_type text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT christmas_order_scenes_status_chk CHECK ((status = ANY (ARRAY['queued'::text, 'generating'::text, 'succeeded'::text, 'failed'::text, 'ready'::text])))
);


--
-- Name: christmas_v2_order_videos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.christmas_v2_order_videos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    source_scene_key text NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    replicate_prediction_id text,
    model_name text,
    attempts integer DEFAULT 0 NOT NULL,
    last_error text,
    result_bucket text,
    result_path text,
    result_content_type text,
    duration_seconds numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT christmas_order_videos_status_chk CHECK ((status = ANY (ARRAY['queued'::text, 'generating'::text, 'succeeded'::text, 'failed'::text, 'ready'::text])))
);


--
-- Name: christmas_v2_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.christmas_v2_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    public_token_hash text NOT NULL,
    public_token_ciphertext text,
    email text NOT NULL,
    email_normalized text NOT NULL,
    customer_name text,
    sku text NOT NULL,
    pack_key text NOT NULL,
    product_type text DEFAULT 'christmas_portrait_pack'::text NOT NULL,
    amount_cents integer NOT NULL,
    charged_amount_cents integer,
    currency text DEFAULT 'eur'::text NOT NULL,
    status text DEFAULT 'awaiting_upload'::text NOT NULL,
    image_count integer NOT NULL,
    video_count integer DEFAULT 0 NOT NULL,
    parent_order_id uuid,
    photo_bucket text,
    photo_path text,
    photo_content_type text,
    photo_file_name text,
    photo_byte_size integer,
    photo_confirmed_at timestamp with time zone,
    stripe_checkout_session_id text,
    stripe_payment_intent_id text,
    stripe_payment_status text,
    paid_at timestamp with time zone,
    generation_started_at timestamp with time zone,
    generation_finished_at timestamp with time zone,
    completed_at timestamp with time zone,
    delivery_email_sent_at timestamp with time zone,
    meta_event_id text NOT NULL,
    funnel_session_id uuid,
    scene_keys jsonb DEFAULT '[]'::jsonb NOT NULL,
    video_source_scene_keys jsonb DEFAULT '[]'::jsonb NOT NULL,
    surprise_me boolean DEFAULT false NOT NULL,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    pack_snapshot jsonb,
    CONSTRAINT christmas_orders_pack_chk CHECK ((pack_key = ANY (ARRAY['starter'::text, 'magic'::text, 'ultimate'::text]))),
    CONSTRAINT christmas_orders_photo_type_chk CHECK (((photo_content_type IS NULL) OR (photo_content_type = ANY (ARRAY['image/jpeg'::text, 'image/png'::text, 'image/webp'::text])))),
    CONSTRAINT christmas_orders_status_chk CHECK ((status = ANY (ARRAY['draft'::text, 'awaiting_upload'::text, 'awaiting_payment'::text, 'paid'::text, 'generating'::text, 'awaiting_qc'::text, 'complete'::text, 'partial_failure'::text, 'failed'::text, 'refunded'::text]))),
    CONSTRAINT christmas_v2_orders_currency_chk CHECK ((currency = ANY (ARRAY['usd'::text, 'eur'::text]))),
    CONSTRAINT christmas_v2_orders_sku_chk CHECK ((sku = ANY (ARRAY['christmas-starter-3'::text, 'christmas-magic-8'::text, 'christmas-ultimate-12'::text, 'christmas-magic-5'::text, 'christmas-ultimate-10'::text])))
);


--
-- Name: processed_stripe_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.processed_stripe_events (
    event_id text NOT NULL,
    event_type text,
    stripe_session_id text,
    processed_at timestamp with time zone DEFAULT now() NOT NULL,
    result jsonb DEFAULT '{}'::jsonb
);


--
-- Name: christmas_v2_checkout_sessions christmas_v2_christmas_checkout_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.christmas_v2_checkout_sessions
    ADD CONSTRAINT christmas_v2_christmas_checkout_sessions_pkey PRIMARY KEY (id);


--
-- Name: christmas_v2_email_deliveries christmas_v2_christmas_email_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.christmas_v2_email_deliveries
    ADD CONSTRAINT christmas_v2_christmas_email_deliveries_pkey PRIMARY KEY (id);


--
-- Name: christmas_v2_generation_jobs christmas_v2_christmas_generation_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.christmas_v2_generation_jobs
    ADD CONSTRAINT christmas_v2_christmas_generation_jobs_pkey PRIMARY KEY (id);


--
-- Name: christmas_v2_order_scenes christmas_v2_christmas_order_scenes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.christmas_v2_order_scenes
    ADD CONSTRAINT christmas_v2_christmas_order_scenes_pkey PRIMARY KEY (id);


--
-- Name: christmas_v2_order_videos christmas_v2_christmas_order_videos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.christmas_v2_order_videos
    ADD CONSTRAINT christmas_v2_christmas_order_videos_pkey PRIMARY KEY (id);


--
-- Name: christmas_v2_orders christmas_v2_christmas_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.christmas_v2_orders
    ADD CONSTRAINT christmas_v2_christmas_orders_pkey PRIMARY KEY (id);


--
-- Name: christmas_v2_funnel_events christmas_v2_funnel_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.christmas_v2_funnel_events
    ADD CONSTRAINT christmas_v2_funnel_events_pkey PRIMARY KEY (id);


--
-- Name: processed_stripe_events processed_stripe_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processed_stripe_events
    ADD CONSTRAINT processed_stripe_events_pkey PRIMARY KEY (event_id);


--
-- Name: christmas_v2_christmas_checkout_sessions_session_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX christmas_v2_christmas_checkout_sessions_session_uidx ON public.christmas_v2_checkout_sessions USING btree (stripe_session_id);


--
-- Name: christmas_v2_christmas_email_deliveries_order_kind_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX christmas_v2_christmas_email_deliveries_order_kind_uidx ON public.christmas_v2_email_deliveries USING btree (order_id, kind);


--
-- Name: christmas_v2_christmas_generation_jobs_order_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX christmas_v2_christmas_generation_jobs_order_uidx ON public.christmas_v2_generation_jobs USING btree (order_id);


--
-- Name: christmas_v2_christmas_order_scenes_order_key_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX christmas_v2_christmas_order_scenes_order_key_uidx ON public.christmas_v2_order_scenes USING btree (order_id, scene_key);


--
-- Name: christmas_v2_christmas_orders_email_normalized_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX christmas_v2_christmas_orders_email_normalized_idx ON public.christmas_v2_orders USING btree (email_normalized);


--
-- Name: christmas_v2_christmas_orders_meta_event_id_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX christmas_v2_christmas_orders_meta_event_id_uidx ON public.christmas_v2_orders USING btree (meta_event_id);


--
-- Name: christmas_v2_christmas_orders_public_token_hash_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX christmas_v2_christmas_orders_public_token_hash_uidx ON public.christmas_v2_orders USING btree (public_token_hash);


--
-- Name: christmas_v2_christmas_orders_status_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX christmas_v2_christmas_orders_status_created_idx ON public.christmas_v2_orders USING btree (status, created_at DESC);


--
-- Name: christmas_v2_christmas_orders_stripe_session_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX christmas_v2_christmas_orders_stripe_session_uidx ON public.christmas_v2_orders USING btree (stripe_checkout_session_id) WHERE ((stripe_checkout_session_id IS NOT NULL) AND (length(TRIM(BOTH FROM stripe_checkout_session_id)) > 0));


--
-- Name: christmas_v2_funnel_events_idem_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX christmas_v2_funnel_events_idem_uidx ON public.christmas_v2_funnel_events USING btree (idempotency_key);


--
-- Name: christmas_v2_funnel_events_session_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX christmas_v2_funnel_events_session_idx ON public.christmas_v2_funnel_events USING btree (funnel_session_id, created_at DESC);


--
-- Name: christmas_v2_checkout_sessions christmas_checkout_sessions_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.christmas_v2_checkout_sessions
    ADD CONSTRAINT christmas_checkout_sessions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.christmas_v2_orders(id) ON DELETE CASCADE;


--
-- Name: christmas_v2_email_deliveries christmas_email_deliveries_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.christmas_v2_email_deliveries
    ADD CONSTRAINT christmas_email_deliveries_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.christmas_v2_orders(id) ON DELETE CASCADE;


--
-- Name: christmas_v2_generation_jobs christmas_generation_jobs_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.christmas_v2_generation_jobs
    ADD CONSTRAINT christmas_generation_jobs_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.christmas_v2_orders(id) ON DELETE CASCADE;


--
-- Name: christmas_v2_order_scenes christmas_order_scenes_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.christmas_v2_order_scenes
    ADD CONSTRAINT christmas_order_scenes_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.christmas_v2_orders(id) ON DELETE CASCADE;


--
-- Name: christmas_v2_order_videos christmas_order_videos_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.christmas_v2_order_videos
    ADD CONSTRAINT christmas_order_videos_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.christmas_v2_orders(id) ON DELETE CASCADE;


--
-- Name: christmas_v2_orders christmas_orders_parent_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.christmas_v2_orders
    ADD CONSTRAINT christmas_orders_parent_order_id_fkey FOREIGN KEY (parent_order_id) REFERENCES public.christmas_v2_orders(id) ON DELETE SET NULL;


--
-- Name: christmas_v2_checkout_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.christmas_v2_checkout_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: christmas_v2_checkout_sessions christmas_v2_checkout_sessions_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY christmas_v2_checkout_sessions_admin_read ON public.christmas_v2_checkout_sessions FOR SELECT USING (public.is_admin());


--
-- Name: christmas_v2_email_deliveries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.christmas_v2_email_deliveries ENABLE ROW LEVEL SECURITY;

--
-- Name: christmas_v2_email_deliveries christmas_v2_email_deliveries_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY christmas_v2_email_deliveries_admin_read ON public.christmas_v2_email_deliveries FOR SELECT USING (public.is_admin());


--
-- Name: christmas_v2_funnel_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.christmas_v2_funnel_events ENABLE ROW LEVEL SECURITY;

--
-- Name: christmas_v2_funnel_events christmas_v2_funnel_events_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY christmas_v2_funnel_events_admin_read ON public.christmas_v2_funnel_events FOR SELECT USING (public.is_admin());


--
-- Name: christmas_v2_generation_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.christmas_v2_generation_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: christmas_v2_generation_jobs christmas_v2_generation_jobs_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY christmas_v2_generation_jobs_admin_read ON public.christmas_v2_generation_jobs FOR SELECT USING (public.is_admin());


--
-- Name: christmas_v2_order_scenes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.christmas_v2_order_scenes ENABLE ROW LEVEL SECURITY;

--
-- Name: christmas_v2_order_scenes christmas_v2_order_scenes_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY christmas_v2_order_scenes_admin_read ON public.christmas_v2_order_scenes FOR SELECT USING (public.is_admin());


--
-- Name: christmas_v2_order_videos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.christmas_v2_order_videos ENABLE ROW LEVEL SECURITY;

--
-- Name: christmas_v2_order_videos christmas_v2_order_videos_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY christmas_v2_order_videos_admin_read ON public.christmas_v2_order_videos FOR SELECT USING (public.is_admin());


--
-- Name: christmas_v2_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.christmas_v2_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: christmas_v2_orders christmas_v2_orders_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY christmas_v2_orders_admin_read ON public.christmas_v2_orders FOR SELECT USING (public.is_admin());


--
-- Name: processed_stripe_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.processed_stripe_events ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict d40rJSuff2ahmgbCd6khJK4SNly96R3XaIATVPin717jQYdGujeW1oVjrgOiqap


CREATE OR REPLACE FUNCTION public.claim_christmas_v2_generation_job(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  job_row public.christmas_v2_generation_jobs%rowtype;
begin
  insert into public.christmas_v2_generation_jobs (order_id, status)
  values (p_order_id, 'queued')
  on conflict (order_id) do nothing;

  select * into job_row
  from public.christmas_v2_generation_jobs
  where order_id = p_order_id
  for update;

  if not found then
    return jsonb_build_object('claimed', false, 'reason', 'missing_job');
  end if;

  if job_row.status = 'running' and job_row.claimed_at is not null
     and job_row.claimed_at > now() - interval '3 minutes' then
    return jsonb_build_object('claimed', false, 'status', 'already_running');
  end if;

  if job_row.status = 'succeeded' then
    return jsonb_build_object('claimed', false, 'status', 'already_succeeded');
  end if;

  update public.christmas_v2_generation_jobs
  set
    status = 'running',
    claimed_at = now(),
    last_error = null,
    updated_at = now()
  where order_id = p_order_id
  returning * into job_row;

  return jsonb_build_object('claimed', true, 'status', job_row.status);
end;
$function$;

CREATE OR REPLACE FUNCTION public.fulfill_christmas_v2_order_payment(p_event_id text, p_session_id text, p_event_type text, p_payment_status text, p_payment_intent_id text, p_amount_cents integer, p_currency text, p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  order_row public.christmas_v2_orders%rowtype;
  already boolean := false;
begin
  select * into order_row from public.christmas_v2_orders where id = p_order_id for update;
  if not found then
    raise exception 'christmas v2 order not found';
  end if;

  if p_payment_status is distinct from 'paid' then raise exception 'payment is not paid'; end if;
  if p_amount_cents is distinct from order_row.amount_cents or lower(p_currency) is distinct from lower(order_row.currency) then
    raise exception 'payment amount or currency does not match order';
  end if;
  if order_row.paid_at is not null then
    already := true;
  else
    update public.christmas_v2_orders
    set
      status = 'paid',
      paid_at = now(),
      stripe_checkout_session_id = coalesce(nullif(p_session_id, ''), stripe_checkout_session_id),
      stripe_payment_intent_id = nullif(p_payment_intent_id, ''),
      stripe_payment_status = coalesce(nullif(p_payment_status, ''), 'paid'),
      charged_amount_cents = coalesce(p_amount_cents, amount_cents),
      updated_at = now()
    where id = p_order_id;

    insert into public.christmas_v2_generation_jobs (order_id, status)
    values (p_order_id, 'queued')
    on conflict (order_id) do nothing;
  end if;

  insert into public.processed_stripe_events (event_id, event_type, stripe_session_id, result)
  values (
    p_event_id,
    p_event_type,
    p_session_id,
    jsonb_build_object(
      'status', case when already then 'already_paid' else 'fulfilled' end,
      'christmas_order_id', p_order_id,
      'should_enqueue', true,
      'schema', 'christmas_v2'
    )
  )
  on conflict (event_id) do nothing;

  return jsonb_build_object(
    'status', case when already then 'already_paid' else 'fulfilled' end,
    'should_enqueue', not already,
    'already_paid', already,
    'christmas_order_id', p_order_id,
    'meta_event_id', order_row.meta_event_id
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.record_christmas_v2_funnel_event(p_event_name text, p_funnel_session_id uuid, p_idempotency_key text, p_event_id uuid DEFAULT NULL::uuid, p_device_type text DEFAULT NULL::text, p_pathname text DEFAULT NULL::text, p_amount_cents integer DEFAULT NULL::integer, p_product text DEFAULT NULL::text, p_utm_source text DEFAULT NULL::text, p_utm_medium text DEFAULT NULL::text, p_utm_campaign text DEFAULT NULL::text, p_utm_content text DEFAULT NULL::text, p_utm_term text DEFAULT NULL::text, p_campaign_id text DEFAULT NULL::text, p_adset_id text DEFAULT NULL::text, p_ad_id text DEFAULT NULL::text, p_has_meta_click boolean DEFAULT NULL::boolean, p_referrer_host text DEFAULT NULL::text, p_failure_category text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.christmas_v2_funnel_events (
    event_name, funnel_session_id, event_id, idempotency_key, device_type, pathname,
    amount_cents, product, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    campaign_id, adset_id, ad_id, has_meta_click, referrer_host, failure_category
  ) values (
    p_event_name, p_funnel_session_id, p_event_id, p_idempotency_key, p_device_type, p_pathname,
    p_amount_cents, p_product, p_utm_source, p_utm_medium, p_utm_campaign, p_utm_content, p_utm_term,
    p_campaign_id, p_adset_id, p_ad_id, p_has_meta_click, p_referrer_host, p_failure_category
  )
  on conflict (idempotency_key) do nothing;

  if found then
    return jsonb_build_object('ok', true, 'duplicate', false);
  end if;
  return jsonb_build_object('ok', true, 'duplicate', true);
end;
$function$;

CREATE OR REPLACE FUNCTION public.christmas_v2_finalize_generation_if_done(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  ord public.christmas_v2_orders%rowtype;
  photo_total integer; photo_done integer; photo_ok integer;
  video_total integer; video_done integer; video_ok integer;
  finished boolean; result_status text;
begin
  select * into ord from public.christmas_v2_orders where id = p_order_id for update;
  if not found or ord.paid_at is null then raise exception 'paid Christmas V2 order required'; end if;
  select count(*), count(*) filter (where status in ('succeeded','ready','failed')),
    count(*) filter (where status in ('succeeded','ready'))
    into photo_total, photo_done, photo_ok from public.christmas_v2_order_scenes where order_id = p_order_id;
  select count(*), count(*) filter (where status in ('succeeded','ready','failed')),
    count(*) filter (where status in ('succeeded','ready'))
    into video_total, video_done, video_ok from public.christmas_v2_order_videos where order_id = p_order_id;
  finished := photo_total >= ord.image_count and photo_done = photo_total
    and video_total >= ord.video_count and video_done = video_total;
  if finished then
    result_status := case when photo_ok = ord.image_count and video_ok = ord.video_count then 'complete'
      when photo_ok + video_ok > 0 then 'partial_failure' else 'failed' end;
    update public.christmas_v2_orders set status = result_status, completed_at = now(), updated_at = now() where id = p_order_id;
    update public.christmas_v2_generation_jobs set status = case when result_status = 'failed' then 'failed' else 'completed' end,
      finished_at = now(), updated_at = now() where order_id = p_order_id;
  end if;
  return jsonb_build_object('done', finished, 'photos_done', photo_total >= ord.image_count and photo_done = photo_total,
    'succeeded', photo_ok, 'failed', photo_total - photo_ok, 'status', result_status);
end; $function$;


GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
NOTIFY pgrst, 'reload schema';
