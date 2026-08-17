import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Inbox, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { sendAdminSupportReply } from "@/features/support/api";
import {
  adminNotificationLabel,
  adminReplyToast,
} from "@/features/support/emailDelivery";
import { SUPPORT_CATEGORIES, SUPPORT_STATUSES } from "@/features/support/types";

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
  category: string | null;
  public_reference: string | null;
  pet_order_id: string | null;
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

type PetOrderSummary = {
  id: string;
  status: string | null;
  species: string | null;
  pet_name: string | null;
};

type DeliveryRow = {
  id: string;
  ticket_id: string;
  message_id: string | null;
  kind: string;
  status: string;
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

function categoryLabel(category: string | null) {
  return SUPPORT_CATEGORIES.find((item) => item.id === category)?.label || category || "Uncategorized";
}

function statusLabel(status: string) {
  return SUPPORT_STATUSES.find((item) => item.id === status)?.label || status;
}

function getStatusStyle(status: string) {
  if (status === "closed") return "bg-zinc-500/15 text-zinc-300";
  if (status === "resolved") return "bg-emerald-500/15 text-emerald-300";
  if (status === "waiting_for_customer") return "bg-amber-500/15 text-amber-300";
  if (status === "in_progress") return "bg-violet-500/15 text-violet-300";
  if (status === "needs_agent") return "bg-red-500/15 text-red-300";
  if (status === "ai_replied") return "bg-cyan-500/15 text-cyan-300";
  return "bg-blue-500/15 text-blue-300";
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
}

export default function SupportTicketsPage() {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const replyKeyRef = useRef(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [petOrder, setPetOrder] = useState<PetOrderSummary | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) || null,
    [tickets, selectedTicketId]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadTickets() {
      try {
        setLoadingTickets(true);

        const { data, error } = await supabase
          .from("support_tickets")
          .select(
            "id, user_id, name, email, subject, status, priority, page_url, category, public_reference, pet_order_id, created_at, updated_at"
          )
          .order("updated_at", { ascending: false });

        if (error) throw error;
        if (cancelled) return;

        const rows = sortTickets((data || []) as TicketRow[]);
        setTickets(rows);

        setSelectedTicketId((current) => {
          if (current && rows.some((ticket) => ticket.id === current)) return current;
          return rows[0]?.id ?? null;
        });
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Failed to load tickets");
      } finally {
        if (!cancelled) setLoadingTickets(false);
      }
    }

    void loadTickets();

    return () => {
      cancelled = true;
    };
  }, []);

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

    async function loadMessages() {
      try {
        setLoadingMessages(true);

        const { data, error } = await supabase
          .from("support_ticket_messages")
          .select("*")
          .eq("ticket_id", selectedTicketId)
          .order("created_at", { ascending: true });

        if (error) throw error;
        if (cancelled) return;

        setMessages((data || []) as MessageRow[]);
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Failed to load messages");
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    }

    void loadMessages();

    return () => {
      cancelled = true;
    };
  }, [selectedTicketId]);

  useEffect(() => {
    if (!selectedTicket?.pet_order_id) {
      setPetOrder(null);
      return;
    }

    let cancelled = false;

    async function loadPetOrder() {
      const { data, error } = await supabase
        .from("pet_orders")
        .select("id, status, species, pet_name")
        .eq("id", selectedTicket!.pet_order_id)
        .maybeSingle();

      if (cancelled) return;
      if (error || !data) {
        setPetOrder(null);
        return;
      }
      setPetOrder(data as PetOrderSummary);
    }

    void loadPetOrder();
    return () => {
      cancelled = true;
    };
  }, [selectedTicket?.pet_order_id]);

  useEffect(() => {
    if (!selectedTicketId) {
      setDeliveries([]);
      return;
    }

    let cancelled = false;

    async function loadDeliveries() {
      const { data, error } = await supabase
        .from("support_email_deliveries")
        .select("id, ticket_id, message_id, kind, status")
        .eq("ticket_id", selectedTicketId);

      if (cancelled) return;
      if (error || !data) {
        setDeliveries([]);
        return;
      }
      setDeliveries(data as DeliveryRow[]);
    }

    void loadDeliveries();
    return () => {
      cancelled = true;
    };
  }, [selectedTicketId, messages.length]);

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
    setMessages((prev) => {
      if (prev.some((item) => item.id === message.id)) return prev;
      return [...prev, message];
    });
  }

  async function touchTicket(ticketId: string, updates: Partial<Pick<TicketRow, "status" | "priority">>) {
    const { data, error } = await supabase
      .from("support_tickets")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticketId)
      .select(
        "id, user_id, name, email, subject, status, priority, page_url, category, public_reference, pet_order_id, created_at, updated_at"
      )
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

  async function setStatus(status: string) {
    if (!selectedTicketId || selectedTicket?.status === status) return;

    try {
      setUpdatingStatus(true);
      await touchTicket(selectedTicketId, { status });
      toast.success(`Status updated to ${statusLabel(status)}`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function sendReply() {
    if (!selectedTicketId || selectedTicket?.status === "closed") return;

    const cleanReply = reply.trim();

    if (!cleanReply) {
      toast.error("Write a reply first");
      return;
    }

    try {
      setSending(true);
      const result = await sendAdminSupportReply({
        ticketId: selectedTicketId,
        reply: cleanReply,
        idempotencyKey: replyKeyRef.current,
      });

      if (result.message) addMessageInstant(result.message as MessageRow);
      setDeliveries((prev) => {
        const next = prev.filter((row) => row.message_id !== result.message.id);
        next.push({
          id: result.message.id,
          ticket_id: selectedTicketId,
          message_id: result.message.id,
          kind: "admin_reply",
          status: result.notificationStatus,
        });
        return next;
      });
      setReply("");
      replyKeyRef.current =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await touchTicket(selectedTicketId, {
        status: selectedTicket?.status === "open" ? "in_progress" : selectedTicket?.status,
      });
      toast.success(adminReplyToast(result.notificationStatus));
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to save reply");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-[#05070d] p-4 text-white sm:p-6">
      <div className="mb-6 shrink-0">
        <h1 className="text-2xl font-bold">Support Tickets</h1>
        <p className="text-sm text-zinc-400">
          Ticket inbox with category, pet-order context, and reply history.
        </p>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] lg:grid-cols-[360px_1fr]">
        <aside className="min-h-0 border-b border-white/10 lg:border-b-0 lg:border-r lg:border-white/10">
          <div className="shrink-0 border-b border-white/10 p-4">
            <p className="text-sm font-semibold">
              Tickets <span className="text-zinc-400">({tickets.length})</span>
            </p>
          </div>

          <div className="h-[260px] overflow-y-auto lg:h-[calc(100%-53px)]">
            {loadingTickets ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
              </div>
            ) : tickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-zinc-500">
                <Inbox className="h-8 w-8" />
                <p className="text-sm">No tickets yet</p>
              </div>
            ) : (
              tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => setSelectedTicketId(ticket.id)}
                  className={cn(
                    "w-full border-b border-white/10 p-4 text-left transition hover:bg-white/[0.06]",
                    selectedTicketId === ticket.id && "bg-white/[0.08]"
                  )}
                >
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <p className="line-clamp-1 font-mono text-xs text-[#ffd976]">
                      {ticket.public_reference || "No reference"}
                    </p>

                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        getStatusStyle(ticket.status || "open")
                      )}
                    >
                      {statusLabel(ticket.status || "open")}
                    </span>
                  </div>

                  <p className="line-clamp-1 text-sm font-semibold text-white">
                    {ticket.subject}
                  </p>
                  <p className="mt-1 line-clamp-1 text-xs text-zinc-400">
                    {ticket.email || ticket.name || "Guest"} · {categoryLabel(ticket.category)}
                  </p>
                  <p className="mt-2 text-[11px] text-zinc-600">
                    {formatTimestamp(ticket.updated_at || ticket.created_at)}
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
                  <div className="min-w-0 space-y-1">
                    <p className="font-mono text-sm text-[#ffd976]">
                      {selectedTicket.public_reference || "No public reference"}
                    </p>
                    <h2 className="truncate font-semibold">{selectedTicket.subject}</h2>
                    <p className="text-xs text-zinc-400">
                      {selectedTicket.email || selectedTicket.name || "Guest"} ·{" "}
                      {categoryLabel(selectedTicket.category)}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      Created {formatTimestamp(selectedTicket.created_at)} · Updated{" "}
                      {formatTimestamp(selectedTicket.updated_at)}
                    </p>
                    {petOrder ? (
                      <p className="text-[11px] text-zinc-400">
                        Pet order: {petOrder.pet_name || "Unnamed"} ({petOrder.species || "pet"}) ·{" "}
                        {petOrder.status || "unknown"}
                      </p>
                    ) : selectedTicket.pet_order_id ? (
                      <p className="text-[11px] text-zinc-500">Associated pet order on file</p>
                    ) : (
                      <p className="text-[11px] text-zinc-600">No associated pet order</p>
                    )}
                    {deliveries.some((row) => row.kind === "ticket_received") ? (
                      <p className="text-[11px] text-zinc-400">
                        Confirmation:{" "}
                        {adminNotificationLabel(
                          deliveries.find((row) => row.kind === "ticket_received")?.status,
                        )}
                      </p>
                    ) : null}
                    {selectedTicket.page_url ? (
                      <p className="mt-1 max-w-[620px] truncate text-[11px] text-zinc-600">
                        {selectedTicket.page_url}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 px-4 pb-4">
                  {SUPPORT_STATUSES.map((status) => (
                    <button
                      key={status.id}
                      type="button"
                      disabled={updatingStatus || selectedTicket.status === status.id}
                      onClick={() => void setStatus(status.id)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-[11px] font-semibold transition disabled:opacity-50",
                        selectedTicket.status === status.id
                          ? "border-white/20 bg-white/10 text-white"
                          : "border-white/10 bg-transparent text-zinc-400 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      {status.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
                {loadingMessages ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                    No messages yet
                  </div>
                ) : (
                  messages.map((message) => {
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

                          {isAdmin ? (
                            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-100">
                              Admin
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
                            {formatTimestamp(message.created_at)}
                          </p>
                          {isAdmin ? (
                            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/80">
                              {adminNotificationLabel(
                                deliveries.find((row) => row.message_id === message.id)?.status,
                              )}
                            </p>
                          ) : null}
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
                    This ticket is closed. Reopen it to save another reply.
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Write a reply. We’ll email the customer if Resend is configured."
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
                      disabled={sending}
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
