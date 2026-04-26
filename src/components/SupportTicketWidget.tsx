// FILE: src/components/SupportTicketWidget.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Loader2, MessageCircle, Send, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

type TicketRow = {
  id: string;
  user_id: string | null;
  name: string | null;
  email: string | null;
  subject: string;
  status: string;
  priority: string | null;
  page_url: string | null;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  ticket_id: string;
  sender_id: string | null;
  sender_type: "client" | "admin";
  message: string;
  created_at: string;
};

function makeChannelName(prefix: string) {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `${prefix}-${id}`;
}

export default function SupportTicketWidget() {
  const location = useLocation();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);

  const [ticket, setTicket] = useState<TicketRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);

  const [email, setEmail] = useState(user?.email ?? "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const hidden =
    location.pathname.includes("/admin") ||
    location.pathname.includes("/funnel") ||
    location.pathname.includes("/checkout") ||
    location.pathname.includes("/payment") ||
    location.pathname.includes("/credits");

  const storageKey = useMemo(
    () => (user?.id ? `support_ticket_${user.id}` : "support_ticket_guest"),
    [user?.id]
  );

  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user?.email]);

  useEffect(() => {
    if (!open) return;

    const savedTicketId = localStorage.getItem(storageKey);
    if (!savedTicketId) return;

    let cancelled = false;

    async function loadTicket() {
      const { data: ticketData, error: ticketError } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("id", savedTicketId)
        .maybeSingle();

      if (cancelled) return;

      if (ticketError) {
        console.error(ticketError);
        return;
      }

      if (!ticketData) {
        localStorage.removeItem(storageKey);
        return;
      }

      setTicket(ticketData as TicketRow);

      const { data: messagesData, error: messagesError } = await supabase
        .from("support_ticket_messages")
        .select("*")
        .eq("ticket_id", savedTicketId)
        .order("created_at", { ascending: true });

      if (messagesError) {
        console.error(messagesError);
        return;
      }

      if (!cancelled) {
        setMessages((messagesData || []) as MessageRow[]);
      }
    }

    void loadTicket();

    return () => {
      cancelled = true;
    };
  }, [open, storageKey]);

  useEffect(() => {
    if (!ticket?.id) return;

    const channel = supabase
      .channel(makeChannelName(`support-ticket-client-${ticket.id}`))
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_ticket_messages",
          filter: `ticket_id=eq.${ticket.id}`,
        },
        (payload) => {
          const newMessage = payload.new as MessageRow;

          setMessages((prev) => {
            if (prev.some((item) => item.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "support_tickets",
          filter: `id=eq.${ticket.id}`,
        },
        (payload) => {
          setTicket(payload.new as TicketRow);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [ticket?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, open]);

  if (hidden) return null;

  async function updateTicketTimestamp(ticketId: string) {
    const { data, error } = await supabase
      .from("support_tickets")
      .update({
        status: ticket?.status === "closed" ? "open" : ticket?.status || "open",
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticketId)
      .select("*")
      .single();

    if (error) throw error;
    if (data) setTicket(data as TicketRow);
  }

  async function createTicket() {
    const cleanSubject = subject.trim();
    const cleanMessage = message.trim();
    const cleanEmail = (user?.email || email).trim();

    if (!cleanEmail) {
      toast.error("Email is required");
      return;
    }

    if (!cleanSubject) {
      toast.error("Please add a subject");
      return;
    }

    if (!cleanMessage) {
      toast.error("Please write your message");
      return;
    }

    try {
      setCreating(true);

      const { data: ticketData, error: ticketError } = await supabase
        .from("support_tickets")
        .insert({
          user_id: user?.id ?? null,
          name:
            user?.user_metadata?.full_name ||
            user?.user_metadata?.name ||
            user?.email ||
            cleanEmail ||
            null,
          email: cleanEmail,
          subject: cleanSubject,
          page_url: window.location.href,
          status: "open",
          priority: "normal",
          updated_at: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (ticketError) throw ticketError;

      const createdTicket = ticketData as TicketRow;

      const { data: messageData, error: messageError } = await supabase
        .from("support_ticket_messages")
        .insert({
          ticket_id: createdTicket.id,
          sender_id: user?.id ?? null,
          sender_type: "client",
          message: cleanMessage,
        })
        .select("*")
        .single();

      if (messageError) throw messageError;

      const firstMessage = messageData as MessageRow;

      setTicket(createdTicket);
      setMessages([firstMessage]);
      localStorage.setItem(storageKey, createdTicket.id);

      setSubject("");
      setMessage("");

      toast.success("Ticket created");
    } catch (error: any) {
      console.error("[SupportTicketWidget] createTicket error:", error);
      toast.error(error?.message || "Failed to create ticket");
    } finally {
      setCreating(false);
    }
  }

  async function sendMessage() {
    if (!ticket?.id) return;

    const cleanMessage = message.trim();

    if (!cleanMessage) {
      toast.error("Please write your message");
      return;
    }

    try {
      setSending(true);

      const { data, error } = await supabase
        .from("support_ticket_messages")
        .insert({
          ticket_id: ticket.id,
          sender_id: user?.id ?? null,
          sender_type: "client",
          message: cleanMessage,
        })
        .select("*")
        .single();

      if (error) throw error;

      if (data) {
        const insertedMessage = data as MessageRow;

        setMessages((prev) => {
          if (prev.some((item) => item.id === insertedMessage.id)) return prev;
          return [...prev, insertedMessage];
        });
      }

      setMessage("");
      await updateTicketTimestamp(ticket.id);
    } catch (error: any) {
      console.error("[SupportTicketWidget] sendMessage error:", error);
      toast.error(error?.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-3 text-sm font-semibold text-white shadow-xl transition hover:brightness-110"
      >
        <MessageCircle className="h-4 w-4" />
        Help
      </button>

      {open ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-end bg-black/40 p-4 backdrop-blur-sm">
          <div className="flex h-[620px] w-full max-w-[390px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b1220] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-white">
                  {ticket ? ticket.subject : "Create Support Ticket"}
                </h3>
                <p className="text-xs text-zinc-400">
                  {ticket ? `Status: ${ticket.status}` : "We usually reply soon."}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-1 text-zinc-400 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!ticket ? (
              <div className="flex flex-1 flex-col p-4">
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!!user?.email}
                  placeholder="Your email"
                  className="mb-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
                />

                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject"
                  className="mb-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-blue-500"
                />

                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your issue..."
                  rows={6}
                  className="mb-3 resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-blue-500"
                />

                <button
                  type="button"
                  onClick={() => void createTicket()}
                  disabled={creating}
                  className={cn(
                    "mt-auto flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 py-2 text-sm font-semibold text-white transition hover:brightness-110",
                    creating && "cursor-not-allowed opacity-60"
                  )}
                >
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {creating ? "Creating..." : "Create Ticket"}
                </button>
              </div>
            ) : (
              <>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                  {messages.map((item) => {
                    const isClient = item.sender_type === "client";

                    return (
                      <div
                        key={item.id}
                        className={cn("flex", isClient ? "justify-end" : "justify-start")}
                      >
                        <div
                          className={cn(
                            "max-w-[82%] rounded-2xl px-3 py-2 text-sm",
                            isClient
                              ? "bg-blue-500 text-white"
                              : "bg-white/10 text-zinc-100"
                          )}
                        >
                          <p className="whitespace-pre-wrap break-words">
                            {item.message}
                          </p>
                          <p className="mt-1 text-[10px] opacity-60">
                            {new Date(item.created_at).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}

                  <div ref={messagesEndRef} />
                </div>

                <div className="border-t border-white/10 p-3">
                  <div className="flex gap-2">
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Write a reply..."
                      rows={1}
                      className="max-h-24 min-h-[42px] flex-1 resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-blue-500"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void sendMessage();
                        }
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => void sendMessage()}
                      disabled={sending}
                      className="flex h-[42px] w-[42px] items-center justify-center rounded-xl bg-blue-500 text-white transition hover:brightness-110 disabled:opacity-60"
                    >
                      {sending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}