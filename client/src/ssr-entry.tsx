import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { Router as WouterRouter } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import App from "./App";

export function renderLocationApp(url: string): string {
  const location = memoryLocation({
    path: url,
    static: true,
  });

  return renderToString(
    createElement(
      WouterRouter,
      {
        hook: location.hook,
        searchHook: location.searchHook,
      },
      createElement(App)
    )
  );
}
