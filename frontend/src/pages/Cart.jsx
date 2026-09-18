import { useNavigate } from "react-router-dom";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { Trash2, ShoppingBag, AlertTriangle, Lock } from "lucide-react";

export default function Cart() {
  const { cart, delivery, updateItem, removeItem, clearCart } = useCart();
  const { user } = useAuth();
  const nav = useNavigate();

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center" data-testid="cart-page">
        <h1 className="font-display text-3xl font-bold mb-4">Please login to view your cart</h1>
        <button onClick={() => nav("/login")} className="btn-primary" data-testid="cart-login-btn">Login</button>
      </div>
    );
  }

  const items = cart?.items || [];
  const subtotal = cart?.subtotal || 0;
  const shipping = subtotal >= delivery.free_shipping_threshold ? 0 : delivery.delivery_charge;
  const gst = subtotal * (delivery.gst_percent / 100);
  const total = subtotal + shipping + gst;

  const isJoined = user?.is_joining_paid;

  return (
    <div className="max-w-6xl mx-auto px-6 py-12" data-testid="cart-page">
      <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
        <h1 className="font-display text-4xl font-bold text-[#7F1D1D]">Your Cart</h1>
        {items.length > 0 && (
          <button
            onClick={() => { if (window.confirm("Remove all items from cart?")) clearCart(); }}
            className="text-sm text-[#EF4444] font-semibold hover:underline"
            data-testid="cart-clear-btn"
          >
            Clear cart
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="card-soft p-12 text-center" data-testid="cart-empty">
          <ShoppingBag className="w-16 h-16 text-[#94A3B8] mx-auto mb-4"/>
          <div className="text-[#64748B] mb-4">Your cart is empty</div>
          <button
            onClick={() => nav("/products")}
            className="btn-primary"
            data-testid="cart-shop-btn"
          >
            Shop Now
          </button>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-3">
            {items.map((item) => {
              const stock = item.product?.stock ?? 0;
              const lowStock = stock > 0 && stock <= 5;
              const outOfStock = stock <= 0;
              return (
                <div
                  key={item.product.id}
                  className="card-soft p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4"
                  data-testid={`cart-item-${item.product.id}`}
                >
                  <img
                    src={item.product.images?.[0]}
                    alt={item.product.name}
                    className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0 w-full">
                    <div className="font-semibold text-[#7F1D1D] truncate" data-testid={`cart-item-name-${item.product.id}`}>
                      {item.product.name}
                    </div>
                    <div className="font-numbers text-sm text-[#B91C1C]">₹{item.product.price.toLocaleString()}</div>
                    {(lowStock || outOfStock) && (
                      <div className={`text-xs mt-1 flex items-center gap-1 ${outOfStock ? "text-[#EF4444]" : "text-[#B45309]"}`} data-testid={`cart-stock-warning-${item.product.id}`}>
                        <AlertTriangle className="w-3 h-3"/>
                        {outOfStock ? "Out of stock" : `Only ${stock} left`}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 bg-[#F1F5F9] rounded-full">
                    <button
                      onClick={() => updateItem(item.product.id, item.quantity - 1)}
                      className="px-3 py-1 font-bold text-[#7F1D1D]"
                      data-testid={`cart-decr-${item.product.id}`}
                    >−</button>
                    <span className="px-2 font-numbers min-w-[24px] text-center" data-testid={`cart-qty-${item.product.id}`}>{item.quantity}</span>
                    <button
                      onClick={() => updateItem(item.product.id, item.quantity + 1)}
                      className="px-3 py-1 font-bold text-[#7F1D1D] disabled:opacity-30"
                      disabled={item.quantity >= stock}
                      data-testid={`cart-incr-${item.product.id}`}
                    >+</button>
                  </div>
                  <div className="font-numbers font-bold text-[#7F1D1D] w-20 text-right" data-testid={`cart-line-total-${item.product.id}`}>
                    ₹{item.line_total.toLocaleString()}
                  </div>
                  <button
                    onClick={() => removeItem(item.product.id)}
                    className="p-2 text-[#EF4444] hover:bg-red-50 rounded-full"
                    data-testid={`cart-remove-${item.product.id}`}
                    aria-label="Remove item"
                  >
                    <Trash2 className="w-4 h-4"/>
                  </button>
                </div>
              );
            })}

            <button
              onClick={() => nav(isJoined ? "/products" : "/hampers")}
              className="text-sm text-[#B91C1C] font-semibold hover:underline mt-2"
              data-testid="cart-continue-shopping"
            >
              ← Continue shopping
            </button>
          </div>

          <div className="card-soft p-6 h-fit sticky top-24">
            <h3 className="font-display font-bold text-lg mb-4">Order Summary</h3>
            <div className="space-y-2 font-numbers">
              <div className="flex justify-between text-sm" data-testid="cart-subtotal-row">
                <span>Subtotal</span><span>₹{subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>GST ({delivery.gst_percent}%)</span><span>₹{gst.toFixed(0)}</span>
              </div>
              <div className="flex justify-between text-sm" data-testid="cart-shipping-row">
                <span>Delivery</span>
                <span>{shipping === 0 ? <span className="text-[#B91C1C] font-semibold">FREE</span> : `₹${shipping}`}</span>
              </div>
              {subtotal < delivery.free_shipping_threshold && (
                <div className="text-xs text-[#B91C1C]">
                  Add ₹{(delivery.free_shipping_threshold - subtotal).toFixed(0)} more for FREE delivery
                </div>
              )}
              <div className="border-t border-[#E2E8F0] pt-2 mt-2 flex justify-between font-bold text-lg text-[#7F1D1D]" data-testid="cart-total-row">
                <span>Total</span><span>₹{total.toFixed(0)}</span>
              </div>
            </div>
            <button
              onClick={() => nav("/checkout")}
              className="btn-primary w-full justify-center mt-6"
              data-testid="cart-checkout-btn"
              disabled={items.some((it) => (it.product?.stock ?? 0) < it.quantity)}
            >
              Proceed to Checkout
            </button>
            <div className="text-[10px] text-[#64748B] text-center mt-3">
              Delivery charges applied separately as per admin config.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
