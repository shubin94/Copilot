import { renderToPipeableStream } from "react-dom/server";
import type { Response } from "express";
import { Router as WouterRouter } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import App from "./App";

/**
 * ✅ OPTIMIZATION: Streaming SSR with renderToPipeableStream
 * 
 * Instead of waiting for the entire React component tree to render,
 * we stream HTML to the response as soon as the shell is ready.
 * This dramatically reduces Time to First Byte (TTFB).
 * 
 * Architecture:
 * 1. onShellReady: Called when initial shell HTML is ready → send headers + root div opening
 * 2. Stream: React renders components into root div as data becomes available
 * 3. onError: Called if error occurs → log error but continue streaming fallback HTML
 */
export function renderLocationApp(url: string, htmlShell: string, res: Response): Promise<void> {
  return new Promise((resolve, reject) => {
    const location = memoryLocation({
      path: url,
      static: true,
    });

    const routerProps = {
      hook: location.hook,
      searchHook: location.searchHook,
    } as unknown as { hook: typeof location.hook };

    // Create the pipeable stream for the React app
    const stream = renderToPipeableStream(
      <WouterRouter {...routerProps}>
        <App />
      </WouterRouter>,
      {
        /**
         * Called when the shell (critical content) is ready to send.
         * This includes all Suspense boundaries marked with <Suspense fallback>.
         * 
         * At this point:
         * - Critical UI elements are rendered
         * - HTML headers and root div have been generated
         * - Non-critical data might still be loading (but won't block response)
         * 
         * We immediately send this to the client for faster first paint.
         */
        onShellReady() {
          // Set response headers - critical for streaming
          if (!res.headersSent) {
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            // Don't set Cache-Control here; let the caller set it for consistency
          }

          // Inject the React shell into the template
          // Format: htmlShell already contains <div id="root">START_ROOT_CONTENT</div>
          // We get the React-generated markup and inject it
          const beforeRoot = htmlShell.substring(0, htmlShell.indexOf('<div id="root">') + '<div id="root">'.length);
          const afterRoot = htmlShell.substring(htmlShell.indexOf('</div>'));

          // Send the initial HTML shell up to the root div opening tag
          res.write(beforeRoot);

          // Start piping the React stream directly into the root div
          stream.pipe(res);

          // When the stream completes, close the root div and send the rest of the HTML
          // This is handled by the stream's 'end' event
          res.on('finish', () => {
            res.write(afterRoot);
          });
        },

        /**
         * Called when the entire tree has been rendered and all content is available.
         * At this point, the shell HTML has already been sent to the client.
         * This callback is informational; the response will be closed automatically.
         */
        onAllReady() {
          // All content is ready - stream will finish naturally
          // No action needed; pipe will handle it
        },

        /**
         * Called when React encounters an error during SSR.
         * 
         * Recovery strategy:
         * 1. Log the error for debugging
         * 2. Continue streaming fallback HTML (already rendered shell protects us)
         * 3. Let the browser handle client-side hydration gracefully
         */
        onError(error: unknown) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error('[SSR Stream Error]', {
            message: errorMsg,
            url,
            stack: error instanceof Error ? error.stack : undefined,
          });
          
          // The shell has already been sent, so we can't change status code
          // Just ensure the stream is ended gracefully
          try {
            res.write('<!-- SSR Error: Check server logs for details -->');
          } catch (writeErr) {
            // Response might be closed; that's okay
          }
        },
      }
    );

    // Handle stream completion
    stream.on('end', () => {
      resolve();
    });

    // Handle stream errors
    stream.on('error', (error: unknown) => {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[SSR Stream Pipe Error]', {
        message: errorMsg,
        url,
        stack: error instanceof Error ? error.stack : undefined,
      });
      reject(error);
    });

    // Ensure response is properly closed
    res.on('error', (error: unknown) => {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[SSR Response Error]', {
        message: errorMsg,
        url,
      });
      stream.destroy();
      reject(error);
    });
  });
}
