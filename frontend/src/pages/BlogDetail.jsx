import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "@/lib/api";

export default function BlogDetail() {
  const { slug } = useParams();
  const [b, setB] = useState(null);
  useEffect(() => { api.get(`/site/blogs/${slug}`).then(({ data }) => setB(data)).catch(() => {}); }, [slug]);
  if (!b) return <div className="p-12 text-center">Loading…</div>;
  return (
    <article className="max-w-3xl mx-auto px-6 py-12" data-testid="blog-detail">
      <h1 className="font-display text-4xl font-bold mb-4">{b.title}</h1>
      <div className="text-sm text-[#65A30D] mb-6">{b.author}</div>
      <img src={b.cover_image} alt="" className="w-full rounded-2xl mb-8"/>
      <div className="prose prose-lg text-[#334155]" dangerouslySetInnerHTML={{ __html: b.content }}/>
    </article>
  );
}
