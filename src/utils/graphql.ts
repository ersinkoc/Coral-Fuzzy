import { RequestConfig, Response } from '../types';

// Types
export interface GraphQLConfig {
  url: string;
  headers?: Record<string, string>;
  defaultQuery?: string;
  defaultVariables?: Record<string, unknown>;
  batchInterval?: number;
  maxBatchSize?: number;
  validateSchema?: boolean;
  introspection?: boolean;
  optimizeQueries?: boolean;
}

export interface GraphQLRequest {
  query: string;
  variables?: Record<string, unknown>;
  operationName?: string;
}

export interface GraphQLError {
  message: string;
  locations?: Array<{ line: number; column: number }>;
  path?: string[];
  extensions?: Record<string, unknown>;
}

export interface GraphQLResponse<T = unknown> {
  data?: T;
  errors?: GraphQLError[];
}

export interface GraphQLBatchRequest {
  requests: GraphQLRequest[];
  resolve: (response: GraphQLResponse) => void;
  reject: (error: Error) => void;
}

// Schema Types
interface GraphQLSchema {
  types: GraphQLType[];
  queryType: GraphQLType;
  mutationType?: GraphQLType;
  subscriptionType?: GraphQLType;
}

type GraphQLTypeKind = 
  | 'SCALAR' 
  | 'OBJECT' 
  | 'INTERFACE' 
  | 'UNION' 
  | 'ENUM' 
  | 'INPUT_OBJECT' 
  | 'LIST' 
  | 'NON_NULL';

interface GraphQLType {
  name: string;
  kind: GraphQLTypeKind;
  fields?: GraphQLField[];
  interfaces?: GraphQLType[];
  possibleTypes?: GraphQLType[];
  enumValues?: GraphQLEnumValue[];
  inputFields?: GraphQLInputField[];
  ofType?: GraphQLType; // For LIST and NON_NULL types
}

interface GraphQLField {
  name: string;
  type: GraphQLType;
  args?: GraphQLInputField[];
  isDeprecated?: boolean;
  deprecationReason?: string;
}

interface GraphQLEnumValue {
  name: string;
  isDeprecated?: boolean;
  deprecationReason?: string;
}

interface GraphQLInputField {
  name: string;
  type: GraphQLType;
  defaultValue?: unknown;
}

interface QueryNode {
  kind: 'query' | 'mutation' | 'subscription' | 'field' | 'argument' | 'fragment';
  name?: string;
  type?: string;
  fields?: QueryNode[];
  arguments?: Array<{ name: string; value: unknown }>;
  fragmentRefs?: string[];
}

const introspectionQuery = `
  query IntrospectionQuery {
    __schema {
      types {
        kind
        name
        fields {
          name
          args {
            name
            type {
              kind
              name
              ofType {
                kind
                name
              }
            }
          }
          type {
            kind
            name
            ofType {
              kind
              name
            }
          }
        }
        inputFields {
          name
          type {
            kind
            name
            ofType {
              kind
              name
            }
          }
        }
        interfaces {
          kind
          name
        }
        enumValues {
          name
          isDeprecated
          deprecationReason
        }
        possibleTypes {
          kind
          name
        }
      }
      queryType {
        name
      }
      mutationType {
        name
      }
      subscriptionType {
        name
      }
    }
  }
`;

