
"use client";

import type { CartItem, Product, ShippingAddress } from '@/types';
import React, { createContext, useState, useEffect, ReactNode, useContext, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface SelectedShippingMethodInfo {
  id: string;
  name: string;
  cost: number;
  duration: string;
}

interface CartContextType {
  cartItems: CartItem[];
  shippingAddress: ShippingAddress | null;
  paymentMethod: string | null;
  selectedShippingRegionId: string | null;
  selectedShippingMethodInfo: SelectedShippingMethodInfo | null;
  addToCart: (product: Product, quantity: number, customizations?: Record<string, any>, customizedPrice?: number) => void;
  removeFromCart: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  setShippingAddress: (address: ShippingAddress | null) => void; // Allow null to clear
  setPaymentMethod: (method: string | null) => void; // Allow null to clear
  setSelectedShippingRegionId: (regionId: string | null) => void; // Allow null to clear
  setSelectedShippingMethodInfo: (methodInfo: SelectedShippingMethodInfo | null) => void; // Allow null to clear
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
  const [selectedShippingRegionId, setSelectedShippingRegionIdState] = useState<string | null>(null);
  const [selectedShippingMethodInfo, setSelectedShippingMethodInfoState] = useState<SelectedShippingMethodInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    setLoading(true);
    try {
      const storedCart = localStorage.getItem('zellowCart');
      if (storedCart) setCartItems(JSON.parse(storedCart));
      
      const storedShippingAddress = localStorage.getItem('zellowShippingAddress');
      if (storedShippingAddress) setShippingAddressState(JSON.parse(storedShippingAddress));
      
      const storedPaymentMethod = localStorage.getItem('zellowPaymentMethod');
      if (storedPaymentMethod) setPaymentMethodState(storedPaymentMethod);

      const storedRegionId = localStorage.getItem('zellowSelectedRegionId');
      if (storedRegionId) setSelectedShippingRegionIdState(storedRegionId);

      const storedMethodInfo = localStorage.getItem('zellowSelectedMethodInfo');
      if (storedMethodInfo) setSelectedShippingMethodInfoState(JSON.parse(storedMethodInfo));

    } catch (error) {
      console.error("Failed to load cart from localStorage", error);
      localStorage.removeItem('zellowCart');
      localStorage.removeItem('zellowShippingAddress');
      localStorage.removeItem('zellowPaymentMethod');
      localStorage.removeItem('zellowSelectedRegionId');
      localStorage.removeItem('zellowSelectedMethodInfo');
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
    if (!loading) {
        if (shippingAddress) localStorage.setItem('zellowShippingAddress', JSON.stringify(shippingAddress));
        else localStorage.removeItem('zellowShippingAddress');
    }
  }, [shippingAddress, loading]);

  useEffect(() => {
    if (!loading) {
        if (paymentMethod) localStorage.setItem('zellowPaymentMethod', paymentMethod);
        else localStorage.removeItem('zellowPaymentMethod');
    }
  }, [paymentMethod, loading]);

  useEffect(() => {
    if (!loading) {
        if (selectedShippingRegionId) localStorage.setItem('zellowSelectedRegionId', selectedShippingRegionId);
        else localStorage.removeItem('zellowSelectedRegionId');
    }
  }, [selectedShippingRegionId, loading]);

  useEffect(() => {
    if (!loading) {
        if (selectedShippingMethodInfo) localStorage.setItem('zellowSelectedMethodInfo', JSON.stringify(selectedShippingMethodInfo));
        else localStorage.removeItem('zellowSelectedMethodInfo');
    }
  }, [selectedShippingMethodInfo, loading]);


  const addToCart = useCallback((product: Product, quantity: number, customizations?: Record<string, any>, customizedPrice?: number) => {
    const cartItemId = generateCartItemId(product.id, customizations);
    const pricePerUnit = customizedPrice !== undefined ? customizedPrice : product.price;
    
    let toastMessage: Parameters<typeof toast>[0] | null = null;

    setCartItems(prevItems => {
      const existingItem = prevItems.find(item => item.cartItemId === cartItemId);
      if (product.stock === 0) {
        toastMessage = { title: "Out of Stock", description: `${product.name} is currently out of stock.`, variant: "destructive" };
        return prevItems;
      }
      if (existingItem) {
        const newQuantity = existingItem.quantity + quantity;
        if (newQuantity > product.stock) {
          toastMessage = { title: "Stock Limit", description: `Only ${product.stock} units of ${product.name} available. Cart updated to max stock.`, variant: "destructive" };
          return prevItems.map(item => item.cartItemId === cartItemId ? { ...item, quantity: product.stock } : item);
        }
        toastMessage = { title: "Item Updated", description: `${product.name} quantity updated in cart.` };
        return prevItems.map(item => item.cartItemId === cartItemId ? { ...item, quantity: newQuantity } : item);
      } else {
        let newQuantity = quantity;
        if (quantity > product.stock) {
          toastMessage = { title: "Stock Limit", description: `Only ${product.stock} units of ${product.name} available. Added ${product.stock} to cart.`, variant: "destructive" };
          newQuantity = product.stock;
        } else {
          toastMessage = { title: "Item Added", description: `${product.name} added to cart.` };
        }
        if (newQuantity > 0) {
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
        return prevItems; // If newQuantity is 0 (e.g. stock was 0 and quantity was higher)
      }
    });
     if (toastMessage) {
        toast(toastMessage);
     }
  }, [toast]);

  const removeFromCart = useCallback((cartItemId: string) => {
    setCartItems(prevItems => prevItems.filter(item => item.cartItemId !== cartItemId));
    toast({ title: "Item Removed", description: "Item removed from cart." });
  }, [toast]);

  const updateQuantity = useCallback((cartItemId: string, quantity: number) => {
    let toastMessage: Parameters<typeof toast>[0] | null = null;
    let itemActuallyRemoved = false;

    setCartItems(prevItems => {
      const itemToUpdate = prevItems.find(item => item.cartItemId === cartItemId);
      if (!itemToUpdate) return prevItems;

      if (quantity <= 0) {
        itemActuallyRemoved = true;
        return prevItems.filter(item => item.cartItemId !== cartItemId);
      }
      if (quantity > itemToUpdate.stock) {
        toastMessage = { title: "Stock Limit", description: `Only ${itemToUpdate.stock} units of ${itemToUpdate.name} available.`, variant: "destructive" };
        return prevItems.map(item => item.cartItemId === cartItemId ? { ...item, quantity: itemToUpdate.stock } : item);
      }
      return prevItems.map(item => item.cartItemId === cartItemId ? { ...item, quantity } : item);
    });
    
    if(itemActuallyRemoved) {
      toast({ title: "Item Removed", description: "Item quantity set to 0 and removed from cart." });
    } else if (toastMessage) {
       toast(toastMessage);
    }
  }, [toast]);

  const clearCart = useCallback(() => {
    setCartItems([]);
    setShippingAddressState(null);
    setPaymentMethodState(null);
    setSelectedShippingRegionIdState(null);
    setSelectedShippingMethodInfoState(null);
    toast({ title: "Cart Cleared", description: "Your shopping cart and checkout details are now empty." });
  }, [toast]);

  const cartSubtotal = cartItems.reduce((total, item) => total + (item.currentPrice * item.quantity), 0);
  const cartTotalItems = cartItems.reduce((total, item) => total + item.quantity, 0);

  return (
    <CartContext.Provider value={{
      cartItems,
      shippingAddress,
      paymentMethod,
      selectedShippingRegionId,
      selectedShippingMethodInfo,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      setShippingAddress: setShippingAddressState,
      setPaymentMethod: setPaymentMethodState,
      setSelectedShippingRegionId: setSelectedShippingRegionIdState,
      setSelectedShippingMethodInfo: setSelectedShippingMethodInfoState,
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

