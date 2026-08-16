-- Baseline snapshot of production public schema for project kjlsocejpmnzhhduyumy
-- Captured 2026-08-16 from the live database.
-- This migration documents the existing schema. It must be marked as already
-- applied on production (supabase migration repair) so it is never executed
-- against objects that already exist. Do not drop or recreate production data.

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- public schema already exists on Supabase; do not recreate it.
-- CREATE SCHEMA public;


--
-- Name: debit_credits_on_generation_complete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.debit_credits_on_generation_complete() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  cost integer;
  email text;
begin
  if new.status = 'completed' and (old.status is distinct from 'completed') then
    cost := coalesce(nullif(new.credit_cost, 0), nullif(new.credits, 0), 1);
    if cost < 1 then cost := 1; end if;

    email := lower(trim(coalesce(new.email, '')));
    if email = '' then
      return new;
    end if;

    -- idempotent: skip if already debited for this generation
    if exists (
      select 1
      from public.credits_ledger cl
      where cl.note = 'generation:' || new.id::text
    ) then
      return new;
    end if;

    insert into public.credits_ledger (
      user_convex_id,
      user_id,
      direction,
      credits,
      event_type,
      category,
      note,
      template_id,
      template_title
    ) values (
      email,
      new.user_id,
      'out',
      cost,
      'generation',
      'generation',
      'generation:' || new.id::text,
      new.template_id,
      new.title
    );
  end if;

  return new;
end;
$$;


--
-- Name: get_result_page_generation(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_result_page_generation(p_session_id text, p_generation_id uuid DEFAULT NULL::uuid) RETURNS TABLE(id uuid, status text, final_image_url text, result_image_url text, preview_image_url text, source_image_url text, template_id uuid, style_id text, style_slug text, prompt text, error text, created_at timestamp with time zone, updated_at timestamp with time zone)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    g.id, g.status, g.final_image_url, g.result_image_url, g.preview_image_url,
    g.source_image_url, g.template_id, g.style_id, g.style_slug, g.prompt, g.error,
    g.created_at, g.updated_at
  from public.generations g
  where
    (p_generation_id is not null and g.id = p_generation_id)
    or (p_session_id is not null and (
      g.stripe_session_id = p_session_id
      or g.checkout_session_id = p_session_id
      or (g.metadata->>'session_id') = p_session_id
      or (g.metadata->>'stripe_session_id') = p_session_id
    ))
  order by g.created_at desc
  limit 1;
$$;


--
-- Name: get_upgrade_result_by_checkout_session(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_upgrade_result_by_checkout_session(p_checkout_session_id text) RETURNS TABLE(fulfillment_id uuid, generation_id uuid, action_type text, fulfillment_status text, output_generation_id uuid, output_image_url text, final_image_url text, generation_status text, generation_created_at timestamp with time zone, generation_updated_at timestamp with time zone)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    uf.id as fulfillment_id,
    uf.generation_id,
    uf.action_type,
    uf.fulfillment_status,
    uf.output_generation_id,
    uf.output_image_url,
    coalesce(og.final_image_url, og.result_image_url, g.final_image_url, g.result_image_url) as final_image_url,
    coalesce(og.status, g.status) as generation_status,
    coalesce(og.created_at, g.created_at) as generation_created_at,
    coalesce(og.updated_at, g.updated_at) as generation_updated_at
  from public.upgrade_fulfillments uf
  left join public.generations g on g.id = uf.generation_id
  left join public.generations og on og.id = uf.output_generation_id
  where uf.checkout_session_id = p_checkout_session_id
  limit 1;
$$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.admin_users au
    where lower(au.email) = lower(coalesce(auth.jwt()->>'email', ''))
  )
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_users (
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: affiliate_clicks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.affiliate_clicks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text,
    visitor_id text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: affiliate_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.affiliate_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    code text,
    discount_percent numeric DEFAULT 0,
    commission_percent numeric DEFAULT 0,
    max_uses integer,
    times_used integer DEFAULT 0,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: affiliate_conversions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.affiliate_conversions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text,
    user_id uuid,
    affiliate_user_id uuid,
    amount numeric DEFAULT 0,
    commission_amount numeric DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: affiliate_earnings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.affiliate_earnings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    affiliate_user_id uuid,
    amount numeric DEFAULT 0,
    status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: affiliate_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.affiliate_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    email text,
    affiliate_code text,
    referral_slug text,
    referral_link text,
    total_clicks integer DEFAULT 0,
    total_conversions integer DEFAULT 0,
    available_earnings numeric DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: affiliate_withdrawals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.affiliate_withdrawals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    affiliate_user_id uuid,
    amount numeric NOT NULL,
    currency text DEFAULT 'eur'::text,
    method text,
    status text DEFAULT 'pending'::text,
    requested_at timestamp with time zone DEFAULT now(),
    processed_at timestamp with time zone,
    payout_details jsonb DEFAULT '{}'::jsonb
);


--
-- Name: app_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    convex_id text,
    email text,
    name text,
    image_url text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: blog_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blog_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    title text,
    meta_title text,
    meta_description text,
    excerpt text,
    content text,
    cover_image_url text,
    cover_image_path text,
    image_prompt text,
    cta_label text,
    cta_url text,
    internal_links jsonb DEFAULT '[]'::jsonb,
    faq jsonb DEFAULT '[]'::jsonb,
    author_name text,
    is_published boolean DEFAULT false,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: generations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.generations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    email text,
    occasion_slug text,
    style_slug text,
    style_id text,
    template_id uuid,
    title text,
    source_image_url text,
    preview_image_url text,
    final_image_url text,
    result_image_url text,
    prompt text,
    status text DEFAULT 'pending'::text,
    error text,
    metadata jsonb DEFAULT '{}'::jsonb,
    is_saved boolean DEFAULT false,
    stripe_session_id text,
    checkout_session_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    credit_cost integer DEFAULT 1,
    credits integer DEFAULT 1
);


