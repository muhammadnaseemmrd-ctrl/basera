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

export function ChatPanel({ title = "Messages", defaultHostelId = "h1", compact = false }) {
  const user = useAuthStore((state) => state.user);
  const [threads, setThreads] = useState(fallbackThreads);
  const [activeThreadId, setActiveThreadId] = useState(fallbackThreads[0].id);
  const [messages, setMessages] = useState(fallbackMessages);
  const [draft, setDraft] = useState("");
  const activeThread = threads.find((thread) => thread.id === activeThreadId) || threads[0];
  const socket = useMemo(() => {
    const baseUrl = (import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1").replace(/\/api\/v1\/?$/, "");
    return io(baseUrl, { autoConnect: false });
  }, []);

  useEffect(() => {
    safeRequest(() => api.get("/chat/threads"), { results: fallbackThreads }).then((result) => {
      const nextThreads = result.results?.length ? result.results : fallbackThreads;
      setThreads(nextThreads);
      setActiveThreadId(nextThreads[0]?.id || fallbackThreads[0].id);
    });
  }, []);

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
    <section className={`panel overflow-hidden ${compact ? "" : "min-h-[620px]"}`}>
      <div className="border-b border-line p-5">
        <h2 className="flex items-center gap-2 text-xl font-bold"><MessageSquare size={22} /> {title}</h2>
      </div>
      <div className="grid min-h-[520px] md:grid-cols-[280px_1fr]">
        <aside className="border-b border-line bg-primary-50/60 p-4 md:border-b-0 md:border-r">
          <div className="grid gap-3">
            {threads.map((thread) => (
              <button
                type="button"
                key={thread.id}
                onClick={() => setActiveThreadId(thread.id)}
                className={`rounded-lg border p-4 text-left transition duration-250 ease-smooth ${
                  activeThreadId === thread.id ? "border-primary-700 bg-white shadow-card" : "border-transparent bg-white/70 hover:bg-white"
                }`}
              >
                <p className="font-bold">{thread.hostelName}</p>
                <p className="mt-1 truncate text-sm text-slate-700">{thread.lastMessage}</p>
                {thread.unread ? <span className="badge mt-3 bg-primary-700 text-white">{thread.unread} new</span> : null}
              </button>
            ))}
          </div>
        </aside>
        <div className="grid min-h-[520px] grid-rows-[1fr_auto]">
          <div className="space-y-4 overflow-y-auto p-5">
            {messages.map((message) => {
              const own = message.senderRole === user?.role || message.sender === user?.id;
              return (
                <div key={message.id || message._id || `${message.message}-${message.createdAt}`} className={`flex ${own ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.isFlagged ? "border border-[#F97316] bg-[#FFF7ED] text-[#9A3412]" : own ? "bg-primary-700 text-white" : "bg-primary-50 text-ink"}`}>
                    <p>{message.message}</p>
                    {message.isFlagged && <p className="mt-2 text-xs font-bold">Contact or off-platform payment detail blocked by Basera.</p>}
                    {message.createdAt && (
                      <p className={`mt-1 text-[11px] ${message.isFlagged ? "text-[#9A3412]/70" : own ? "text-white/70" : "text-slate-500"}`}>
                        {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <form onSubmit={sendMessage} className="border-t border-line p-4">
            <div className="flex gap-3">
              <input className="input" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Type a message..." />
              <button type="submit" className="btn-primary px-5" aria-label="Send message"><Send size={18} /></button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
