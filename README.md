# Ayancheri Family Tree

An interactive, responsive family tree application built with React, TypeScript, and Vite. This application visualizes family relationships and allows users to search, view, and safely suggest edits to the family data.

## Features

- **Interactive Visualization**: Zoom, pan, and click on nodes to fluidly navigate the family tree.
- **Search Functionality**: Quickly find family members by their first or last name.
- **Edit Mode**: Users can propose additions, edits, or deletions directly from the UI. Submissions are verified via Google reCAPTCHA to prevent spam.
- **Responsive Design**: Fully optimized for both desktop and mobile viewing with a native app-like full-screen layout.
- **Modern Aesthetic**: A sleek, dark-themed UI built for comfortable viewing.

## Tech Stack

- **Framework**: [React](https://reactjs.org/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Charting Engine**: [family-chart (f3)](https://www.npmjs.com/package/family-chart)
- **Security**: Google reCAPTCHA v2

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/akshayxml/ayancheri.git
   cd ayancheri
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Environment Variables *(Optional)*:
   Create a `.env` file in the root directory if you need to override the default reCAPTCHA site key:
   ```env
   VITE_RECAPTCHA_SITE_KEY=your_recaptcha_site_key
   ```

### Development

Run the local development server with hot-module replacement:
```bash
npm run dev
```

### Build

To build the application for production:
```bash
npm run build
```

## Data Structure

Family data is managed in `src/data.ts`. The application expects an array of objects representing individuals, containing their IDs, relationships, names, birthdays, and avatar links.

## Contributing

- **Family Data**: Switch to "Edit Mode" in the application to securely submit changes or additions to the family tree directly.
- **Code**: For codebase contributions, please fork the repository and submit a pull request.
