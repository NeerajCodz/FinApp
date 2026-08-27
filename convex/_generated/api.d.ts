/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accounts_domain from "../accounts/domain.js";
import type * as accounts_mutations from "../accounts/mutations.js";
import type * as accounts_queries from "../accounts/queries.js";
import type * as activity_domain from "../activity/domain.js";
import type * as activity_queries from "../activity/queries.js";
import type * as analytics_domain from "../analytics/domain.js";
import type * as analytics_insights from "../analytics/insights.js";
import type * as analytics_queries from "../analytics/queries.js";
import type * as auth from "../auth.js";
import type * as budgets_domain from "../budgets/domain.js";
import type * as budgets_mutations from "../budgets/mutations.js";
import type * as categories_domain from "../categories/domain.js";
import type * as categories_mutations from "../categories/mutations.js";
import type * as categories_queries from "../categories/queries.js";
import type * as dashboard_domain from "../dashboard/domain.js";
import type * as dashboard_queries from "../dashboard/queries.js";
import type * as export_domain from "../export/domain.js";
import type * as files_domain from "../files/domain.js";
import type * as goals_domain from "../goals/domain.js";
import type * as goals_mutations from "../goals/mutations.js";
import type * as groups_domain from "../groups/domain.js";
import type * as groups_mutations from "../groups/mutations.js";
import type * as groups_queries from "../groups/queries.js";
import type * as http from "../http.js";
import type * as notifications_domain from "../notifications/domain.js";
import type * as notifications_mutations from "../notifications/mutations.js";
import type * as recurring_domain from "../recurring/domain.js";
import type * as recurring_mutations from "../recurring/mutations.js";
import type * as search_domain from "../search/domain.js";
import type * as search_queries from "../search/queries.js";
import type * as settlements_domain from "../settlements/domain.js";
import type * as settlements_mutations from "../settlements/mutations.js";
import type * as shared_audit from "../shared/audit.js";
import type * as shared_auth from "../shared/auth.js";
import type * as shared_errors from "../shared/errors.js";
import type * as shared_money from "../shared/money.js";
import type * as shared_permissions from "../shared/permissions.js";
import type * as shared_validators from "../shared/validators.js";
import type * as splits_domain from "../splits/domain.js";
import type * as splits_mutations from "../splits/mutations.js";
import type * as transactions_domain from "../transactions/domain.js";
import type * as transactions_mutations from "../transactions/mutations.js";
import type * as transactions_queries from "../transactions/queries.js";
import type * as transactions_suggestions from "../transactions/suggestions.js";
import type * as users_domain from "../users/domain.js";
import type * as users_mutations from "../users/mutations.js";
import type * as users_queries from "../users/queries.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "accounts/domain": typeof accounts_domain;
  "accounts/mutations": typeof accounts_mutations;
  "accounts/queries": typeof accounts_queries;
  "activity/domain": typeof activity_domain;
  "activity/queries": typeof activity_queries;
  "analytics/domain": typeof analytics_domain;
  "analytics/insights": typeof analytics_insights;
  "analytics/queries": typeof analytics_queries;
  auth: typeof auth;
  "budgets/domain": typeof budgets_domain;
  "budgets/mutations": typeof budgets_mutations;
  "categories/domain": typeof categories_domain;
  "categories/mutations": typeof categories_mutations;
  "categories/queries": typeof categories_queries;
  "dashboard/domain": typeof dashboard_domain;
  "dashboard/queries": typeof dashboard_queries;
  "export/domain": typeof export_domain;
  "files/domain": typeof files_domain;
  "goals/domain": typeof goals_domain;
  "goals/mutations": typeof goals_mutations;
  "groups/domain": typeof groups_domain;
  "groups/mutations": typeof groups_mutations;
  "groups/queries": typeof groups_queries;
  http: typeof http;
  "notifications/domain": typeof notifications_domain;
  "notifications/mutations": typeof notifications_mutations;
  "recurring/domain": typeof recurring_domain;
  "recurring/mutations": typeof recurring_mutations;
  "search/domain": typeof search_domain;
  "search/queries": typeof search_queries;
  "settlements/domain": typeof settlements_domain;
  "settlements/mutations": typeof settlements_mutations;
  "shared/audit": typeof shared_audit;
  "shared/auth": typeof shared_auth;
  "shared/errors": typeof shared_errors;
  "shared/money": typeof shared_money;
  "shared/permissions": typeof shared_permissions;
  "shared/validators": typeof shared_validators;
  "splits/domain": typeof splits_domain;
  "splits/mutations": typeof splits_mutations;
  "transactions/domain": typeof transactions_domain;
  "transactions/mutations": typeof transactions_mutations;
  "transactions/queries": typeof transactions_queries;
  "transactions/suggestions": typeof transactions_suggestions;
  "users/domain": typeof users_domain;
  "users/mutations": typeof users_mutations;
  "users/queries": typeof users_queries;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
