import { GraphQLScalarType, Kind } from 'graphql';

export const DateTimeScalar = new GraphQLScalarType({
  name: 'DateTime',
  description: 'DateTime custom scalar type in ISO 8601 format',
  serialize(value: unknown): string {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'number') {
      return new Date(value).toISOString();
    }
    if (typeof value === 'string') {
      return new Date(value).toISOString();
    }
    throw new Error('DateTime cannot be serialized');
  },
  parseValue(value: unknown): Date {
    if (typeof value === 'string') {
      return new Date(value);
    }
    if (typeof value === 'number') {
      return new Date(value);
    }
    throw new Error('DateTime must be a string or number');
  },
  parseLiteral(ast: any): Date {
    if (ast.kind === Kind.STRING) {
      return new Date(ast.value);
    }
    if (ast.kind === Kind.INT) {
      return new Date(parseInt(ast.value, 10));
    }
    throw new Error('DateTime must be a string');
  },
});

const encodeBase64 = (id: string): string => {
  return Buffer.from(id).toString('base64url');
};

const decodeBase64 = (encoded: string): string => {
  return Buffer.from(encoded, 'base64url').toString('utf-8');
};

export const IDScalar = new GraphQLScalarType({
  name: 'ID',
  description: 'Custom ID scalar that encodes/decodes from base64url',
  serialize(value: unknown): string {
    if (typeof value === 'string') {
      return encodeBase64(value);
    }
    throw new Error('ID must be a string');
  },
  parseValue(value: unknown): string {
    if (typeof value === 'string') {
      const decoded = decodeBase64(value);
      return decoded.split(':').pop() || decoded;
    }
    throw new Error('ID must be a base64url string');
  },
  parseLiteral(ast: any): string {
    if (ast.kind === Kind.STRING) {
      const decoded = decodeBase64(ast.value);
      return decoded.split(':').pop() || decoded;
    }
    throw new Error('ID must be a string');
  },
});

export const JSONScalar = new GraphQLScalarType({
  name: 'JSON',
  description: 'The `JSON` scalar type represents JSON values as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf).',
  serialize(value: unknown): any {
    return value;
  },
  parseValue(value: unknown): any {
    return value;
  },
  parseLiteral(ast: any): any {
    switch (ast.kind) {
      case Kind.STRING:
      case Kind.BOOLEAN:
        return ast.value;
      case Kind.INT:
      case Kind.FLOAT:
        return parseFloat(ast.value);
      case Kind.OBJECT: {
        const value = Object.create(null);
        ast.fields.forEach((field: any) => {
          value[field.name.value] = JSONScalar.parseLiteral(field.value, {});
        });
        return value;
      }
      case Kind.LIST:
        return ast.values.map((n: any) => JSONScalar.parseLiteral(n, {}));
      case Kind.NULL:
        return null;
      default:
        return undefined;
    }
  },
});
