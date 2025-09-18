Deno.test("it should work", () => {
  console.log({
    user: {
      id: 1,
      name: "John Doe",
      email: "john@example.com",
      roles: ["admin", "user"],
      metadata: {
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-15T12:30:00Z",
        lastLogin: "2024-01-20T09:15:00Z"
      }
    }
  });

  console.log({
    product: {
      sku: "PROD-001",
      name: "Widget Pro",
      price: 99.99,
      inventory: {
        quantity: 150,
        warehouse: "US-WEST-1",
        reserved: 25
      },
      categories: ["electronics", "gadgets"],
      specifications: {
        weight: "250g",
        dimensions: { width: 10, height: 5, depth: 2 },
        color: "Space Gray"
      }
    }
  });

  console.log({
    transaction: {
      id: "txn_abc123",
      amount: 1250.50,
      currency: "USD",
      status: "completed",
      items: [
        { productId: "PROD-001", quantity: 2, price: 199.98 },
        { productId: "PROD-002", quantity: 1, price: 1050.52 }
      ],
      customer: {
        id: "cust_xyz789",
        email: "customer@example.com",
        shippingAddress: {
          street: "123 Main St",
          city: "San Francisco",
          state: "CA",
          zip: "94105",
          country: "USA"
        }
      },
      timestamps: {
        initiated: "2024-01-20T10:00:00Z",
        processed: "2024-01-20T10:00:15Z",
        completed: "2024-01-20T10:01:00Z"
      }
    }
  });
});
