
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
  
  // Gift related state
  isGiftOrder: boolean;
  giftRecipientName: string;
  giftRecipientContactMethod: 'email' | 'phone' | '';
  giftRecipientContactValue: string;
  giftMessage: string;
  notifyRecipient: boolean;
  showPricesToRecipient: boolean;
  giftRecipientCanViewAndTrack: boolean; // New state

  addToCart: (product: Product, quantity: number, customizations?: Record<string, any>, customizedPrice?: number) => void;
  removeFromCart: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  setShippingAddress: (address: ShippingAddress | null) => void;
  setPaymentMethod: (method: string | null) => void;
  setSelectedShippingRegionId: (regionId: string | null) => void;
  setSelectedShippingMethodInfo: (methodInfo: SelectedShippingMethodInfo | null) => void;

  // Gift related setters
  setIsGiftOrder: (isGift: boolean) => void;
  setGiftRecipientName: (name: string) => void;
  setGiftRecipientContactMethod: (method: 'email' | 'phone' | '') => void;
  setGiftRecipientContactValue: (value: string) => void;
  setGiftMessage: (message: string) => void;
  setNotifyRecipient: (notify: boolean) => void;
  setShowPricesToRecipient: (show: boolean) => void;
  setGiftRecipientCanViewAndTrack: (canView: boolean) => void; // New setter

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
  
  // Gift states
  const [isGiftOrder, setIsGiftOrderState] = useState<boolean>(false);
  const [giftRecipientName, setGiftRecipientNameState] = useState<string>('');
  const [giftRecipientContactMethod, setGiftRecipientContactMethodState] = useState<'email' | 'phone' | ''>('');
  const [giftRecipientContactValue, setGiftRecipientContactValueState] = useState<string>('');
  const [giftMessage, setGiftMessageState] = useState<string>('');
  const [notifyRecipient, setNotifyRecipientState] = useState<boolean>(false);
  const [showPricesToRecipient, setShowPricesToRecipientState] = useState<boolean>(false);
  const [giftRecipientCanViewAndTrack, setGiftRecipientCanViewAndTrackState] = useState<boolean>(true); // Defaults to true

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

      // Load gift details
      const storedIsGiftOrder = localStorage.getItem('zellowIsGiftOrder');
      if (storedIsGiftOrder) setIsGiftOrderState(JSON.parse(storedIsGiftOrder));
      const storedGiftRecipientName = localStorage.getItem('zellowGiftRecipientName');
      if (storedGiftRecipientName) setGiftRecipientNameState(storedGiftRecipientName);
      const storedGiftRecipientContactMethod = localStorage.getItem('zellowGiftRecipientContactMethod') as 'email' | 'phone' | '';
      if (storedGiftRecipientContactMethod) setGiftRecipientContactMethodState(storedGiftRecipientContactMethod);
      const storedGiftRecipientContactValue = localStorage.getItem('zellowGiftRecipientContactValue');
      if (storedGiftRecipientContactValue) setGiftRecipientContactValueState(storedGiftRecipientContactValue);
      const storedGiftMessage = localStorage.getItem('zellowGiftMessage');
      if (storedGiftMessage) setGiftMessageState(storedGiftMessage);
      const storedNotifyRecipient = localStorage.getItem('zellowNotifyRecipient');
      if (storedNotifyRecipient) setNotifyRecipientState(JSON.parse(storedNotifyRecipient));
      const storedShowPrices = localStorage.getItem('zellowShowPricesToRecipient');
      if (storedShowPrices) setShowPricesToRecipientState(JSON.parse(storedShowPrices));
      const storedCanView = localStorage.getItem('zellowGiftRecipientCanViewAndTrack');
      if (storedCanView) setGiftRecipientCanViewAndTrackState(JSON.parse(storedCanView));


    } catch (error) {
      console.error("Failed to load cart/checkout state from localStorage", error);
      // Clear all relevant localStorage items on error to prevent corrupted state
      ['zellowCart', 'zellowShippingAddress', 'zellowPaymentMethod', 'zellowSelectedRegionId', 'zellowSelectedMethodInfo', 
       'zellowIsGiftOrder', 'zellowGiftRecipientName', 'zellowGiftRecipientContactMethod', 'zellowGiftRecipientContactValue', 
       'zellowGiftMessage', 'zellowNotifyRecipient', 'zellowShowPricesToRecipient', 'zellowGiftRecipientCanViewAndTrack']
      .forEach(key => localStorage.removeItem(key));
    } finally {
      setLoading(false);
    }
  }, []);

  // Save cartItems
  useEffect(() => { if (!loading) localStorage.setItem('zellowCart', JSON.stringify(cartItems)); }, [cartItems, loading]);
  // Save shippingAddress
  useEffect(() => { if (!loading) { if (shippingAddress) localStorage.setItem('zellowShippingAddress', JSON.stringify(shippingAddress)); else localStorage.removeItem('zellowShippingAddress'); } }, [shippingAddress, loading]);
  // Save paymentMethod
  useEffect(() => { if (!loading) { if (paymentMethod) localStorage.setItem('zellowPaymentMethod', paymentMethod); else localStorage.removeItem('zellowPaymentMethod'); } }, [paymentMethod, loading]);
  // Save selectedShippingRegionId
  useEffect(() => { if (!loading) { if (selectedShippingRegionId) localStorage.setItem('zellowSelectedRegionId', selectedShippingRegionId); else localStorage.removeItem('zellowSelectedRegionId'); } }, [selectedShippingRegionId, loading]);
  // Save selectedShippingMethodInfo
  useEffect(() => { if (!loading) { if (selectedShippingMethodInfo) localStorage.setItem('zellowSelectedMethodInfo', JSON.stringify(selectedShippingMethodInfo)); else localStorage.removeItem('zellowSelectedMethodInfo'); } }, [selectedShippingMethodInfo, loading]);

  // Save gift details
  useEffect(() => { if (!loading) localStorage.setItem('zellowIsGiftOrder', JSON.stringify(isGiftOrder)); }, [isGiftOrder, loading]);
  useEffect(() => { if (!loading) localStorage.setItem('zellowGiftRecipientName', giftRecipientName); }, [giftRecipientName, loading]);
  useEffect(() => { if (!loading) localStorage.setItem('zellowGiftRecipientContactMethod', giftRecipientContactMethod); }, [giftRecipientContactMethod, loading]);
  useEffect(() => { if (!loading) localStorage.setItem('zellowGiftRecipientContactValue', giftRecipientContactValue); }, [giftRecipientContactValue, loading]);
  useEffect(() => { if (!loading) localStorage.setItem('zellowGiftMessage', giftMessage); }, [giftMessage, loading]);
  useEffect(() => { if (!loading) localStorage.setItem('zellowNotifyRecipient', JSON.stringify(notifyRecipient)); }, [notifyRecipient, loading]);
  useEffect(() => { if (!loading) localStorage.setItem('zellowShowPricesToRecipient', JSON.stringify(showPricesToRecipient)); }, [showPricesToRecipient, loading]);
  useEffect(() => { if (!loading) localStorage.setItem('zellowGiftRecipientCanViewAndTrack', JSON.stringify(giftRecipientCanViewAndTrack)); }, [giftRecipientCanViewAndTrack, loading]);


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
        return prevItems; 
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
    // Clear gift states
    setIsGiftOrderState(false);
    setGiftRecipientNameState('');
    setGiftRecipientContactMethodState('');
    setGiftRecipientContactValueState('');
    setGiftMessageState('');
    setNotifyRecipientState(false);
    setShowPricesToRecipientState(false);
    setGiftRecipientCanViewAndTrackState(true); // Reset to default
    // Toast is removed from here, success page will handle it.
    // toast({ title: "Cart Cleared", description: "Your shopping cart and checkout details are now empty." });
  }, []);

  const cartSubtotal = cartItems.reduce((total, item) => total + (item.currentPrice * item.quantity), 0);
  const cartTotalItems = cartItems.reduce((total, item) => total + item.quantity, 0);

  return (
    <CartContext.Provider value={{
      cartItems,
      shippingAddress,
      paymentMethod,
      selectedShippingRegionId,
      selectedShippingMethodInfo,
      
      isGiftOrder,
      giftRecipientName,
      giftRecipientContactMethod,
      giftRecipientContactValue,
      giftMessage,
      notifyRecipient,
      showPricesToRecipient,
      giftRecipientCanViewAndTrack,

      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      setShippingAddress: setShippingAddressState,
      setPaymentMethod: setPaymentMethodState,
      setSelectedShippingRegionId: setSelectedShippingRegionIdState,
      setSelectedShippingMethodInfo: setSelectedShippingMethodInfoState,
      
      setIsGiftOrder: setIsGiftOrderState,
      setGiftRecipientName: setGiftRecipientNameState,
      setGiftRecipientContactMethod: setGiftRecipientContactMethodState,
      setGiftRecipientContactValue: setGiftRecipientContactValueState,
      setGiftMessage: setGiftMessageState,
      setNotifyRecipient: setNotifyRecipientState,
      setShowPricesToRecipient: setShowPricesToRecipientState,
      setGiftRecipientCanViewAndTrack: setGiftRecipientCanViewAndTrackState,

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
