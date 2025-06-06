
"use client";

import type { CartItem, Product, ShippingAddress } from '@/types';
import React, { createContext, useState, useEffect, ReactNode, useContext, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface CartContextType {
  cartItems: CartItem[];
  shippingAddress: ShippingAddress | null;
  paymentMethod: string | null;
  addToCart: (product: Product, quantity: number, customizations?: Record<string, any>, customizedPrice?: number) => void;
  removeFromCart: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  setShippingAddress: (address: ShippingAddress) => void;
  setPaymentMethod: (method: string) => void;
  cartSubtotal: number;
  cartTotalItems: number;
  loading: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const generateCartItemId = (productId: string, customizations?: Record<string, any>): string => {
  if (!customizations || Object.keys(customizations).length === 0) {
    return productId;
  }
  const sortedCustomizations = Object.entries(customizations)
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([key, value]) => `${key}:${value}`)
    .join('|');
  return `${productId}_${sortedCustomizations}`;
};

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [shippingAddress, setShippingAddressState] = useState<ShippingAddress | null>(null);
  const [paymentMethod, setPaymentMethodState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    setLoading(true);
    try {
      const storedCart = localStorage.getItem('zellowCart');
      if (storedCart) {
        setCartItems(JSON.parse(storedCart));
      }
      const storedShippingAddress = localStorage.getItem('zellowShippingAddress');
      if (storedShippingAddress) {
        setShippingAddressState(JSON.parse(storedShippingAddress));
      }
       const storedPaymentMethod = localStorage.getItem('zellowPaymentMethod');
      if (storedPaymentMethod) {
        setPaymentMethodState(storedPaymentMethod);
      }
    } catch (error) {
      console.error("Failed to load cart from localStorage", error);
      localStorage.removeItem('zellowCart');
      localStorage.removeItem('zellowShippingAddress');
      localStorage.removeItem('zellowPaymentMethod');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading) {
      localStorage.setItem('zellowCart', JSON.stringify(cartItems));
    }
  }, [cartItems, loading]);

  useEffect(() => {
    if (!loading && shippingAddress) {
      localStorage.setItem('zellowShippingAddress', JSON.stringify(shippingAddress));
    } else if (!loading && !shippingAddress) {
      localStorage.removeItem('zellowShippingAddress');
    }
  }, [shippingAddress, loading]);

  useEffect(() => {
    if (!loading && paymentMethod) {
        localStorage.setItem('zellowPaymentMethod', paymentMethod);
    } else if (!loading && !paymentMethod) {
        localStorage.removeItem('zellowPaymentMethod');
    }
  }, [paymentMethod, loading]);


  const addToCart = useCallback((product: Product, quantity: number, customizations?: Record<string, any>, customizedPrice?: number) => {
    const cartItemId = generateCartItemId(product.id, customizations);
    const pricePerUnit = customizedPrice !== undefined ? customizedPrice : product.price;
    let toastInfo: Parameters<typeof toast>[0] | null = null;

    setCartItems(prevItems => {
      const existingItem = prevItems.find(item => item.cartItemId === cartItemId);
      if (product.stock === 0) {
        toastInfo = { title: "Out of Stock", description: `${product.name} is currently out of stock.`, variant: "destructive" };
        return prevItems;
      }
      if (existingItem) {
        const newQuantity = existingItem.quantity + quantity;
        if (newQuantity > product.stock) {
          toastInfo = { title: "Stock Limit", description: `Only ${product.stock} units of ${product.name} available.`, variant: "destructive" };
          return prevItems.map(item => item.cartItemId === cartItemId ? { ...item, quantity: product.stock } : item);
        }
        toastInfo = { title: "Item Updated", description: `${product.name} quantity updated in cart.` };
        return prevItems.map(item => item.cartItemId === cartItemId ? { ...item, quantity: newQuantity } : item);
      } else {
        let newQuantity = quantity;
        if (quantity > product.stock) {
          toastInfo = { title: "Stock Limit", description: `Only ${product.stock} units of ${product.name} available. Added ${product.stock} to cart.`, variant: "destructive" };
          newQuantity = product.stock;
        } else {
          toastInfo = { title: "Item Added", description: `${product.name} added to cart.` };
        }
        return [...prevItems, {
          productId: product.id,
          name: product.name,
          unitPrice: product.price,
          currentPrice: pricePerUnit,
          imageUrl: product.imageUrl,
          quantity: newQuantity,
          stock: product.stock,
          customizations,
          cartItemId,
        }];
      }
    });

    if (toastInfo) {
      toast(toastInfo);
    }
  }, [toast]);

  const removeFromCart = useCallback((cartItemId: string) => {
    setCartItems(prevItems => prevItems.filter(item => item.cartItemId !== cartItemId));
    toast({ title: "Item Removed", description: "Item removed from cart." });
  }, [toast]);

  const updateQuantity = useCallback((cartItemId: string, quantity: number) => {
    let toastInfo: Parameters<typeof toast>[0] | null = null;
    let itemActuallyRemoved = false;

    setCartItems(prevItems => {
      const itemToUpdate = prevItems.find(item => item.cartItemId === cartItemId);
      if (!itemToUpdate) return prevItems;

      if (quantity <= 0) {
        itemActuallyRemoved = true;
        return prevItems.filter(item => item.cartItemId !== cartItemId);
      }
      if (quantity > itemToUpdate.stock) {
        toastInfo = { title: "Stock Limit", description: `Only ${itemToUpdate.stock} units of ${itemToUpdate.name} available.`, variant: "destructive" };
        return prevItems.map(item => item.cartItemId === cartItemId ? { ...item, quantity: itemToUpdate.stock } : item);
      }
      return prevItems.map(item => item.cartItemId === cartItemId ? { ...item, quantity } : item);
    });

    if (itemActuallyRemoved) {
      toast({ title: "Item Removed", description: "Item quantity set to 0 and removed from cart." });
    } else if (toastInfo) {
      toast(toastInfo);
    }
  }, [toast]);

  const clearCart = useCallback(() => {
    setCartItems([]);
    setShippingAddressState(null);
    setPaymentMethodState(null);
    toast({ title: "Cart Cleared", description: "Your shopping cart is now empty." });
  }, [toast]);

  const setAddress = useCallback((address: ShippingAddress) => {
    setShippingAddressState(address);
  }, []);

  const setPayMethod = useCallback((method: string) => {
    setPaymentMethodState(method);
  }, []);

  const cartSubtotal = cartItems.reduce((total, item) => total + (item.currentPrice * item.quantity), 0);
  const cartTotalItems = cartItems.reduce((total, item) => total + item.quantity, 0);

  return (
    <CartContext.Provider value={{
      cartItems,
      shippingAddress,
      paymentMethod,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      setShippingAddress: setAddress,
      setPaymentMethod: setPayMethod,
      cartSubtotal,
      cartTotalItems,
      loading,
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
