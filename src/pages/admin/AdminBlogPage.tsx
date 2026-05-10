import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Eye,
  ImagePlus,
  Link as LinkIcon,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

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
  cta_label: string | null;
  cta_url: string | null;
  internal_links: InternalLink[];
  faq: FaqItem[];
  author_name: string;
  is_published: boolean;
  published_at: string | null;
};

type InternalLink = {
  label: string;
  url: string;
};

type FaqItem = {
  question: string;
  answer: string;
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

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [form, setForm] = useState<BlogForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const publicUrl = useMemo(() => {
    if (!form.slug) return "";
    return `/blog/${form.slug}`;
  }, [form.slug]);

  async function loadPosts() {
    setLoading(true);

    const { data, error } = await supabase
      .from("blog_posts")
      .select(
        "id,slug,title,meta_title,meta_description,excerpt,content,cover_image_url,cover_image_path,cta_label,cta_url,internal_links,faq,author_name,is_published,published_at"
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
    setForm(emptyForm);
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
      cta_label: post.cta_label ?? "",
      cta_url: post.cta_url ?? "",
      internal_links: Array.isArray(post.internal_links)
        ? post.internal_links
        : [],
      faq: Array.isArray(post.faq) ? post.faq : [],
      author_name: post.author_name,
      is_published: post.is_published,
    });
  }

  async function uploadCoverImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const extension = file.name.split(".").pop() || "jpg";
    const filePath = `covers/${Date.now()}-${slugify(file.name)}.${extension}`;

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

    toast.success("Image uploaded");
  }

  function addInternalLink() {
    updateField("internal_links", [
      ...form.internal_links,
      { label: "", url: "" },
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
      cta_label: form.cta_label || null,
      cta_url: form.cta_url || null,
      internal_links: form.internal_links.filter(
        (link) => link.label.trim() && link.url.trim()
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
      cta_label: saved.cta_label ?? "",
      cta_url: saved.cta_url ?? "",
      internal_links: Array.isArray(saved.internal_links)
        ? saved.internal_links
        : [],
      faq: Array.isArray(saved.faq) ? saved.faq : [],
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
    setForm(emptyForm);
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
              <Plus className="h-4 w-4" />
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

        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <aside className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
              Posts
            </h2>

            {loading ? (
              <p className="text-sm text-slate-400">Loading...</p>
            ) : posts.length === 0 ? (
              <p className="text-sm text-slate-400">No blog posts yet.</p>
            ) : (
              <div className="space-y-2">
                {posts.map((post) => (
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
                  className={`${inputClass()} min-h-[420px] font-mono leading-7`}
                  value={form.content}
                  onChange={(event) =>
                    updateField("content", event.target.value)
                  }
                  placeholder={`Write your blog here.

Use normal paragraphs.

You can include section titles like:
## Best ideas
## Why it works
## Final thoughts`}
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
                <h2 className="text-lg font-semibold">Internal links</h2>

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
                      value={link.label}
                      onChange={(event) =>
                        updateInternalLink(index, "label", event.target.value)
                      }
                      placeholder="Birthday gift"
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
                  </div>
                ))}

                {form.internal_links.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Add links to SEO pages like /occasion/birthday,
                    /recipient/girlfriend or /generator/ai-birthday-video-generator.
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

                {form.faq.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    FAQ helps SEO and can appear in structured data later.
                  </p>
                ) : null}
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