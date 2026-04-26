import React, { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Send, Inbox, CheckCircle2 } from "lucide-react";
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
  priority: string;
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

  const selectedTicket = useMemo(() => {
    return tickets.find((ticket) => ticket.id === selectedTicketId) || null;
  }, [tickets, selectedTicketId]);

  useEffect(() => {
    async function loadTickets() {
      try {
        setLoadingTickets(true);

        const { data, error } = await supabase
          .from("support_tickets")
          .select("*")
          .order("updated_at", { ascending: false });

        if (error) throw error;

        const rows = (data || []) as TicketRow[];
        setTickets(rows);

        if (!selectedTicketId && rows[0]) {
          setSelectedTicketId(rows[0].id);
        }
      } catch (error: any) {
        console.error(error);
        toast.error(error?.message || "Failed to load tickets");
      } finally {
        setLoadingTickets(false);
      }
    }

    void loadTickets();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("admin-support-tickets")
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
              return [newTicket, ...prev];
            });

            setSelectedTicketId((current) => current || newTicket.id);
          }

          if (payload.eventType === "UPDATE") {
            const updatedTicket = payload.new as TicketRow;

            setTickets((prev) =>
              prev
                .map((ticket) =>
                  ticket.id === updatedTicket.id ? updatedTicket : ticket
                )
                .sort(
                  (a, b) =>
                    new Date(b.updated_at).getTime() -
                    new Date(a.updated_at).getTime()
                )
            );
          }

          if (payload.eventType === "DELETE") {
            const deletedTicket = payload.old as TicketRow;

            setTickets((prev) =>
              prev.filter((ticket) => ticket.id !== deletedTicket.id)
            );
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

    async function loadMessages() {
      try {
        setLoadingMessages(true);

        const { data, error } = await supabase
          .from("support_ticket_messages")
          .select("*")
          .eq("ticket_id", selectedTicketId)
          .order("created_at", { ascending: true });

        if (error) throw error;

        setMessages((data || []) as MessageRow[]);
      } catch (error: any) {
        console.error(error);
        toast.error(error?.message || "Failed to load messages");
      } finally {
        setLoadingMessages(false);
      }
    }

    void loadMessages();
  }, [selectedTicketId]);

  useEffect(() => {
    if (!selectedTicketId) return;

    const channel = supabase
      .channel(`admin-support-messages-${selectedTicketId}`)
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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, selectedTicketId]);

  async function sendReply() {
    if (!selectedTicketId) return;

    if (!reply.trim()) {
      toast.error("Write a reply first");
      return;
    }

    try {
      setSending(true);

      const { error } = await supabase.from("support_ticket_messages").insert({
        ticket_id: selectedTicketId,
        sender_id: user?.id ?? null,
        sender_type: "admin",
        message: reply.trim(),
      });

      if (error) throw error;

      await supabase
        .from("support_tickets")
        .update({
          status: "open",
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedTicketId);

      setReply("");
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Failed to send reply");
    } finally {
      setSending(false);
    }
  }

  async function closeTicket() {
    if (!selectedTicketId) return;

    const { error } = await supabase
      .from("support_tickets")
      .update({
        status: "closed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedTicketId);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Ticket closed");
  }

  return (
    <div className="min-h-screen bg-[#05070d] p-6 text-white">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Support Tickets</h1>
        <p className="text-sm text-zinc-400">
          Real-time support inbox for client messages.
        </p>
      </div>

      <div className="grid h-[calc(100vh-150px)] grid-cols-1 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] lg:grid-cols-[360px_1fr]">
        <aside className="border-r border-white/10">
          <div className="border-b border-white/10 p-4">
            <p className="text-sm font-semibold">
              Tickets{" "}
              <span className="text-zinc-400">({tickets.length})</span>
            </p>
          </div>

          <div className="h-full overflow-y-auto">
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
                    <p className="line-clamp-1 text-sm font-semibold text-white">
                      {ticket.subject}
                    </p>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        ticket.status === "closed"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-blue-500/15 text-blue-300"
                      )}
                    >
                      {ticket.status}
                    </span>
                  </div>

                  <p className="line-clamp-1 text-xs text-zinc-400">
                    {ticket.email || ticket.name || "Guest"}
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
              <div className="flex items-center justify-between border-b border-white/10 p-4">
                <div>
                  <h2 className="font-semibold">{selectedTicket.subject}</h2>
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
                  onClick={closeTicket}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Close
                </button>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-5">
                {loadingMessages ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                  </div>
                ) : (
                  messages.map((message) => {
                    const isAdmin = message.sender_type === "admin";

                    return (
                      <div
                        key={message.id}
                        className={cn("flex", isAdmin ? "justify-end" : "justify-start")}
                      >
                        <div
                          className={cn(
                            "max-w-[75%] rounded-2xl px-4 py-2 text-sm",
                            isAdmin
                              ? "bg-blue-500 text-white"
                              : "bg-white/10 text-zinc-100"
                          )}
                        >
                          <p>{message.message}</p>
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

              <div className="border-t border-white/10 p-4">
                <div className="flex gap-2">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
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
                    onClick={sendReply}
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
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}