import { Helmet } from "react-helmet-async";
import { ChatPanel } from "../../components/ChatPanel";
import { useDocumentTitle } from "../../utils/useDocumentTitle";

export function StudentChat() {
  useDocumentTitle("Student Chat | Basera");

  return (
    <>
      <Helmet>
        <title>Student Chat | Basera</title>
      </Helmet>
      <div className="mb-7">
        <h2 className="text-3xl font-extrabold tracking-tight">Chat</h2>
        <p className="mt-2 text-neutral-700">Coordinate visits, availability, and booking questions with hostel managers.</p>
      </div>
      <ChatPanel title="Student Messages" />
    </>
  );
}
