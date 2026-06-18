import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { Trash2 } from "lucide-react";

export default function Cart() {
  const { cart, updateItem, removeItem } = useCart();
  const { user } = useAuth();
  const nav = useNavigate();

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <h1 className="font-display text-3xl font-bold mb-4">Please login to view your cart</h1>
        <button onClick={() => nav("/login")} className="btn-primary">Login</button>
      </div>
    );
  }

  const subtotal = cart?.subtotal || 0;
  const shipping = subtotal >= 999 ? 0 : 49;
  const gst = subtotal * 0.05;
  const total = subtotal + shipping + gst;

  return (
    <div className="max-w-6xl mx-auto px-6 py-12" data-testid="cart-page">
      <h1 className="font-display text-4xl font-bold mb-8">Your Cart</h1>
      {cart?.items?.length === 0 ? (
        <div className="card-soft p-12 text-center">
          <div className="text-[#64748B] mb-4">Your cart is empty</div>
          <button onClick={() => nav("/products")} className="btn-primary">Shop Now</button>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-3">
            {cart?.items?.map((item) => (
              <div key={item.product.id} className="card-soft p-4 flex items-center gap-4" data-testid={`cart-item-${item.product.id}`}>
                <img src={item.product.images?.[0]} alt={item.product.name} className="w-20 h-20 rounded-xl object-cover"/>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[#064E3B] truncate">{item.product.name}</div>
                  <div className="font-numbers text-sm text-[#65A30D]">₹{item.product.price}</div>
                </div>
                <div className="flex items-center gap-1 bg-[#F1F5F9] rounded-full">
                  <button onClick={() => updateItem(item.product.id, item.quantity - 1)} className="px-3 py-1 font-bold">−</button>
                  <span className="px-2 font-numbers">{item.quantity}</span>
                  <button onClick={() => updateItem(item.product.id, item.quantity + 1)} className="px-3 py-1 font-bold">+</button>
                </div>
                <div className="font-numbers font-bold text-[#064E3B]">₹{item.line_total}</div>
                <button onClick={() => removeItem(item.product.id)} className="p-2 text-[#EF4444] hover:bg-red-50 rounded-full" data-testid={`cart-remove-${item.product.id}`}><Trash2 className="w-4 h-4"/></button>
              </div>
            ))}
          </div>
          <div className="card-soft p-6 h-fit">
            <h3 className="font-display font-bold text-lg mb-4">Order Summary</h3>
            <div className="space-y-2 font-numbers">
              <div className="flex justify-between text-sm"><span>Subtotal</span><span>₹{subtotal.toFixed(0)}</span></div>
              <div className="flex justify-between text-sm"><span>GST (5%)</span><span>₹{gst.toFixed(0)}</span></div>
              <div className="flex justify-between text-sm"><span>Shipping</span><span>{shipping === 0 ? "FREE" : `₹${shipping}`}</span></div>
              <div className="border-t border-[#E2E8F0] pt-2 mt-2 flex justify-between font-bold text-lg text-[#064E3B]"><span>Total</span><span>₹{total.toFixed(0)}</span></div>
            </div>
            <button onClick={() => nav("/checkout")} className="btn-primary w-full justify-center mt-6" data-testid="cart-checkout-btn">Proceed to Checkout</button>
          </div>
        </div>
      )}
    </div>
  );
}
