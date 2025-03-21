
import * as z from "zod";

export const bankFormSchema = z.object({
  bank: z.string().min(1, "Nome do banco é obrigatório"),
  ownerName: z.string().min(1, "Nome do titular é obrigatório"), 
  accountNumber: z.string().min(1, "Número da conta é obrigatório")
});

export type BankFormValues = z.infer<typeof bankFormSchema>;
