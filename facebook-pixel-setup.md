# Facebook Pixel Setup Guide for StoryInColor

## Overview
Facebook Pixel tracking has been implemented to track conversions from your Facebook ads. The implementation tracks key user actions throughout the conversion funnel.

## Setup Steps

### 1. Get Your Facebook Pixel ID
1. Go to [Facebook Business Manager](https://business.facebook.com/)
2. Navigate to **Events Manager**
3. Select your Pixel or create a new one
4. Copy your Pixel ID (it looks like: `123456789012345`)

### 2. Configure Your Environment
Add your Pixel ID to your environment variables:

```bash
# In your .env.local file
NEXT_PUBLIC_FACEBOOK_PIXEL_ID=your_pixel_id_here

# To enable pixel in development (optional)
NEXT_PUBLIC_ENABLE_FB_PIXEL=true
```

### 3. Update Configuration
The Pixel ID is managed in `/lib/facebook-pixel-config.ts`. You can also directly edit this file if you prefer not to use environment variables.

## Events Being Tracked

### 1. Landing Page Events
- **Lead**: When users click "Start Free" buttons (Hero section, Pricing section)
- **InitiateCheckout**: When users click pricing CTAs

### 2. Registration Events  
- **CompleteRegistration**: When users successfully register via email or Google
- Tracks registration method (email vs google)

### 3. Purchase Events
- **Purchase**: When credit purchases are completed
- Includes value, currency, and number of credits purchased

### 4. Page Views
- **PageView**: Automatically tracked on all pages

## Testing Your Setup

### 1. Facebook Pixel Helper (Chrome Extension)
1. Install the [Facebook Pixel Helper](https://chrome.google.com/webstore/detail/facebook-pixel-helper/fdgfkebogiimcoedlicjlajpkdmockpc)
2. Visit your website
3. Check that the pixel is firing correctly

### 2. Events Manager
1. Go to Facebook Events Manager
2. Check the "Test Events" tab
3. You should see events coming through in real-time

### 3. Browser Console
The implementation includes console logging for debugging. Check your browser's developer console for tracking confirmations.

## Facebook Ads Manager Setup

### 1. Create Custom Conversions
In Facebook Ads Manager, create custom conversions for:
- **Lead Generation**: Track when users click "Start Free"
- **Registration**: Track successful sign-ups
- **Purchase**: Track credit purchases

### 2. Set Up Conversion Campaigns
When creating Facebook ad campaigns:
1. Choose "Conversions" as your campaign objective
2. Select your custom conversions as the optimization goal
3. Set your pixel as the conversion source

### 3. Attribution Settings
- Go to Events Manager > Settings
- Configure your attribution window (recommended: 7-day click, 1-day view)

## Advanced Tracking (Optional)

### Custom Parameters
Each event includes detailed parameters:
- `content_name`: Describes the specific action
- `content_category`: Groups similar actions
- `value`: Monetary value for purchases
- `currency`: Always set to 'USD'

### Server-Side Events (Future Enhancement)
Consider implementing Facebook Conversions API for more reliable tracking, especially with iOS 14.5+ privacy changes.

## Troubleshooting

### Common Issues
1. **Pixel not firing**: Check that `NEXT_PUBLIC_FACEBOOK_PIXEL_ID` is set correctly
2. **Events not showing**: Ensure you're in production mode or have `NEXT_PUBLIC_ENABLE_FB_PIXEL=true`
3. **Double-firing events**: Clear browser cache and test in incognito mode

### Debug Mode
Enable debug logging by checking your browser console. All pixel events log their details for troubleshooting.

## Privacy Compliance
- The implementation respects user privacy settings
- Events only fire when the pixel script loads successfully
- Consider adding cookie consent management for GDPR compliance

## Files Modified
- `/app/layout.tsx` - Pixel initialization
- `/components/tracking/facebook-pixel.tsx` - Main tracking component
- `/components/landing-page/hero-section.tsx` - Lead tracking
- `/components/landing-page/pricing-section.tsx` - Checkout tracking  
- `/app/login/page.tsx` - Registration tracking
- `/app/dashboard/page.tsx` - Purchase tracking
- `/lib/facebook-pixel-config.ts` - Configuration

## Next Steps
1. Replace `YOUR_FACEBOOK_PIXEL_ID` with your actual Pixel ID
2. Test the implementation using Facebook Pixel Helper
3. Create custom conversions in Facebook Ads Manager
4. Set up your Facebook ad campaigns with conversion tracking
5. Monitor performance in Facebook Events Manager 