/** Full-screen layout for exam mode (no navigation chrome). */
export default function ExamLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-bg">{children}</div>;
}
