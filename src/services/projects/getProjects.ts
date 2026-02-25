import logger from '../../utils/logger.js';
import { ensureApiClient, getApiClientForVersion } from '../core/apiClient.js';
import { ProjectQueryParams } from '../core/types.js';

/**
 * Fetches projects from the Teamwork API
 * @param params Optional query parameters for filtering projects
 * @returns The API response with project data
 */
export const getProjects = async (params?: ProjectQueryParams) => {
  try {
    logger.info('Fetching projects from Teamwork API');

    try {
      // Try with v3 API first
      const api = ensureApiClient();
      const response = await api.get('/projects.json', { params });
      logger.info('Successfully fetched projects using v3 API');

      // FIX: Prune the massive Teamwork payload
      if (response.data && response.data.projects) {
        return {
          projects: response.data.projects.map((p: any) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            status: p.status
          }))
        };
      }
    } catch (error: any) {
      logger.warn(`V3 API request failed: ${error.message}`);

      // Try the v1 API format as fallback
      logger.info('Trying v1 API format as fallback');
      try {
        const v1Api = getApiClientForVersion('v1');
        const v1Response = await v1Api.get('/projects.json', { params });
        logger.info('Successfully fetched projects using v1 API');
        if (v1Response.data && v1Response.data.projects) {
          return {
            projects: v1Response.data.projects.map((p: any) => ({
              id: p.id,
              name: p.name,
              description: p.description,
              status: p.status
            }))
          };
        }
      } catch (v1Error: any) {
        logger.error(`V1 API request also failed: ${v1Error.message}`);
        throw error; // Throw the original error
      }
    }
  } catch (error: any) {
    logger.error(`Teamwork API error: ${error.message}`);
    throw new Error('Failed to fetch projects from Teamwork API');
  }
};

export default getProjects; 