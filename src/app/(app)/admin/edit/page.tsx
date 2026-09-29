import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { FileJson, Lock } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Callout } from "@/components/ui/Callout";
import { isAdminEnabled } from "@/components/insights/admin/access";
import { checkContentPathSyntax, listContentJsonFiles } from "@/components/insights/admin/paths";
import { fileKind } from "@/components/insights/admin/validateFile";
import { editHref } from "@/components/insights/admin/data";
import { FileEditor } from "@/components/insights/admin/FileEditor";

export const metadata: Metadata = { title: "Edit content file (admin)", robots: { index: false, follow: false } };

type Search = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminEditPage({ searchParams }: { searchParams: Search }) {
  await connection();
  if (!isAdminEnabled()) notFound();
  const sp = await searchParams;
  const file = Array.isArray(sp.file) ? sp.file[0] : sp.file;

  if (!file) {
    const files = listContentJsonFiles(process.cwd());
    const groups = new Map<string, string[]>();
    for (const f of files) {
      const dir = f.split("/").slice(0, -1).join("/");
      (groups.get(dir) ?? groups.set(dir, []).get(dir)!).push(f);
    }
    return (
      <>
        <PageHeader title="Content files" crumbs={[{ label: "Admin", href: "/admin" }, { label: "Content files" }]} description="Every JSON file under content/. Open one to view, validate and save it." />
        <div className="grid gap-4 lg:grid-cols-2">
          {[...groups.entries()].map(([dir, list]) => (
            <Card key={dir}>
              <CardHeader as="h2" title={<span className="font-mono text-sm">{dir}/</span>} description={`${list.length} file${list.length === 1 ? "" : "s"}`} />
              <ul className={list.length > 12 ? "max-h-80 divide-y divide-border overflow-y-auto" : "divide-y divide-border"}>
                {list.map((f) => {
                  const info = fileKind(f);
                  return (
                    <li key={f}>
                      <Link href={editHref(f)} className="flex min-h-10 items-center gap-2 px-4 py-1.5 text-sm hover:bg-surface-2 sm:px-5">
                        <FileJson aria-hidden className="h-4 w-4 shrink-0 text-fg-3" />
                        <span className="min-w-0 flex-1 truncate font-mono text-[0.8rem]">{f.slice(dir.length + 1)}</span>
                        <span className="shrink-0 text-xs text-fg-3">{info.label}</span>
                        {!info.writable ? (
                          <span className="inline-flex shrink-0 items-center gap-1 text-xs text-fg-3">
                            <Lock aria-hidden className="h-3 w-3" /> read-only
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>
      </>
    );
  }

  const syntax = checkContentPathSyntax(file);
  return (
    <>
      <PageHeader
        title={<span className="break-all font-mono text-xl sm:text-2xl">{syntax.ok ? syntax.rel : "Invalid path"}</span>}
        crumbs={[{ label: "Admin", href: "/admin" }, { label: "Content files", href: "/admin/edit" }, { label: "Edit" }]}
      />
      {syntax.ok ? (
        <FileEditor key={syntax.rel} file={syntax.rel} />
      ) : (
        <Callout tone="danger" title="This path cannot be opened">
          {syntax.error}{" "}
          <Link href="/admin/edit" className="underline">
            Choose a file from the list
          </Link>
          .
        </Callout>
      )}
    </>
  );
}
