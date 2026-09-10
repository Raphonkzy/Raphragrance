// CartContext stub: cart feature removed, website is now info-only.
// This file is kept to avoid import errors in any remaining references.

import { createContext, useContext } from "react";

const CartContext = createContext({});

export function CartProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useCart(): any {
  return useContext(CartContext);
}
