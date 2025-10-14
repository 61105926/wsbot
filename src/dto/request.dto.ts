import { z } from 'zod';

/**
 * DTO para envío de boletas de pago
 */
export const SendPayslipLinksDTO = z.object({
  month: z.string()
    .regex(/^\d{6}$/, 'Formato de mes inválido. Use YYYYMM (ejemplo: 202409)')
    .refine((val) => {
      const year = parseInt(val.substring(0, 4));
      const month = parseInt(val.substring(4, 6));
      return year >= 2020 && year <= 2100 && month >= 1 && month <= 12;
    }, 'Mes inválido. Debe ser un año entre 2020-2100 y mes entre 01-12')
});

export type SendPayslipLinksInput = z.infer<typeof SendPayslipLinksDTO>;

/**
 * DTO para envío de mensajes regionales
 */
export const SendRegionalMessagesDTO = z.object({
  messages: z.string()
    .transform((val) => JSON.parse(val))
    .pipe(z.array(z.string()).min(1, 'Debe haber al menos un mensaje')),

  regions: z.string()
    .transform((val) => JSON.parse(val))
    .pipe(z.array(z.string()).min(1, 'Debe haber al menos una regional'))
});

export type SendRegionalMessagesInput = z.infer<typeof SendRegionalMessagesDTO>;

/**
 * Helper para validar datos
 */
export function validateDTO<T>(schema: z.ZodSchema<T>, data: any): T {
  return schema.parse(data);
}

/**
 * Helper para validación segura (retorna error en lugar de lanzar excepción)
 */
export function safeValidateDTO<T>(schema: z.ZodSchema<T>, data: any): {
  success: true; data: T
} | {
  success: false; errors: z.ZodError
} {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, errors: result.error };
  }
}
