/**
 * QdrantClient
 *
 * Minimal wrapper around the Qdrant HTTP API. This client implements the same
 * high‑level operations used by the existing PostgresClient (upsert, search,
 * delete) so that it can be swapped in the SDK without touching the rest of the
 * code base.
 *
 * The implementation purposefully avoids any third‑party Qdrant packages and
 * relies only on the native `fetch` API (available in Node ≥18). If `fetch` is
 * not present, the user must polyfill it.
 *
 * Configuration object:
 *   {
 *     url:        string  // Base URL of the Qdrant instance, e.g. "http://localhost:6333"
 *     apiKey:     string  // Optional API key (if Qdrant is secured)
 *     collection: string  // Name of the collection to work with
 *   }
 */

class QdrantClient {
  /**
   * @param {Object} config
   * @param {string} config.url        Base URL of Qdrant (no trailing slash)
   * @param {string} [config.apiKey]   API key for authentication
   * @param {string} config.collection Name of the collection to use
   */
  constructor({ url, apiKey, collection }) {
    if (!url) {
      throw new Error('QdrantClient: "url" is required in configuration.');
    }
    if (!collection) {
      throw new Error('QdrantClient: "collection" is required in configuration.');
    }

    // Normalise the URL (remove trailing slashes)
    this.baseUrl = url.replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.collection = collection;
  }

  /**
   * Insert or update a batch of points.
   *
   * @param {Array<Object>} points
   *   Each point must contain:
   *     - id: string|number
   *     - vector: number[]
   *     - payload?: object (optional metadata)
   * @returns {Promise<Object>} Raw Qdrant response
   */
  async upsert(points) {
    if (!Array.isArray(points) || points.length === 0) {
      throw new Error('QdrantClient.upsert: points must be a non‑empty array.');
    }

    const url = `${this.baseUrl}/collections/${encodeURIComponent(
      this.collection,
    )}/points?wait=true`;

    const body = {
      points: points.map(p => ({
        id: p.id,
        vector: p.vector,
        payload: p.payload || {},
      })),
    };

    const response = await fetch(url, {
      method: 'PUT',
      headers: this._headers(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Qdrant upsert failed (${response.status}): ${text}`);
    }

    return response.json();
  }

  /**
   * Search for the nearest neighbours of a vector.
   *
   * @param {number[]} vector          Query vector
   * @param {Object} [options]
   * @param {Object} [options.filter] Optional Qdrant filter object
   * @param {number} [options.limit]  Number of results to return (default 10)
   * @returns {Promise<Array<Object>>} Array of matching points
   */
  async search(vector, { filter = null, limit = 10 } = {}) {
    if (!Array.isArray(vector) || vector.length === 0) {
      throw new Error('QdrantClient.search: vector must be a non‑empty array.');
    }

    const url = `${this.baseUrl}/collections/${encodeURIComponent(
      this.collection,
    )}/points/search`;

    const body = {
      vector,
      limit,
      filter,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Qdrant search failed (${response.status}): ${text}`);
    }

    const data = await response.json();
    // Qdrant returns { result: [ { id, score, payload, ... }, ... ] }
    return data.result || [];
  }

  /**
   * Delete points by their IDs.
   *
   * @param {Array<string|number>} ids
   * @returns {Promise<Object>} Raw Qdrant response
   */
  async delete(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error('QdrantClient.delete: ids must be a non‑empty array.');
    }

    const url = `${this.baseUrl}/collections/${encodeURIComponent(
      this.collection,
    )}/points/delete`;

    const body = {
      points: ids,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Qdrant delete failed (${response.status}): ${text}`);
    }

    return response.json();
  }

  /**
   * Internal helper to build request headers.
   * @returns {Object}
   */
  _headers() {
    const headers = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['api-key'] = this.apiKey;
    }
    return headers;
  }
}

module.exports = { QdrantClient };
