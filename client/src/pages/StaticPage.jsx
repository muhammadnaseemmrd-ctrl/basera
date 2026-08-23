import { Helmet } from "react-helmet-async";
import { useDocumentTitle } from "../utils/useDocumentTitle";

export function StaticPage({ title = "About Basera" }) {
  useDocumentTitle(`${title} | Basera`);
  return (
    <>
      <Helmet>
        <title>{title} | Basera</title>
      </Helmet>
      <main className="container-page py-16">
        <section className="panel p-8 sm:p-12">
          <h1 className="text-4xl font-extrabold">{title}</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-700">
            Basera Pakistan connects students with verified, affordable, and safe accommodation near major universities. The platform includes searchable listings, real-time booking workflows, Host management tools, and admin operations for verification, payouts, and disputes.
          </p>
        </section>
      </main>
    </>
  );
}
