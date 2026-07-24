import { createRoot } from "react-dom/client";
import Framework7 from "framework7/bundle";
import Framework7React from "framework7-react";

import "framework7/css/bundle";
import "framework7-icons/css/framework7-icons.css";
import "./index.css";

import App from "./App.tsx";

// oxlint's rules-of-hooks matches any `use*` call name; this is F7's plugin
// registration API, not a React hook.
// eslint-disable-next-line react-hooks/rules-of-hooks
Framework7.use(Framework7React);

// React 19 StrictMode's double-invoke of mount/unmount corrupts F7's
// imperative page-router bookkeeping, so it's deliberately not used here.
createRoot(document.getElementById("app")!).render(<App />);
