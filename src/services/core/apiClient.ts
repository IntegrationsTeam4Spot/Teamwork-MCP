import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import logger from '../../utils/logger.js';
import config from '../../utils/config.js';

// Debug environment variables
logger.info(`TEAMWORK_DOMAIN: ${config.domain}`);
logger.info(`Constructed API URL: ${config.apiUrl}`);
logger.info(`TEAMWORK_USERNAME: ${config.username}`);
logger.info(`TEAMWORK_PASSWORD length: ${config.password ? config.password.length : 0}`);

// Create auth header with debugging
const username = config.username;
const password = config.password;
const authString = `${username}:${password}`;
const base64Auth = Buffer.from(authString).toString('base64');
logger.info(`Auth string length: ${authString.length}, Base64 auth length: ${base64Auth.length}`);

// Configure Teamwork API clients
let teamworkApiV3: AxiosInstance | null = null;
let teamworkApiV1: AxiosInstance | null = null;

const safeJsonStringify = (value: any): string => {
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
};

/**
 * Constructs the Teamwork API URL for a specific version
 * @param version API version (v1, v3, etc.)
 * @returns The API URL for the specified version
 */
export const getApiUrlForVersion = (version: string = 'v3'): string => {
  if (!config.domain) {
    logger.error('Teamwork domain is not set');
    return '';
  }
  
  // Remove any http/https prefix if present
  const cleanDomain = config.domain.replace(/^(https?:\/\/)/, '');
  
  // Remove .teamwork.com if present (in case user enters full domain)
  const baseDomain = cleanDomain.replace(/\.teamwork\.com$/, '');
  
  // Remove any trailing slashes
  const trimmedDomain = baseDomain.replace(/\/+$/, '');
  
  // For v1 API, the URL format is different
  if (version === 'v1') {
    return `https://${trimmedDomain}.teamwork.com/`;
  }
  
  // For v3 and other versions
  return `https://${trimmedDomain}.teamwork.com/projects/api/${version}/`;
};

/**
 * Creates an API client for a specific Teamwork API version
 * @param version API version (v1, v3, etc.)
 * @returns Configured Axios instance for the specified API version
 */
