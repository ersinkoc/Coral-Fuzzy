import { RequestConfig, Response } from '../types';

export interface GraphQLConfig {
  url: string;
  headers?: Record<string, string>;
  defaultQuery?: string;
  defaultVariables?: Record<string, any>;
  batchInterval?: number;
  maxBatchSize?: number;
  validateSchema?: boolean;
  introspection?: boolean;
  optimizeQueries?: boolean;
}

export interface GraphQLRequest {
  query: string;
  variables?: Record<string, any>;
  operationName?: string;
}

export interface GraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
    extensions?: Record<string, any>;
  }>;
}

export interface GraphQLBatchRequest {
  requests: GraphQLRequest[];
  resolve: (responses: GraphQLResponse[]) => void;
  reject: (error: any) => void;
}

export interface GraphQLSchema {
  types: GraphQLType[];
  queryType: GraphQLType;
  mutationType?: GraphQLType;
  subscriptionType?: GraphQLType;
}

export interface GraphQLType {
  name: string;
  kind: 'OBJECT' | 'INTERFACE' | 'UNION' | 'ENUM' | 'INPUT_OBJECT' | 'SCALAR';
  fields?: GraphQLField[];
  interfaces?: GraphQLType[];
  possibleTypes?: GraphQLType[];
  enumValues?: GraphQLEnumValue[];
  inputFields?: GraphQLInputField[];
}

export interface GraphQLField {
  name: string;
  type: GraphQLType;
  args?: GraphQLInputField[];
  isDeprecated?: boolean;
  deprecationReason?: string;
}

export interface GraphQLEnumValue {
  name: string;
  isDeprecated?: boolean;
  deprecationReason?: string;
}

export interface GraphQLInputField {
  name: string;
  type: GraphQLType;
  defaultValue?: any;
}

interface IntrospectionResponse {
  __schema: {
    types: any[];
    queryType: { name: string };
    mutationType?: { name: string };
    subscriptionType?: { name: string };
  };
}

interface QueryNode {
  kind: 'query' | 'mutation' | 'subscription' | 'field' | 'argument' | 'fragment';
  name?: string;
  type?: string;
  fields?: QueryNode[];
  arguments?: Array<{ name: string; value: any }>;
  fragmentRefs?: string[];
}

export class GraphQLHandler {
  private config: Required<GraphQLConfig>;
  private batchQueue: GraphQLBatchRequest[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private schema: GraphQLSchema | null = null;
  private queryCache: Map<string, QueryNode> = new Map();

  constructor(config: GraphQLConfig) {
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
      this.fetchSchema();
    }
  }

