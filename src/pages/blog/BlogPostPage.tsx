import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";

type BlogPost = {
  slug: string;
  title: string;
  meta_title: string;
  meta_description: string;
  excerpt: string;
  content: string;
  cover_image_url: string | null;
  author_name: string;
  published_at: string | null;
};

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const safeSlug = slug?.trim().toLowerCase();

  useEffect(() => {
    async function loadPost() {
      if (!safeSlug) return;

      const { data } = await supabase
        .from("blog_posts")
        .select(
          "slug,title,meta_title,meta_description,excerpt,content,cover_image_url,author_name,published_at"
        )
        .eq("slug", safeSlug)
        .eq("is_published", true)
        .single();

      setPost((data as BlogPost) ?? null);
    }

    loadPost();
  }, [safeSlug]);

  useEffect(() => {
    if (!post) return;

    document.title = post.meta_title;

    let description = document.querySelector("meta[name='description']");
    if (!description) {
      description = document.createElement("meta");
      description.setAttribute("name", "description");
      document.head.appendChild(description);
    }

    description.setAttribute("content", post.meta_description);

    let canonical = document.querySelector("link[rel='canonical']");
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }

    canonical.setAttribute(
      "href",
      `https://thedigitalgifter.com/blog/${post.slug}`
    );
  }, [post]);

  if (!post) {
    return (
      <main className="min-h-screen bg-[#f8f4ea] px-6 py-20 text-center">
        <h1 className="text-4xl font-semibold text-[#063f2f]">
          Blog post not found
        </h1>
        <Link
          to="/blog"
          className="mt-6 inline-block rounded-full bg-[#063f2f] px-6 py-3 text-white"
        >
          Back to blog
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8f4ea] px-6 py-20 text-[#063f2f]">
      <article className="mx-auto max-w-3xl">
        <Link to="/blog" className="text-sm font-semibold text-[#3f5f55]">
          ← Back to blog
        </Link>

        <h1 className="mt-8 text-5xl font-semibold leading-tight">
          {post.title}
        </h1>

        <p className="mt-5 text-lg leading-8 text-[#3f5f55]">
          {post.excerpt}
        </p>

        {post.cover_image_url && (
          <img
            src={post.cover_image_url}
            alt={post.title}
            className="mt-10 rounded-3xl"
          />
        )}

        <div className="prose prose-lg mt-10 max-w-none text-[#163f34]">
          {post.content.split("\n").map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </article>
    </main>
  );
}