--
-- Name: client_dashboard_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.client_dashboard_summary AS
 SELECT user_id,
    (count(*))::integer AS total_generations,
    (count(*) FILTER (WHERE is_saved))::integer AS saved_results_count,
    (count(*) FILTER (WHERE (created_at > (now() - '7 days'::interval))))::integer AS recent_activity_count
   FROM public.generations g
  GROUP BY user_id;


--
-- Name: credits_ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credits_ledger (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_convex_id text,
    user_id uuid,
    direction text,
    credits integer DEFAULT 0 NOT NULL,
    event_type text,
    template_id uuid,
    template_title text,
    category text,
    amount numeric,
    currency text DEFAULT 'eur'::text,
    order_convex_id text,
    note text,
    occurred_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT credits_ledger_direction_check CHECK ((direction = ANY (ARRAY['in'::text, 'out'::text])))
);


--
-- Name: credits_admin_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.credits_admin_view AS
 SELECT c.id,
    c.user_convex_id,
    au.name AS user_name,
    au.email AS user_email,
    au.image_url AS user_image,
    c.event_type,
    c.direction,
    c.credits,
    c.order_convex_id,
    c.template_id,
    c.template_title,
    c.category,
    c.amount,
    c.currency,
    c.note,
    c.occurred_at,
    c.created_at
   FROM (public.credits_ledger c
     LEFT JOIN public.app_users au ON ((au.convex_id = c.user_convex_id)));


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    email text,
    subscription_status text,
    cancel_at_period_end boolean DEFAULT false,
    current_period_end timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    user_convex_id text,
    email text,
    amount numeric,
    amount_total_cents integer,
    currency text DEFAULT 'eur'::text,
    pack text,
    product_type text,
    status text,
    credits_granted integer,
    stripe_session_id text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text,
    role text DEFAULT 'user'::text,
    updated_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_profiles (
    id uuid NOT NULL,
    email text,
    name text,
    full_name text,
    avatar_url text,
    credits integer DEFAULT 0,
    updated_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: customers_admin_view_unified; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.customers_admin_view_unified AS
 SELECT COALESCE(p.id, au.id) AS id,
    COALESCE(up.name, up.full_name, au.name, split_part(COALESCE(p.email, au.email, ''::text), '@'::text, 1)) AS name,
    COALESCE(p.email, up.email, au.email) AS email,
    COALESCE(up.avatar_url, au.image_url) AS image_url,
    (COALESCE(( SELECT sum(
                CASE
                    WHEN (cl.direction = 'out'::text) THEN cl.credits
                    ELSE 0
                END) AS sum
           FROM public.credits_ledger cl
          WHERE ((cl.user_convex_id = au.convex_id) OR (cl.user_id = p.id))), (0)::bigint))::integer AS credits_used,
    (COALESCE(( SELECT count(*) AS count
           FROM public.generations g
          WHERE (g.user_id = p.id)), (0)::bigint))::integer AS generations,
    COALESCE(( SELECT ((sum(COALESCE(o.amount_total_cents, ((o.amount * (100)::numeric))::integer, 0)))::numeric / 100.0)
           FROM public.orders o
          WHERE ((o.user_id = p.id) OR (o.user_convex_id = au.convex_id))), (0)::numeric) AS total_money_spent,
    (COALESCE(( SELECT count(*) AS count
           FROM public.orders o
          WHERE ((o.user_id = p.id) OR (o.user_convex_id = au.convex_id))), (0)::bigint))::integer AS orders_count,
    COALESCE(up.created_at, au.created_at, p.created_at) AS created_at,
    GREATEST(COALESCE(( SELECT max(g.created_at) AS max
           FROM public.generations g
          WHERE (g.user_id = p.id)), '1970-01-01 00:00:00+00'::timestamp with time zone), COALESCE(up.updated_at, p.updated_at, au.created_at, '1970-01-01 00:00:00+00'::timestamp with time zone)) AS last_activity,
    NULL::text AS promo_code,
    NULL::timestamp with time zone AS promo_sent_at,
    (EXISTS ( SELECT 1
           FROM public.orders o
          WHERE (((o.user_id = p.id) OR (o.user_convex_id = au.convex_id)) AND (lower(COALESCE(o.status, ''::text)) = ANY (ARRAY['paid'::text, 'complete'::text, 'completed'::text, 'succeeded'::text]))))) AS has_purchased
   FROM ((public.profiles p
     FULL JOIN public.user_profiles up ON ((up.id = p.id)))
     FULL JOIN public.app_users au ON ((lower(au.email) = lower(COALESCE(p.email, up.email)))));


--
-- Name: email_offers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_offers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text,
    discount_percent numeric,
    coupon_code text,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: email_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    email text,
    marketing boolean DEFAULT true,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: email_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text,
    type text,
    subject text,
    html text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: funnel_leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.funnel_leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    occasion text,
    style_id text,
    funnel_slug text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    user_convex_id text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    type text,
    prompt text,
    status text,
    input_file_path text,
    result_url text,
    video_url text,
    duration integer,
    resolution text,
    aspect_ratio text,
    generate_audio boolean,
    negative_prompt text,
    seed bigint,
    error_message text,
    debited boolean DEFAULT false,
    template_id uuid
);


