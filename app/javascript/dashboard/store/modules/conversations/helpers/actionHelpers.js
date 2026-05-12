import types from '../../../mutation-types';

export const setPageFilter = ({ dispatch, filter, page, markEndReached }) => {
  dispatch('conversationPage/setCurrentPage', { filter, page }, { root: true });
  if (markEndReached) {
    dispatch('conversationPage/setEndReached', { filter }, { root: true });
  }
};

export const setContacts = (commit, chatList) => {
  commit(
    `contacts/${types.SET_CONTACTS}`,
    chatList.map(chat => chat.meta.sender)
  );
};

export const isOnMentionsView = ({ route: { name: routeName } }) => {
  const MENTION_ROUTES = [
    'conversation_mentions',
    'conversation_through_mentions',
  ];
  return MENTION_ROUTES.includes(routeName);
};

export const isOnUnattendedView = ({ route: { name: routeName } }) => {
  const UNATTENDED_ROUTES = [
    'conversation_unattended',
    'conversation_through_unattended',
  ];
  return UNATTENDED_ROUTES.includes(routeName);
};

export const isOnFoldersView = ({ route: { name: routeName } }) => {
  const FOLDER_ROUTES = [
    'folder_conversations',
    'conversations_through_folders',
  ];
  return FOLDER_ROUTES.includes(routeName);
};

// Maps filter attribute_key values to getters on the conversation object
const FILTER_ATTRIBUTE_GETTERS = {
  status: c => c.status,
  assignee_id: c => c.meta?.assignee?.id,
  team_id: c => c.meta?.team?.id,
  inbox_id: c => c.inbox_id,
  label: c => c.labels || [],
  priority: c => c.priority,
};

// Filter values can be raw primitives or objects with an `id` (e.g. {id: 42, name: '...'})
const normalizeValues = values =>
  (values || []).map(v => (v !== null && typeof v === 'object' ? v.id : v));

const evaluateOperator = (operator, convValue, filterValues) => {
  const normalized = normalizeValues(filterValues);
  switch (operator) {
    case 'equal_to':
      return Array.isArray(convValue)
        ? normalized.some(v => convValue.includes(v))
        : normalized.includes(convValue);
    case 'not_equal_to':
      return Array.isArray(convValue)
        ? !normalized.some(v => convValue.includes(v))
        : !normalized.includes(convValue);
    case 'contains':
      return Array.isArray(convValue)
        ? normalized.every(v => convValue.includes(v))
        : String(convValue ?? '').includes(String(normalized[0] ?? ''));
    case 'does_not_contain':
      return Array.isArray(convValue)
        ? !normalized.some(v => convValue.includes(v))
        : !String(convValue ?? '').includes(String(normalized[0] ?? ''));
    case 'is_present':
      return convValue !== null && convValue !== undefined && convValue !== '';
    case 'is_not_present':
      return convValue === null || convValue === undefined || convValue === '';
    default:
      return true; // unknown operator → be permissive
  }
};

/**
 * Evaluates whether a conversation matches the given filter payload.
 *
 * The payload is an array of filter conditions where each item has:
 *   { attribute_key, filter_operator, values, query_operator }
 *
 * `query_operator` on item[i] is the logical connector between item[i] and item[i+1].
 * The last item's query_operator is expected to be null/undefined.
 *
 * For unknown attribute keys we return `true` (permissive) so we never block a
 * conversation that might actually match on the server side.
 */
export const conversationMatchesFilters = (conversation, filterPayload) => {
  if (!filterPayload || !filterPayload.length) return true;

  let result = null;

  for (let i = 0; i < filterPayload.length; i++) {
    const { attribute_key, filter_operator, values } = filterPayload[i];
    // The operator that joins the *previous* result with this filter's result
    const queryOperator = i > 0 ? filterPayload[i - 1].query_operator : null;

    const getter = FILTER_ATTRIBUTE_GETTERS[attribute_key];
    // If we don't know how to evaluate this attribute, be permissive
    const matches = getter
      ? evaluateOperator(filter_operator, getter(conversation), values)
      : true;

    if (result === null) {
      result = matches;
    } else if (queryOperator === 'OR') {
      result = result || matches;
    } else {
      result = result && matches; // default: AND
    }
  }

  return result === null ? true : result;
};

export const buildConversationList = (
  context,
  requestPayload,
  responseData,
  filterType
) => {
  const { payload: conversationList, meta: metaData } = responseData;
  context.commit(types.SET_ALL_CONVERSATION, conversationList);
  context.dispatch('conversationStats/set', metaData);
  context.dispatch(
    'conversationLabels/setBulkConversationLabels',
    conversationList
  );
  context.commit(types.CLEAR_LIST_LOADING_STATUS);
  setContacts(context.commit, conversationList);
  setPageFilter({
    dispatch: context.dispatch,
    filter: filterType,
    page: requestPayload.page,
    markEndReached: !conversationList.length,
  });
};
