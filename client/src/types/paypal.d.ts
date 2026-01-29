// PayPal SDK type definitions
declare global {
  interface Window {
    paypal?: {
      Buttons: (options: {
        createOrder?: (data: any, actions: any) => string | Promise<string>;
        onApprove?: (data: any, actions: any) => Promise<void>;
        onError?: (error: any) => void;
        onCancel?: () => void;
      }) => {
        render: (selector: string | Element) => Promise<void>;
      };
    };
  }
}

export {};
