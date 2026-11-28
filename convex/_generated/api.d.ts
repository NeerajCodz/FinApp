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
import type * as ai_a2ui from "../ai/a2ui.js";
import type * as ai_actions from "../ai/actions.js";
import type * as ai_agent from "../ai/agent.js";
import type * as ai_assistant from "../ai/assistant.js";
import type * as ai_assistantTools from "../ai/assistantTools.js";
import type * as ai_attachmentContent from "../ai/attachmentContent.js";
import type * as ai_attachments from "../ai/attachments.js";
import type * as ai_chatContext from "../ai/chatContext.js";
import type * as ai_chatShape from "../ai/chatShape.js";
import type * as ai_chatTools from "../ai/chatTools.js";
import type * as ai_config from "../ai/config.js";
import type * as ai_decisions from "../ai/decisions.js";
import type * as ai_errors from "../ai/errors.js";
import type * as ai_gemini from "../ai/gemini.js";
import type * as ai_heicConversion from "../ai/heicConversion.js";
import type * as ai_geminiChat from "../ai/geminiChat.js";
import type * as ai_importDomain from "../ai/importDomain.js";
import type * as ai_importTools from "../ai/importTools.js";
import type * as ai_keyVault from "../ai/keyVault.js";
import type * as ai_keys from "../ai/keys.js";
import type * as ai_manageActions from "../ai/manageActions.js";
import type * as ai_manageTools from "../ai/manageTools.js";
import type * as ai_mentions from "../ai/mentions.js";
import type * as ai_present from "../ai/present.js";
import type * as ai_prompts from "../ai/prompts.js";
import type * as ai_providers from "../ai/providers.js";
import type * as ai_receiptDomain from "../ai/receiptDomain.js";
import type * as ai_receipts from "../ai/receipts.js";
import type * as ai_records from "../ai/records.js";
import type * as ai_settings from "../ai/settings.js";
import type * as ai_spreadsheet from "../ai/spreadsheet.js";
import type * as ai_streamWriter from "../ai/streamWriter.js";
import type * as ai_toolArgs from "../ai/toolArgs.js";
import type * as ai_toolContext from "../ai/toolContext.js";
import type * as ai_usage from "../ai/usage.js";
import type * as ai_validators from "../ai/validators.js";
import type * as analytics_domain from "../analytics/domain.js";
import type * as analytics_insights from "../analytics/insights.js";
import type * as analytics_queries from "../analytics/queries.js";
import type * as auth from "../auth.js";
import type * as authEmailChallenges from "../authEmailChallenges.js";
import type * as avatars_domain from "../avatars/domain.js";
import type * as avatars_helpers from "../avatars/helpers.js";
import type * as avatars_mutations from "../avatars/mutations.js";
import type * as avatars_queries from "../avatars/queries.js";
import type * as categories_alerts from "../categories/alerts.js";
import type * as categories_fromBudgets from "../categories/fromBudgets.js";
import type * as categories_limits from "../categories/limits.js";
import type * as categories_mutations from "../categories/mutations.js";
import type * as categories_queries from "../categories/queries.js";
import type * as crons from "../crons.js";
import type * as dashboard_domain from "../dashboard/domain.js";
import type * as dashboard_queries from "../dashboard/queries.js";
import type * as directMessages_mutations from "../directMessages/mutations.js";
import type * as directMessages_queries from "../directMessages/queries.js";
import type * as export_domain from "../export/domain.js";
import type * as files_domain from "../files/domain.js";
import type * as goals_domain from "../goals/domain.js";
import type * as goals_mutations from "../goals/mutations.js";
import type * as groups_domain from "../groups/domain.js";
import type * as groups_ledger from "../groups/ledger.js";
import type * as groups_mutations from "../groups/mutations.js";
import type * as groups_queries from "../groups/queries.js";
import type * as http from "../http.js";
import type * as mcp from "../mcp.js";
import type * as mcpOAuth from "../mcpOAuth.js";
import type * as mcpOAuthActions from "../mcpOAuthActions.js";
import type * as mfa from "../mfa.js";
import type * as mfaDomain from "../mfaDomain.js";
import type * as migrations from "../migrations.js";
import type * as notifications_domain from "../notifications/domain.js";
import type * as notifications_mutations from "../notifications/mutations.js";
import type * as notifications_push from "../notifications/push.js";
import type * as presence_mutations from "../presence/mutations.js";
import type * as presence_queries from "../presence/queries.js";
import type * as qr from "../qr.js";
import type * as recurring_domain from "../recurring/domain.js";
import type * as recurring_mutations from "../recurring/mutations.js";
import type * as search_domain from "../search/domain.js";
import type * as search_queries from "../search/queries.js";
import type * as security from "../security.js";
import type * as settlements_domain from "../settlements/domain.js";
import type * as settlements_mutations from "../settlements/mutations.js";
import type * as shared_aiProviders from "../shared/aiProviders.js";
import type * as shared_audit from "../shared/audit.js";
import type * as shared_auth from "../shared/auth.js";
import type * as shared_authErrors from "../shared/authErrors.js";
import type * as shared_chat from "../shared/chat.js";
import type * as shared_clientId from "../shared/clientId.js";
import type * as shared_email from "../shared/email.js";
import type * as shared_errors from "../shared/errors.js";
import type * as shared_finaiSettings from "../shared/finaiSettings.js";
import type * as shared_mcpAuth from "../shared/mcpAuth.js";
import type * as shared_mcpClients from "../shared/mcpClients.js";
import type * as shared_money from "../shared/money.js";
import type * as shared_permissions from "../shared/permissions.js";
import type * as shared_validators from "../shared/validators.js";
import type * as shared_version from "../shared/version.js";
import type * as shared_voice from "../shared/voice.js";
import type * as social_mutations from "../social/mutations.js";
import type * as social_queries from "../social/queries.js";
import type * as splits_domain from "../splits/domain.js";
import type * as splits_mutations from "../splits/mutations.js";
import type * as sync_common from "../sync/common.js";
import type * as sync_queries from "../sync/queries.js";
import type * as sync_types from "../sync/types.js";
import type * as system from "../system.js";
import type * as transactions_domain from "../transactions/domain.js";
import type * as transactions_mutations from "../transactions/mutations.js";
import type * as transactions_queries from "../transactions/queries.js";
import type * as transactions_suggestions from "../transactions/suggestions.js";
import type * as trash from "../trash.js";
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
  "ai/a2ui": typeof ai_a2ui;
  "ai/actions": typeof ai_actions;
  "ai/agent": typeof ai_agent;
  "ai/assistant": typeof ai_assistant;
  "ai/assistantTools": typeof ai_assistantTools;
  "ai/attachmentContent": typeof ai_attachmentContent;
  "ai/attachments": typeof ai_attachments;
  "ai/chatContext": typeof ai_chatContext;
  "ai/chatShape": typeof ai_chatShape;
  "ai/chatTools": typeof ai_chatTools;
  "ai/config": typeof ai_config;
  "ai/decisions": typeof ai_decisions;
  "ai/errors": typeof ai_errors;
  "ai/gemini": typeof ai_gemini;
  "ai/heicConversion": typeof ai_heicConversion;
  "ai/geminiChat": typeof ai_geminiChat;
  "ai/importDomain": typeof ai_importDomain;
  "ai/importTools": typeof ai_importTools;
  "ai/keyVault": typeof ai_keyVault;
  "ai/keys": typeof ai_keys;
  "ai/manageActions": typeof ai_manageActions;
  "ai/manageTools": typeof ai_manageTools;
  "ai/mentions": typeof ai_mentions;
  "ai/present": typeof ai_present;
  "ai/prompts": typeof ai_prompts;
  "ai/providers": typeof ai_providers;
  "ai/receiptDomain": typeof ai_receiptDomain;
  "ai/receipts": typeof ai_receipts;
  "ai/records": typeof ai_records;
  "ai/settings": typeof ai_settings;
  "ai/spreadsheet": typeof ai_spreadsheet;
  "ai/streamWriter": typeof ai_streamWriter;
  "ai/toolArgs": typeof ai_toolArgs;
  "ai/toolContext": typeof ai_toolContext;
  "ai/usage": typeof ai_usage;
  "ai/validators": typeof ai_validators;
  "analytics/domain": typeof analytics_domain;
  "analytics/insights": typeof analytics_insights;
  "analytics/queries": typeof analytics_queries;
  auth: typeof auth;
  authEmailChallenges: typeof authEmailChallenges;
  "avatars/domain": typeof avatars_domain;
  "avatars/helpers": typeof avatars_helpers;
  "avatars/mutations": typeof avatars_mutations;
  "avatars/queries": typeof avatars_queries;
  "categories/alerts": typeof categories_alerts;
  "categories/fromBudgets": typeof categories_fromBudgets;
  "categories/limits": typeof categories_limits;
  "categories/mutations": typeof categories_mutations;
  "categories/queries": typeof categories_queries;
  crons: typeof crons;
  "dashboard/domain": typeof dashboard_domain;
  "dashboard/queries": typeof dashboard_queries;
  "directMessages/mutations": typeof directMessages_mutations;
  "directMessages/queries": typeof directMessages_queries;
  "export/domain": typeof export_domain;
  "files/domain": typeof files_domain;
  "goals/domain": typeof goals_domain;
  "goals/mutations": typeof goals_mutations;
  "groups/domain": typeof groups_domain;
  "groups/ledger": typeof groups_ledger;
  "groups/mutations": typeof groups_mutations;
  "groups/queries": typeof groups_queries;
  http: typeof http;
  mcp: typeof mcp;
  mcpOAuth: typeof mcpOAuth;
  mcpOAuthActions: typeof mcpOAuthActions;
  mfa: typeof mfa;
  mfaDomain: typeof mfaDomain;
  migrations: typeof migrations;
  "notifications/domain": typeof notifications_domain;
  "notifications/mutations": typeof notifications_mutations;
  "notifications/push": typeof notifications_push;
  "presence/mutations": typeof presence_mutations;
  "presence/queries": typeof presence_queries;
  qr: typeof qr;
  "recurring/domain": typeof recurring_domain;
  "recurring/mutations": typeof recurring_mutations;
  "search/domain": typeof search_domain;
  "search/queries": typeof search_queries;
  security: typeof security;
  "settlements/domain": typeof settlements_domain;
  "settlements/mutations": typeof settlements_mutations;
  "shared/aiProviders": typeof shared_aiProviders;
  "shared/audit": typeof shared_audit;
  "shared/auth": typeof shared_auth;
  "shared/authErrors": typeof shared_authErrors;
  "shared/chat": typeof shared_chat;
  "shared/clientId": typeof shared_clientId;
  "shared/email": typeof shared_email;
  "shared/errors": typeof shared_errors;
  "shared/finaiSettings": typeof shared_finaiSettings;
  "shared/mcpAuth": typeof shared_mcpAuth;
  "shared/mcpClients": typeof shared_mcpClients;
  "shared/money": typeof shared_money;
  "shared/permissions": typeof shared_permissions;
  "shared/validators": typeof shared_validators;
  "shared/version": typeof shared_version;
  "shared/voice": typeof shared_voice;
  "social/mutations": typeof social_mutations;
  "social/queries": typeof social_queries;
  "splits/domain": typeof splits_domain;
  "splits/mutations": typeof splits_mutations;
  "sync/common": typeof sync_common;
  "sync/queries": typeof sync_queries;
  "sync/types": typeof sync_types;
  system: typeof system;
  "transactions/domain": typeof transactions_domain;
  "transactions/mutations": typeof transactions_mutations;
  "transactions/queries": typeof transactions_queries;
  "transactions/suggestions": typeof transactions_suggestions;
  trash: typeof trash;
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
