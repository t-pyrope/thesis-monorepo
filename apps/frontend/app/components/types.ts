export type RuleValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | RuleValue[]
  | { [key: string]: RuleValue };
