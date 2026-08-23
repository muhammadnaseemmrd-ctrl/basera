import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Building2, CheckCircle2, DoorOpen, Lock, Unlock, UserRound } from "lucide-react";
import { api, safeRequest } from "../services/api";
import { useAuthStore } from "../store/useAuthStore";
import { useDocumentTitle } from "../utils/useDocumentTitle";

const fallbackBlocks = [
  { id: "blk-h1-a", hostelId: "h1", name: "Block A", wardenId: "u-warden", floorCount: 3, notes: "Main block, ground to 3rd floor." }
];

const fallbackRoomsByBlock = {
  "blk-h1-a": [
    { id: "r1", roomNumber: "101", title: "Premium Single Seater near NUST", totalBeds: 1 },
    { id: "r2", roomNumber: "204", title: "Standard Double Seater F-10", totalBeds: 2 }
  ]
};

export function WardenDashboard() {
  useDocumentTitle("Warden Dashboard | Basera");
  const user = useAuthStore((state) => state.user);
  const [blocks, setBlocks] = useState([]);
  const [roomsByBlock, setRoomsByBlock] = useState({});
  const [availabilityByRoom, setAvailabilityByRoom] = useState({});
  const [loading, setLoading] = useState(true);
  const [busySeat, setBusySeat] = useState("");
  const [notice, setNotice] = useState("");

  const isWarden = user?.role === "warden";

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      setLoading(true);
      const blockResult = await safeRequest(() => api.get("/blocks"), { results: fallbackBlocks, demo: true });
      const myBlocks = blockResult.results || [];
      if (ignore) return;
      setBlocks(myBlocks);

      const roomEntries = await Promise.all(
        myBlocks.map(async (block) => {
          const result = await safeRequest(() => api.get(`/blocks/${block.id}/rooms`), { results: fallbackRoomsByBlock[block.id] || [], demo: true });
          return [block.id, result.results || []];
        })
      );
      if (ignore) return;
      const nextRoomsByBlock = Object.fromEntries(roomEntries);
      setRoomsByBlock(nextRoomsByBlock);

      const allRooms = Object.values(nextRoomsByBlock).flat();
      const availabilityEntries = await Promise.all(
        allRooms.map(async (room) => {
          const roomId = room.id || room._id;
          const result = await safeRequest(() => api.get(`/rooms/${roomId}/availability`), {
            totalBeds: room.totalBeds || 1,
            availableBedIndices: [],
            blocks: []
          });
          return [roomId, result];
        })
      );
      if (ignore) return;
      setAvailabilityByRoom(Object.fromEntries(availabilityEntries));
      setLoading(false);
    };

    load();
    return () => {
      ignore = true;
    };
  }, []);

  const refreshRoomAvailability = async (roomId) => {
    const result = await safeRequest(() => api.get(`/rooms/${roomId}/availability`), availabilityByRoom[roomId]);
    setAvailabilityByRoom((current) => ({ ...current, [roomId]: result }));
  };

  const seatStatus = (roomId, bedIndex) => {
    const availability = availabilityByRoom[roomId];
    if (!availability) return { status: "unknown" };
    if ((availability.availableBedIndices || []).includes(bedIndex)) return { status: "available" };
    const block = (availability.blocks || []).find((item) => item.bedIndex === bedIndex);
    if (block?.reason === "booked_offline") return { status: "booked_offline", block };
    if (block) return { status: "blocked", block };
    return { status: "occupied" };
  };

  const markBooked = async (room, bedIndex) => {
    const roomId = room.id || room._id;
    const seatKey = `${roomId}-${bedIndex}`;
    setBusySeat(seatKey);
    const note = window.prompt("Reason for this offline booking (e.g. booked directly by student's family, cash payment):", "Booked directly by student's family, cash payment.");
    if (note === null) {
      setBusySeat("");
      return;
    }
    const payload = {
      bedIndex,
      from: new Date().toISOString(),
      to: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      reason: "booked_offline",
      note
    };
    const result = await safeRequest(() => api.post(`/rooms/${roomId}/bed-blocks`, payload), { block: { id: `BB-${Date.now()}`, ...payload }, demo: true });
    await refreshRoomAvailability(roomId);
    setNotice(result.demo ? "Seat marked booked (offline) in demo mode." : "Seat marked booked (offline).");
    setBusySeat("");
    setTimeout(() => setNotice(""), 2600);
  };

  const releaseSeat = async (room, bedIndex, block) => {
    const roomId = room.id || room._id;
    const seatKey = `${roomId}-${bedIndex}`;
    setBusySeat(seatKey);
    const blockId = block.id || block._id;
    const result = await safeRequest(() => api.put(`/rooms/${roomId}/bed-blocks/${blockId}`, { status: "released" }), { block: { ...block, status: "released" }, demo: true });
    await refreshRoomAvailability(roomId);
    setNotice(result.demo ? "Seat released in demo mode." : "Seat released.");
    setBusySeat("");
    setTimeout(() => setNotice(""), 2600);
  };

  return (
    <>
      <Helmet>
        <title>Warden Dashboard | Basera</title>
      </Helmet>
      <main className="container-page py-10 lg:py-14">
        <div className="mb-8 flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-primary-50 text-primary-800">
            <UserRound size={22} />
          </span>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Warden Dashboard</h1>
            <p className="text-slate-700">{isWarden ? `Signed in as ${user?.name || "Warden"}` : "Oversight view - blocks and manual seat corrections."}</p>
          </div>
        </div>

        {notice && <p className="mb-6 rounded-md bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-800">{notice}</p>}

        {loading ? (
          <p className="text-slate-700">Loading your assigned blocks...</p>
        ) : blocks.length === 0 ? (
          <div className="panel p-8 text-center">
            <p className="text-lg font-bold">No block assigned yet</p>
            <p className="mt-2 text-slate-700">Ask your host to assign you to a block from the host dashboard.</p>
          </div>
        ) : (
          <div className="grid gap-8">
            {blocks.map((block) => (
              <section key={block.id || block._id} className="panel p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
                  <div className="flex items-center gap-3">
                    <Building2 className="text-primary-800" size={22} />
                    <div>
                      <h2 className="text-xl font-bold">{block.name}</h2>
                      <p className="text-sm text-slate-700">{block.floorCount} floor{block.floorCount === 1 ? "" : "s"}{block.notes ? ` - ${block.notes}` : ""}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-4">
                  {(roomsByBlock[block.id || block._id] || []).map((room) => {
                    const roomId = room.id || room._id;
                    const totalBeds = room.totalBeds || 1;
                    return (
                      <article key={roomId} className="rounded-lg border border-line bg-canvas p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-bold">Room {room.roomNumber} - {room.title}</p>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-3">
                          {Array.from({ length: totalBeds }, (_, bedIndex) => bedIndex).map((bedIndex) => {
                            const { status, block: seatBlock } = seatStatus(roomId, bedIndex);
                            const seatKey = `${roomId}-${bedIndex}`;
                            const isBusy = busySeat === seatKey;
                            return (
                              <div
                                key={bedIndex}
                                className={`grid w-40 gap-2 rounded-lg border p-3 text-center ${
                                  status === "available"
                                    ? "border-accent-700 bg-accent-50"
                                    : status === "booked_offline"
                                      ? "border-[#B45309] bg-[#FEF3C7]"
                                      : status === "blocked"
                                        ? "border-[#C81E1E] bg-[#FEE2E2]"
                                        : "border-primary-700 bg-primary-50"
                                }`}
                              >
                                <p className="text-xs font-bold uppercase tracking-widest text-slate-700">Seat {bedIndex + 1}</p>
                                <p className="flex items-center justify-center gap-1 text-sm font-semibold">
                                  {status === "available" && <><CheckCircle2 size={15} /> Available</>}
                                  {status === "booked_offline" && <><Lock size={15} /> Booked (offline)</>}
                                  {status === "blocked" && <><Lock size={15} /> On hold</>}
                                  {status === "occupied" && <><DoorOpen size={15} /> Occupied</>}
                                  {status === "unknown" && "Loading..."}
                                </p>
                                {status === "booked_offline" && seatBlock?.note && (
                                  <p className="text-xs text-slate-700">{seatBlock.note}</p>
                                )}
                                {status === "available" && (
                                  <button type="button" disabled={isBusy} onClick={() => markBooked(room, bedIndex)} className="btn-primary py-1.5 text-xs">
                                    {isBusy ? "Marking..." : "Mark Booked"}
                                  </button>
                                )}
                                {status === "booked_offline" && (
                                  <button type="button" disabled={isBusy} onClick={() => releaseSeat(room, bedIndex, seatBlock)} className="btn-secondary flex items-center justify-center gap-1 py-1.5 text-xs">
                                    <Unlock size={13} /> {isBusy ? "Releasing..." : "Release"}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </article>
                    );
                  })}
                  {!(roomsByBlock[block.id || block._id] || []).length && (
                    <p className="text-sm text-slate-700">No rooms assigned to this block yet.</p>
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
