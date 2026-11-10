import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import "./santaSupport.css";
const EVENT = "tdg-santa-support-open";
const KEY = "tdg.santa.support.v1";
export function openSantaSupport() {
  window.dispatchEvent(new Event(EVENT));
}
type Access = { reference: string; guestToken: string };
type Thread = {
  status: string;
  messages: { id: string; senderType: string; message: string }[];
};
export function SantaSupportChat({
  language = "ro",
  context = "landing",
}: {
  language?: "ro" | "en";
  context?: "landing" | "call";
}) {
  const ro = language === "ro";
  const [open, setOpen] = useState(false),
    [email, setEmail] = useState(""),
    [message, setMessage] = useState(""),
    [website, setWebsite] = useState("");
  const [access, setAccess] = useState<Access | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "null");
    } catch {
      return null;
    }
  });
  const [thread, setThread] = useState<Thread | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const locked = useRef(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  async function request(body: object) {
    const { data, error } = await supabase.functions.invoke(
      "support-conversation",
      { body },
    );
    if (error || !data || data.error) throw Error("support");
    return data;
  }
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(EVENT, show);
    return () => window.removeEventListener(EVENT, show);
  }, []);
  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement;
    closeRef.current?.focus();
    return () => previousFocus.current?.focus();
  }, [open]);
  useEffect(() => {
    if (!open || !access) return;
    let cancelled = false;
    let running = false;
    const refresh = async () => {
      if (running || document.hidden) return;
      running = true;
      try {
        const data = await request({ action: "load", ...access });
        if (!cancelled) {
          setThread(data);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        running = false;
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 8000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [open, access]);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(false);
    try {
      const data = await request(
        access
          ? { action: "reply", ...access, message }
          : { action: "create", email, message, website, context },
      );
      if (!access) {
        if (!data.reference || !data.guestToken) throw Error("support");
        const next = { reference: data.reference, guestToken: data.guestToken };
        setAccess(next);
        try {
          localStorage.setItem(KEY, JSON.stringify(next));
        } catch {}
        setThread({
          status: "open",
          messages: [{ id: "first", senderType: "client", message }],
        });
      } else setThread(data);
      setMessage("");
    } catch {
      setError(true);
    } finally {
      setBusy(false);
      locked.current = false;
    }
  }
  return (
    <div className="santa-support" data-clarity-mask="true">
      {!open && (
        <button className="santa-support-launch" onClick={() => setOpen(true)}>
          {ro ? "Ai nevoie de ajutor?" : "Need help?"}
        </button>
      )}
      {open && (
        <div className="santa-support-backdrop">
          <section
            className="santa-support-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="santa-support-title"
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              if (e.key === "Tab") {
                const items = Array.from(
                  e.currentTarget.querySelectorAll<HTMLElement>(
                    'button:not(:disabled), input:not([type="hidden"]), textarea, a[href]',
                  ),
                ).filter((x) => x.offsetParent !== null);
                const first = items[0],
                  last = items[items.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                  e.preventDefault();
                  last?.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault();
                  first?.focus();
                }
              }
            }}
          >
            <header>
              <h2 id="santa-support-title">
                {ro ? "Ajutor pentru Apel cu Moșu" : "Santa call support"}
              </h2>
              <button
                ref={closeRef}
                aria-label={ro ? "Închide chatul" : "Close chat"}
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </header>
            <p>
              {ro
                ? "Scrie echipei noastre. Mesajul ajunge în suport; răspundem aici după ce îl verificăm. Nu este un chat cu operator permanent online."
                : "Message our team. We will reply here after reviewing your request. An agent is not always online."}
            </p>
            {access && (
              <p>
                {ro ? "Tichet" : "Ticket"}: <strong>{access.reference}</strong>
              </p>
            )}
            <div
              className="santa-support-messages"
              role="log"
              aria-live="polite"
            >
              {thread?.messages.map((m) => (
                <div
                  key={m.id}
                  className={
                    m.senderType === "client" ? "from-client" : "from-team"
                  }
                >
                  <strong>
                    {m.senderType === "client"
                      ? ro
                        ? "Tu"
                        : "You"
                      : ro
                        ? "Echipa de suport"
                        : "Support team"}
                  </strong>
                  <p>{m.message}</p>
                </div>
              ))}
            </div>
            {error && (
              <p role="alert">
                {ro
                  ? "Nu am putut actualiza conversația. Mesajul netrimis este păstrat. Reîncearcă sau scrie-ne pe email."
                  : "We could not update the conversation. Your unsent message is preserved. Retry or email us."}
              </p>
            )}
            {thread?.status === "closed" ? (
              <>
                <p>
                  {ro ? "Tichetul a fost închis." : "This ticket is closed."}
                </p>
                <button
                  onClick={() => {
                    setAccess(null);
                    setThread(null);
                    localStorage.removeItem(KEY);
                  }}
                >
                  {ro ? "Conversație nouă" : "New conversation"}
                </button>
              </>
            ) : (
              <form onSubmit={send}>
                {!access && (
                  <label>
                    {ro ? "Emailul părintelui" : "Parent email"}
                    <input
                      type="email"
                      required
                      maxLength={254}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                    />
                  </label>
                )}
                <label className="santa-support-trap" aria-hidden="true">
                  Website
                  <input
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </label>
                <label>
                  {ro ? "Cu ce te putem ajuta?" : "How can we help?"}
                  <textarea
                    required
                    minLength={access ? 1 : 10}
                    maxLength={4000}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                  />
                </label>
                <small>
                  {ro
                    ? "Nu trimite date de card sau linkul privat al apelului."
                    : "Do not send card details or your private call link."}
                </small>
                <button type="submit" disabled={busy}>
                  {busy
                    ? ro
                      ? "Se trimite…"
                      : "Sending…"
                    : ro
                      ? "Trimite mesajul"
                      : "Send message"}
                </button>
              </form>
            )}
            <a href="mailto:support@thedigitalgifter.com">
              support@thedigitalgifter.com
            </a>
          </section>
        </div>
      )}
    </div>
  );
}
