/**
 * GraphQL Security Plugins for Apollo Server
 * - Query Depth Limiting (max 7 levels)
 * - Query Complexity Analysis (max 1000 cost)
 * - Introspection Control (disabled in production)
 */

import type { ApolloServerPlugin, GraphQLRequestListener, BaseContext } from '@apollo/server';
import {
  DocumentNode,
  FieldNode,
  FragmentDefinitionNode,
  InlineFragmentNode,
  Kind,
  OperationDefinitionNode,
  SelectionSetNode,
} from 'graphql';
import { logger } from './logger';

const MAX_DEPTH = 7;
const MAX_COMPLEXITY = 1000;

// --- Query Depth Limiting ---

function getDepth(
  selectionSet: SelectionSetNode | undefined,
  fragments: Record<string, FragmentDefinitionNode>,
  currentDepth: number,
  visited: Set<string>
): number {
  if (!selectionSet) return currentDepth;

  let maxDepth = currentDepth;

  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FIELD) {
      const field = selection as FieldNode;
      if (field.selectionSet) {
        const depth = getDepth(field.selectionSet, fragments, currentDepth + 1, visited);
        if (depth > maxDepth) maxDepth = depth;
      }
    } else if (selection.kind === Kind.FRAGMENT_SPREAD) {
      const fragmentName = selection.name.value;
      if (visited.has(fragmentName)) continue; // Prevent circular fragments
      visited.add(fragmentName);
      const fragment = fragments[fragmentName];
      if (fragment) {
        const depth = getDepth(fragment.selectionSet, fragments, currentDepth, visited);
        if (depth > maxDepth) maxDepth = depth;
      }
    } else if (selection.kind === Kind.INLINE_FRAGMENT) {
      const inlineFragment = selection as InlineFragmentNode;
      const depth = getDepth(inlineFragment.selectionSet, fragments, currentDepth, visited);
      if (depth > maxDepth) maxDepth = depth;
    }
  }

  return maxDepth;
}

function calculateQueryDepth(document: DocumentNode): number {
  const fragments: Record<string, FragmentDefinitionNode> = {};
  for (const definition of document.definitions) {
    if (definition.kind === Kind.FRAGMENT_DEFINITION) {
      fragments[definition.name.value] = definition;
    }
  }

  let maxDepth = 0;
  for (const definition of document.definitions) {
    if (definition.kind === Kind.OPERATION_DEFINITION) {
      const operation = definition as OperationDefinitionNode;
      const depth = getDepth(operation.selectionSet, fragments, 0, new Set());
      if (depth > maxDepth) maxDepth = depth;
    }
  }

  return maxDepth;
}

// --- Query Complexity Analysis ---

// Fields that trigger database joins cost more
const EXPENSIVE_FIELDS = new Set([
  'leads', 'patients', 'appointments', 'surgeons', 'users',
  'budgets', 'complaints', 'auditLogs', 'notifications',
  'contacts', 'documents', 'postOps', 'followUps', 'treatments',
  'dashboardStats', 'performanceMetrics', 'evolutionApiInstances',
]);

const CONNECTION_FIELDS = new Set([
  'edges', 'node',
]);

function calculateComplexity(
  selectionSet: SelectionSetNode | undefined,
  fragments: Record<string, FragmentDefinitionNode>,
  multiplier: number,
  visited: Set<string>
): number {
  if (!selectionSet) return 0;

  let complexity = 0;

  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FIELD) {
      const field = selection as FieldNode;
      const fieldName = field.name.value;

      // Skip __typename introspection field
      if (fieldName.startsWith('__')) continue;

      let fieldCost = 1;
      let fieldMultiplier = multiplier;

      if (EXPENSIVE_FIELDS.has(fieldName)) {
        fieldCost = 10;
        fieldMultiplier = multiplier * 5; // List fields multiply child cost
      } else if (CONNECTION_FIELDS.has(fieldName)) {
        fieldCost = 0; // Connection wrapper nodes are free
      }

      complexity += fieldCost * multiplier;

      if (field.selectionSet) {
        complexity += calculateComplexity(field.selectionSet, fragments, fieldMultiplier, visited);
      }
    } else if (selection.kind === Kind.FRAGMENT_SPREAD) {
      const fragmentName = selection.name.value;
      if (visited.has(fragmentName)) continue;
      visited.add(fragmentName);
      const fragment = fragments[fragmentName];
      if (fragment) {
        complexity += calculateComplexity(fragment.selectionSet, fragments, multiplier, visited);
      }
    } else if (selection.kind === Kind.INLINE_FRAGMENT) {
      const inlineFragment = selection as InlineFragmentNode;
      complexity += calculateComplexity(inlineFragment.selectionSet, fragments, multiplier, visited);
    }
  }

  return complexity;
}

function calculateQueryComplexity(document: DocumentNode): number {
  const fragments: Record<string, FragmentDefinitionNode> = {};
  for (const definition of document.definitions) {
    if (definition.kind === Kind.FRAGMENT_DEFINITION) {
      fragments[definition.name.value] = definition;
    }
  }

  let totalComplexity = 0;
  for (const definition of document.definitions) {
    if (definition.kind === Kind.OPERATION_DEFINITION) {
      const operation = definition as OperationDefinitionNode;
      totalComplexity += calculateComplexity(operation.selectionSet, fragments, 1, new Set());
    }
  }

  return totalComplexity;
}

// --- Apollo Server Plugins ---

export function createDepthLimitPlugin(): ApolloServerPlugin<BaseContext> {
  return {
    async requestDidStart(): Promise<GraphQLRequestListener<BaseContext>> {
      return {
        async didResolveOperation(requestContext) {
          const { document, operationName } = requestContext;
          const depth = calculateQueryDepth(document);

          if (depth > MAX_DEPTH) {
            logger.warn('GraphQL:Security', `Query depth ${depth} exceeds max ${MAX_DEPTH}`, {
              operationName,
              depth,
            });
            throw new Error(
              `Query depth ${depth} exceeds maximum allowed depth of ${MAX_DEPTH}. Simplifique sua consulta.`
            );
          }
        },
      };
    },
  };
}

export function createComplexityPlugin(): ApolloServerPlugin<BaseContext> {
  return {
    async requestDidStart(): Promise<GraphQLRequestListener<BaseContext>> {
      return {
        async didResolveOperation(requestContext) {
          const { document, operationName } = requestContext;
          const complexity = calculateQueryComplexity(document);

          if (complexity > MAX_COMPLEXITY) {
            logger.warn('GraphQL:Security', `Query complexity ${complexity} exceeds max ${MAX_COMPLEXITY}`, {
              operationName,
              complexity,
            });
            throw new Error(
              `Query complexity ${complexity} exceeds maximum of ${MAX_COMPLEXITY}. Reduza o número de campos solicitados.`
            );
          }
        },
      };
    },
  };
}

// --- Introspection Control ---

export function getIntrospectionConfig(): boolean {
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    logger.info('GraphQL:Security', 'Introspection DISABLED (production mode)');
  }
  return !isProduction;
}

export function getSecurityPlugins(): ApolloServerPlugin<BaseContext>[] {
  return [
    createDepthLimitPlugin(),
    createComplexityPlugin(),
  ];
}