--
-- Name: occasion_collections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.occasion_collections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    main_category text,
    label text,
    description text,
    image_url text,
    gradient_from text,
    gradient_to text,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    is_trending boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: occasions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.occasions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    updated_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: orders_admin_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.orders_admin_view AS
 SELECT o.id,
    o.user_convex_id,
    o.amount,
    o.amount AS amount_eur,
    o.pack,
    o.status,
    o.stripe_session_id,
    o.created_at,
    COALESCE(au.name, o.email) AS user_name,
    COALESCE(au.email, o.email) AS user_email,
    au.image_url AS user_image
   FROM (public.orders o
     LEFT JOIN public.app_users au ON ((au.convex_id = o.user_convex_id)));


--
-- Name: pricing_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pricing_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    category text,
    name text,
    description text,
    price_cents integer DEFAULT 0,
    currency text DEFAULT 'eur'::text,
    credits integer DEFAULT 0,
    stripe_price_id text,
    stripe_product_id text,
    discount_percent numeric,
    commission_percent numeric,
    active boolean DEFAULT true,
    is_active boolean DEFAULT true,
    is_featured boolean DEFAULT false,
    sort_order integer DEFAULT 0,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: seo_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.seo_pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    page_type text NOT NULL,
    slug text NOT NULL,
    title text,
    meta_title text,
    meta_description text,
    h1 text,
    intro text,
    cta_text text,
    benefits jsonb DEFAULT '[]'::jsonb,
    faq jsonb DEFAULT '[]'::jsonb,
    related_pages jsonb DEFAULT '[]'::jsonb,
    hero_image_url text,
    hero_image_path text,
    image_alt text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: support_ticket_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_ticket_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid,
    sender_id uuid,
    sender_type text,
    message text,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.support_ticket_messages REPLICA IDENTITY FULL;


--
-- Name: support_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    name text,
    email text,
    subject text,
    status text DEFAULT 'open'::text,
    priority text DEFAULT 'normal'::text,
    page_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.support_tickets REPLICA IDENTITY FULL;


