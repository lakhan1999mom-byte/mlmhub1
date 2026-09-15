import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Users, ChevronDown, ChevronRight } from "lucide-react";

export default function Network() {
  const [tree, setTree] = useState(null);
  const [collapsed, setCollapsed] = useState({});

  useEffect(() => { api.get("/users/network-tree?depth=5").then(({ data }) => setTree(data)); }, []);

  if (!tree) return <div className="p-8 text-center">Loading…</div>;

  const flat = [];
  const walk = (node, depth) => {
    flat.push({ ...node, _depth: depth });
    if (!collapsed[node.id] && (node.children || []).length) {
      for (const c of node.children) walk(c, depth + 1);
    }
  };
  walk(tree, 0);

  return (
    <div className="space-y-6" data-testid="network-page">
      <div>
        <h1 className="font-display text-3xl font-bold">My Network</h1>
        <p className="text-[#64748B]">Your downline genealogy tree (up to 5 levels)</p>
      </div>
      <div className="card-soft p-6 overflow-x-auto">
        <div className="space-y-2 min-w-fit">
          {flat.map((node) => {
            const hasChildren = (node.children || []).length > 0;
            const isCollapsed = collapsed[node.id];
            const isRoot = node._depth === 0;
            return (
              <div key={node.id} style={{ marginLeft: `${node._depth * 24}px` }} className="flex items-center gap-3" data-testid={`tree-node-${node.user_code}`}>
                {hasChildren ? (
                  <button onClick={() => setCollapsed({ ...collapsed, [node.id]: !isCollapsed })} className="p-1 text-[#B91C1C]" data-testid={`tree-toggle-${node.user_code}`}>
                    {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                ) : <span className="w-6" />}
                <div className={`inline-flex items-center gap-3 px-4 py-2.5 rounded-xl ${isRoot ? "bg-[#7F1D1D] text-white" : "bg-[#FEE2E2] text-[#7F1D1D]"}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isRoot ? "bg-white/20" : "bg-[#DC2626]"}`}>
                    <Users className={`w-4 h-4 ${isRoot ? "text-white" : "text-[#7F1D1D]"}`} />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{node.name}</div>
                    <div className={`text-xs font-numbers ${isRoot ? "text-white/70" : "text-[#B91C1C]"}`}>
                      {node.user_code} · Stage {node.current_stage} · Team {node.team_size}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
