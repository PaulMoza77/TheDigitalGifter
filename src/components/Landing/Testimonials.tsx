import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Sarah Mitchell",
    role: "Event Planner",
    image:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces",
    content:
      "TheDigitalGifter saved me hours of work! I created 50+ personalized wedding cards for my clients in minutes. The AI face matching is incredibly accurate and the templates are stunning.",
    rating: 5,
  },
  {
    name: "Michael Chen",
    role: "Small Business Owner",
    image:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces",
    content:
      "I use this for all our company holiday cards. The video generation feature is a game-changer - our clients absolutely love receiving personalized video greetings. Worth every credit!",
    rating: 5,
  },
  {
    name: "Emily Rodriguez",
    role: "Mom of 3",
    image:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=faces",
    content:
      "As a busy mom, this is perfect! I can create beautiful birthday cards for my kids' parties in literally 30 seconds. The quality is amazing and everyone asks where I got them made.",
    rating: 5,
  },
  {
    name: "David Thompson",
    role: "Marketing Director",
    image:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=faces",
    content:
      "We've been using TheDigitalGifter for our corporate greeting cards. The print quality is exceptional and the variety of templates means we always find the perfect match for our brand.",
    rating: 5,
  },
  {
    name: "Jessica Park",
    role: "Wedding Photographer",
    image:
      "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=100&h=100&fit=crop&crop=faces",
    content:
      "I recommend this to all my couples for save-the-dates and thank you cards. The AI creates such beautiful compositions with their photos - better than most manual designs!",
    rating: 5,
  },
];

export const Testimonials = () => {
  return (
    <section className="w-full py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-950/50 to-transparent">
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-20 space-y-4 animate-fade-in">
          <h2 className="text-4xl sm:text-5xl font-bold text-white">
            Loved by{" "}
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              50,000+ Users
            </span>
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            See what our community says about creating AI-powered cards
          </p>
        </div>

        {/* Testimonials grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {testimonials.slice(0, 3).map((testimonial, index) => (
            <div
              key={index}
              className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 hover:border-blue-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10 animate-slide-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star
                    key={i}
                    className="w-5 h-5 fill-amber-400 text-amber-400"
                  />
                ))}
              </div>

              {/* Content */}
              <p className="text-slate-300 mb-6 leading-relaxed">
                "{testimonial.content}"
              </p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <img
                  src={testimonial.image}
                  alt={testimonial.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-slate-700"
                  loading="lazy"
                />
                <div>
                  <div className="font-semibold text-white">
                    {testimonial.name}
                  </div>
                  <div className="text-sm text-slate-400">
                    {testimonial.role}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Additional testimonials for desktop */}
        <div className="hidden lg:grid grid-cols-2 gap-8 mt-8">
          {testimonials.slice(3).map((testimonial, index) => (
            <div
              key={index + 3}
              className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 hover:border-blue-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10 animate-slide-up"
              style={{ animationDelay: `${(index + 3) * 0.1}s` }}
            >
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star
                    key={i}
                    className="w-5 h-5 fill-amber-400 text-amber-400"
                  />
                ))}
              </div>
              <p className="text-slate-300 mb-6 leading-relaxed">
                "{testimonial.content}"
              </p>
              <div className="flex items-center gap-3">
                <img
                  src={testimonial.image}
                  alt={testimonial.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-slate-700"
                  loading="lazy"
                />
                <div>
                  <div className="font-semibold text-white">
                    {testimonial.name}
                  </div>
                  <div className="text-sm text-slate-400">
                    {testimonial.role}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
