export type AdminDemoSubscription = {
  userId: string;
  email: string;
  planId: string;
  notes: string;
};

export const STAGING_ADMIN_DEMO_SUBSCRIPTION: AdminDemoSubscription = {
  userId: 'ZJvFsVqJLPENwKKL',
  email: 'raju.debug@gmail.com',
  planId: 'Y6XHXiF9Hmr2z4Bx',
  notes: '2 Day Demo plan activated due to admin account.',
};

export const PRODUCTION_ADMIN_DEMO_SUBSCRIPTION: AdminDemoSubscription = {
  userId: 'j5UMYWkUzmk6nYJY',
  email: 'nikabluishvili123@gmail.com',
  planId: 'MRAZQkgqTEpDDioU',
  notes: '2 Day Demo plan activated due to reseller account',
};

export function getAdminDemoSubscription(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): AdminDemoSubscription | null {
  if (nodeEnv === 'staging') return STAGING_ADMIN_DEMO_SUBSCRIPTION;
  if (nodeEnv === 'production') return PRODUCTION_ADMIN_DEMO_SUBSCRIPTION;
  return null;
}

export function isAdminDemoAccount(
  user: { id: string; email: string },
  config: AdminDemoSubscription,
): boolean {
  return (
    user.id === config.userId &&
    user.email.toLowerCase() === config.email.toLowerCase()
  );
}
