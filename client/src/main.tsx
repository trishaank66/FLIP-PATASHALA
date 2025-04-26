// Import HMR fix first - before any other modules
import "./vite-hmr-fix";

console.log("Application bootstrap starting...");

// Then import the React-related modules
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Create a helper function to render the app with retry mechanism
const renderApp = () => {
  // Make sure the root element exists and render the app
  const rootElement = document.getElementById("root");
  if (rootElement) {
    try {
      console.log("Rendering application to DOM...");
      createRoot(rootElement).render(<App />);
      console.log("Application rendered successfully!");
      
      // Add a visible notification for the user
      if (import.meta.env.DEV) {
        const loadingElement = document.getElementById("loading");
        if (loadingElement) {
          loadingElement.classList.add("hidden");
        }
        
        // Show a temporary success message
        const successMessage = document.createElement("div");
        successMessage.style.position = "fixed";
        successMessage.style.bottom = "20px";
        successMessage.style.left = "20px";
        successMessage.style.padding = "10px 15px";
        successMessage.style.backgroundColor = "#4CAF50";
        successMessage.style.color = "white";
        successMessage.style.borderRadius = "4px";
        successMessage.style.zIndex = "9999";
        successMessage.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
        successMessage.style.transition = "opacity 0.5s";
        successMessage.textContent = "Application loaded successfully!";
        
        document.body.appendChild(successMessage);
        
        setTimeout(() => {
          successMessage.style.opacity = "0";
          setTimeout(() => {
            if (document.body.contains(successMessage)) {
              document.body.removeChild(successMessage);
            }
          }, 500);
        }, 3000);
      }
    } catch (error) {
      console.error("Error rendering application:", error);
      // If rendering fails, try again after a short delay
      setTimeout(renderApp, 1000);
    }
  } else {
    console.error("Root element not found. Make sure the HTML has a div with id 'root'");
    // Try again after a delay if the root element isn't ready yet
    setTimeout(renderApp, 500);
  }
};

// Start rendering the app
renderApp();
