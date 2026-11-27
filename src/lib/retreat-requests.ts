export const retreatPaymentPlans = [
  { id: 'single', label: 'Pago único', payments: 1, amount: 610000 },
  { id: '2_payments', label: '2 pagos', payments: 2, amount: 330000 },
  { id: '3_payments', label: '3 pagos', payments: 3, amount: 230000 },
  { id: '4_payments', label: '4 pagos', payments: 4, amount: 185000 },
] as const;

export const undecidedPayment = 'undecided';
export const retreatReference = /\bSOMA-[0-9A-F]{12}\b/i;

const pesos = new Intl.NumberFormat('es-AR');
export const retreatPrice = (amount: number) => '$' + pesos.format(amount);

export function retreatPaymentLabel(plan: typeof retreatPaymentPlans[number]) {
  return plan.payments === 1
    ? plan.label + ' · ' + retreatPrice(plan.amount)
    : plan.payments + ' cuotas de ' + retreatPrice(plan.amount) + ' · Total ' + retreatPrice(plan.payments * plan.amount);
}
