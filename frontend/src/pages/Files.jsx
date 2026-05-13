import React, { useEffect, useRef, useState } from "react";
import api from "../lib/api";
import { toast } from "sonner";
import { UploadCloud, Trash2, FileText } from "lucide-react";

export default function Files() {
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const load = async () => {
    try { const { data } = await api.get("/files"); setFiles(data); } catch { /* */ }
  };
  useEffect(() => { load(); }, []);

  const upload = async (file) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.post("/files/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`Uploaded ${file.name}`);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Upload failed");
    } finally { setBusy(false); }
  };

  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) upload(f);
  };

  const remove = async (fid) => {
    if (!window.confirm("Delete this file?")) return;
    try { await api.delete(`/files/${fid}`); load(); } catch { toast.error("Delete failed"); }
  };

  const fmtSize = (b) => b < 1024 ? `${b}B` : b < 1024*1024 ? `${(b/1024).toFixed(1)}KB` : `${(b/1024/1024).toFixed(2)}MB`;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10" data-testid="files-page">
      <span className="label-tag">Index</span>
      <h1 className="font-display text-4xl sm:text-5xl tracking-tight mt-2">Documents your chatbot reads.</h1>
      <p className="text-sm text-[var(--text-sub)] mt-2 max-w-xl">Drop in PDF, DOCX, MD, or TXT (max 10MB). Lexicon will use them as grounding context for future answers.</p>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`mt-8 border-2 border-dashed p-12 text-center cursor-pointer transition-colors ${dragOver ? "border-[var(--accent)] bg-[color:var(--accent)]/5" : "border-[var(--border)]"}`}
        data-testid="file-dropzone"
      >
        <UploadCloud className="mx-auto" size={28}/>
        <div className="label-tag mt-3">{busy ? "Uploading…" : "Drop a file or click to choose"}</div>
        <input ref={inputRef} type="file" className="hidden" accept=".pdf,.txt,.md,.docx" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} data-testid="file-input"/>
      </div>

      <div className="mt-10 surface-card">
        <div className="grid grid-cols-12 px-4 py-3 border-b border-[var(--border)] label-tag">
          <div className="col-span-6">Filename</div>
          <div className="col-span-2">Size</div>
          <div className="col-span-3">Uploaded</div>
          <div className="col-span-1 text-right">—</div>
        </div>
        {files.length === 0 && (
          <div className="px-4 py-6 text-sm text-[var(--text-sub)]" data-testid="files-empty">No files yet.</div>
        )}
        {files.map((f) => (
          <div key={f.file_id} className="grid grid-cols-12 px-4 py-3 border-b border-[var(--border)] items-center text-sm" data-testid="file-row">
            <div className="col-span-6 inline-flex items-center gap-2 truncate"><FileText size={14}/> <span className="truncate">{f.filename}</span></div>
            <div className="col-span-2">{fmtSize(f.size)}</div>
            <div className="col-span-3 text-xs text-[var(--text-sub)]">{new Date(f.created_at).toLocaleString()}</div>
            <div className="col-span-1 text-right">
              <button onClick={() => remove(f.file_id)} className="text-[var(--text-sub)] hover:text-[var(--error)]" data-testid="file-delete"><Trash2 size={14}/></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
