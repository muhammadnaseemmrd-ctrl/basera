import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { MessageSquare, Send } from "lucide-react";
import { api, safeRequest } from "../services/api";
import { useAuthStore } from "../store/useAuthStore";

const fallbackThreads = [
  {
    id: "thread-owner",
    hostelId: "h1",
    hostelName: "Cozy Boys Hostel F-10",
    participant: { id: "u-owner", name: "Hostel Manager", role: "host" },
    lastMessage: "Your visit slot is available tomorrow at 5 PM.",
    unread: 1
  }
];

const fallbackMessages = [
  { id: "m1", senderRole: "student", message: "Hi, is the double room still available?", createdAt: new Date().toISOString() },
  { id: "m2", senderRole: "host", message: "Yes. You can book or schedule a visit through Basera.", createdAt: new Date().toISOString() }
];

const QUICK_PROMPTS = ["Is this room still available?", "Can I schedule a visit?", "What's included in the rent?"];

// lockToSupport enforces the platform business rule that customers reach
// Admin/Support first rather than messaging a specific property owner
// directly. When set, the thread list/host picker is replaced by a single
// fixed "Basera Support" conversation and every outgoing message is routed
// to that support account, regardless of which hostel the student came from.
export function ChatPanel({ title = "Messages", defaultHostelId = "h1", compact = false, lockToSupport = false }) {
  const user = useAuthStore((state) => state.user);
  const [threads, setThreads] = useState(fallbackThreads);
  const [activeThreadId, setActiveThreadId] = useState(fallbackThreads[0].id);
  const [messages, setMessages] = useState(fallbackMessages);
  const [draft, setDraft] = useState("");
  const [supportContact, setSupportContact] = useState(null);
  const [supportError, setSupportError] = useState(false);
  const supportThread = useMemo(
    () =>
      supportContact
        ? {
            id: "thread-support",
            hostelId: null,
            hostelName: "Basera Support",
            participant: supportContact,
            lastMessage: "",
            unread: 0
          }
        : null,
    [supportContact]
  );
  const effectiveThreads = lockToSupport ? (supportThread ? [supportThread] : []) : threads;
  const activeThread = lockToSupport ? supportThread : threads.find((thread) => thread.id === activeThreadId) || threads[0];
  const socket = useMemo(() => {
    const baseUrl = (import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1").replace(/\/api\/v1\/?$/, "");
    return io(baseUrl, { autoConnect: false });
  }, []);

  useEffect(() => {
    if (!lockToSupport) return;
    safeRequest(() => api.get("/chat/support-contact"), { contact: { id: "u-admin", name: "Basera Support Team", role: "admin" } })
      .then((result) => {
        if (result?.contact) setSupportContact(result.contact);
        else setSupportError(true);
      })
      .catch(() => setSupportError(true));
  }, [lockToSupport]);

  useEffect(() => {
    if (lockToSupport) return;
    safeRequest(() => api.get("/chat/threads"), { results: fallbackThreads }).then((result) => {
      const nextThreads = result.results?.length ? result.results : fallbackThreads;
      setThreads(nextThreads);
      setActiveThreadId(nextThreads[0]?.id || fallbackThreads[0].id);
    });
  }, [lockToSupport]);

  useEffect(() => {
    if (!activeThread) return;
    safeRequest(
      () => api.get("/chat/messages", { params: { receiverId: activeThread.participant?.id || activeThread.participant?._id, hostelId: activeThread.hostelId || defaultHostelId } }),
      { results: fallbackMessages }
    ).then((result) => {
      setMessages(result.results?.length ? result.results : fallbackMessages);
    });
  }, [activeThread, defaultHostelId]);

  useEffect(() => {
    socket.connect();
    if (user?.id) socket.emit("join", { userId: user.id });
    socket.on("chat:message", (message) => {
      setMessages((current) => [...current, message]);
    });
    return () => {
      socket.off("chat:message");
      socket.disconnect();
    };
  }, [socket, user?.id]);

  const sendMessage = async (event) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || !activeThread) return;
    if (lockToSupport && !activeThread.participant?.id && !activeThread.participant?._id) return; // support contact not resolved yet
    setDraft("");
    const payload = {
      receiverId: activeThread.participant?.id || activeThread.participant?._id || "u-owner",
      hostelId: activeThread.hostelId || defaultHostelId,
      message
    };
    const result = await safeRequest(() => api.post("/chat/messages", payload), {
      message: { id: `local-${Date.now()}`, senderRole: user?.role || "student", message, createdAt: new Date().toISOString(), isFlagged: false },
      demo: true
    });
    const savedMessage = result.message || result;
    setMessages((current) => [...current, savedMessage]);
    socket.emit("chat:send", { ...payload, senderRole: user?.role || "student", senderId: user?.id });
  };

  return (
    <section className={`overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm ${compact ? "" : "min-h-[620px]"}`}>
      <div className="flex items-center justify-between gap-3 border-b border-outline-variant px-5 py-4">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold text-on-surface"><MessageSquare size={22} className="text-primary-700" /> {title}</h2>
        <span className="flex items-center gap-1 rounded-full border border-outline-variant bg-secondary-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-secondary-700">
          {lockToSupport ? "Routed via Basera Support" : "Verified messaging"}
        </span>
      </div>
      <div className="grid min-h-[520px] md:grid-cols-[280px_1fr]">
        <aside className="border-b border-outline-variant bg-surface-container-low p-4 md:border-b-0 md:border-r">
          {lockToSupport ? (
            <div className="rounded-lg border border-primary-700 bg-surface-container-lowest p-4 text-left shadow-sm">
              <p className="font-semibold text-on-surface">Basera Support Team</p>
              <p className="mt-1 text-sm text-on-surface-variant">
                {supportError
                  ? "Support routing is temporarily unavailable."
                  : "Your host will be looped in by our team when needed. Direct host messaging is disabled for your protection."}
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {effectiveThreads.map((thread) => (
                <button
                  type="button"
                  key={thread.id}
                  onClick={() => setActiveThreadId(thread.id)}
                  className={`rounded-lg border p-4 text-left transition duration-250 ease-smooth ${
                    activeThreadId === thread.id ? "border-primary-700 bg-surface-container-lowest shadow-sm" : "border-transparent bg-surface-container-lowest/70 hover:bg-surface-container-lowest"
                  }`}
                >
                  <p className="font-semibold text-on-surface">{thread.hostelName}</p>
                  <p className="mt-1 truncate text-sm text-on-surface-variant">{thread.lastMessage}</p>
                  {thread.unread ? <span className="badge mt-3 bg-primary-700 text-white">{thread.unread} new</span> : null}
                </button>
              ))}
            </div>
          )}
        </aside>
        <div className="grid min-h-[520px] grid-rows-[1fr_auto]">
          <div className="space-y-4 overflow-y-auto p-5">
            {messages.map((message) => {
              const own = message.senderRole === user?.role || message.sender === user?.id;
              return (
                <div key={message.id || message._id || `${message.message}-${message.createdAt}`} className={`flex flex-col gap-1 ${own ? "items-end" : "items-start"}`}>
                  <div
                    className={`max-w-[78%] px-4 py-3 text-sm leading-6 shadow-sm ${
                      message.isFlagged
                        ? "rounded-xl rounded-tl-sm border border-warning-600 bg-warning-50 text-[#9A3412]"
                        : own
                          ? "rounded-xl rounded-tr-sm bg-primary-container text-on-primary-container"
                          : "rounded-xl rounded-tl-sm border border-outline-variant bg-surface-container-high text-on-surface"
                    }`}
                  >
                    <p>{message.message}</p>
                    {message.isFlagged && <p className="mt-2 text-xs font-bold">Contact or off-platform payment detail blocked by Basera.</p>}
                  </div>
                  {message.createdAt && (
                    <span className="px-1 text-xs text-on-surface-variant">
                      {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="border-t border-outline-variant px-4 pt-3">
            <div className="flex flex-wrap justify-end gap-2 pb-3">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => setDraft(prompt)}
                  className="rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-2 text-xs font-medium text-on-surface-variant shadow-sm transition-colors hover:bg-surface-container-high"
                >
                  {prompt}
                </button>
              ))}
            </div>
            <form onSubmit={sendMessage} className="pb-4">
              <div className="relative flex items-center">
                <input
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-low py-3 pl-4 pr-14 text-sm text-on-surface shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Type your message..."
                />
                <button type="submit" className="absolute right-2 flex items-center justify-center rounded-md bg-primary p-2 text-on-primary transition-colors hover:bg-primary-700" aria-label="Send message">
                  <Send size={18} />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
