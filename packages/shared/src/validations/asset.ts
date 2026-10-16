import { z } from "zod";

export const createAssetSchema = z.object({
    symbol: z
        .string({ error: "Symbol is required", })
        .trim()
        .min(1, { error: "Symbol cannot be empty" })
        .max(20, { error: "Symbol cannot exceed 20 characters" })
        .regex(/^[A-Z]+$/, {
            error: "Symbol must contain only uppercase letters",
        }),

    name: z
        .string({ error: "Asset name is required", })
        .trim()
        .min(1, { error: "Asset name cannot be empty" })
        .max(10, { error: "Asset name cannot exceed 10 characters" }),

    type: z.enum(["BASE", "QUOTE"]),
    logoUrl: z
        .string()
        .url({ error: "Logo URL must be a valid URL" })
        .optional(),

    precision: z
        .number({ error: "Precision is required", })
        .int({ error: "Precision must be an integer" })
        .min(0, { error: "Precision cannot be negative" })
        .max(18, { error: "Precision cannot exceed 18" }),

    isActive: z.boolean().optional(),
});

export const updateAssetSchema = z
    .object({
        name: z
            .string()
            .trim()
            .min(1, { error: "Asset name cannot be empty" })
            .max(10, { error: "Asset name cannot exceed 10 characters" })
            .optional(),

        logoUrl: z
            .string()
            .url({ error: "Logo URL must be a valid URL" })
            .optional(),

        precision: z.coerce
            .number()
            .int({ error: "Precision must be an integer" })
            .min(0, { error: "Precision cannot be negative" })
            .max(18, { error: "Precision cannot exceed 18" })
            .optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        error: "At least one field must be provided for update",
    });

