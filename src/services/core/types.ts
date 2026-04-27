// Define interface for project query parameters
export interface ProjectQueryParams {
  // String parameters
  updatedAfter?: string;
  timeMode?: 'timelogs' | 'estimated';
  searchTerm?: string;
  reportType?: 'project' | 'health';
  reportTimezone?: string;
  reportFormat?: 'csv' | 'html' | 'pdf' | 'xls';
  projectType?: string;
  orderMode?: 'asc' | 'desc';
  orderBy?: 'companyname' | 'datecreated' | 'duedate' | 'lastactivity' | 'name' | 'namecaseinsensitive' | 'ownercompany' | 'starred' | 'categoryname';
  notCompletedBefore?: string;
  minLastActivityDate?: string;
  maxLastActivityDate?: string;
  
  // Integer parameters
  userId?: number;
  pageSize?: number;
  page?: number;
  orderByCustomFieldId?: number;
  minBudgetCapacityUsedPercent?: number;
  maxBudgetCapacityUsedPercent?: number;
  
  // Boolean parameters
  useFormulaFields?: boolean;
  skipCounts?: boolean;
  searchCompanies?: boolean;
  searchByLetter?: boolean;
  onlyStarredProjects?: boolean;
  onlyProjectsWithExplicitMembership?: boolean;
  onlyProjectsThatCanLogTime?: boolean;
  onlyArchivedProjects?: boolean;
  matchAllProjectTags?: boolean;
  matchAllExcludedTags?: boolean;
  isReportDownload?: boolean;
  includeTentativeProjects?: boolean;
  includeSubCategories?: boolean;
  includeStats?: boolean;
  includeProjectUserInfo?: boolean;
  includeProjectProfitability?: boolean;
  includeProjectDates?: boolean;
  includeCustomFields?: boolean;
  includeCounts?: boolean;
  includeCompletedStatus?: boolean;
  includeArchivedProjects?: boolean;
  hideObservedProjects?: boolean;
  alwaysIncludeFiltering?: boolean;
  
  // Array parameters
  usersWithExplicitMembershipIds?: number[];
  teamIds?: number[];
  selectedColumns?: string[];
  projectTagIds?: number[];
  projectStatuses?: ('active' | 'current' | 'late' | 'upcoming' | 'completed' | 'deleted' | 'archived' | 'inactive')[];
  projectOwnerIds?: number[];
  projectIds?: number[];
  projectHealths?: (0 | 1 | 2 | 3)[];
  projectCompanyIds?: number[];
  projectCategoryIds?: number[];
  includeCustomFieldIds?: number[];
  include?: string[];
  featuresEnabled?: string[];
  excludeTagIds?: number[];
  excludeProjectIds?: number[];
  
  // Field selection parameters
  'fields[workflows]'?: string[];
  'fields[users]'?: string[];
  'fields[tags]'?: string[];
  'fields[stages]'?: string[];
  'fields[workflowStages]'?: string[];
  'fields[projects]'?: string[];
  'fields[projectcategories]'?: string[];
  'fields[projectUpdates]'?: string[];
  'fields[projectBudgets]'?: string[];
  'fields[portfolioColumns]'?: string[];
  'fields[portfolioCards]'?: string[];
  'fields[portfolioBoards]'?: string[];
  'fields[industries]'?: string[];
  'fields[customfields]'?: string[];
  'fields[customfieldProjects]'?: string[];
  'fields[countries]'?: string[];
  'fields[companies]'?: string[];
  
  // Custom field filtering
  [key: string]: any; // For projectCustomField[id][op]=value format
}

// Task data interface
export interface TaskData {
  [key: string]: any;
}

// Response interfaces
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ProjectIdResponse {
  projectId: string | number;
} 
