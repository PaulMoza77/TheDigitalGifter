/** User-started demo: no media download or sound until playback is requested. */
export function GraceLandingDemo() {
  return <video
    controls
    playsInline
    preload="none"
    width={720}
    height={1280}
    poster="/assets/christmas/grace/grace-poster.jpg"
    src="/assets/christmas/grace/grace-demo.mp4"
    aria-label="Conversație cu Grace: ea răspunde, iar Moș Crăciun reacționează și îi spune numele."
  />;
}