--
-- Name: templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    slug text,
    title text,
    prompt text,
    main_category text,
    occasion text,
    category text,
    sub_category text,
    subcategory text,
    type text DEFAULT 'image'::text,
    scene text,
    orientation text DEFAULT 'portrait'::text,
    aspect_ratio text,
    preview_url text,
    previewurl text,
    preview_image_url text,
    thumbnail_url text,
    thumbnailurl text,
    video_url text,
    text_default text,
    textdefault text,
    credit_cost integer DEFAULT 1,
    creditcost integer DEFAULT 1,
    tags text[] DEFAULT '{}'::text[],
    style_id text,
    default_duration integer,
    defaultduration integer,
    default_aspect_ratio text,
    defaultaspectratio text,
    default_resolution text,
    defaultresolution text,
    generate_audio_default boolean,
    generateaudiodefault boolean,
    negative_prompt_default text,
    negativepromptdefault text,
    is_active boolean DEFAULT true,
    isactive boolean DEFAULT true
);


--
-- Name: upgrade_fulfillments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.upgrade_fulfillments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    checkout_session_id text,
    generation_id uuid,
    action_type text,
    fulfillment_status text DEFAULT 'queued'::text,
    output_generation_id uuid,
    output_image_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: admin_users admin_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_pkey PRIMARY KEY (email);


--
-- Name: affiliate_clicks affiliate_clicks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_clicks
    ADD CONSTRAINT affiliate_clicks_pkey PRIMARY KEY (id);


--
-- Name: affiliate_codes affiliate_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_codes
    ADD CONSTRAINT affiliate_codes_code_key UNIQUE (code);


--
-- Name: affiliate_codes affiliate_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_codes
    ADD CONSTRAINT affiliate_codes_pkey PRIMARY KEY (id);


--
-- Name: affiliate_conversions affiliate_conversions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_conversions
    ADD CONSTRAINT affiliate_conversions_pkey PRIMARY KEY (id);


--
-- Name: affiliate_earnings affiliate_earnings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_earnings
    ADD CONSTRAINT affiliate_earnings_pkey PRIMARY KEY (id);


--
-- Name: affiliate_profiles affiliate_profiles_affiliate_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_profiles
    ADD CONSTRAINT affiliate_profiles_affiliate_code_key UNIQUE (affiliate_code);


--
-- Name: affiliate_profiles affiliate_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_profiles
    ADD CONSTRAINT affiliate_profiles_pkey PRIMARY KEY (id);


--
-- Name: affiliate_profiles affiliate_profiles_referral_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_profiles
    ADD CONSTRAINT affiliate_profiles_referral_slug_key UNIQUE (referral_slug);


--
-- Name: affiliate_profiles affiliate_profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_profiles
    ADD CONSTRAINT affiliate_profiles_user_id_key UNIQUE (user_id);


--
-- Name: affiliate_withdrawals affiliate_withdrawals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_withdrawals
    ADD CONSTRAINT affiliate_withdrawals_pkey PRIMARY KEY (id);


--
-- Name: app_users app_users_convex_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_users
    ADD CONSTRAINT app_users_convex_id_key UNIQUE (convex_id);


--
-- Name: app_users app_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_users
    ADD CONSTRAINT app_users_pkey PRIMARY KEY (id);


--
-- Name: blog_posts blog_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_pkey PRIMARY KEY (id);


--
-- Name: blog_posts blog_posts_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_slug_key UNIQUE (slug);


--
-- Name: credits_ledger credits_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credits_ledger
    ADD CONSTRAINT credits_ledger_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: customers customers_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_user_id_key UNIQUE (user_id);


--
-- Name: email_offers email_offers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_offers
    ADD CONSTRAINT email_offers_pkey PRIMARY KEY (id);


--
-- Name: email_preferences email_preferences_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_preferences
    ADD CONSTRAINT email_preferences_email_key UNIQUE (email);


--
-- Name: email_preferences email_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_preferences
    ADD CONSTRAINT email_preferences_pkey PRIMARY KEY (id);


--
-- Name: email_preferences email_preferences_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_preferences
    ADD CONSTRAINT email_preferences_user_id_key UNIQUE (user_id);


--
-- Name: email_templates email_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_pkey PRIMARY KEY (id);


--
-- Name: funnel_leads funnel_leads_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funnel_leads
    ADD CONSTRAINT funnel_leads_email_key UNIQUE (email);


