
"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CheckCircle, ShoppingBag, Truck } from 'lucide-react';
import { useRouter } from "next/navigation";

interface OrderSuccessModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string | null;
}

export function OrderSuccessModal({ isOpen, onOpenChange, orderId }: OrderSuccessModalProps) {
  const router = useRouter();

  if (!orderId) return null;

  const handleTrackOrder = () => {
    onOpenChange(false);
    router.push(`/track/order/${orderId}`);
  };

  const handleContinueShopping = () => {
    onOpenChange(false);
    router.push('/products');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md text-center p-0 overflow-hidden">
        <div className="p-6 sm:p-8 pt-8 sm:pt-10">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-5" />
            <DialogHeader className="text-center space-y-0">
                <DialogTitle className="text-2xl sm:text-3xl font-headline font-bold text-primary mb-2">
                    Woohoo!
                </DialogTitle>
            </DialogHeader>
            <p className="text-lg font-semibold text-foreground mb-3">
                Your order has been placed
            </p>
            <DialogDescription className="text-sm text-muted-foreground mb-6">
                Order ID: <strong className="text-foreground/80">{orderId.substring(0,12)}...</strong>
            </DialogDescription>
            <p className="text-sm text-muted-foreground leading-relaxed mb-8">
                Pull up a chair, sit back and relax as your order is on its way to you!
            </p>
        </div>
        <DialogFooter className="bg-muted/50 p-4 flex-col sm:flex-row gap-3 sm:justify-between">
          <Button 
            onClick={handleTrackOrder} 
            className="w-full sm:flex-1"
            variant="default"
            size="lg"
          >
            <Truck className="mr-2 h-5 w-5" /> Track Order
          </Button>
          <Button 
            onClick={handleContinueShopping} 
            className="w-full sm:flex-1" 
            variant="outline"
            size="lg"
          >
            <ShoppingBag className="mr-2 h-5 w-5" /> Continue Shopping
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
