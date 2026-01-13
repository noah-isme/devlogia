import { z } from "zod";

const literalSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

type Literal = z.infer<typeof literalSchema>;
type JsonArray = Json[];
type JsonObject = { [key: string]: Json };
type Json = Literal | JsonArray | JsonObject;

export const jsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([
    literalSchema,
    z.array(jsonSchema),
    z.record(z.string(), jsonSchema),
  ]),
);

export const jsonObjectSchema = z.record(z.string(), jsonSchema);

export type JsonValue = Json;
export type { JsonObject };
