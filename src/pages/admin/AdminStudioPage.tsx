import { Link } from "react-router-dom";
export default function AdminStudioPage() {
  return <div className="p-8 text-slate-100"><h1 className="text-2xl font-semibold">Content tools</h1><p className="my-4 text-slate-400">Choose an existing tool to create or manage content.</p><nav className="flex flex-wrap gap-4" aria-label="Content tools"><Link className="underline" to="/admin/long-form-studio">Long-form studio</Link><Link className="underline" to="/admin/clip-factory">Clip factory</Link><Link className="underline" to="/admin/library">Finished media library</Link></nav></div>;
}
