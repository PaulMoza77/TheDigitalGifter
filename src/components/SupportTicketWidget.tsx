// FILE: src/components/SupportTicketWidget.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Bot, Loader2, MessageCircle, Send, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

type SenderType = "client" | "admin" | "ai" | "system";

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
  sender_type: SenderType;
  message: string;
  created_at: string;
};

const LIVE_AGENT_KEYWORD = "live agent";

function makeChannelName(prefix: string) {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `${prefix}-${id}`;
}

function hasLiveAgentRequest(text: string) {
  return text.toLowerCase().includes(LIVE_AGENT_KEYWORD);
}

function getGuestStorageKey() {
  let guestId = localStorage.getItem("support_guest_id");

  if (!guestId) {
    guestId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    localStorage.setItem("support_guest_id", guestId);
  }

  return `support_ticket_guest_${guestId}`;
}

export default function SupportTicketWidget() {
  const location = useLocation();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [aiTyping, setAiTyping] = useState(false);

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
    () => (user?.id ? `support_ticket_${user.id}` : getGuestStorageKey()),
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
        console.error("[SupportTicketWidget] load ticket error:", ticketError);
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
        console.error("[SupportTicketWidget] load messages error:", messagesError);
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
  }, [messages.length, open, aiTyping]);

  if (hidden) return null;

  function addMessageInstant(messageRow: MessageRow) {
    setMessages((prev) => {
      if (prev.some((item) => item.id === messageRow.id)) return prev;
      return [...prev, messageRow];
    });
  }

  async function updateTicket(ticketId: string, updates?: Partial<TicketRow>) {
    const { data, error } = await supabase
      .from("support_tickets")
      .update({
        ...(updates || {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticketId)
      .select("*")
      .single();

    if (error) throw error;
    if (data) setTicket(data as TicketRow);
  }

  async function insertSystemMessage(ticketId: string, text: string) {
    const { data, error } = await supabase
      .from("support_ticket_messages")
      .insert({
        ticket_id: ticketId,
        sender_id: null,
        sender_type: "system",
        message: text,
      })
      .select("*")
      .single();

    if (error) throw error;
    if (data) addMessageInstant(data as MessageRow);
  }

  async function requestAiReply(ticketId: string, userMessage: string) {
    try {
      setAiTyping(true);

      const recentMessages = messages.slice(-12).map((item) => ({
        role:
          item.sender_type === "client"
            ? "user"
            : item.sender_type === "ai" || item.sender_type === "admin"
            ? "assistant"
            : "system",
        content: item.message,
      }));

      const { data, error } = await supabase.functions.invoke("support-ai-chat", {
        body: {
          ticketId,
          message: userMessage,
          pageUrl: window.location.href,
          subject: ticket?.subject || subject || "Support request",
          recentMessages,
        },
      });

      if (error) throw error;

      const reply = String(
        data?.reply ||
          data?.message ||
          "I’m not fully sure about that. Please type “Live Agent” and our team will help you directly."
      ).trim();

      const needsAgent =
        Boolean(data?.needsAgent) || hasLiveAgentRequest(reply) || !reply;

      if (needsAgent) {
        await updateTicket(ticketId, {
          status: "needs_agent",
          priority: "high",
        } as Partial<TicketRow>);

        await insertSystemMessage(
          ticketId,
          "A live agent has been requested. Our team has been notified and will reply here as soon as possible."
        );

        return;
      }

      const { data: aiMessageData, error: aiMessageError } = await supabase
        .from("support_ticket_messages")
        .insert({
          ticket_id: ticketId,
          sender_id: null,
          sender_type: "ai",
          message: reply,
        })
        .select("*")
        .single();

      if (aiMessageError) throw aiMessageError;

      if (aiMessageData) {
        addMessageInstant(aiMessageData as MessageRow);
      }

      await updateTicket(ticketId, {
        status: "ai_replied",
        priority: "normal",
      } as Partial<TicketRow>);
    } catch (error) {
      console.error("[SupportTicketWidget] AI reply error:", error);

      await insertSystemMessage(
        ticketId,
        "I couldn’t answer that automatically. Please type “Live Agent” and our team will help you directly."
      );
    } finally {
      setAiTyping(false);
    }
  }

  async function handleLiveAgentRequest(ticketId: string) {
    await updateTicket(ticketId, {
      status: "needs_agent",
      priority: "high",
    } as Partial<TicketRow>);

    await insertSystemMessage(
      ticketId,
      "A live agent has been requested. Our team has been notified and will reply here as soon as possible."
    );
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

      const liveAgentRequested = hasLiveAgentRequest(cleanMessage);

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
          status: liveAgentRequested ? "needs_agent" : "open",
          priority: liveAgentRequested ? "high" : "normal",
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

      if (liveAgentRequested) {
        await handleLiveAgentRequest(createdTicket.id);
      } else {
        await requestAiReply(createdTicket.id, cleanMessage);
      }
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

      const liveAgentRequested = hasLiveAgentRequest(cleanMessage);

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
        addMessageInstant(data as MessageRow);
      }

      setMessage("");

      await updateTicket(ticket.id, {
        status: liveAgentRequested ? "needs_agent" : "open",
        priority: liveAgentRequested ? "high" : ticket.priority || "normal",
      } as Partial<TicketRow>);

      if (liveAgentRequested) {
        await handleLiveAgentRequest(ticket.id);
      } else if (ticket.status !== "needs_agent" && ticket.status !== "closed") {
        await requestAiReply(ticket.id, cleanMessage);
      }
    } catch (error: any) {
      console.error("[SupportTicketWidget] sendMessage error:", error);
      toast.error(error?.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  const showLiveAgentHint =
    ticket?.status !== "needs_agent" && ticket?.status !== "closed";

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
                  {ticket ? ticket.subject : "AI Support"}
                </h3>
                <p className="flex items-center gap-1.5 text-xs text-zinc-400">
                  {ticket ? (
                    <>
                      <Bot className="h-3.5 w-3.5" />
                      {ticket.status === "needs_agent"
                        ? "Live agent requested"
                        : ticket.status === "closed"
                        ? "Closed"
                        : "AI assistant online"}
                    </>
                  ) : (
                    "Ask a question or request a live agent."
                  )}
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
                  placeholder='Ask your question. Type "Live Agent" if you want a human support agent.'
                  rows={6}
                  className="mb-3 resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-blue-500"
                />

                <p className="mb-3 text-xs text-zinc-500">
                  The AI assistant will answer instantly when possible. For human help, type{" "}
                  <span className="font-semibold text-zinc-300">Live Agent</span>.
                </p>

                <button
                  type="button"
                  onClick={() => void createTicket()}
                  disabled={creating || aiTyping}
                  className={cn(
                    "mt-auto flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 py-2 text-sm font-semibold text-white transition hover:brightness-110",
                    (creating || aiTyping) && "cursor-not-allowed opacity-60"
                  )}
                >
                  {creating || aiTyping ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {creating
                    ? "Creating..."
                    : aiTyping
                    ? "AI is replying..."
                    : "Start Chat"}
                </button>
              </div>
            ) : (
              <>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                  {messages.map((item) => {
                    const isClient = item.sender_type === "client";
                    const isAi = item.sender_type === "ai";
                    const isSystem = item.sender_type === "system";

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "flex",
                          isClient ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[82%] rounded-2xl px-3 py-2 text-sm",
                            isClient && "bg-blue-500 text-white",
                            isAi && "bg-white/10 text-zinc-100",
                            isSystem && "bg-amber-500/10 text-amber-100",
                            item.sender_type === "admin" && "bg-emerald-500/15 text-emerald-100"
                          )}
                        >
                          {isAi ? (
                            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200">
                              <Bot className="h-3 w-3" />
                              AI Assistant
                            </div>
                          ) : null}

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

                  {aiTyping ? (
                    <div className="flex justify-start">
                      <div className="flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 text-sm text-zinc-100">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        AI is typing...
                      </div>
                    </div>
                  ) : null}

                  <div ref={messagesEndRef} />
                </div>

                {showLiveAgentHint ? (
                  <div className="border-t border-white/10 px-3 py-2 text-xs text-zinc-500">
                    Need a human? Type{" "}
                    <span className="font-semibold text-zinc-300">Live Agent</span>.
                  </div>
                ) : null}

                <div className="border-t border-white/10 p-3">
                  {ticket.status === "closed" ? (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-zinc-300">
                      This support chat has been closed. If you need more help, please open a new support ticket.
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder='Write a reply...'
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
                        disabled={sending || aiTyping}
                        className="flex h-[42px] w-[42px] items-center justify-center rounded-xl bg-blue-500 text-white transition hover:brightness-110 disabled:opacity-60"
                      >
                        {sending || aiTyping ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}