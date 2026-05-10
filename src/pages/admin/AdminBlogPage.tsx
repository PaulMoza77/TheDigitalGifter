import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Eye,
  ImagePlus,
  Link as LinkIcon,
  Plus,
  Save,
  Trash2,
  Wand2,
  Search,
  FilePlus2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type InternalLink = {
  anchor_text: string;
  url: string;
  placement_note: string;
};

type FaqItem = {
  question: string;
  answer: string;
};

type BlogPost = {
  id: string;
  slug: string;
  title: string;
  meta_title: string;
  meta_description: string;
  excerpt: string;
  content: string;
  cover_image_url: string | null;
  cover_image_path: string | null;
  image_prompt: string | null;
  cta_label: string | null;
  cta_url: string | null;
  internal_links: InternalLink[];
  faq: FaqItem[];
  author_name: string;
  is_published: boolean;
  published_at: string | null;
  updated_at: string | null;
};

type BlogForm = {
  id: string | null;
  slug: string;
  title: string;
  meta_title: string;
  meta_description: string;
  excerpt: string;
  content: string;
  cover_image_url: string;
  cover_image_path: string;
  image_prompt: string;
  cta_label: string;
  cta_url: string;
  internal_links: InternalLink[];
  faq: FaqItem[];
  author_name: string;
  is_published: boolean;
};

const emptyForm: BlogForm = {
  id: null,
  slug: "",
  title: "",
  meta_title: "",
  meta_description: "",
  excerpt: "",
  content: "",
  cover_image_url: "",
  cover_image_path: "",
  image_prompt: "",
  cta_label: "Create your AI gift",
  cta_url: "/generator",
  internal_links: [],
  faq: [],
  author_name: "TheDigitalGifter Team",
  is_published: false,
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inputClass() {
  return "w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-emerald-400";
}

function labelClass() {
  return "mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400";
}

function normalizeLinks(value: unknown): InternalLink[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const row = item as Partial<InternalLink> & {
        label?: string;
      };

      return {
        anchor_text: String(row.anchor_text ?? row.label ?? ""),
        url: String(row.url ?? ""),
        placement_note: String(row.placement_note ?? ""),
      };
    })
    .filter((item) => item.anchor_text || item.url || item.placement_note);
}

