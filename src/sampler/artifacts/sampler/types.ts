export interface Sampler0 {
  user: User;
}

export interface User {
  id: number;
  name: string;
  email: string;
  roles: string[];
  metadata: Metadata;
}

export interface Metadata {
  createdAt: Date;
  updatedAt: Date;
  lastLogin: Date;
}

export interface Sampler1 {
  product: Product;
}

export interface Product {
  sku: string;
  name: string;
  price: number;
  inventory: Inventory;
  categories: string[];
  specifications: Specifications;
}

export interface Inventory {
  quantity: number;
  warehouse: string;
  reserved: number;
}

export interface Specifications {
  weight: string;
  dimensions: Dimensions;
  color: string;
}

export interface Dimensions {
  width: number;
  height: number;
  depth: number;
}

export interface Sampler2 {
  transaction: Transaction;
}

export interface Transaction {
  id: string;
  amount: number;
  currency: string;
  status: string;
  items: Item[];
  customer: Customer;
  timestamps: Timestamps;
}

export interface Customer {
  id: string;
  email: string;
  shippingAddress: ShippingAddress;
}

export interface ShippingAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface Item {
  productId: string;
  quantity: number;
  price: number;
}

export interface Timestamps {
  initiated: Date;
  processed: Date;
  completed: Date;
}
