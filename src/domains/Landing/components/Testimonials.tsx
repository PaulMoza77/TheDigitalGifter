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
    <section className="w-full bg-gradient-to-b from-black via-slate-950/70 to-black px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto mb-20 max-w-3xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-pink-400/25 bg-pink-400/10 px-4 py-2 text-sm font-bold text-pink-200">
            <Heart className="h-4 w-4" />
            Real moments, real reactions
          </div>

          <h2 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
            Made for gifts that feel personal.
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/60">
            People use TheDigitalGifter to create birthday surprises, love
            notes, apology cards, wedding memories, family keepsakes and
            thoughtful little gifts.
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
      className={`rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-xl transition duration-300 hover:-translate-y-1 hover:border-yellow-300/35 hover:shadow-yellow-500/10 ${
        wide ? "min-h-[230px]" : "min-h-[280px]"
      }`}
    >
      <div className="mb-5 flex gap-1">
        {Array.from({ length: testimonial.rating }).map((_, index) => (
          <Star
            key={index}
            className="h-5 w-5 fill-yellow-300 text-yellow-300"
          />
        ))}
      </div>

      <p className="mb-7 text-base leading-7 text-white/75">
        “{testimonial.content}”
      </p>

      <div className="flex items-center gap-3">
        <img
          src={testimonial.image}
          alt={testimonial.name}
          className="h-12 w-12 rounded-full border border-white/15 object-cover"
          loading="lazy"
        />

        <div>
          <div className="font-bold text-white">{testimonial.name}</div>
          <div className="text-sm text-white/45">{testimonial.role}</div>
        </div>
      </div>
    </div>
  );
}