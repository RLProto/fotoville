"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { fetchOrderDownload, markDownloaded, writeOrder, type DirectoryHandle } from "@/lib/admin-download";
import { DownloadDialog, downloadCancelled, downloadResult, type DownloadState } from "@/components/admin/download-dialog";
import { useFolderPicker } from "@/components/admin/folder-picker";
import { reportError } from "@/lib/report-error";
import type { Order } from "@/lib/types";

/** O mínimo para baixar: a pasta leva o número, e o status diz se o download passa o pedido para produção. */
export type DownloadTarget = Pick<Order, "id" | "number" | "status">;

/**
 * Download em pastas de um ou vários pedidos, com um seletor de pasta para todos: usado pela lista de pedidos e
 * pelos lotes de etiquetas. `busy` é o id do pedido sendo baixado sozinho, "many" para vários, ou null.
 * `dialogs` vai no fim do componente (escolha da pasta e andamento).
 */
export function useOrderDownloads() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [download, setDownload] = useState<DownloadState | null>(null);
  const stopRef = useRef<AbortController | null>(null);
  const folder = useFolderPicker();

  /** Grava um pedido em `root`, marca como baixado e, se estava pago, passa para "Em produção". */
  async function downloadInto(root: DirectoryHandle, order: DownloadTarget, title: string, signal: AbortSignal) {
    setDownload({ phase: "running", title, done: 0, total: 0 });
    try {
      const data = await fetchOrderDownload(order.id, signal);
      const result = await writeOrder(root, data, {
        signal,
        onProgress: (done, total) => setDownload({ phase: "running", title, done, total }),
      });
      return !result.failed && !result.cancelled && (await markDownloaded(order));
    } catch (err) {
      if (!signal.aborted) reportError("loja", err, { etapa: "baixar pedido pela lista", order: order.id });
      return false;
    }
  }

  /** Pede a pasta e baixa os pedidos, um depois do outro. false quando nenhuma pasta foi escolhida. */
  async function run(list: DownloadTarget[]): Promise<boolean> {
    if (!list.length) return false;
    const root = await folder.pick();
    if (!root) return false;
    setBusy(list.length === 1 ? list[0].id : "many");
    const stop = new AbortController();
    stopRef.current = stop;
    let saved = 0;
    const failed: number[] = [];
    for (const [i, order] of list.entries()) {
      if (stop.signal.aborted) break;
      const place = list.length > 1 ? ` (${i + 1} de ${list.length})` : "";
      if (await downloadInto(root, order, `Baixando pedido #${order.number}${place}`, stop.signal)) saved += 1;
      else if (!stop.signal.aborted) failed.push(order.number);
    }
    stopRef.current = null;
    setBusy(null);
    setDownload(stop.signal.aborted ? downloadCancelled(saved) : downloadResult(saved, failed));
    router.refresh();
    return true;
  }

  const dialogs = (
    <>
      {download && (
        <DownloadDialog state={download} onClose={() => setDownload(null)} onStop={() => stopRef.current?.abort()} />
      )}
      {folder.dialog}
    </>
  );
  return { run, busy, dialogs };
}
