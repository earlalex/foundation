import { Type } from '../core/validator.js';
import { AccessSchema, LinkSchema, MediaSchema, PreviewSchema } from './common.js';

export const ProductSchema = {
  type: Type.string,                       // "product"
  id: Type.string,
  title: Type.string,
  description: Type.string,
  longFormText: Type.array,                // Product description / details
  
  // Pricing and payment options
  pricing: Type.object({
    basePrice: Type.number,                 // Base price in cents
    currency: Type.string,                  // e.g., "USD"
    paymentType: Type.string,               // "full_upfront", "retainer_invoice", "invoice_only"
    retainerAmount: Type.optional(Type.number), // For retainer+invoice: upfront retainer amount in cents
    retainerPercentage: Type.optional(Type.number), // Alternative: percentage of total for retainer
  }),
  
  // Stripe integration
  stripe: Type.optional(Type.object({
    productId: Type.string,                 // Stripe Product ID
    priceId: Type.string,                   // Stripe Price ID
    invoiceTemplateId: Type.optional(Type.string), // Stripe Invoice template ID
    enableAch: Type.optional(Type.boolean), // Enable ACH Direct Debit Payment ($5 Platform Fee Applied)
  })),
  
  // Product details
  category: Type.string,                   // Product category
  sku: Type.optional(Type.string),          // Stock keeping unit
  stock: Type.optional(Type.number),        // Available stock (null for digital/services)
  
  access: Type.optional(AccessSchema),
  
  media: Type.optional(MediaSchema),
  images: Type.optional(Type.array),
  preview: Type.optional(PreviewSchema),
  
  links: Type.optional(Type.array),
  
  // Invoice tracking
  invoiceSettings: Type.optional(Type.object({
    autoGenerateInvoice: Type.boolean,      // Auto-generate invoice on purchase
    invoiceDueDays: Type.number,            // Days until invoice is due
    paymentTerms: Type.string,              // Payment terms text
    googleContactLink: Type.optional(Type.string) // Link to Google Contact for invoicing
  })),

  // Direct Crypto and NFT
  enableCryptoPayment: Type.optional(Type.boolean),
  enableNftCounterpart: Type.optional(Type.boolean),
  nftMetadata: Type.optional(Type.object),

  // Etsy-Style Physical / Handmade Attributes
  isPhysicalProduct: Type.optional(Type.boolean),
  isHandmade: Type.optional(Type.boolean),
  inventory: Type.optional(Type.object),
  craftDetails: Type.optional(Type.object),
  variations: Type.optional(Type.array),
  shippingOptions: Type.optional(Type.object)
};
