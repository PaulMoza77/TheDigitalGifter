export default function AdminStudioPage() {
  return (
    <div className="min-h-screen bg-slate-950 px-4 py-5 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Admin Panel</p>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Studio</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
          Generation tools (image-to-video, reel assembly, model runs) will live here. Existing generation APIs and
          Christmas/pet pipelines were not removed. The Library is only for finished media.
        </p>
      </div>
    </div>
  );
}
