import type { CashSession, Product, Sale, StoreData, Payment } from '../electron/store'

export {}

declare global {
  interface Window {
    loja: {
      getState: () => Promise<StoreData>
      saveProduct: (input: Partial<Product>) => Promise<Product>
      deleteProduct: (id: string) => Promise<{ archived: boolean }>
      finalizeSale: (input: { items: { productId: string | null; name?: string; quantity: number; unitPrice?: number; description?: string }[]; payments: Payment[] }) => Promise<Sale>
      cancelSale: (id: string) => Promise<Sale>
      openCash: (openingAmount: number) => Promise<CashSession>
      closeCash: () => Promise<{ session: CashSession; salesCount: number; salesTotal: number; byPayment: Record<Payment['method'], number> }>
    }
  }
}