  private async fetchSchema(): Promise<void> {
    const introspectionQuery = `
      query IntrospectionQuery {
        __schema {
          types {
            name
            kind
            fields {
              name
              type {
                name
                kind
                ofType {
                  name
                  kind
                }
              }
              args {
                name
                type {
                  name
                  kind
                  ofType {
                    name
                    kind
                  }
                }
              }
            }
            interfaces {
              name
            }
            possibleTypes {
              name
            }
            enumValues {
              name
              isDeprecated
              deprecationReason
            }
            inputFields {
              name
              type {
                name
                kind
                ofType {
                  name
                  kind
                }
              }
              defaultValue
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

    try {
      const response = await this.executeSingle<{ data: IntrospectionResponse }>(
        (config) => this.request(config),
        { query: introspectionQuery }
      );

      if (response.data?.data?.__schema) {
        this.schema = this.processIntrospectionResponse(response.data.data.__schema);
      }
    } catch (error) {
      console.warn('GraphQL schema not loaded:', error);
    }
  }

  private parseQuery(query: string): QueryNode {
    // Check cache
    const cached = this.queryCache.get(query);
    if (cached) {
      return cached;
    }

    // Simple AST parser
    const lines = query.trim().split('\n');
    const root: QueryNode = {
      kind: 'query',
      fields: []
    };

    let currentNode = root;
    const stack: QueryNode[] = [root];

    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('query') || trimmed.startsWith('mutation')) {
        root.kind = trimmed.startsWith('query') ? 'query' : 'mutation';
        const nameMatch = trimmed.match(/(?:query|mutation)\s+(\w+)/);
        if (nameMatch) {
          root.name = nameMatch[1];
        }
      } else if (trimmed.startsWith('{')) {
        // Field start
        continue;
      } else if (trimmed.startsWith('}')) {
        // Field end
        stack.pop();
        currentNode = stack[stack.length - 1];
      } else if (trimmed) {
        // Field definition
        const field: QueryNode = { kind: 'field' };
        const nameMatch = trimmed.match(/(\w+)(?:\(([^)]+)\))?/);
        
        if (nameMatch) {
          field.name = nameMatch[1];
          if (nameMatch[2]) {
            field.arguments = this.parseArguments(nameMatch[2]);
          }
        }

        currentNode.fields?.push(field);
        if (trimmed.includes('{')) {
          field.fields = [];
          stack.push(field);
          currentNode = field;
        }
      }
    }

    // Cache
    this.queryCache.set(query, root);
    return root;
  }

  private parseArguments(argsStr: string): Array<{ name: string; value: any }> {
    const args: Array<{ name: string; value: any }> = [];
    const matches = argsStr.match(/(\w+):\s*([^,\s]+)/g) || [];

    for (const match of matches) {
      const [name, valueStr] = match.split(':').map(s => s.trim());
      let value: any = valueStr;

      // Value conversion
      if (valueStr.startsWith('"') || valueStr.startsWith("'")) {
        value = valueStr.slice(1, -1);
      } else if (valueStr === 'true' || valueStr === 'false') {
        value = valueStr === 'true';
      } else if (!isNaN(Number(valueStr))) {
        value = Number(valueStr);
      } else if (valueStr.startsWith('$')) {
        value = { variable: valueStr.slice(1) };
      }

      args.push({ name, value });
    }

    return args;
  }

  private validateOperation(query: string, variables?: Record<string, any>): void {
    if (!this.schema || !this.config.validateSchema) {
      return;
    }

    const parsedQuery = this.parseQuery(query);
    
    // Check query type
    if (!parsedQuery.kind) {
      throw new Error('Invalid query: Operation type not specified');
    }

    // Type check
    if (parsedQuery.kind === 'query' && !this.schema.queryType) {
      throw new Error('This GraphQL API does not support query operations');
    }
    if (parsedQuery.kind === 'mutation' && !this.schema.mutationType) {
      throw new Error('This GraphQL API does not support mutation operations');
    }

    // Field and argument check
    this.validateFields(parsedQuery.fields || [], this.getOperationType(parsedQuery.kind));

    // Variable check
    if (variables) {
      this.validateVariables(parsedQuery, variables);
    }
  }

  private validateFields(fields: QueryNode[], parentType: GraphQLType): void {
    if (!parentType.fields) {
      throw new Error(`No field definitions found for type ${parentType.name}`);
    }

    for (const field of fields) {
      const schemaField = parentType.fields.find(f => f.name === field.name);
      
      if (!schemaField) {
        throw new Error(`Invalid field: ${field.name} not found on type ${parentType.name}`);
      }

      // Argument check
      if (field.arguments?.length) {
        if (!schemaField.args) {
          throw new Error(`Field ${field.name} does not accept arguments`);
        }
        this.validateArguments(field.arguments, schemaField.args);
      }

      // Check sub-fields
      if (field.fields?.length) {
        const fieldType = this.getFieldType(schemaField.type);
        this.validateFields(field.fields, fieldType);
      }
    }
  }

  private validateArguments(
    queryArgs: Array<{ name: string; value: any }>,
    schemaArgs: GraphQLInputField[]
  ): void {
    for (const arg of queryArgs) {
      const schemaArg = schemaArgs.find(a => a.name === arg.name);
      
      if (!schemaArg) {
        throw new Error(`Invalid argument: ${arg.name}`);
      }

      // Type check
      this.validateArgumentValue(arg.value, schemaArg.type);
    }
  }

  private validateArgumentValue(value: any, type: GraphQLType): void {
    if (!type) {
      throw new Error('Type definition not found');
    }

    // Basic type check
    switch (type.kind) {
      case 'SCALAR':
        this.validateScalarValue(value, type.name);
        break;
      
      case 'ENUM':
        this.validateEnumValue(value, type.name);
        break;

      case 'INPUT_OBJECT':
        this.validateInputObject(value, type.name);
        break;

      default:
        throw new Error(`Unsupported type: ${type.kind}`);
    }
  }

  private validateScalarValue(value: any, typeName: string): void {
    switch (typeName) {
      case 'Int':
        if (!Number.isInteger(value)) {
          throw new Error(`Value must be an integer: ${value}`);
        }
        break;
      case 'Float':
        if (typeof value !== 'number') {
          throw new Error(`Value must be a number: ${value}`);
        }
        break;
      case 'String':
        if (typeof value !== 'string') {
          throw new Error(`Value must be a string: ${value}`);
        }
        break;
      case 'Boolean':
        if (typeof value !== 'boolean') {
          throw new Error(`Value must be a boolean: ${value}`);
        }
        break;
      case 'ID':
        if (typeof value !== 'string' && typeof value !== 'number') {
          throw new Error(`Value must be an ID: ${value}`);
        }
        break;
      default:
        throw new Error(`Unknown scalar type: ${typeName}`);
    }
  }

  private validateEnumValue(value: any, typeName: string): void {
    const enumType = this.schema?.types.find(t => t.name === typeName);
    if (!enumType?.enumValues?.length) {
      throw new Error(`No values found for enum type ${typeName}`);
    }

    if (!enumType.enumValues.some(v => v.name === value)) {
      throw new Error(`Invalid enum value: ${value}`);
    }
  }

  private validateInputObject(value: any, typeName: string): void {
    if (typeof value !== 'object' || value === null) {
      throw new Error(`Value must be an object: ${value}`);
    }

    const inputType = this.schema?.types.find(t => t.name === typeName);
    if (!inputType?.inputFields?.length) {
      throw new Error(`No field definitions found for input type ${typeName}`);
    }

    for (const field of inputType.inputFields) {
      if (field.name in value) {
        this.validateArgumentValue(value[field.name], field.type);
      }
    }
  }

  private validateVariables(
    query: QueryNode,
    variables: Record<string, any>
  ): void {
    // Check variable usage
    const usedVariables = this.collectVariables(query);
    
    // Check for missing variables
    for (const varName of usedVariables) {
      if (!(varName in variables)) {
        throw new Error(`Missing variable: $${varName}`);
      }
    }

    // Check for unused variables
    for (const varName in variables) {
      if (!usedVariables.has(varName)) {
        throw new Error(`Unused variable: $${varName}`);
      }
    }
  }

  private collectVariables(node: QueryNode): Set<string> {
    const variables = new Set<string>();

    // Collect variables from arguments
    if (node.arguments) {
      for (const arg of node.arguments) {
        if (typeof arg.value === 'object' && arg.value?.variable) {
          variables.add(arg.value.variable);
        }
      }
    }

    // Collect variables from sub-fields
    if (node.fields) {
      for (const field of node.fields) {
        const fieldVars = this.collectVariables(field);
        fieldVars.forEach(v => variables.add(v));
      }
    }

    return variables;
  }

  private optimizeQuery(query: string): string {
    if (!this.config.optimizeQueries) {
      return query;
    }

    const parsedQuery = this.parseQuery(query);
    
    // Remove unnecessary spaces
    let optimized = query.replace(/\s+/g, ' ').trim();

    // Remove duplicate fields
    const fields = new Set<string>();
    optimized = this.deduplicateFields(optimized, fields);

    // Remove unused fragments
    optimized = this.removeUnusedFragments(optimized, parsedQuery);

    return optimized;
  }

  private deduplicateFields(query: string, fields: Set<string>): string {
    const lines = query.split('\n');
    const result: string[] = [];
    
    for (const line of lines) {
      const fieldMatch = line.match(/\s*(\w+)(?:\([^)]*\))?\s*{?/);
      if (fieldMatch) {
        const fieldName = fieldMatch[1];
        if (!fields.has(fieldName)) {
          fields.add(fieldName);
          result.push(line);
        }
      } else {
        result.push(line);
      }
    }

    return result.join('\n');
  }

  private removeUnusedFragments(query: string, parsedQuery: QueryNode): string {
    const usedFragments = new Set<string>();
    this.collectFragmentRefs(parsedQuery, usedFragments);

    const lines = query.split('\n');
    const result: string[] = [];
    let inFragment = false;
    let currentFragment = '';

    for (const line of lines) {
      if (line.trim().startsWith('fragment')) {
        inFragment = true;
        const fragmentMatch = line.match(/fragment\s+(\w+)/);
        if (fragmentMatch) {
          currentFragment = fragmentMatch[1];
        }
      } else if (inFragment && line.trim() === '}') {
        inFragment = false;
        if (usedFragments.has(currentFragment)) {
          result.push(line);
        }
      } else if (!inFragment || usedFragments.has(currentFragment)) {
        result.push(line);
      }
    }

    return result.join('\n');
  }

  private collectFragmentRefs(node: QueryNode, fragments: Set<string>): void {
    if (node.fragmentRefs) {
      node.fragmentRefs.forEach(ref => fragments.add(ref));
    }

    if (node.fields) {
      node.fields.forEach(field => this.collectFragmentRefs(field, fragments));
    }
  }

  private processIntrospectionResponse(schemaData: any): GraphQLSchema {
    return {
      types: this.processTypes(schemaData.types),
      queryType: this.findType(schemaData.queryType.name, schemaData.types),
      mutationType: schemaData.mutationType ? 
        this.findType(schemaData.mutationType.name, schemaData.types) : 
        undefined,
      subscriptionType: schemaData.subscriptionType ?
        this.findType(schemaData.subscriptionType.name, schemaData.types) :
        undefined
    };
  }

  private processTypes(types: any[]): GraphQLType[] {
    return types.map(type => ({
      name: type.name,
      kind: type.kind,
      fields: type.fields?.map(this.processField.bind(this)),
      interfaces: type.interfaces?.map((iface: any) => ({ name: iface.name })),
      possibleTypes: type.possibleTypes?.map((pt: any) => ({ name: pt.name })),
      enumValues: type.enumValues,
      inputFields: type.inputFields?.map(this.processInputField.bind(this))
    }));
  }

  private processField(field: any): GraphQLField {
    return {
      name: field.name,
      type: this.processTypeRef(field.type),
      args: field.args?.map(this.processInputField.bind(this)),
      isDeprecated: field.isDeprecated,
      deprecationReason: field.deprecationReason
    };
  }

  private processInputField(field: any): GraphQLInputField {
    return {
      name: field.name,
      type: this.processTypeRef(field.type),
      defaultValue: field.defaultValue
    };
  }

  private processTypeRef(type: any): GraphQLType {
    return {
      name: type.name || (type.ofType?.name ?? 'Unknown'),
      kind: type.kind || (type.ofType?.kind ?? 'SCALAR')
    };
  }

  private findType(name: string, types: any[]): GraphQLType {
    const type = types.find(t => t.name === name);
    return this.processTypeRef(type);
  }

  private getOperationType(kind: string): GraphQLType {
    if (!this.schema || !this.schema.types.length) {
      throw new Error('Schema not loaded or empty');
    }

    const defaultType = this.schema.types[0];
    
    switch (kind) {
      case 'query':
        return this.schema.queryType || defaultType;
      case 'mutation':
        return this.schema.mutationType || defaultType;
      case 'subscription':
        return this.schema.subscriptionType || defaultType;
      default:
        throw new Error('Invalid operation type');
    }
  }

  private getFieldType(type: GraphQLType): GraphQLType {
    if (!this.schema?.types?.length) {
      throw new Error('Schema not loaded or empty');
    }

    const objectTypes = this.schema.types.filter(t => t.kind === 'OBJECT');
    if (!objectTypes.length) {
      throw new Error('No OBJECT type found in schema');
    }

    if (type.kind === 'OBJECT') {
      return type;
    } else if (type.kind === 'INTERFACE' || type.kind === 'UNION') {
      return objectTypes[0];
    }

    throw new Error(`Unsupported type: ${type.kind}`);
  }

  private async request<T>(config: RequestConfig): Promise<Response<T>> {
    // This method should be implemented by CoralFuzzy instance
    throw new Error('request method should be implemented');
  }

  async execute<T = any>(
    request: (config: RequestConfig) => Promise<Response<GraphQLResponse<T>>>,
    query: string,
    variables?: Record<string, any>,
    operationName?: string
  ): Promise<GraphQLResponse<T>> {
    this.validateOperation(query, variables);

    const optimizedQuery = this.optimizeQuery(query);
    
    const graphqlRequest: GraphQLRequest = {
      query: optimizedQuery || this.config.defaultQuery,
      variables: { ...this.config.defaultVariables, ...variables },
      operationName
    };

    if (this.isMutation(optimizedQuery)) {
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

  private addToBatch<T>(
    request: (config: RequestConfig) => Promise<Response<GraphQLResponse<T>>>,
    graphqlRequest: GraphQLRequest
  ): Promise<GraphQLResponse<T>> {
    return new Promise((resolve, reject) => {
      this.batchQueue.push({
        requests: [graphqlRequest],
        resolve: ([response]) => resolve(response),
        reject
      });

      this.scheduleBatch(request);
    });
  }

  private scheduleBatch(
    request: (config: RequestConfig) => Promise<Response<any>>
  ): void {
    if (this.batchTimeout) {
      return;
    }

    this.batchTimeout = setTimeout(() => {
      this.processBatch(request);
    }, this.config.batchInterval);
  }

  private async processBatch(
    request: (config: RequestConfig) => Promise<Response<any>>
  ): Promise<void> {
    this.batchTimeout = null;

    if (this.batchQueue.length === 0) {
      return;
    }

    const batch = this.batchQueue.splice(0, this.config.maxBatchSize);
    const requests = batch.map(item => item.requests[0]);

    try {
      const response = await request({
        url: this.config.url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers
        },
        data: requests.length === 1 ? requests[0] : requests
      });

      const responses = Array.isArray(response.data) ? 
        response.data : 
        [response.data];

      responses.forEach((res, index) => {
        this.validateResponse(res);
        batch[index].resolve(res);
      });
    } catch (error) {
      batch.forEach(item => item.reject(this.formatError(error)));
    }
  }

  private validateResponse(response: GraphQLResponse): void {
    if (response.errors?.length) {
      const error = new Error(response.errors[0].message);
      Object.assign(error, { response });
      throw error;
    }
  }

  private formatError(error: any): Error {
    if (error.response?.data?.errors) {
      return new Error(error.response.data.errors[0].message);
    }
    return error;
  }

  private isMutation(query: string): boolean {
    return /^\\s*mutation\\b/i.test(query);
  }

  getStats(): {
    queueSize: number;
    isBatching: boolean;
    config: Required<GraphQLConfig>;
  } {
    return {
      queueSize: this.batchQueue.length,
      isBatching: this.batchTimeout !== null,
      config: { ...this.config }
    };
  }

  clearBatch(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    this.batchQueue = [];
  }

  getSchema(): GraphQLSchema | null {
    return this.schema;
  }

  async refreshSchema(): Promise<void> {
    await this.fetchSchema();
  }

  validateQuery(query: string, variables?: Record<string, any>): boolean {
    try {
      this.validateOperation(query, variables);
      return true;
    } catch {
      return false;
    }
  }
} 