--
-- Name: funnel_leads funnel_leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funnel_leads
    ADD CONSTRAINT funnel_leads_pkey PRIMARY KEY (id);


--
-- Name: generations generations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generations
    ADD CONSTRAINT generations_pkey PRIMARY KEY (id);


--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);


--
-- Name: occasion_collections occasion_collections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.occasion_collections
    ADD CONSTRAINT occasion_collections_pkey PRIMARY KEY (id);


--
-- Name: occasion_collections occasion_collections_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.occasion_collections
    ADD CONSTRAINT occasion_collections_slug_key UNIQUE (slug);


--
-- Name: occasions occasions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.occasions
    ADD CONSTRAINT occasions_pkey PRIMARY KEY (id);


--
-- Name: occasions occasions_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.occasions
    ADD CONSTRAINT occasions_slug_key UNIQUE (slug);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: pricing_items pricing_items_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_items
    ADD CONSTRAINT pricing_items_key_key UNIQUE (key);


--
-- Name: pricing_items pricing_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_items
    ADD CONSTRAINT pricing_items_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: seo_pages seo_pages_page_type_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seo_pages
    ADD CONSTRAINT seo_pages_page_type_slug_key UNIQUE (page_type, slug);


--
-- Name: seo_pages seo_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seo_pages
    ADD CONSTRAINT seo_pages_pkey PRIMARY KEY (id);


--
-- Name: support_ticket_messages support_ticket_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_messages
    ADD CONSTRAINT support_ticket_messages_pkey PRIMARY KEY (id);


--
-- Name: support_tickets support_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id);


--
-- Name: templates templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_pkey PRIMARY KEY (id);


--
-- Name: templates templates_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_slug_key UNIQUE (slug);


--
-- Name: upgrade_fulfillments upgrade_fulfillments_checkout_session_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upgrade_fulfillments
    ADD CONSTRAINT upgrade_fulfillments_checkout_session_id_key UNIQUE (checkout_session_id);


--
-- Name: upgrade_fulfillments upgrade_fulfillments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upgrade_fulfillments
    ADD CONSTRAINT upgrade_fulfillments_pkey PRIMARY KEY (id);


--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);


--
-- Name: affiliate_clicks_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX affiliate_clicks_code_idx ON public.affiliate_clicks USING btree (code);


--
-- Name: affiliate_conversions_affiliate_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX affiliate_conversions_affiliate_user_idx ON public.affiliate_conversions USING btree (affiliate_user_id);


--
-- Name: affiliate_conversions_user_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX affiliate_conversions_user_code_idx ON public.affiliate_conversions USING btree (user_id, code);


--
-- Name: affiliate_earnings_user_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX affiliate_earnings_user_status_idx ON public.affiliate_earnings USING btree (affiliate_user_id, status);


--
-- Name: affiliate_withdrawals_user_req_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX affiliate_withdrawals_user_req_idx ON public.affiliate_withdrawals USING btree (affiliate_user_id, requested_at DESC);


--
-- Name: app_users_email_lower_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX app_users_email_lower_idx ON public.app_users USING btree (lower(email));


--
-- Name: blog_posts_published_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX blog_posts_published_idx ON public.blog_posts USING btree (is_published, published_at DESC);


--
-- Name: credits_ledger_user_convex_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX credits_ledger_user_convex_idx ON public.credits_ledger USING btree (user_convex_id);


--
-- Name: generations_checkout_session_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX generations_checkout_session_idx ON public.generations USING btree (checkout_session_id);


--
-- Name: generations_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX generations_status_idx ON public.generations USING btree (status);


--
-- Name: generations_stripe_session_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX generations_stripe_session_idx ON public.generations USING btree (stripe_session_id);


--
-- Name: generations_user_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX generations_user_created_idx ON public.generations USING btree (user_id, created_at DESC);


--
-- Name: occasion_collections_cat_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX occasion_collections_cat_sort_idx ON public.occasion_collections USING btree (main_category, sort_order, title);


--
-- Name: occasions_active_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX occasions_active_sort_idx ON public.occasions USING btree (active, sort_order);


--
-- Name: orders_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_created_at_idx ON public.orders USING btree (created_at DESC);


--
-- Name: pricing_items_active_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pricing_items_active_key_idx ON public.pricing_items USING btree (active, key, sort_order);


--
-- Name: support_ticket_messages_ticket_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX support_ticket_messages_ticket_idx ON public.support_ticket_messages USING btree (ticket_id, created_at);


