import Link from "next/link";

export default function RootNotFound() {
  return (
    <main className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-fg-2">The page you are looking for does not exist.</p>
      <Link href="/" className="mt-6 inline-block font-medium text-accent-text underline">
        Go to the dashboard
      </Link>
    </main>
  );
}
