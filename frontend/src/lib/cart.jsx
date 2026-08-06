import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";

const CartContext = createContext(null);

const DEFAULT_DELIVERY = { delivery_charge: 49, free_shipping_threshold: 999, gst_percent: 5, gst_enabled: true, delivery_charge_enabled: true, extra_charges: [] };

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [cart, setCart] = useState({ items: [], subtotal: 0 });
  const [delivery, setDelivery] = useState(DEFAULT_DELIVERY);

  const fetchCart = useCallback(async () => {
    if (!user) {
      setCart({ items: [], subtotal: 0 });
      return;
    }
    try {
      const { data } = await api.get("/cart");
      setCart(data);
    } catch (e) {
      // ignore
    }
  }, [user]);

  const fetchDelivery = useCallback(async () => {
    try {
      const { data } = await api.get("/site/delivery-config");
      setDelivery(data);
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  useEffect(() => {
    fetchDelivery();
  }, [fetchDelivery]);

  const addItem = async (productId, quantity = 1) => {
    try {
      await api.post("/cart/add", { product_id: productId, quantity });
      await fetchCart();
      return { ok: true };
    } catch (err) {
      const msg = err?.response?.data?.detail || "Failed to add to cart";
      toast.error(msg);
      return { ok: false, error: msg };
    }
  };
  const updateItem = async (productId, quantity) => {
    try {
      await api.post("/cart/update", { product_id: productId, quantity });
      await fetchCart();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to update cart");
    }
  };
  const removeItem = async (productId) => {
    await api.delete(`/cart/${productId}`);
    await fetchCart();
  };
  const clearCart = async () => {
    await api.delete("/cart");
    await fetchCart();
  };

  const itemCount = (cart?.items || []).reduce((s, it) => s + (it.quantity || 0), 0);

  return (
    <CartContext.Provider
      value={{ cart, delivery, fetchCart, addItem, updateItem, removeItem, clearCart, itemCount }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
