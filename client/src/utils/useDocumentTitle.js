import { useEffect } from "react";

/**
 * Sets the document title and, optionally, the meta description tag for the
 * current page. Passing a description lets individual public pages (hostel
 * detail, city listings, rooms marketplace, etc.) surface unique, keyword-rich
 * snippets in search results instead of sharing the one static tag in index.html.
 */
export function useDocumentTitle(title, description) {
  useEffect(() => {
    document.title = title;
  }, [title]);

  useEffect(() => {
    if (!description) return;
    let tag = document.querySelector('meta[name="description"]');
    const previous = tag ? tag.getAttribute("content") : null;
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute("name", "description");
      document.head.appendChild(tag);
    }
    tag.setAttribute("content", description);
    return () => {
      if (tag && previous !== null) tag.setAttribute("content", previous);
    };
  }, [description]);
}