export class GraphQLHandler {
  private readonly config: Required<GraphQLConfig>;
  private batchQueue: GraphQLBatchRequest[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private schema: GraphQLSchema | null = null;
  private queryCache: Map<string, QueryNode> = new Map();

  constructor(config: GraphQLConfig) {
    if (!config.url) {
      throw new Error('GraphQL URL is required');
    }

    this.config = {
      url: config.url,
      headers: config.headers ?? {},
      defaultQuery: config.defaultQuery ?? '',
      defaultVariables: config.defaultVariables ?? {},
      batchInterval: config.batchInterval ?? 50,
      maxBatchSize: config.maxBatchSize ?? 10,
      validateSchema: config.validateSchema ?? true,
      introspection: config.introspection ?? true,
      optimizeQueries: config.optimizeQueries ?? true
    };

    if (this.config.introspection) {
      void this.fetchSchema();
    }
  }

  private async fetchSchema(): Promise<void> {
    try {
      const response = await fetch(this.config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers
        },
        body: JSON.stringify({
          query: introspectionQuery
        })
      });

      if (!response.ok) {
        throw new Error(`Schema fetch failed: ${response.statusText}`);
      }

      const result = await response.json() as { data?: { __schema: unknown } };
      
      if (!result.data?.__schema) {
        throw new Error('Invalid schema response');
      }

      this.schema = this.processIntrospectionResponse(result.data.__schema);
    } catch (error) {
      console.error('Failed to fetch GraphQL schema:', error);
      this.schema = null;
    }
  }

  private processIntrospectionResponse(schemaData: unknown): GraphQLSchema {
    if (!this.isValidSchemaData(schemaData)) {
      throw new Error('Invalid schema data');
    }

    const types = this.processTypes(schemaData.types);
    const queryType = this.findType(schemaData.queryType.name, types);

    if (!queryType) {
      throw new Error('Query type not found in schema');
    }

    return {
      types,
      queryType,
      mutationType: schemaData.mutationType 
        ? this.findType(schemaData.mutationType.name, types) 
        : undefined,
      subscriptionType: schemaData.subscriptionType
        ? this.findType(schemaData.subscriptionType.name, types)
        : undefined
    };
  }

  private isValidSchemaData(data: unknown): data is {
    types: unknown[];
    queryType: { name: string };
    mutationType?: { name: string };
    subscriptionType?: { name: string };
  } {
    if (!data || typeof data !== 'object') return false;
    
    const schemaData = data as Record<string, unknown>;
    
    return Array.isArray(schemaData.types) &&
           typeof schemaData.queryType === 'object' &&
           schemaData.queryType !== null &&
           'name' in schemaData.queryType &&
           typeof schemaData.queryType.name === 'string';
  }

  private processTypes(types: unknown[]): GraphQLType[] {
    return types
      .filter((type): type is Record<string, unknown> => 
        type !== null && typeof type === 'object')
      .map(type => this.processType(type));
  }

  private processType(typeData: Record<string, unknown>): GraphQLType {
    if (!this.isValidTypeData(typeData)) {
      throw new Error(`Invalid type data: ${JSON.stringify(typeData)}`);
    }

    return {
      name: typeData.name,
      kind: typeData.kind,
      fields: typeData.fields?.map(field => this.processField(field)),
      interfaces: typeData.interfaces?.map(iface => this.processType(iface)),
      possibleTypes: typeData.possibleTypes?.map(type => this.processType(type)),
      enumValues: typeData.enumValues?.map(value => ({
        name: value.name,
        isDeprecated: value.isDeprecated,
        deprecationReason: value.deprecationReason
      })),
      inputFields: typeData.inputFields?.map(field => ({
        name: field.name,
        type: this.processType(field.type),
        defaultValue: field.defaultValue
      }))
    };
  }

  private isValidTypeData(data: Record<string, unknown>): data is {
    name: string;
    kind: GraphQLTypeKind;
    fields?: Record<string, unknown>[];
    interfaces?: Record<string, unknown>[];
    possibleTypes?: Record<string, unknown>[];
    enumValues?: Array<{
      name: string;
      isDeprecated?: boolean;
      deprecationReason?: string;
    }>;
    inputFields?: Array<{
      name: string;
      type: Record<string, unknown>;
      defaultValue?: unknown;
    }>;
  } {
    return typeof data.name === 'string' &&
           typeof data.kind === 'string' &&
           this.isValidTypeKind(data.kind);
  }

  private isValidTypeKind(kind: string): kind is GraphQLTypeKind {
    return [
      'SCALAR', 'OBJECT', 'INTERFACE', 'UNION',
      'ENUM', 'INPUT_OBJECT', 'LIST', 'NON_NULL'
    ].includes(kind);
  }

  private processField(fieldData: Record<string, unknown>): GraphQLField {
    if (!this.isValidFieldData(fieldData)) {
      throw new Error(`Invalid field data: ${JSON.stringify(fieldData)}`);
    }

    return {
      name: fieldData.name,
      type: this.processType(fieldData.type),
      args: fieldData.args?.map(arg => ({
        name: arg.name,
        type: this.processType(arg.type),
        defaultValue: arg.defaultValue
      })),
      isDeprecated: fieldData.isDeprecated,
      deprecationReason: fieldData.deprecationReason
    };
  }

  private isValidFieldData(data: Record<string, unknown>): data is {
    name: string;
    type: Record<string, unknown>;
    args?: Array<{
      name: string;
      type: Record<string, unknown>;
      defaultValue?: unknown;
    }>;
    isDeprecated?: boolean;
    deprecationReason?: string;
  } {
    return typeof data.name === 'string' &&
           data.type !== null &&
           typeof data.type === 'object';
  }

  private findType(name: string, types: GraphQLType[]): GraphQLType | undefined {
    return types.find(type => type.name === name);
  }

  async execute<T>(
    request: (config: RequestConfig) => Promise<Response<GraphQLResponse<T>>>,
    query: string,
    variables?: Record<string, unknown>,
    operationName?: string
  ): Promise<GraphQLResponse<T>> {
    const graphqlRequest: GraphQLRequest = {
      query,
      variables,
      operationName
    };

    if (this.config.validateSchema && this.schema) {
      this.validateOperation(query, variables);
    }

    if (this.isMutation(query)) {
      return this.executeSingle(request, graphqlRequest);
    }

    return this.addToBatch(request, graphqlRequest);
  }

  private async executeSingle<T>(
    request: (config: RequestConfig) => Promise<Response<GraphQLResponse<T>>>,
    graphqlRequest: GraphQLRequest
  ): Promise<GraphQLResponse<T>> {
    try {
      const response = await request({
        url: this.config.url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers
        },
        data: graphqlRequest
      });

      this.validateResponse(response.data);
      return response.data;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  private async addToBatch<T>(
    request: (config: RequestConfig) => Promise<Response<GraphQLResponse<T>>>,
    graphqlRequest: GraphQLRequest
  ): Promise<GraphQLResponse<T>> {
    return new Promise((resolve, reject) => {
      this.batchQueue.push({
        requests: [graphqlRequest],
        resolve: resolve as (response: GraphQLResponse) => void,
        reject
      });

      this.scheduleBatch(request);
    });
  }

  private scheduleBatch(
    request: (config: RequestConfig) => Promise<Response<unknown>>
  ): void {
    if (this.batchQueue.length >= this.config.maxBatchSize) {
      void this.processBatch(request);
    } else if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => {
        void this.processBatch(request);
      }, this.config.batchInterval);
    }
  }

  private async processBatch(
    request: (config: RequestConfig) => Promise<Response<unknown>>
  ): Promise<void> {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    const currentBatch = [...this.batchQueue];
    this.batchQueue = [];

    if (currentBatch.length === 0) return;

    try {
      const response = await request({
        url: this.config.url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers
        },
        data: {
          queries: currentBatch.map(item => item.requests[0])
        }
      });

      const data = response.data as unknown;
      
      if (!this.isValidBatchResponse(data)) {
        throw new Error('Invalid batch response');
      }

      currentBatch.forEach((item, index) => {
        const result = data[index];
        if (result.errors?.length) {
          item.reject(new Error(result.errors[0].message));
        } else {
          item.resolve(result);
        }
      });
    } catch (error) {
      currentBatch.forEach(item => {
        item.reject(this.formatError(error));
      });
    }
  }

  private isValidBatchResponse(data: unknown): data is GraphQLResponse[] {
    return Array.isArray(data) && data.every(item => 
      typeof item === 'object' && item !== null &&
      (('data' in item) || ('errors' in item && Array.isArray(item.errors)))
    );
  }

  private validateResponse(response: GraphQLResponse): void {
    if (response.errors?.length) {
      throw new Error(response.errors[0].message);
    }
  }

  private formatError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }
    return new Error(String(error));
  }

  private isMutation(query: string): boolean {
    return /^\s*mutation\s/.test(query);
  }

  private validateOperation(query: string, variables?: Record<string, unknown>): void {
    const parsedQuery = this.parseQuery(query);
    if (!parsedQuery) {
      throw new Error('Failed to parse GraphQL query');
    }

    if (variables) {
      this.validateVariables(parsedQuery, variables);
    }
  }

  private parseQuery(query: string): QueryNode | null {
    // Basic query parser implementation
    // In a production environment, consider using a proper GraphQL parser library
    try {
      const trimmed = query.trim();
      const operationType = trimmed.startsWith('mutation') ? 'mutation' : 
                          trimmed.startsWith('subscription') ? 'subscription' : 
                          'query';

      return {
        kind: operationType,
        fields: this.parseFields(query)
      };
    } catch (error) {
      console.error('Query parsing failed:', error);
      return null;
    }
  }

  private parseFields(query: string): QueryNode[] {
    // Simplified field parser
    // This is a basic implementation and should be replaced with a proper parser
    const fields: QueryNode[] = [];
    const fieldRegex = /\w+\s*{([^}]*)}/g;
    let match;

    while ((match = fieldRegex.exec(query)) !== null) {
      fields.push({
        kind: 'field',
        name: match[0].split('{')[0].trim(),
        fields: this.parseFields(match[1])
      });
    }

    return fields;
  }

  private validateVariables(
    query: QueryNode,
    variables: Record<string, unknown>
  ): void {
    const usedVariables = new Set<string>();
    this.collectVariables(query, usedVariables);

    for (const varName of Object.keys(variables)) {
      if (!usedVariables.has(varName)) {
        console.warn(`Unused variable in GraphQL query: ${varName}`);
      }
    }
  }

  private collectVariables(node: QueryNode, variables: Set<string>): void {
    if (node.arguments) {
      node.arguments.forEach(arg => {
        if (typeof arg.value === 'string' && arg.value.startsWith('$')) {
          variables.add(arg.value.slice(1));
        }
      });
    }

    node.fields?.forEach(field => this.collectVariables(field, variables));
  }

  getStats(): {
    queueSize: number;
    isBatching: boolean;
    config: Required<GraphQLConfig>;
  } {
    return {
      queueSize: this.batchQueue.length,
      isBatching: this.batchTimeout !== null,
      config: this.config
    };
  }

  clearBatch(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    this.batchQueue = [];
  }
}