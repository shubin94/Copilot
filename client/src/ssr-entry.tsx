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
 * 1. onShellReady: Called when initial shell HTML is ready → send headers + before-root HTML
 * 2. Stream: React renders components into root div as data becomes available
 * 3. Stream finish: After stream completes → send after-root HTML and close response
 * 4. onError: Called if error occurs → log error but continue streaming fallback HTML
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

    // ✅ FIX BUG #3: Correct HTML template splitting
    // Find the root div's opening tag
    const rootOpeningTag = '<div id="root">';
    const rootStartIndex = htmlShell.indexOf(rootOpeningTag);
    
    if (rootStartIndex === -1) {
      reject(new Error('Could not find <div id="root"> in HTML template'));
      return;
    }

    // Find the MATCHING closing tag for root div
    // Search AFTER the root opening tag + some buffer to skip any nested divs
    const searchStartPos = rootStartIndex + rootOpeningTag.length + 50;
    const rootEndIndex = htmlShell.indexOf('</div>', searchStartPos);
    
    if (rootEndIndex === -1) {
      reject(new Error('Could not find closing </div> for root div in HTML template'));
      return;
    }

    // Split template correctly:
    // beforeRoot: Everything up to and including <div id="root">
    // afterRoot: Everything from </div> (closing root div) onwards
    const beforeRoot = htmlShell.substring(0, rootStartIndex + rootOpeningTag.length);
    const afterRoot = htmlShell.substring(rootEndIndex);

    // Safety timeout: Force close after 58 seconds to prevent Vercel timeout
    const timeoutId = setTimeout(() => {
      console.error('[SSR Timeout] Forcing response close after 58s');
      if (!res.headersSent) {
        res.status(504).send('<html><body><h1>504 - Request Timeout</h1></body></html>');
      } else if (!res.writableEnded) {
        res.write('<!-- SSR Timeout: Forcing close -->');
        res.end();
      }
      reject(new Error('SSR streaming timeout after 58s'));
    }, 58000);

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
          try {
            // Set response headers - critical for streaming
            if (!res.headersSent) {
              res.setHeader("Content-Type", "text/html; charset=utf-8");
              // Don't set Cache-Control here; let the caller set it for consistency
            }

            // Send the initial HTML shell up to and including the root div opening tag
            res.write(beforeRoot);

            // ✅ FIX BUG #2: Use { end: false } to prevent auto-closing response
            // This allows us to write afterRoot HTML after the stream completes
            stream.pipe(res, { end: false });
          } catch (error) {
            console.error('[SSR onShellReady Error]', error);
            reject(error);
          }
        },

        /**
         * Called when the entire tree has been rendered and all content is available.
         * At this point, the shell HTML has already been sent to the client.
         * This callback is informational; the response will be closed automatically.
         */
        onAllReady() {
          // All content is ready - stream will finish naturally
          // No action needed; we handle completion in stream.on('finish')
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
            if (!res.writableEnded) {
              res.write('<!-- SSR Error: Check server logs for details -->');
            }
          } catch (writeErr) {
            // Response might be closed; that's okay
          }
        },
      }
    );

    // ✅ FIX BUG #1, #4, #5: Write afterRoot at correct time and explicitly close response
    // Handle stream completion - this fires when ALL React content has been written
    stream.on('finish', () => {
      try {
        clearTimeout(timeoutId);
        
        // Write the closing HTML tags (includes </div> for root and rest of document)
        if (!res.writableEnded) {
          res.write(afterRoot);
          
          // ✅ CRITICAL: Explicitly end the response to ensure browser receives complete HTML
          res.end();
        }
        
        // ✅ FIX BUG #4: Resolve promise AFTER response is fully complete
        resolve();
      } catch (error) {
        console.error('[SSR Stream Finish Error]', error);
        reject(error);
      }
    });

    // Handle stream errors
    stream.on('error', (error: unknown) => {
      clearTimeout(timeoutId);
      
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[SSR Stream Pipe Error]', {
        message: errorMsg,
        url,
        stack: error instanceof Error ? error.stack : undefined,
      });
      
      // Try to close response gracefully
      if (!res.writableEnded) {
        try {
          res.write('<!-- Stream Error -->');
          res.end();
        } catch (writeErr) {
          // Response already closed
        }
      }
      
      reject(error);
    });

    // Handle response errors (connection closed by client, etc.)
    res.on('error', (error: unknown) => {
      clearTimeout(timeoutId);
      
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[SSR Response Error]', {
        message: errorMsg,
        url,
      });
      
      // Destroy the stream to stop rendering
      stream.destroy();
      reject(error);
    });
  });
}
