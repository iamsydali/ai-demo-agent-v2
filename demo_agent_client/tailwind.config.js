// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      "./src/**/*.{js,jsx,ts,tsx}", // This line is crucial
      "./public/index.html",
    ],
    theme: {
      extend: {},
    },
    plugins: [],
  }