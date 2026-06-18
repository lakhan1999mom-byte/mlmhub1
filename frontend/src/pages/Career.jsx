export default function Career() {
  const openings = [
    { title: "Senior Backend Engineer", loc: "Mumbai / Remote", type: "Full-time" },
    { title: "Growth Marketer", loc: "Mumbai", type: "Full-time" },
    { title: "Customer Support Lead", loc: "Remote", type: "Full-time" },
    { title: "Field Sales Manager", loc: "Pan India", type: "Full-time" },
  ];
  return (
    <div className="max-w-5xl mx-auto px-6 py-12" data-testid="career-page">
      <h1 className="font-display text-5xl font-bold mb-4">Careers at EverGro</h1>
      <p className="text-lg text-[#334155] mb-10">Join us in building India's most transparent wealth-creation platform.</p>
      <div className="space-y-3">
        {openings.map((o) => (
          <div key={o.title} className="card-soft p-6 flex items-center justify-between">
            <div>
              <div className="font-display text-xl font-bold text-[#064E3B]">{o.title}</div>
              <div className="text-sm text-[#64748B]">{o.loc} · {o.type}</div>
            </div>
            <a href={`mailto:careers@evergroemart.com?subject=Application: ${o.title}`} className="btn-primary text-sm">Apply</a>
          </div>
        ))}
      </div>
    </div>
  );
}
