/**
 * AJAX Utility Module
 * Provides centralized HTTP request handling with error management
 */

class AjaxClient {
    constructor(baseURL = '') {
        this.baseURL = baseURL;
        this.defaultHeaders = {
            'Content-Type': 'application/json'
        };
        this.requestInterceptors = [];
        this.responseInterceptors = [];
    }

    /**
     * Set default headers for all requests
     */
    setHeaders(headers) {
        this.defaultHeaders = { ...this.defaultHeaders, ...headers };
    }

    /**
     * Add request interceptor
     */
    addRequestInterceptor(fn) {
        this.requestInterceptors.push(fn);
    }

    /**
     * Add response interceptor
     */
    addResponseInterceptor(fn) {
        this.responseInterceptors.push(fn);
    }

    /**
     * Core fetch wrapper with error handling
     */
    async request(endpoint, options = {}) {
        const url = this.baseURL + endpoint;
        const config = {
            ...options,
            headers: {
                ...this.defaultHeaders,
                ...options.headers
            }
        };

        // Run request interceptors
        for (const interceptor of this.requestInterceptors) {
            await interceptor(config);
        }

        try {
            const response = await fetch(url, config);

            // Run response interceptors
            for (const interceptor of this.responseInterceptors) {
                await interceptor(response);
            }

            // Handle non-OK responses
            if (!response.ok) {
                const error = await this.handleError(response);
                throw error;
            }

            // Parse response based on Content-Type
            const contentType = response.headers.get('Content-Type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }

            return await response.text();
        } catch (error) {
            console.error(`AJAX Error [${config.method || 'GET'}] ${url}:`, error);
            throw error;
        }
    }

    /**
     * Handle HTTP errors
     */
    async handleError(response) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        let errorData = null;

        try {
            errorData = await response.json();
            if (errorData.message) {
                errorMessage = errorData.message;
            }
        } catch (e) {
            // If response is not JSON, use text
            try {
                errorMessage = await response.text();
            } catch (textError) {
                // Use default error message
            }
        }

        const error = new Error(errorMessage);
        error.status = response.status;
        error.data = errorData;
        return error;
    }

    /**
     * GET request
     */
    async get(endpoint, params = {}, options = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;

        return this.request(url, {
            ...options,
            method: 'GET'
        });
    }

    /**
     * POST request
     */
    async post(endpoint, data = {}, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * PUT request
     */
    async put(endpoint, data = {}, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    /**
     * PATCH request
     */
    async patch(endpoint, data = {}, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    }

    /**
     * DELETE request
     */
    async delete(endpoint, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'DELETE'
        });
    }

    /**
     * Upload file with FormData
     */
    async upload(endpoint, formData, options = {}) {
        // Remove Content-Type header to let browser set it with boundary
        const headers = { ...options.headers };
        delete headers['Content-Type'];

        return this.request(endpoint, {
            ...options,
            method: 'POST',
            headers,
            body: formData
        });
    }
}

// Create default instance
const ajax = new AjaxClient('/api');

// Add global error interceptor
ajax.addResponseInterceptor(async (response) => {
    if (response.status === 401) {
        // Unauthorized - redirect to login
        if (!window.location.pathname.includes('login')) {
            window.location.href = '/views/login.html';
        }
    }
});

// Export both class and instance
window.AjaxClient = AjaxClient;
window.ajax = ajax;