--
-- Name: support_tickets_updated_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX support_tickets_updated_idx ON public.support_tickets USING btree (updated_at DESC);


--
-- Name: templates_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX templates_created_at_idx ON public.templates USING btree (created_at DESC);


--
-- Name: templates_isactive_occasion_title_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX templates_isactive_occasion_title_idx ON public.templates USING btree (isactive, occasion, title);


--
-- Name: templates_occasion_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX templates_occasion_idx ON public.templates USING btree (occasion);


--
-- Name: templates_style_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX templates_style_id_idx ON public.templates USING btree (style_id);


--
-- Name: generations trg_debit_credits_on_generation_complete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_debit_credits_on_generation_complete AFTER UPDATE OF status ON public.generations FOR EACH ROW EXECUTE FUNCTION public.debit_credits_on_generation_complete();


--
-- Name: affiliate_profiles affiliate_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_profiles
    ADD CONSTRAINT affiliate_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: customers customers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: generations generations_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generations
    ADD CONSTRAINT generations_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates(id) ON DELETE SET NULL;


--
-- Name: generations generations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generations
    ADD CONSTRAINT generations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: support_ticket_messages support_ticket_messages_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_messages
    ADD CONSTRAINT support_ticket_messages_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE CASCADE;


--
-- Name: upgrade_fulfillments upgrade_fulfillments_generation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upgrade_fulfillments
    ADD CONSTRAINT upgrade_fulfillments_generation_id_fkey FOREIGN KEY (generation_id) REFERENCES public.generations(id) ON DELETE SET NULL;


--
-- Name: user_profiles user_profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: admin_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_users admin_users_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_users_read ON public.admin_users FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: affiliate_clicks aff_clicks_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY aff_clicks_insert ON public.affiliate_clicks FOR INSERT WITH CHECK (true);


--
-- Name: affiliate_clicks aff_clicks_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY aff_clicks_read ON public.affiliate_clicks FOR SELECT USING (true);


--
-- Name: affiliate_codes aff_codes_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY aff_codes_read ON public.affiliate_codes FOR SELECT USING (true);


--
-- Name: affiliate_conversions aff_conv_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY aff_conv_insert ON public.affiliate_conversions FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: affiliate_conversions aff_conv_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY aff_conv_read ON public.affiliate_conversions FOR SELECT USING (((user_id = auth.uid()) OR (affiliate_user_id = auth.uid()) OR public.is_admin()));


--
-- Name: affiliate_earnings aff_earn_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY aff_earn_read ON public.affiliate_earnings FOR SELECT USING (((affiliate_user_id = auth.uid()) OR public.is_admin()));


--
-- Name: affiliate_profiles aff_profiles_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY aff_profiles_own ON public.affiliate_profiles USING (((user_id = auth.uid()) OR public.is_admin())) WITH CHECK (((user_id = auth.uid()) OR public.is_admin()));


--
-- Name: affiliate_withdrawals aff_wd_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY aff_wd_insert ON public.affiliate_withdrawals FOR INSERT WITH CHECK ((affiliate_user_id = auth.uid()));


--
-- Name: affiliate_withdrawals aff_wd_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY aff_wd_read ON public.affiliate_withdrawals FOR SELECT USING (((affiliate_user_id = auth.uid()) OR public.is_admin()));


--
-- Name: affiliate_clicks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;

--
-- Name: affiliate_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.affiliate_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: affiliate_conversions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.affiliate_conversions ENABLE ROW LEVEL SECURITY;

--
-- Name: affiliate_earnings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.affiliate_earnings ENABLE ROW LEVEL SECURITY;

--
-- Name: affiliate_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.affiliate_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: affiliate_withdrawals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.affiliate_withdrawals ENABLE ROW LEVEL SECURITY;

--
-- Name: app_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

--
-- Name: app_users app_users_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY app_users_read ON public.app_users FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: blog_posts blog_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY blog_admin_write ON public.blog_posts USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: blog_posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

--
-- Name: blog_posts blog_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY blog_public_read ON public.blog_posts FOR SELECT USING ((COALESCE(is_published, false) OR public.is_admin()));


--
-- Name: credits_ledger; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.credits_ledger ENABLE ROW LEVEL SECURITY;

--
-- Name: credits_ledger credits_own_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY credits_own_read ON public.credits_ledger FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

