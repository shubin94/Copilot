import { google } from "googleapis";
import { JWT } from "google-auth-library";
import * as fs from "fs";
import * as path from "path";

// Action types for Google Indexing API
export type IndexingAction = "URL_UPDATED" | "URL_DELETED";

interface IndexingRequest {
  url: string;
  type: IndexingAction;
}

interface IndexingResponse {
  success: boolean;
  message: string;
  url: string;
}

/**
 * Google Indexing Service
 * Notifies Google Search Console about URL changes immediately
 * Supports both URL_UPDATED (new/modified pages) and URL_DELETED actions
 */
export class GoogleIndexingService {
  private jwtClient: JWT | null = null;
  private isInitialized = false;
  private indexingApiClient: any = null;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize JWT authentication using Google Service Account
   * Expects GOOGLE_SERVICE_ACCOUNT_JSON environment variable or file at default path
   */
  private initialize() {
    try {
      const serviceAccountPath =
        process.env.GOOGLE_SERVICE_ACCOUNT_JSON ||
        path.join(process.cwd(), "google-service-account.json");

      // Check if file exists
      if (!fs.existsSync(serviceAccountPath)) {
        console.warn(`⚠️  Google Service Account file not found at ${serviceAccountPath}`);
        console.warn(
          "📌 To enable Google Indexing API, place your service account JSON file in the project root"
        );
        console.warn(
          "   Or set GOOGLE_SERVICE_ACCOUNT_JSON environment variable with absolute path"
        );
        return;
      }

      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf-8"));

      // Create JWT client
      this.jwtClient = new JWT({
        email: serviceAccount.client_email,
        key: serviceAccount.private_key,
        scopes: [
          "https://www.googleapis.com/auth/indexing",
          "https://www.googleapis.com/auth/webmasters.readonly",
        ],
      });

      // Create Indexing API client
      this.indexingApiClient = google.indexing({
        version: "v3",
        auth: this.jwtClient,
      });

      this.isInitialized = true;
      console.log("✅ Google Indexing Service initialized successfully");
    } catch (error) {
      console.warn("⚠️  Failed to initialize Google Indexing Service:", error);
      console.warn("   Indexing requests will be logged but not sent to Google");
    }
  }

  /**
   * Send a single URL to Google Indexing API
   * @param url - The URL to index
   * @param type - Action type: URL_UPDATED (new/modified) or URL_DELETED
   */
  async submitUrl(url: string, type: IndexingAction = "URL_UPDATED"): Promise<IndexingResponse> {
    // Validate URL
    if (!url || !this.isValidUrl(url)) {
      return {
        success: false,
        message: "Invalid URL provided",
        url,
      };
    }

    // Log the request regardless of initialization status
    console.log(`📝 Google Indexing: ${type} - ${url}`);

    // If not initialized, return success but note it wasn't actually sent
    if (!this.isInitialized) {
      console.log(
        "⏸️  Skipped actual indexing (service account not configured) - would have indexed:",
        url
      );
      return {
        success: true,
        message: "Logged for indexing (service account not configured - dry run mode)",
        url,
      };
    }

    try {
      // Send to Google Indexing API
      const response = await this.indexingApiClient.urlNotifications.publish({
        requestBody: {
          url,
          type,
        },
      });

      if (response.status === 200) {
        console.log(`✅ Google Indexing successful: ${type} - ${url}`);
        return {
          success: true,
          message: `Successfully submitted ${type} request to Google`,
          url,
        };
      }

      return {
        success: false,
        message: `Google API returned status ${response.status}`,
        url,
      };
    } catch (error) {
      console.error(`❌ Google Indexing failed for ${url}:`, error);
      return {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : String(error)}`,
        url,
      };
    }
  }

  /**
   * Batch submit multiple URLs to Google Indexing API
   * @param urls - Array of URLs to index
   * @param type - Action type for all URLs
   * @param delayMs - Delay between requests (default 100ms to avoid rate limits)
   */
  async submitBatch(
    urls: string[],
    type: IndexingAction = "URL_UPDATED",
    delayMs: number = 100
  ): Promise<IndexingResponse[]> {
    const results: IndexingResponse[] = [];

    for (let i = 0; i < urls.length; i++) {
      const result = await this.submitUrl(urls[i], type);
      results.push(result);

      // Add delay between requests to avoid rate limiting
      if (i < urls.length - 1) {
        await this.delay(delayMs);
      }
    }

    // Summary
    const successful = results.filter((r) => r.success).length;
    console.log(
      `📊 Batch indexing complete: ${successful}/${results.length} URLs indexed successfully`
    );

    return results;
  }

  /**
   * Validate if a URL is properly formatted
   */
  private isValidUrl(urlString: string): boolean {
    try {
      new URL(urlString);
      return urlString.startsWith("http://") || urlString.startsWith("https://");
    } catch {
      return false;
    }
  }

  /**
   * Delay helper for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if the service is properly initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get initialization status message
   */
  getStatus(): string {
    if (this.isInitialized) {
      return "✅ Google Indexing API is configured and ready";
    }
    return "⏸️  Google Indexing API is in dry-run mode (no service account configured)";
  }
}

// Export singleton instance
export const googleIndexing = new GoogleIndexingService();
