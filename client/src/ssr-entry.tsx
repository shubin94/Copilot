import { renderToString } from "react-dom/server";
import { Router as WouterRouter } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import App from "./App";

export function renderLocationApp(url: string): string {
  const location = memoryLocation({
    path: url,
    static: true,
  });

  const routerProps = {
    hook: location.hook,
    searchHook: location.searchHook,
  } as unknown as { hook: typeof location.hook };

  return renderToString(
    <WouterRouter {...routerProps}>
      <App />
    </WouterRouter>
  );

}
