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
  parseLiteral(ast: Kind): Date {
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
      return decodeBase64(value);
    }
    throw new Error('ID must be a base64url string');
  },
  parseLiteral(ast: Kind): string {
    if (ast.kind === Kind.STRING) {
      return decodeBase64(ast.value);
    }
    throw new Error('ID must be a string');
  },
});
