// DESIGN UPDATE - Solid background no flicker v2
import React from 'react';

interface HeroSectionProps {
  onStartCreating: () => void;
  onViewTemplates: () => void;
}

export default function HeroSection({ onStartCreating, onViewTemplates }: HeroSectionProps) {
  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Subtle Christmas Background Elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 text-6xl">🎄</div>
        <div className="absolute top-20 right-20 text-4xl">❄️</div>
        <div className="absolute bottom-20 left-20 text-5xl">⭐</div>
        <div className="absolute bottom-10 right-10 text-6xl">🎁</div>
      </div>

      <div className="relative z-10 container mx-auto px-6 py-20">
        {/* Main Hero Content */}
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 font-serif">
            Create Magical Christmas Cards with AI
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed">
            Transform your holiday memories into stunning, personalized Christmas cards in seconds. 
            No design skills needed – just upload, customize, and let our AI work its magic.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-6 justify-center mb-20">
            <button
              onClick={onStartCreating}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-12 rounded-full text-lg transition-all duration-300 shadow-lg"
            >
              Start Creating
            </button>
            <button
              onClick={onViewTemplates}
              className="border-2 border-green-500 text-green-500 hover:bg-green-500 hover:text-white font-bold py-4 px-12 rounded-full text-lg transition-all duration-300"
            >
              View Templates
            </button>
          </div>

          {/* Stats Section */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="text-3xl font-bold text-red-500">10K+</div>
              <div className="text-gray-300">Cards Created</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-500">5K+</div>
              <div className="text-gray-300">Happy Customers</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-500">30s</div>
              <div className="text-gray-300">Average Time</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-500">4.9★</div>
              <div className="text-gray-300">Customer Rating</div>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <div className="bg-gray-900 py-20">
        <div className="container mx-auto px-6">
          <h2 className="text-4xl font-bold text-center text-white mb-16 font-serif">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {[
              { step: "1", title: "Choose Template", description: "Pick from our featured collection" },
              { step: "2", title: "Add Your Touch", description: "Upload photos and customize text" },
              { step: "3", title: "AI Magic", description: "Our AI perfects the design" },
              { step: "4", title: "Download & Share", description: "Get your beautiful Christmas card" }
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-16 h-16 bg-red-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                <p className="text-gray-300">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}