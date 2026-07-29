export interface HqAdmin {
  readonly id: string;
  readonly email: string;
  readonly isHq: true;
}

export function isHqAdmin(user: unknown): user is HqAdmin {
  return (
    typeof user === 'object' &&
    user !== null &&
    (user as HqAdmin).isHq === true
  );
}
