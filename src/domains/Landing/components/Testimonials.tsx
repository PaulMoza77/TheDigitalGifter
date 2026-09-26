import { useMemo } from "react";
import { Heart, Star } from "lucide-react";

type Testimonial = {
  name: string;
  role: string;
  image: string;
  content: string;
  rating: number;
};

const testimonials: Testimonial[] = [
  {
    name: "Sarah Mitchell",
    role: "Event Planner",
    image:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces",
    content:
      "I created personalized wedding cards for several clients in minutes. The results felt elegant, emotional, and much more personal than standard templates.",
    rating: 5,
  },
  {
    name: "Emily Rodriguez",
    role: "Mom of 3",
    image:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=faces",
    content:
      "I made a birthday surprise for my daughter and she loved it. It looked beautiful, warm, and completely made for her.",
    rating: 5,
  },
  {
    name: "Jessica Park",
    role: "Wedding Photographer",
    image:
      "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=100&h=100&fit=crop&crop=faces",
    content:
      "My couples use it for save-the-dates, thank-you cards, and emotional keepsakes. It helps turn simple photos into something truly memorable.",
    rating: 5,
  },
  {
    name: "Michael Chen",
    role: "Small Business Owner",
    image:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces",
    content:
      "We used it for our client holiday cards and the response was amazing. It felt premium without needing a designer for every small occasion.",
    rating: 5,
  },
  {
    name: "Amanda Collins",
    role: "Bride-to-be",
    image:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=faces",
    content:
      "I wanted something that felt romantic but not generic. The final card looked like a small movie poster for our story.",
    rating: 5,
  },
  {
    name: "Laura Bennett",
    role: "Teacher",
    image:
      "https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=100&h=100&fit=crop&crop=faces",
    content:
      "I made personalized cards for my students and parents. It was simple, fast, and every card felt thoughtful.",
    rating: 5,
  },
  {
    name: "Daniel Moore",
    role: "Dad",
    image:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=faces",
    content:
      "I made something for my wife’s birthday in a few minutes, and honestly it felt more meaningful than most gifts I could buy last minute.",
    rating: 5,
  },
  {
    name: "Sofia Martin",
    role: "Content Creator",
    image:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100&h=100&fit=crop&crop=faces",
    content:
      "The styles are beautiful. I use it when I want a gift or post to feel more emotional, personal, and polished.",
    rating: 5,
  },
];

function shuffleTestimonials(items: Testimonial[]) {
  return [...items]
    .map((item) => ({ item, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ item }) => item);
}

export const Testimonials = () => {
  const randomizedTestimonials = useMemo(
    () => shuffleTestimonials(testimonials),
    []
  );

  const topTestimonials = randomizedTestimonials.slice(0, 3);
  const bottomTestimonials = randomizedTestimonials.slice(3, 5);

  return (
    <section
      className="w-full border-t border-[var(--tdg-home-border)] bg-[var(--tdg-home-bg)] px-4 py-14 sm:px-6 sm:py-20 lg:px-8"
      aria-labelledby="testimonials-heading"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto mb-12 max-w-3xl text-center sm:mb-16">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--tdg-home-border)] bg-[var(--tdg-home-surface)] px-4 py-2 text-sm font-semibold text-[var(--tdg-home-accent)]">
            <Heart className="h-4 w-4" aria-hidden="true" />
            Real moments
          </div>

          <h2
            id="testimonials-heading"
            className="font-serif text-3xl font-semibold tracking-tight text-[var(--tdg-home-text)] sm:text-4xl"
          >
            Made for gifts that feel personal.
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[var(--tdg-home-text-muted)] sm:text-lg sm:leading-8">
            Birthday surprises, love notes, apology cards, wedding memories, and
            family keepsakes — created in minutes, meant to be felt.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {topTestimonials.map((testimonial) => (
            <TestimonialCard
              key={`${testimonial.name}-${testimonial.role}`}
              testimonial={testimonial}
            />
          ))}
        </div>

        <div className="mt-8 hidden grid-cols-2 gap-8 lg:grid">
          {bottomTestimonials.map((testimonial) => (
            <TestimonialCard
              key={`${testimonial.name}-${testimonial.role}`}
              testimonial={testimonial}
              wide
            />
          ))}
        </div>
      </div>
    </section>
  );
};

function TestimonialCard({
  testimonial,
  wide = false,
}: {
  testimonial: Testimonial;
  wide?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-[var(--tdg-home-border)] bg-[var(--tdg-home-surface)] p-6 sm:p-8 ${
        wide ? "min-h-[220px]" : "min-h-[260px]"
      }`}
    >
      <div className="mb-4 flex gap-1" aria-hidden="true">
        {Array.from({ length: testimonial.rating }).map((_, index) => (
          <Star
            key={index}
            className="h-4 w-4 fill-[var(--tdg-home-accent)] text-[var(--tdg-home-accent)]"
          />
        ))}
      </div>

      <p className="mb-6 text-base leading-7 text-[var(--tdg-home-text)]/90">
        “{testimonial.content}”
      </p>

      <div className="flex items-center gap-3">
        <img
          src={testimonial.image}
          alt=""
          className="h-11 w-11 rounded-full border border-[var(--tdg-home-border)] object-cover"
          loading="lazy"
        />

        <div>
          <div className="font-semibold text-[var(--tdg-home-text)]">
            {testimonial.name}
          </div>
          <div className="text-sm text-[var(--tdg-home-text-muted)]">
            {testimonial.role}
          </div>
        </div>
      </div>
    </div>
  );
}