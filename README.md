# StoryInColor - AI Coloring Books

A web application for creating personalized coloring books using AI technology.

## Technologies Used

- **Frontend**: Next.js, React, Tailwind CSS, Shadcn UI
- **Backend**: Firebase (Authentication, Firestore, Storage)
- **Deployment**: GitHub Pages

## Features

- User authentication (email/password and Google sign-in)
- Create and manage coloring book projects
- Upload images and organize pages
- Preview coloring books before ordering
- Order tracking

## Setup Instructions

### Prerequisites

- Node.js (v18 or newer)
- npm or pnpm
- A Firebase project

### Firebase Setup

1. Create a new Firebase project at [firebase.google.com](https://firebase.google.com)
2. Enable the following services:
   - Authentication (Email/Password and Google providers)
   - Firestore Database
   - Storage
3. Set up Firestore security rules (see below)
4. Create a web app in your Firebase project and copy the configuration

### Local Development

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/story-in-color.git
   cd story-in-color
   ```

2. Install dependencies
   ```bash
   npm install
   # or
   pnpm install
   ```

3. Create a `.env.local` file in the root directory with your Firebase configuration:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
   NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
   ```

4. Start the development server
   ```bash
   npm run dev
   # or
   pnpm dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### GitHub Pages Deployment

This application is configured to be deployed to GitHub Pages. The deployment is handled automatically through GitHub Actions.

### How it works

1. When you push to the `main` branch, GitHub Actions will:
   - Build the Next.js app with static export
   - Deploy it to GitHub Pages
   - Make it available at `https://[your-username].github.io/aibooks/`

### Setting up the deployment

1. Create a GitHub repository secret named `env` containing all environment variables:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-auth-domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-storage-bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
   NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your-measurement-id
   ```

2. Set up GitHub Pages:
   - Go to your repository settings
   - Navigate to Pages
   - Select "GitHub Actions" as the source

3. Update Firebase Authentication:
   - Go to Firebase Console > Authentication > Settings
   - Add your GitHub Pages domain to Authorized domains

4. Update Firebase Storage CORS:
   - Run `firebase storage:cors set cors.json --project [your-project-id]`

### Local Development

To run the project locally:

```bash
# Install dependencies
npm install

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Building for Production

```bash
# Build the project
npm run build

# Preview the build
npx serve out
```

## Project Structure

- **app/** - Next.js application routes and components
- **components/** - Reusable UI components
- **public/** - Static assets
- **.github/workflows/** - GitHub Actions workflow configuration

## Firestore Security Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow users to read and write their own data
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Public data can be read by anyone but only written by authenticated users
    match /public/{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

## Storage Security Rules

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Allow users to read and write their own files
    match /users/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Public files can be read by anyone but only written by authenticated users
    match /public/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

## License

[MIT](LICENSE)

## Technologies

- Next.js 15
- Firebase (Authentication, Firestore, Storage)
- Tailwind CSS
- shadcn/ui components

<!-- Deployment trigger: 1 --> 