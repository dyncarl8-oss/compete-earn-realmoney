/**
 * Decimal utility functions for precise money calculations
 * Avoids floating-point precision errors by working with integers (cents)
 */

export class MoneyAmount {
  private readonly cents: number;

  constructor(amount: string | number) {
    if (typeof amount === 'string') {
      // Parse string like "12.34" to 1234 cents
      const parsed = parseFloat(amount);
      if (isNaN(parsed)) {
        throw new Error(`Invalid money amount: ${amount}`);
      }
      this.cents = Math.round(parsed * 100);
    } else {
      // Assume number is already in dollars
      this.cents = Math.round(amount * 100);
    }
  }

  static fromCents(cents: number): MoneyAmount {
    const amount = new MoneyAmount(0);
    (amount as any).cents = cents;
    return amount;
  }

  add(other: MoneyAmount): MoneyAmount {
    return MoneyAmount.fromCents(this.cents + other.cents);
  }

  subtract(other: MoneyAmount): MoneyAmount {
    return MoneyAmount.fromCents(this.cents - other.cents);
  }

  multiply(factor: number): MoneyAmount {
    return MoneyAmount.fromCents(Math.round(this.cents * factor));
  }

  isGreaterThan(other: MoneyAmount): boolean {
    return this.cents > other.cents;
  }

  isGreaterThanOrEqual(other: MoneyAmount): boolean {
    return this.cents >= other.cents;
  }

  isLessThan(other: MoneyAmount): boolean {
    return this.cents < other.cents;
  }

  isEqual(other: MoneyAmount): boolean {
    return this.cents === other.cents;
  }

  toCents(): number {
    return this.cents;
  }

  toDollars(): number {
    return this.cents / 100;
  }

  toString(): string {
    return (this.cents / 100).toFixed(2);
  }

  // Validate minimum withdrawal amount
  static readonly MIN_WITHDRAWAL = new MoneyAmount("20.00");
}

export function calculateWinnings(transactions: Array<{type: string, amount: string}>): MoneyAmount {
  return transactions
    .filter(t => t.type === "win")
    .reduce((sum, t) => sum.add(new MoneyAmount(t.amount)), new MoneyAmount(0));
}

export function calculateWithdrawn(transactions: Array<{type: string, amount: string}>): MoneyAmount {
  return transactions
    .filter(t => t.type === "withdrawal")
    .reduce((sum, t) => sum.add(new MoneyAmount(Math.abs(parseFloat(t.amount)).toString())), new MoneyAmount(0));
}