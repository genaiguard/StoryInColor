// Facebook Pixel Configuration
export const FACEBOOK_PIXEL_CONFIG = {
  // Your Facebook Pixel ID
  PIXEL_ID: '660006810196406',
  
  // Enable/disable tracking based on environment
  ENABLED: process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_ENABLE_FB_PIXEL === 'true'
}

// Event names for consistent tracking
export const FB_EVENTS = {
  PAGE_VIEW: 'PageView',
  LEAD: 'Lead',
  COMPLETE_REGISTRATION: 'CompleteRegistration',
  INITIATE_CHECKOUT: 'InitiateCheckout',
  ADD_TO_CART: 'AddToCart',
  PURCHASE: 'Purchase',
  VIEW_CONTENT: 'ViewContent'
} as const 