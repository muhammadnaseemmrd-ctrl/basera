import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Activity, ArrowLeft, BedDouble, Radio } from "lucide-react";
import { api, safeRequest } from "../services/api";
import { useDocumentTitle } from "../utils/useDocumentTitle";

const fallbackBoard = {
  hostelId: "h1",
  generatedAt: new Date().toISOString(),
  summary: { rooms: 4, totalBeds: 18, availableBeds: 5, occupiedBeds: 13 },
  rooms: [
    { id: "101", title: "Room 101", totalBeds: 4, availableBeds: 1, status: "available", beds: [{ bed: 1, status: "occupied" }, { bed: 2, status: "available" }, { bed: 3, status: "occupied" }, { bed: 4, status: "occupied" }] },
    { id: "102", title: "Room 102", totalBeds: 2, availableBeds: 0, status: "occupied", beds: [{ bed: 1, status: "occupied" }, { bed: 2, status: "occupied" }] },
    { id: "201", title: "Room 201", totalBeds: 6, availableBeds: 3, status: "available", beds: [{ bed: 1, status: "available" }, { bed: 2, status: "available" }, { bed: 3, status: "available" }, { bed: 4, status: "occupied" }, { bed: 5, status: "occupied" }, { bed: 6, status: "occupied" }] }
  ]
};

export function LiveRoomBoardPage() {
  const { slug } = useParams();
  const [board, setBoard] = useState(fallbackBoard);
  const [streamState, setStreamState] = useState("Loading");
  useDocumentTitle("Live Room Board | Basera");

  useEffect(() => {
    let ignore = false;
    safeRequest(() => api.get(`/hostels/${slug}/live-board`), { board: fallbackBoard }).then((result) => {
      if (!ignore) setBoard(result.board || fallbackBoard);
    });

    const baseUrl = api.defaults.baseURL || "http://localhost:5000/api/v1";
    const stream = new EventSource(`${baseUrl}/hostels/${encodeURIComponent(slug)}/live-board/stream`);
    stream.addEventListener("live-board", (event) => {
      setBoard(JSON.parse(event.data));
      setStreamState("Live");
    });
    stream.onerror = () => {
      setStreamState("Demo");
      stream.close();
    };
    return () => {
      ignore = true;
      stream.close();
    };
  }, [slug]);

  const occupancy = useMemo(() => {
    const total = Number(board.summary?.totalBeds || 1);
    const occupied = Number(board.summary?.occupiedBeds || 0);
    return Math.round((occupied / total) * 100);
  }, [board]);
  const updatedAt = useMemo(() => new Date(board.generatedAt || fallbackBoard.generatedAt).toLocaleTimeString(), [board.generatedAt]);

  return (
    <main className="container-page py-8">
      <Link to={`/hostels/${slug}`} className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-primary-800">
        <ArrowLeft size={18} /> Back to hostel
      </Link>
      <section className="panel p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="badge bg-accent-50 text-accent-700"><Radio size={14} /> {streamState}</p>
            <h1 className="mt-4 text-3xl font-extrabold">Live room status board</h1>
            <p className="mt-2 max-w-3xl text-slate-700">Availability updates for beds, rooms, and occupancy. Useful for host operations and student transparency.</p>
          </div>
          <div className="rounded-lg border border-line bg-primary-50 p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-700">Occupancy</p>
            <p className="mt-2 text-4xl font-extrabold text-primary-800">{occupancy}%</p>
            <p className="mt-1 text-sm text-slate-700">{board.summary?.occupiedBeds} of {board.summary?.totalBeds} beds occupied</p>
          </div>
        </div>
      </section>

      <section className="mt-7 grid gap-5 md:grid-cols-4">
        {[
          ["Rooms", board.summary?.rooms || board.rooms?.length, BedDouble],
          ["Total Beds", board.summary?.totalBeds, BedDouble],
          ["Available", board.summary?.availableBeds, Activity],
          ["Updated", updatedAt, Radio]
        ].map(([label, value, Icon]) => (
          <article key={label} className="panel p-5">
            <Icon className="text-primary-800" size={20} />
            <p className="mt-3 text-xs font-bold uppercase tracking-widest text-slate-700">{label}</p>
            <p className="mt-2 text-2xl font-extrabold">{value}</p>
          </article>
        ))}
      </section>

      <section className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {(board.rooms || []).map((room) => (
          <article key={room.id} className="panel p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">{room.title}</h2>
                <p className="mt-1 text-sm text-slate-700">{room.availableBeds} of {room.totalBeds} beds available</p>
              </div>
              <span className={`badge ${room.status === "available" ? "bg-accent-50 text-accent-700" : room.status === "maintenance" ? "bg-[#FEF3C7] text-[#92400E]" : "bg-primary-50 text-primary-800"}`}>{room.status}</span>
            </div>
            <div className="mt-5 grid grid-cols-4 gap-3">
              {(room.beds || []).map((bed) => (
                <div key={bed.bed} className={`rounded-lg border px-3 py-4 text-center text-sm font-bold ${bed.status === "available" ? "border-accent-200 bg-accent-50 text-accent-700" : bed.status === "maintenance" ? "border-[#FCD34D] bg-[#FEF3C7] text-[#92400E]" : "border-line bg-canvas text-slate-700"}`}>
                  Bed {bed.bed}
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