function normalizeFaq(value: unknown): FaqItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const row = item as Partial<FaqItem>;

      return {
        question: String(row.question ?? ""),
        answer: String(row.answer ?? ""),
      };
    })
    .filter((item) => item.question || item.answer);
}

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [form, setForm] = useState<BlogForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [aiTopic, setAiTopic] = useState("");
  const [generating, setGenerating] = useState(false);

  const publicUrl = useMemo(() => {
    if (!form.slug) return "";
    return `/blog/${form.slug}`;
  }, [form.slug]);

  const filteredPosts = useMemo(() => {
    const clean = search.trim().toLowerCase();
    if (!clean) return posts;

    return posts.filter((post) => {
      return (
        post.title.toLowerCase().includes(clean) ||
        post.slug.toLowerCase().includes(clean) ||
        post.meta_title.toLowerCase().includes(clean)
      );
    });
  }, [posts, search]);

  async function loadPosts() {
    setLoading(true);

    const { data, error } = await supabase
      .from("blog_posts")
      .select(
        "id,slug,title,meta_title,meta_description,excerpt,content,cover_image_url,cover_image_path,image_prompt,cta_label,cta_url,internal_links,faq,author_name,is_published,published_at,updated_at"
      )
      .order("updated_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    setPosts((data as BlogPost[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void loadPosts();
  }, []);

  function updateField<K extends keyof BlogForm>(key: K, value: BlogForm[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function startNewPost() {
    setForm({ ...emptyForm });
    setAiTopic("");
  }

  function editPost(post: BlogPost) {
    setForm({
      id: post.id,
      slug: post.slug,
      title: post.title,
      meta_title: post.meta_title,
      meta_description: post.meta_description,
      excerpt: post.excerpt,
      content: post.content,
      cover_image_url: post.cover_image_url ?? "",
      cover_image_path: post.cover_image_path ?? "",
      image_prompt: post.image_prompt ?? "",
      cta_label: post.cta_label ?? "Create your AI gift",
      cta_url: post.cta_url ?? "/generator",
      internal_links: normalizeLinks(post.internal_links),
      faq: normalizeFaq(post.faq),
      author_name: post.author_name,
      is_published: post.is_published,
    });
  }

  async function uploadCoverImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const extension = file.name.split(".").pop() || "jpg";
    const cleanName = slugify(file.name.replace(/\.[^/.]+$/, ""));
    const filePath = `covers/${Date.now()}-${cleanName}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("blog-images")
      .upload(filePath, file, {
        upsert: true,
        contentType: file.type,
      });

    if (uploadError) {
      toast.error(uploadError.message);
      return;
    }

    const { data } = supabase.storage
      .from("blog-images")
      .getPublicUrl(filePath);

    updateField("cover_image_url", data.publicUrl);
    updateField("cover_image_path", filePath);

    toast.success("Cover image uploaded");
  }

  function addInternalLink() {
    updateField("internal_links", [
      ...form.internal_links,
      {
        anchor_text: "",
        url: "",
        placement_note: "",
      },
    ]);
  }

  function updateInternalLink(
    index: number,
    key: keyof InternalLink,
    value: string
  ) {
    const next = [...form.internal_links];
    next[index] = {
      ...next[index],
      [key]: value,
    };

    updateField("internal_links", next);
  }

  function removeInternalLink(index: number) {
    updateField(
      "internal_links",
      form.internal_links.filter((_, itemIndex) => itemIndex !== index)
    );
  }

  function addFaq() {
    updateField("faq", [...form.faq, { question: "", answer: "" }]);
  }

  function updateFaq(index: number, key: keyof FaqItem, value: string) {
    const next = [...form.faq];
    next[index] = {
      ...next[index],
      [key]: value,
    };

    updateField("faq", next);
  }

  function removeFaq(index: number) {
    updateField(
      "faq",
      form.faq.filter((_, itemIndex) => itemIndex !== index)
    );
  }

  async function generateWithAI() {
    const topic = aiTopic.trim() || form.title.trim();

    if (!topic) {
      toast.error("Add a blog topic or title first");
      return;
    }

    setGenerating(true);

    const { data, error } = await supabase.functions.invoke(
      "generate-blog-draft",
      {
        body: {
          topic,
          current_title: form.title,
          target_brand: "TheDigitalGifter",
          target_audience:
            "people looking for emotional digital gifts, AI photo gifts, apology gifts, birthday gifts, romantic surprises, and last-minute online gifts",
        },
      }
    );

    if (error) {
      toast.error(error.message);
      setGenerating(false);
      return;
    }

    const draft = data as Partial<BlogForm>;

    const nextTitle = draft.title?.trim() || form.title || topic;

    setForm((current) => ({
      ...current,
      title: nextTitle,
      slug: draft.slug?.trim() || current.slug || slugify(nextTitle),
      meta_title:
        draft.meta_title?.trim() ||
        current.meta_title ||
        `${nextTitle} | TheDigitalGifter`,
      meta_description:
        draft.meta_description?.trim() || current.meta_description,
      excerpt: draft.excerpt?.trim() || current.excerpt,
      content: draft.content?.trim() || current.content,
      image_prompt: draft.image_prompt?.trim() || current.image_prompt,
      cta_label: draft.cta_label?.trim() || current.cta_label,
      cta_url: draft.cta_url?.trim() || current.cta_url,
      internal_links: Array.isArray(draft.internal_links)
        ? normalizeLinks(draft.internal_links)
        : current.internal_links,
      faq: Array.isArray(draft.faq) ? normalizeFaq(draft.faq) : current.faq,
    }));

    toast.success("AI draft generated");
    setGenerating(false);
  }

  async function savePost() {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }

    const cleanSlug = form.slug.trim() || slugify(form.title);

    if (!cleanSlug) {
      toast.error("Slug is required");
      return;
    }

    if (!form.meta_title.trim()) {
      toast.error("Meta title is required");
      return;
    }

    if (!form.meta_description.trim()) {
      toast.error("Meta description is required");
      return;
    }

    if (!form.excerpt.trim()) {
      toast.error("Excerpt is required");
      return;
    }

    if (!form.content.trim()) {
      toast.error("Content is required");
      return;
    }

    setSaving(true);

    const payload = {
      slug: cleanSlug,
      title: form.title.trim(),
      meta_title: form.meta_title.trim(),
      meta_description: form.meta_description.trim(),
      excerpt: form.excerpt.trim(),
      content: form.content.trim(),
      cover_image_url: form.cover_image_url || null,
      cover_image_path: form.cover_image_path || null,
      image_prompt: form.image_prompt || null,
      cta_label: form.cta_label || null,
      cta_url: form.cta_url || null,
      internal_links: form.internal_links.filter(
        (link) => link.anchor_text.trim() && link.url.trim()
      ),
      faq: form.faq.filter(
        (item) => item.question.trim() && item.answer.trim()
      ),
      author_name: form.author_name.trim() || "TheDigitalGifter Team",
      is_published: form.is_published,
      published_at: form.is_published ? new Date().toISOString() : null,
    };

    const query = form.id
      ? supabase.from("blog_posts").update(payload).eq("id", form.id).select()
      : supabase.from("blog_posts").insert(payload).select();

    const { data, error } = await query.single();

    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }

    toast.success(form.id ? "Blog post updated" : "Blog post created");

    const saved = data as BlogPost;

    setForm({
      id: saved.id,
      slug: saved.slug,
      title: saved.title,
      meta_title: saved.meta_title,
      meta_description: saved.meta_description,
      excerpt: saved.excerpt,
      content: saved.content,
      cover_image_url: saved.cover_image_url ?? "",
      cover_image_path: saved.cover_image_path ?? "",
      image_prompt: saved.image_prompt ?? "",
      cta_label: saved.cta_label ?? "Create your AI gift",
      cta_url: saved.cta_url ?? "/generator",
      internal_links: normalizeLinks(saved.internal_links),
      faq: normalizeFaq(saved.faq),
      author_name: saved.author_name,
      is_published: saved.is_published,
    });

    await loadPosts();
    setSaving(false);
  }

  async function deletePost() {
    if (!form.id) return;

    const confirmed = window.confirm("Delete this blog post?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("blog_posts")
      .delete()
      .eq("id", form.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Blog post deleted");
    setForm({ ...emptyForm });
    await loadPosts();
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-8 text-slate-50">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-semibold">Blog editor</h1>
            <p className="mt-2 text-sm text-slate-400">
              Create SEO blog posts that publish automatically to /blog.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {publicUrl ? (
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
              >
                <Eye className="h-4 w-4" />
                Preview
              </a>
            ) : null}

            <button
              type="button"
              onClick={startNewPost}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
            >
              <FilePlus2 className="h-4 w-4" />
              New post
            </button>

            <button
              type="button"
              onClick={savePost}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <label className={labelClass()}>
                AI topic / keyword
              </label>
              <input
                className={inputClass()}
                value={aiTopic}
                onChange={(event) => setAiTopic(event.target.value)}
                placeholder="Example: last-minute birthday gift ideas for girlfriend"
              />
              <p className="mt-2 text-xs text-slate-500">
                AI will generate title, slug, meta title, meta description,
                excerpt, blog body, FAQs, internal link suggestions and image
                prompt.
              </p>
            </div>

            <button
              type="button"
              onClick={generateWithAI}
              disabled={generating}
              className="inline-flex h-[46px] items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 text-sm font-semibold text-slate-950 disabled:opacity-60"
            >
              <Wand2 className="h-4 w-4" />
              {generating ? "Generating..." : "Generate with AI"}
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <aside className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                Posts
              </h2>

              <span className="text-xs text-slate-500">
                {filteredPosts.length}
              </span>
            </div>

            <div className="mb-4 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search posts..."
                className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
              />
            </div>

            {loading ? (
              <p className="text-sm text-slate-400">Loading...</p>
            ) : filteredPosts.length === 0 ? (
              <p className="text-sm text-slate-400">No blog posts found.</p>
            ) : (
              <div className="max-h-[720px] space-y-2 overflow-y-auto pr-1">
                {filteredPosts.map((post) => (
                  <button
                    type="button"
                    key={post.id}
                    onClick={() => editPost(post)}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                      form.id === post.id
                        ? "border-emerald-400 bg-slate-800"
                        : "border-slate-800 bg-slate-950 hover:bg-slate-800/70"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold">
                        {post.title}
                      </p>

                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                          post.is_published
                            ? "bg-emerald-400/10 text-emerald-300"
                            : "bg-slate-700 text-slate-300"
                        }`}
                      >
                        {post.is_published ? "Live" : "Draft"}
                      </span>
                    </div>

                    <p className="mt-1 truncate text-xs text-slate-500">
                      /blog/{post.slug}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <section className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
              <h2 className="mb-5 text-lg font-semibold">Main content</h2>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className={labelClass()}>Title</label>
                  <input
                    className={inputClass()}
                    value={form.title}
                    onChange={(event) => {
                      const nextTitle = event.target.value;
                      updateField("title", nextTitle);

                      if (!form.id && !form.slug) {
                        updateField("slug", slugify(nextTitle));
                      }

                      if (!form.meta_title) {
                        updateField("meta_title", nextTitle);
                      }
                    }}
                    placeholder="Best last-minute birthday gift ideas"
                  />
                </div>

                <div>
                  <label className={labelClass()}>Slug</label>
                  <input
                    className={inputClass()}
                    value={form.slug}
                    onChange={(event) =>
                      updateField("slug", slugify(event.target.value))
                    }
                    placeholder="last-minute-birthday-gift-ideas"
                  />
                </div>

                <div>
                  <label className={labelClass()}>Meta title</label>
                  <input
                    className={inputClass()}
                    value={form.meta_title}
                    onChange={(event) =>
                      updateField("meta_title", event.target.value)
                    }
                    placeholder="Last-Minute Birthday Gift Ideas | TheDigitalGifter"
                  />
                </div>

                <div>
                  <label className={labelClass()}>Author</label>
                  <input
                    className={inputClass()}
                    value={form.author_name}
                    onChange={(event) =>
                      updateField("author_name", event.target.value)
                    }
                  />
                </div>
              </div>

              <div className="mt-5">
                <label className={labelClass()}>
                  Meta description — max 150-160 chars
                </label>
                <textarea
                  className={inputClass()}
                  rows={3}
                  value={form.meta_description}
                  onChange={(event) =>
                    updateField("meta_description", event.target.value)
                  }
                  placeholder="Discover emotional last-minute birthday gift ideas you can create online in minutes."
                />
              </div>

              <div className="mt-5">
                <label className={labelClass()}>Excerpt</label>
                <textarea
                  className={inputClass()}
                  rows={3}
                  value={form.excerpt}
                  onChange={(event) =>
                    updateField("excerpt", event.target.value)
                  }
                  placeholder="Short summary shown on the blog page."
                />
              </div>

              <div className="mt-5">
                <label className={labelClass()}>Blog content</label>
                <textarea
                  className={`${inputClass()} min-h-[460px] font-mono leading-7`}
                  value={form.content}
                  onChange={(event) =>
                    updateField("content", event.target.value)
                  }
                  placeholder={`Write your blog here.

Use markdown-style structure:

## Section title
Paragraph text.

## Another section
Paragraph text.`}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
              <h2 className="mb-5 text-lg font-semibold">Cover image</h2>

              <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-950 px-6 py-10 text-center hover:bg-slate-900">
                <ImagePlus className="h-8 w-8 text-slate-400" />
                <span className="mt-3 text-sm font-semibold">
                  Upload blog cover
                </span>
                <span className="mt-1 text-xs text-slate-500">
                  JPG, PNG, WEBP
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={uploadCoverImage}
                  className="hidden"
                />
              </label>

              <div className="mt-5">
                <label className={labelClass()}>
                  AI image prompt
                </label>
                <textarea
                  className={inputClass()}
                  rows={4}
                  value={form.image_prompt}
                  onChange={(event) =>
                    updateField("image_prompt", event.target.value)
                  }
                  placeholder="AI image idea based on this article..."
                />
              </div>

              {form.cover_image_url ? (
                <img
                  src={form.cover_image_url}
                  alt={form.title || "Blog cover"}
                  className="mt-5 max-h-80 rounded-2xl object-cover"
                />
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
              <h2 className="mb-5 text-lg font-semibold">CTA</h2>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className={labelClass()}>CTA label</label>
                  <input
                    className={inputClass()}
                    value={form.cta_label}
                    onChange={(event) =>
                      updateField("cta_label", event.target.value)
                    }
                    placeholder="Create your AI gift"
                  />
                </div>

                <div>
                  <label className={labelClass()}>CTA URL</label>
                  <input
                    className={inputClass()}
                    value={form.cta_url}
                    onChange={(event) =>
                      updateField("cta_url", event.target.value)
                    }
                    placeholder="/generator"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Internal links</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Add exact anchor text + destination URL. Use the anchor text
                    naturally inside the article.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addInternalLink}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800"
                >
                  <LinkIcon className="h-4 w-4" />
                  Add link
                </button>
              </div>

              <div className="space-y-3">
                {form.internal_links.map((link, index) => (
                  <div
                    key={index}
                    className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4 md:grid-cols-[1fr_1fr_auto]"
                  >
                    <input
                      className={inputClass()}
                      value={link.anchor_text}
                      onChange={(event) =>
                        updateInternalLink(
                          index,
                          "anchor_text",
                          event.target.value
                        )
                      }
                      placeholder="Anchor text: AI birthday gift"
                    />

                    <input
                      className={inputClass()}
                      value={link.url}
                      onChange={(event) =>
                        updateInternalLink(index, "url", event.target.value)
                      }
                      placeholder="/occasion/birthday"
                    />

                    <button
                      type="button"
                      onClick={() => removeInternalLink(index)}
                      className="rounded-xl border border-red-500/30 px-3 py-2 text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>

                    <textarea
                      className={`${inputClass()} md:col-span-3`}
                      rows={2}
                      value={link.placement_note}
                      onChange={(event) =>
                        updateInternalLink(
                          index,
                          "placement_note",
                          event.target.value
                        )
                      }
                      placeholder="Placement note: Add this in the section about last-minute birthday ideas."
                    />
                  </div>
                ))}

                {form.internal_links.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Example: anchor text “AI birthday gift” → URL
                    /occasion/birthday
                  </p>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
              <div className="mb-5 flex items-center justify-between gap-4">
                <h2 className="text-lg font-semibold">FAQ</h2>

                <button
                  type="button"
                  onClick={addFaq}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800"
                >
                  <Plus className="h-4 w-4" />
                  Add FAQ
                </button>
              </div>

              <div className="space-y-3">
                {form.faq.map((item, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                  >
                    <input
                      className={inputClass()}
                      value={item.question}
                      onChange={(event) =>
                        updateFaq(index, "question", event.target.value)
                      }
                      placeholder="Question"
                    />

                    <textarea
                      className={`${inputClass()} mt-3`}
                      rows={3}
                      value={item.answer}
                      onChange={(event) =>
                        updateFaq(index, "answer", event.target.value)
                      }
                      placeholder="Answer"
                    />

                    <button
                      type="button"
                      onClick={() => removeFaq(index)}
                      className="mt-3 inline-flex items-center gap-2 rounded-xl border border-red-500/30 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove FAQ
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
              <h2 className="mb-5 text-lg font-semibold">Publishing</h2>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={form.is_published}
                  onChange={(event) =>
                    updateField("is_published", event.target.checked)
                  }
                  className="h-5 w-5 rounded border-slate-700"
                />
                <span className="text-sm text-slate-200">
                  Publish this post
                </span>
              </label>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={savePost}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {saving ? "Saving..." : "Save blog post"}
                </button>

                {form.id ? (
                  <button
                    type="button"
                    onClick={deletePost}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 px-5 py-3 text-sm font-semibold text-red-300 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}