import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";

export default function Blog() {
  const [items, setItems] = useState([]);
  useEffect(() => { api.get("/site/blogs").then(({ data }) => setItems(data)); }, []);
  return (
    <div className="max-w-6xl mx-auto px-6 py-12" data-testid="blog-page">
      <h1 className="font-display text-5xl font-bold mb-8">Blog</h1>
      <div className="grid md:grid-cols-3 gap-6">
        {items.map((b) => (
          <Link to={`/blog/${b.slug}`} key={b.id} className="card-soft overflow-hidden hover:-translate-y-1 transition-transform" data-testid={`blog-${b.slug}`}>
            <img src={b.cover_image} alt="" className="aspect-video w-full object-cover"/>
            <div className="p-5">
              <h3 className="font-display font-bold text-lg mb-2 text-[#7F1D1D]">{b.title}</h3>
              <p className="text-sm text-[#334155]">{b.excerpt}</p>
              <div className="text-xs text-[#B91C1C] mt-3 font-semibold">{b.author}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
