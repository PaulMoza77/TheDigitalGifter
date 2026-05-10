import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";

type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  cover_image_url: string | null;
  published_at: string | null;
};

export default function BlogIndexPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);

  useEffect(() => {
    async function loadPosts() {
      const { data } = await supabase
        .from("blog_posts")
        .select("slug,title,excerpt,cover_image_url,published_at")
        .eq("is_published", true)
        .order("published_at", { ascending: false });

      setPosts((data as BlogPost[]) ?? []);
    }

    loadPosts();
  }, []);

  return (
    <main className="min-h-screen bg-[#f8f4ea] px-6 py-20 text-[#063f2f]">
      <section className="mx-auto max-w-5xl">
        <h1 className="text-5xl font-semibold">Gift ideas & inspiration</h1>

        <p className="mt-5 max-w-2xl text-lg text-[#3f5f55]">
          Emotional gift ideas, AI gifting inspiration, and simple ways to make
          someone feel special.
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {posts.map((post) => (
            <Link
              key={post.slug}
              to={`/blog/${post.slug}`}
              className="rounded-3xl bg-white p-5 shadow-sm transition hover:-translate-y-1"
            >
              <div className="aspect-[4/3] rounded-2xl bg-[#eaf4eb]">
                {post.cover_image_url && (
                  <img
                    src={post.cover_image_url}
                    alt={post.title}
                    className="h-full w-full rounded-2xl object-cover"
                  />
                )}
              </div>

              <h2 className="mt-5 text-xl font-semibold">{post.title}</h2>

              <p className="mt-3 text-sm leading-6 text-[#3f5f55]">
                {post.excerpt}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}