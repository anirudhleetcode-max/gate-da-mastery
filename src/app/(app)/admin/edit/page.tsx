import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { FileJson, Lock } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Callout } from "@/components/ui/Callout";
import { isAdminEnabled } from "@/components/insights/admin/access";
import { checkContentPathSyntax, listContentJsonFiles, resolveContentPath } from "@/components/insights/admin/paths";
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
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[...groups.entries()].map(([dir, list]) => (
            <Card key={dir} className="min-w-0">
              <CardHeader as="h2" title={<span className="font-mono text-sm">{dir}/</span>} description={`${list.length} file${list.length === 1 ? "" : "s"}`} />
              <ul className={list.length > 12 ? "max-h-80 divide-y divide-border overflow-y-auto" : "divide-y divide-border"}>
                {list.map((f) => {
                  const info = fileKind(f);
                  return (
                    <li key={f}>
                      <Link href={editHref(f)} className="flex min-h-10 items-center gap-2 px-4 py-1.5 text-sm hover:bg-surface-2 sm:px-5">
                        <FileJson aria-hidden className="h-4 w-4 shrink-0 text-fg-3" />
                        <span className="min-w-0 flex-1 truncate font-mono text-[0.8rem]">{f.slice(dir.length + 1)}</span>
                        <span className="hidden shrink-0 text-xs text-fg-3 sm:inline">{info.label}</span>
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
  // Full check (traversal, symlinks, existence) on the server, so an unusable path never reaches the editor.
  const resolved = syntax.ok ? resolveContentPath(syntax.rel, process.cwd()) : null;
  const problem = !syntax.ok ? syntax.error : resolved && !resolved.ok ? resolved.error : null;
  return (
    <>
      <PageHeader
        title={
          <span className="font-mono text-xl sm:text-2xl">
            {syntax.ok
              ? syntax.rel.split("/").map((part, i) => (
                  <Fragment key={i}>
                    {i ? (
                      <>
                        /<wbr />
                      </>
                    ) : null}
                    {part}
                  </Fragment>
                ))
              : "Invalid path"}
          </span>
        }
        crumbs={[{ label: "Admin", href: "/admin" }, { label: "Content files", href: "/admin/edit" }, { label: "Edit" }]}
      />
      {syntax.ok && !problem ? (
        <FileEditor key={syntax.rel} file={syntax.rel} />
      ) : (
        <Callout tone="danger" title="This path cannot be opened">
          {problem}{" "}
          <Link href="/admin/edit" className="underline">
            Choose a file from the list
          </Link>
          .
        </Callout>
      )}
    </>
  );
}
