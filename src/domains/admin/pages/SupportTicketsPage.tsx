// FILE: src/domains/admin/pages/SupportTicketsPage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bot, CheckCircle2, Inbox, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import { readAdminRows } from "@/domains/admin/data/readAdminRows";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

type SenderType = "client" | "admin" | "ai" | "system";

type TicketStatus = "open" | "closed" | "needs_agent" | "ai_replied";

type TicketRow = {
  id: string;
  user_id: string | null;
  name: string | null;
  email: string | null;
  subject: string;
  public_reference?: string | null;
  status: TicketStatus | string;
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

function makeChannelName(prefix: string) {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `${prefix}-${id}`;
}

function sortTickets(tickets: TicketRow[]) {
  return [...tickets].sort(
    (a, b) =>
      new Date(b.updated_at || b.created_at).getTime() -
      new Date(a.updated_at || a.created_at).getTime()
  );
}

function getStatusStyle(status: string) {
  if (status === "closed") return "bg-emerald-500/15 text-emerald-300";
  if (status === "needs_agent") return "bg-red-500/15 text-red-300";
  if (status === "ai_replied") return "bg-cyan-500/15 text-cyan-300";
  return "bg-blue-500/15 text-blue-300";
}

export default function SupportTicketsPage() {
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const activeTicketRef = useRef(selectedTicketId);
  activeTicketRef.current = selectedTicketId;
  const mutationRef = useRef(false);
  const drafts = useRef<Record<string, string>>({});
  const [failedAlerts, setFailedAlerts] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { count, error } = await supabase.from("support_admin_alerts").select("id", { count: "exact", head: true }).or(`status.eq.failed,and(status.in.(queued,sending),created_at.lt.${cutoff})`);
      if (!cancelled) setFailedAlerts(error ? null : count ?? 0);
    };
    void check(); const timer = window.setInterval(check, 30000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) || null,
    [tickets, selectedTicketId]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadTickets() {
      try {
        // Background polling also works when Realtime is unavailable.

        const data = await readAdminRows<TicketRow>(() => supabase
          .from("support_tickets")
          .select("*", { count: "exact" })
          .order("updated_at", { ascending: false }).order("id"), "Support tickets");
        if (cancelled) return;

        const rows = sortTickets((data || []) as TicketRow[]);
        setTickets(rows);
        setTicketError(null);

        setSelectedTicketId((current) => {
          if (current && rows.some((ticket) => ticket.id === current)) return current;
          const requested = new URLSearchParams(window.location.search).get("ticket");
          return rows.find((ticket) => ticket.id === requested)?.id ?? rows[0]?.id ?? null;
        });
      } catch (error: any) {
        console.error("[SupportTicketsPage] loadTickets error:", error);
        if (!cancelled) setTicketError(error?.message || "Failed to load tickets");
      } finally {
        if (!cancelled) setLoadingTickets(false);
      }
    }

    void loadTickets();
    const timer = window.setInterval(() => { void loadTickets(); }, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [retry]);

  useEffect(() => {
    const channel = supabase
      .channel(makeChannelName("admin-support-tickets"))
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "support_tickets",
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newTicket = payload.new as TicketRow;

            setTickets((prev) => {
              if (prev.some((ticket) => ticket.id === newTicket.id)) return prev;
              return sortTickets([newTicket, ...prev]);
            });

            setSelectedTicketId((current) => current || newTicket.id);
          }

          if (payload.eventType === "UPDATE") {
            const updatedTicket = payload.new as TicketRow;

            setTickets((prev) =>
              sortTickets(
                prev.map((ticket) =>
                  ticket.id === updatedTicket.id ? updatedTicket : ticket
                )
              )
            );
          }

          if (payload.eventType === "DELETE") {
            const deletedTicket = payload.old as TicketRow;

            setTickets((prev) => {
              const next = prev.filter((ticket) => ticket.id !== deletedTicket.id);

              setSelectedTicketId((current) => {
                if (current !== deletedTicket.id) return current;
                return next[0]?.id ?? null;
              });

              return next;
            });
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!selectedTicketId) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    setMessages([]);
    setReply(drafts.current[selectedTicketId] || "");
    setMessageError(null);
    setLoadingMessages(true);

    async function loadMessages() {
      try {
        const data = await readAdminRows<MessageRow>(() => supabase
          .from("support_ticket_messages")
          .select("*", { count: "exact" })
          .eq("ticket_id", selectedTicketId)
          .order("created_at", { ascending: true }).order("id"), "Ticket messages");
        if (cancelled) return;

        setMessages((prev) => {
          const merged = new Map(prev.filter((m) => m.ticket_id === selectedTicketId).map((m) => [m.id, m]));
          for (const message of data) merged.set(message.id, message);
          return [...merged.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
        });
        setMessageError(null);
      } catch (error: any) {
        console.error("[SupportTicketsPage] loadMessages error:", error);
        if (!cancelled) setMessageError(error?.message || "Failed to load messages");
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    }

    void loadMessages();
    const timer = window.setInterval(() => { void loadMessages(); }, 10000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [selectedTicketId, retry]);

  useEffect(() => {
    if (!selectedTicketId) return;

    const channel = supabase
      .channel(makeChannelName(`admin-support-messages-${selectedTicketId}`))
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_ticket_messages",
          filter: `ticket_id=eq.${selectedTicketId}`,
        },
        (payload) => {
          const newMessage = payload.new as MessageRow;
          if (activeTicketRef.current !== newMessage.ticket_id) return;

          setMessages((prev) => {
            if (prev.some((message) => message.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [selectedTicketId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, selectedTicketId]);

  function addMessageInstant(message: MessageRow) {
    if (activeTicketRef.current !== message.ticket_id) return;
    setMessages((prev) => {
      if (prev.some((item) => item.id === message.id)) return prev;
      return [...prev, message];
    });
  }

  async function touchTicket(
    ticketId: string,
    updates: Partial<Pick<TicketRow, "status" | "priority">>
  ) {
    const { data, error } = await supabase
      .from("support_tickets")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticketId)
      .select("*")
      .single();

    if (error) throw error;

    if (data) {
      const updatedTicket = data as TicketRow;

      setTickets((prev) =>
        sortTickets(
          prev.map((ticket) =>
            ticket.id === updatedTicket.id ? updatedTicket : ticket
          )
        )
      );
    }
  }

  async function sendReply() {
    if (!selectedTicketId || selectedTicket?.status === "closed" || mutationRef.current || !user?.id) return;
    const ticketId = selectedTicketId;
    const cleanReply = reply.trim();

    if (!cleanReply) {
      toast.error("Write a reply first");
      return;
    }

    mutationRef.current = true;
    try {
      setSending(true);

      const { data, error } = await supabase
        .from("support_ticket_messages")
        .insert({
          ticket_id: ticketId,
          sender_id: user?.id ?? null,
          sender_type: "admin",
          message: cleanReply,
        })
        .select("*")
        .single();

      if (error) throw error;

      if (data) addMessageInstant(data as MessageRow);

      drafts.current[ticketId] = "";
      if (activeTicketRef.current === ticketId) setReply("");
      try {
        await touchTicket(ticketId, { status: "open" });
      } catch {
        toast.warning("Reply delivered, but ticket status could not be updated. Refresh before changing status.");
      }
    } catch (error: any) {
      console.error("[SupportTicketsPage] sendReply error:", error);
      toast.error(error?.message || "Failed to send reply");
    } finally {
      mutationRef.current = false;
      setSending(false);
    }
  }

  async function closeTicket() {
    if (!selectedTicketId || selectedTicket?.status === "closed" || mutationRef.current) return;
    const ticketId = selectedTicketId;
    mutationRef.current = true;
    try {
      setClosing(true);
      await touchTicket(ticketId, { status: "closed" });
      toast.success("Ticket closed");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to close ticket");
    } finally {
      mutationRef.current = false;
      setClosing(false);
    }
  }
  const visibleTickets = tickets.filter((ticket) =>
    (statusFilter === "all" || (statusFilter === "active" ? ticket.status !== "closed" : ticket.status === "closed")) &&
    `${ticket.subject} ${ticket.email || ""} ${ticket.public_reference || ""} ${ticket.id}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-[#05070d] p-4 text-white sm:p-6">
      <div className="mb-6 shrink-0">
        <h1 className="text-2xl font-bold">Support Tickets</h1>
        <button type="button" className="my-2 underline" onClick={() => setRetry((v) => v + 1)}>Refresh inbox</button>
        {ticketError && <p role="alert" className="text-red-300">Tickets unavailable: {ticketError}. Previous data may be outdated.</p>}
        {failedAlerts === null ? <p className="text-sm text-amber-200">Email notification status unavailable. Check support-alert deployment/configuration.</p> : failedAlerts > 0 ? <p role="alert" className="text-sm text-amber-200">{failedAlerts} email notification(s) failed or delayed more than 5 minutes. Check Resend and the support notification worker.</p> : null}
        <p className="text-sm text-zinc-400">
          Client messages refresh automatically. Replies appear in the client chat; they are not sent by email.
        </p>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] lg:grid-cols-[360px_1fr]">
        <aside className="min-h-0 border-b border-white/10 lg:border-b-0 lg:border-r lg:border-white/10">
          <div className="shrink-0 border-b border-white/10 p-4">
            <p className="text-sm font-semibold">
              Tickets <span className="text-zinc-400">({visibleTickets.length})</span>
            </p>
          </div>

          <div className="flex flex-wrap gap-2 p-3">
            <input aria-label="Search tickets" placeholder="Email, subject or ID" value={search} onChange={(e) => setSearch(e.target.value)} className="min-w-0 w-full rounded bg-slate-900 p-2" />
            <select aria-label="Ticket status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded bg-slate-900 p-2"><option value="active">Active</option><option value="closed">Closed</option><option value="all">All</option></select>
          </div>
          <div className="h-[260px] overflow-y-auto lg:h-[calc(100%-53px)]">
            {loadingTickets ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
              </div>
            ) : visibleTickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-zinc-500">
                <Inbox className="h-8 w-8" />
                <p className="text-sm">{ticketError ? "Tickets could not be loaded" : "No matching tickets"}</p>
              </div>
            ) : (
              visibleTickets.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => { if (ticket.id !== selectedTicketId) { setMessages([]); setLoadingMessages(true); setSelectedTicketId(ticket.id); } }}
                  className={cn(
                    "w-full border-b border-white/10 p-4 text-left transition hover:bg-white/[0.06]",
                    selectedTicketId === ticket.id && "bg-white/[0.08]"
                  )}
                >
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <p className="line-clamp-1 text-sm font-semibold text-white">
                      {ticket.subject}
                    </p>

                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        getStatusStyle(ticket.status || "open")
                      )}
                    >
                      {ticket.status || "open"}
                    </span>
                  </div>

                  <p className="line-clamp-1 text-xs text-zinc-400">
                    {ticket.public_reference ? `${ticket.public_reference} · ` : ""}{ticket.email || ticket.name || "Guest"}
                  </p>

                  <p className="mt-2 text-[11px] text-zinc-600">
                    {new Date(ticket.updated_at || ticket.created_at).toLocaleString()}
                  </p>
                </button>
              ))
            )}
          </div>
        </aside>

        <main className="flex min-h-0 flex-col">
          {!selectedTicket ? (
            <div className="flex flex-1 items-center justify-center text-zinc-500">
              Select a ticket
            </div>
          ) : (
            <>
              <div className="shrink-0 border-b border-white/10">
                <div className="flex items-start justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate font-semibold">
                        {selectedTicket.subject}
                      </h2>

                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          getStatusStyle(selectedTicket.status || "open")
                        )}
                      >
                        {selectedTicket.status || "open"}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-400">
                      {selectedTicket.email || selectedTicket.name || "Guest"}
                    </p>

                    {selectedTicket.page_url ? (
                      <p className="mt-1 max-w-[620px] truncate text-[11px] text-zinc-600">
                        {selectedTicket.page_url}
                      </p>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => void closeTicket()}
                    disabled={closing || sending || selectedTicket.status === "closed"}
                    className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {closing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    {selectedTicket.status === "closed" ? "Closed" : "Close"}
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
                {messageError && <p role="alert" className="text-red-300">Messages unavailable: {messageError}. Refresh to retry.</p>}
                {loadingMessages ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                    No messages yet
                  </div>
                ) : (
                  messages.filter((message) => message.ticket_id === selectedTicketId).map((message) => {
                    const isClient = message.sender_type === "client";
                    const isAdmin = message.sender_type === "admin";
                    const isAi = message.sender_type === "ai";
                    const isSystem = message.sender_type === "system";

                    return (
                      <div
                        key={message.id}
                        className={cn(
                          "flex",
                          isAdmin ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[75%] rounded-2xl px-4 py-2 text-sm",
                            isClient && "bg-white/10 text-zinc-100",
                            isAdmin && "bg-blue-500 text-white",
                            isAi && "bg-cyan-500/10 text-cyan-50",
                            isSystem && "bg-amber-500/10 text-amber-100"
                          )}
                        >
                          {isAi ? (
                            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200">
                              <Bot className="h-3 w-3" />
                              AI Assistant
                            </div>
                          ) : null}

                          {isSystem ? (
                            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200">
                              System
                            </div>
                          ) : null}

                          <p className="whitespace-pre-wrap break-words">
                            {message.message}
                          </p>

                          <p className="mt-1 text-[10px] opacity-60">
                            {new Date(message.created_at).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}

                <div ref={messagesEndRef} />
              </div>

              <div className="shrink-0 border-t border-white/10 p-4">
                {selectedTicket.status === "closed" ? (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-zinc-300">
                    This support chat is closed. The client can open a new support ticket if they need more help.
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <textarea
                      value={reply}
                      disabled={sending || closing || loadingMessages || Boolean(messageError)}
                      onChange={(e) => { setReply(e.target.value); if (selectedTicketId) drafts.current[selectedTicketId] = e.target.value; }}
                      placeholder="Write a reply..."
                      rows={1}
                      className="max-h-28 min-h-[44px] flex-1 resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-blue-500"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void sendReply();
                        }
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => void sendReply()}
                      aria-label="Send reply"
                      disabled={sending || closing || loadingMessages || Boolean(messageError) || !reply.trim()}
                      className="flex h-[44px] w-[44px] items-center justify-center rounded-xl bg-blue-500 text-white transition hover:brightness-110 disabled:opacity-60"
                    >
                      {sending ? (
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
        </main>
      </div>
    </div>
  );
}