export const createApiClientForVersion = (version: string = 'v3'): AxiosInstance | null => {
  try {
    const apiUrl = getApiUrlForVersion(version);
    
    if (!apiUrl) {
      throw new Error(`Invalid or empty Teamwork API URL for version ${version}`);
    }
    
    logger.info(`Creating API client for version ${version} with baseURL: ${apiUrl}`);
    
    const api = axios.create({
      baseURL: apiUrl,
      headers: {
        'Authorization': `Basic ${base64Auth}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Log request interceptor for debugging
    api.interceptors.request.use((request: InternalAxiosRequestConfig) => {
      // Remove any prefix / from the url
      const url = request.url?.replace(/^\/+/, '');
      logger.info(`Request URL: ${request.baseURL}${url}`);
      logger.info(`Request method: ${request.method?.toUpperCase()}`);
      
      // Don't log full headers to avoid exposing auth credentials in logs
      const safeHeaders = { ...request.headers };
      if (safeHeaders.Authorization) {
        safeHeaders.Authorization = 'Basic ***** (redacted)';
      }
      logger.info(`Request headers: ${safeJsonStringify(safeHeaders)}`);
      
      // Log request body for POST/PUT/PATCH requests
      if (request.data && ['post', 'put', 'patch'].includes(request.method || '')) {
        logger.info(`Request body: ${safeJsonStringify(request.data)}`);
      }
      
      // Log query parameters if present
      if (request.params) {
        logger.info(`Request params: ${safeJsonStringify(request.params)}`);
      }
      
      return request;
    }, (error: AxiosError) => {
      logger.error(`Request setup error: ${error.message}`);
      if (error.stack) {
        logger.error(`Stack trace: ${error.stack}`);
      }
      return Promise.reject(error);
    });
    
    // Log response interceptor for debugging
    api.interceptors.response.use((response: AxiosResponse) => {
      logger.info(`Response status: ${response.status} ${response.statusText}`);
      
      // Log response headers
      logger.verbose(`Response headers: ${safeJsonStringify(response.headers)}`);
      
      // Log response data preview
      const dataType = typeof response.data;
      if (dataType === 'object' && response.data !== null) {
        logger.info(`4️⃣`);
        if (Array.isArray(response.data)) {
          logger.info(`5️⃣`);
          logger.info(`Response data: Array with ${response.data.length} items`);
          if (response.data.length > 0) {
            logger.info(`6️⃣`);
            logger.info(`First item sample: ${safeJsonStringify(response.data[0]).substring(0, 200)}...`);
          }
        } else {
          logger.info(`7️⃣`);
          const keys = Object.keys(response.data);
          logger.info(`Response data: Object with keys [${keys.join(', ')}]`);
          logger.info(`Data preview: ${safeJsonStringify(response.data).substring(0, 200)}...`);
        }
      } else {
        logger.info(`Response data type: ${dataType}`);
      }
      
      return response;
    }, (error: AxiosError) => {
      logger.info(`8️⃣`);
      if (error.response) {
        logger.error(`Response error: ${error.response.status} - ${error.response.statusText}`);
        logger.error(`Response headers: ${safeJsonStringify(error.response.headers)}`);
        
        // Log response data if available
        if (error.response.data) {
          logger.error(`Response data: ${safeJsonStringify(error.response.data)}`);
        }
      } else if (error.request) {
        logger.error(`Request error (no response received): ${error.message}`);
        logger.error(`Request details: ${safeJsonStringify({
          method: error.config?.method,
          url: error.config?.url,
          baseURL: error.config?.baseURL
        })}`);
      } else {
        logger.error(`Error setting up request: ${error.message}`);
      }
      
      if (error.config) {
        logger.error(`Request config: ${safeJsonStringify({
          url: error.config.url,
          method: error.config.method,
          baseURL: error.config.baseURL,
          timeout: error.config.timeout
        })}`);
      }
      
      if (error.stack) {
        logger.error(`Stack trace: ${error.stack}`);
      }
      
      return Promise.reject(error);
    });
    
    return api;
  } catch (error: any) {
    logger.error(`Failed to create Teamwork API client for version ${version}: ${error.message}`);
    return null;
  }
};

// Helper function to create and configure the default API client (v3)
export const createApiClient = (): AxiosInstance | null => {
  return createApiClientForVersion('v3');
};

// Initialize the default API client (v3)
teamworkApiV3 = createApiClient();

// Helper function to check if default API client (v3) is initialized
export const ensureApiClient = (): AxiosInstance => {
  if (!teamworkApiV3) {
    teamworkApiV3 = createApiClient();
    if (!teamworkApiV3) {
      const errorMsg = 'Teamwork API client (v3) is not initialized. Please check your configuration.';
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }
  }
  return teamworkApiV3;
};

/**
 * Gets or creates an API client for a specific version
 * @param version API version (v1, v3, etc.)
 * @returns Axios instance for the specified API version
 */
export const getApiClientForVersion = (version: string = 'v3'): AxiosInstance => {
  // For v3 API (default), use the existing client
  if (version === 'v3') {
    return ensureApiClient();
  }
  
  // For v1 API
  if (version === 'v1') {
    if (!teamworkApiV1) {
      teamworkApiV1 = createApiClientForVersion('v1');
      if (!teamworkApiV1) {
        const errorMsg = 'Teamwork API client (v1) could not be initialized. Please check your configuration.';
        logger.error(errorMsg);
        throw new Error(errorMsg);
      }
    }
    return teamworkApiV1;
  }
  
  // For any other version, create a new client each time
  const apiClient = createApiClientForVersion(version);
  if (!apiClient) {
    const errorMsg = `Teamwork API client (${version}) could not be initialized. Please check your configuration.`;
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }
  return apiClient;
};

export default {
  createApiClient,
  ensureApiClient,
  createApiClientForVersion,
  getApiClientForVersion
}; 
