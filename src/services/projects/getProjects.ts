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
    const apiParams: ProjectQueryParams = { ...(params || {}) };

    if (!apiParams.include || apiParams.include.length === 0) {
      apiParams.include = ['tags', 'projectCategories', 'users', 'projectOwners', 'createdBy', 'updatedBy'];
    }
    if (!apiParams['fields[projects]']) {
      apiParams['fields[projects]'] = ['id', 'name'];
    }
    if (!apiParams['fields[tags]']) {
      apiParams['fields[tags]'] = ['id', 'name', 'color', 'count'];
    }
    if (!apiParams['fields[workflows]']) {
      apiParams['fields[workflows]'] = ['id', 'name', 'statusId'];
    }
    if (!apiParams['fields[stages]']) {
      apiParams['fields[stages]'] = ['id', 'name', 'stage'];
    }

    try {
      // Try with v3 API first
      const api = ensureApiClient();
      const response = await api.get('/projects.json', { params: apiParams });
      logger.info('Successfully fetched projects using v3 API');
      return response.data;
    } catch (error: any) {
      logger.warn(`V3 API request failed: ${error.message}`);

      // Try the v1 API format as fallback
      logger.info('Trying v1 API format as fallback');
      try {
        const v1Api = getApiClientForVersion('v1');
        const v1Response = await v1Api.get('/projects.json', { params });
        logger.info('Successfully fetched projects using v1 API');
        return v1Response.data;
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
