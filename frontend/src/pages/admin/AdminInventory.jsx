import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Package, AlertTriangle } from "lucide-react";

export default function AdminInventory() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/admin/inventory").then(({ data }) => setData(data)); }, []);
  if (!data) return <div className="p-8 text-center">Loading…</div>;
  return (
    <div className="space-y-6" data-testid="admin-inventory-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Inventory</h1>
          <p className="text-sm text-[#64748B]">Total products: <b className="font-numbers">{data.total}</b> · Low stock: <b className="text-[#EF4444] font-numbers">{data.low_stock_count}</b></p>
        </div>
      </div>
      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#F1F5F9] text-left text-xs uppercase">
            <tr><th className="p-3">Product</th><th>SKU</th><th>Stock</th><th>Sold</th><th>Price</th><th>Status</th></tr>
          </thead>
          <tbody>
            {data.items.map((i) => (
              <tr key={i.id} className="border-t border-[#F1F5F9]" data-testid={`inv-${i.id}`}>
                <td className="p-3">
                  <div className="font-semibold text-[#064E3B] flex items-center gap-2">
                    {i.is_hamper && <Package className="w-4 h-4 text-[#65A30D]"/>}
                    {i.name}
                  </div>
                </td>
                <td className="p-3 font-numbers text-xs text-[#64748B]">{i.sku}</td>
                <td className="p-3 font-numbers">
                  {i.stock}
                  {i.low_stock && <span className="ml-1 badge-pill bg-red-50 text-red-700"><AlertTriangle className="w-3 h-3"/>Low</span>}
                </td>
                <td className="p-3 font-numbers">{i.sold}</td>
                <td className="p-3 font-numbers">₹{i.price}</td>
                <td className="p-3">
                  <span className={`badge-pill ${i.is_locked ? "bg-red-50 text-red-700" : i.is_active ? "bg-[#ECFCCB] text-[#065F46]" : "bg-[#F1F5F9] text-[#64748B]"}`}>
                    {i.is_locked ? "Locked" : i.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