--
-- Name: customers customers_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customers_own ON public.customers FOR SELECT USING (((user_id = auth.uid()) OR public.is_admin()));


--
-- Name: email_offers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_offers ENABLE ROW LEVEL SECURITY;

--
-- Name: email_offers email_offers_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_offers_admin ON public.email_offers USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: email_offers email_offers_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_offers_read ON public.email_offers FOR SELECT USING (true);


--
-- Name: email_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: email_preferences email_prefs_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_prefs_own ON public.email_preferences USING (((user_id = auth.uid()) OR public.is_admin())) WITH CHECK (true);


--
-- Name: email_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: email_templates email_templates_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_templates_admin ON public.email_templates USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: funnel_leads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.funnel_leads ENABLE ROW LEVEL SECURITY;

--
-- Name: funnel_leads funnel_leads_upsert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY funnel_leads_upsert ON public.funnel_leads USING (true) WITH CHECK (true);


--
-- Name: generations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;

--
-- Name: generations generations_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY generations_insert ON public.generations FOR INSERT WITH CHECK (((user_id = auth.uid()) OR (user_id IS NULL) OR (auth.uid() IS NOT NULL)));


--
-- Name: generations generations_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY generations_select ON public.generations FOR SELECT USING (((user_id = auth.uid()) OR (user_id IS NULL) OR public.is_admin()));


--
-- Name: generations generations_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY generations_update ON public.generations FOR UPDATE USING (((user_id = auth.uid()) OR public.is_admin()));


--
-- Name: jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: jobs jobs_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY jobs_read ON public.jobs FOR SELECT USING (((auth.uid() IS NOT NULL) OR public.is_admin()));


--
-- Name: occasion_collections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.occasion_collections ENABLE ROW LEVEL SECURITY;

--
-- Name: occasion_collections occasion_collections_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY occasion_collections_admin_write ON public.occasion_collections USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: occasion_collections occasion_collections_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY occasion_collections_public_read ON public.occasion_collections FOR SELECT USING (true);


--
-- Name: occasions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.occasions ENABLE ROW LEVEL SECURITY;

--
-- Name: occasions occasions_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY occasions_admin_write ON public.occasions USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: occasions occasions_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY occasions_public_read ON public.occasions FOR SELECT USING (true);


--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

--
-- Name: orders orders_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_read ON public.orders FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: pricing_items pricing_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pricing_admin_write ON public.pricing_items USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: pricing_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pricing_items ENABLE ROW LEVEL SECURITY;

--
-- Name: pricing_items pricing_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pricing_public_read ON public.pricing_items FOR SELECT USING (COALESCE(active, is_active, true));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select ON public.profiles FOR SELECT USING (((id = auth.uid()) OR public.is_admin()));


--
-- Name: profiles profiles_upsert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_upsert ON public.profiles USING (((id = auth.uid()) OR public.is_admin())) WITH CHECK (((id = auth.uid()) OR public.is_admin()));


--
-- Name: seo_pages seo_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY seo_admin_write ON public.seo_pages USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: seo_pages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.seo_pages ENABLE ROW LEVEL SECURITY;

--
-- Name: seo_pages seo_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY seo_public_read ON public.seo_pages FOR SELECT USING (COALESCE(is_active, true));


--
-- Name: support_ticket_messages support_msgs_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY support_msgs_all ON public.support_ticket_messages USING (true) WITH CHECK (true);


--
-- Name: support_ticket_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: support_tickets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

--
-- Name: support_tickets support_tickets_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY support_tickets_all ON public.support_tickets USING (((user_id = auth.uid()) OR public.is_admin() OR (user_id IS NULL))) WITH CHECK (true);


--
-- Name: templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

--
-- Name: templates templates_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY templates_admin_write ON public.templates USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: templates templates_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY templates_public_read ON public.templates FOR SELECT USING (true);


--
-- Name: upgrade_fulfillments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.upgrade_fulfillments ENABLE ROW LEVEL SECURITY;

--
-- Name: upgrade_fulfillments upgrades_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY upgrades_read ON public.upgrade_fulfillments FOR SELECT USING (true);


--
-- Name: user_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_profiles user_profiles_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_profiles_own ON public.user_profiles USING (((id = auth.uid()) OR public.is_admin())) WITH CHECK (((id = auth.uid()) OR public.is_admin()));


--
-- PostgreSQL database dump complete
--


