import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [cart, setCart] = useState({ items: [], subtotal: 0 });

  const fetchCart = useCallback(async () => {
    if (!user) {
      setCart({ items: [], subtotal: 0 });
      return;
    }
    try {
      const { data } = await api.get("/cart");
      setCart(data);
    } catch (e) {}
  }, [user]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const addItem = async (productId, quantity = 1) => {
    await api.post("/cart/add", { product_id: productId, quantity });
    await fetchCart();
  };
  const updateItem = async (productId, quantity) => {
    await api.post("/cart/update", { product_id: productId, quantity });
    await fetchCart();
  };
  const removeItem = async (productId) => {
    await api.delete(`/cart/${productId}`);
    await fetchCart();
  };

  return (
    <CartContext.Provider value={{ cart, fetchCart, addItem, updateItem, removeItem }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
