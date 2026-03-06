# Lumina Frontend

This repository contains the frontend application for the **Lumina** project, built using **React**, **Vite**, and **Tailwind CSS**. It provides a user interface for managing projects, analyzing data, and interacting with various workspace features.

## 🔧 Technologies

- **React** (v19)
- **Vite** as the development build tool
- **Tailwind CSS** for styling
- **React Router** for client-side navigation
- **Axios** for HTTP requests
- **Recharts**, **React Tooltip**, and **Lucide React** for visual components

## 🚀 Getting Started

### Prerequisites

- Node.js (recommended v18+)
- npm (bundled with Node.js)

### Installation

```bash
# Clone the repo (if not already done)
git clone <repository-url>

# Change directory
git checkout <branch> # or navigate into the project folder
cd lumina_frontend

# Install dependencies
npm install
```

### Development

Start the development server using Vite:

```bash
npm run dev
```

The application will be available at `http://localhost:5173` (default).

### Building for Production

```bash
npm run build
```

### Previewing the Production Build

```bash
npm run preview
```

### Linting

The project uses ESLint with basic configuration. Run:

```bash
npm run lint
```

## 📁 Project Structure

```
public/            # static files
src/
  api/             # axios configuration and API utilities
  assets/          # images, icons, etc.
  components/      # UI components
  pages/           # route-level components
  workspace/       # workspace-specific features and tools
  App.jsx
  main.jsx
```

## 📌 Notes

- This frontend is configured as an ES module project (`"type": "module"` in package.json).
- Tailwind CSS is integrated via PostCSS configuration.

## 🛠️ Contributing

Feel free to open issues or submit pull requests. Ensure code follows existing conventions and add appropriate documentation when modifying features.

