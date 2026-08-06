import { readFile } from "node:fs/promises";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validators = new Map();

export async function validateJsonFile(schemaPath, filePath) {
  const [schemaText, fileText] = await Promise.all([
    readFile(schemaPath, "utf8"),
    readFile(filePath, "utf8")
  ]);
  let schema;
  let value;
  try {
    schema = JSON.parse(schemaText);
    value = JSON.parse(fileText);
  } catch (error) {
    const parseError = new Error(`Invalid JSON: ${error.message}`);
    parseError.code = "INVALID_JSON";
    throw parseError;
  }
  let validate = validators.get(schemaPath);
  if (!validate) {
    validate = ajv.compile(schema);
    validators.set(schemaPath, validate);
  }
  if (!validate(value)) {
    const error = new Error(ajv.errorsText(validate.errors, { separator: "\n" }));
    error.code = "SCHEMA_INVALID";
    error.details = validate.errors;
    throw error;
  }
  return value;
}

export function formatValidationError(error) {
  return error.code === "SCHEMA_INVALID" ? error.message : error.message;
}
