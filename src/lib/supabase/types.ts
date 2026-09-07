/**
 * Hand-authored Supabase schema types for Life OS.
 *
 * This mirrors /supabase/migrations. Once the schema is applied to a live
 * project, regenerate with the Supabase type generator to keep in sync.
 */

// ---- Enums ---------------------------------------------------------------

export type AccountType = "cash" | "ewallet" | "bank" | "savings" | "other";
export type CategoryKind = "income" | "expense";
export type TransactionType = "income" | "expense" | "transfer" | "adjustment";
export type AdjustmentDirection = "in" | "out";
export type BudgetPeriod = "monthly";
export type BillFrequency = "once" | "weekly" | "monthly" | "yearly";
export type LifeArea =
  | "physical"
  | "emotional"
  | "spiritual"
  | "mental"
  | "work"
  | "relationships"
  | "growth";
export type HabitStatus = "completed" | "skipped" | "missed";
export type TaskStatus = "todo" | "done" | "cancelled" | "backlog";
export type CalendarEventKind = "appointment" | "personal" | "work" | "other";
export type WeekStart = "monday" | "sunday";
export type LedgerDirection = "receivable" | "payable";
export type LedgerStatus = "open" | "settled";
export type AssetKind =
  | "property"
  | "investment"
  | "business"
  | "vehicle"
  | "cash"
  | "other";
export type LiabilityKind = "mortgage" | "loan" | "credit_card" | "other";
export type SubscriptionStatus =
  | "inactive"
  | "active"
  | "past_due"
  | "canceled";

// ---- Helpers -------------------------------------------------------------

type Timestamps = {
  created_at: string;
  updated_at: string;
};

type Owned = {
  id: string;
  user_id: string;
};

type TableShape<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

// ---- Row types -----------------------------------------------------------

export type UserRole = "user" | "super_admin";

/**
 * How a super_admin role was granted. "bootstrap" is revoked automatically once
 * the account's email leaves the allow-list; "manual" never is.
 */
export type RoleSource = "bootstrap" | "manual";
export type AccessType = "paid" | "complimentary_pro" | "lifetime_pro";
export type AccountStatus = "active" | "suspended" | "revoked";

export type Profile = {
  id: string;
  user_id: string;
  display_name: string | null;
  currency: string;
  timezone: string;
  week_starts_on: WeekStart;
  onboarded: boolean;
  low_balance_threshold: number;
  role: UserRole;
  username: string | null;
  status: AccountStatus;
  must_change_password: boolean;
  last_login_at: string | null;
  dashboard_prefs: DashboardPrefs;
  role_source: RoleSource | null;
} & Timestamps;

/** Per-user dashboard card visibility. Empty/absent = everything visible. */
export type DashboardPrefs = {
  hidden?: string[];
};

export type Account = Owned & {
  name: string;
  type: AccountType;
  opening_balance: number;
  is_spending: boolean;
  archived: boolean;
  sort_order: number;
  icon: string | null;
  color: string | null;
  low_balance_threshold: number | null;
} & Timestamps;

export type AccountBalance = {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  is_spending: boolean;
  archived: boolean;
  opening_balance: number;
  balance: number;
};

export type Category = Owned & {
  name: string;
  kind: CategoryKind;
  icon: string | null;
  color: string | null;
  is_system: boolean;
  sort_order: number;
} & Timestamps;

export type Transaction = Owned & {
  type: TransactionType;
  amount: number;
  category_id: string | null;
  account_id: string;
  to_account_id: string | null;
  direction: AdjustmentDirection | null;
  occurred_at: string;
  merchant: string | null;
  notes: string | null;
  bill_id: string | null;
  import_batch_id: string | null;
  /** Stable identity of the source statement line; null for manual entries. */
  import_fingerprint: string | null;
} & Timestamps;

/** One uploaded statement file. */
export type ImportBatch = Owned & {
  account_id: string | null;
  source: string;
  filename: string | null;
  row_count: number;
  imported_count: number;
  skipped_count: number;
  created_at: string;
};

export type Budget = Owned & {
  category_id: string;
  amount: number;
  period: BudgetPeriod;
  active: boolean;
  carryover: boolean; // roll unspent budget into the next month
} & Timestamps;

export type MonthlyBudget = Owned & {
  period_start: string; // YYYY-MM-DD (first day of the budget month, local)
  total_amount: number;
  savings_target: number;
} & Timestamps;

/** Per-user learned merchant → category mapping (never shared across users). */
export type MerchantCategory = Owned & {
  merchant_key: string;
  category_id: string;
  hit_count: number;
} & Timestamps;

/** A saved, frequently-used transaction for one-tap re-entry. */
export type TransactionFavorite = Owned & {
  label: string;
  type: "income" | "expense";
  amount: number | null;
  category_id: string | null;
  account_id: string | null;
  merchant: string | null;
  sort_order: number;
} & Timestamps;

export type Bill = Owned & {
  name: string;
  amount: number;
  category_id: string | null;
  account_id: string | null;
  frequency: BillFrequency;
  next_due_date: string;
  remind_days_before: number;
  active: boolean;
  notes: string | null;
} & Timestamps;

export type BillPayment = Owned & {
  bill_id: string;
  transaction_id: string;
  paid_for_date: string;
} & Timestamps;

export type Habit = Owned & {
  name: string;
  life_area: LifeArea;
  schedule_days: number[];
  reminder_time: string | null;
  active: boolean;
  sort_order: number;
  icon: string | null;
  color: string | null;
} & Timestamps;

export type HabitLog = Owned & {
  habit_id: string;
  log_date: string;
  status: HabitStatus;
} & Timestamps;

export type MoodEntry = Owned & {
  entry_date: string;
  mood: number;
  energy: number | null;
  stress: number | null;
  gratitude: string | null;
  wins: string | null;
  struggles: string | null;
  prayer_requests: string | null;
  journal: string | null;
} & Timestamps;

export type Task = Owned & {
  title: string;
  due_date: string | null;
  status: TaskStatus;
  is_priority: boolean;
  priority_date: string | null;
  completed_at: string | null;
  sort_order: number;
  notes: string | null;
} & Timestamps;

export type CalendarEvent = Owned & {
  title: string;
  kind: CalendarEventKind;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  notes: string | null;
  location: string | null;
} & Timestamps;

export type LedgerEntry = Owned & {
  direction: LedgerDirection;
  party: string;
  amount: number;
  due_date: string | null;
  status: LedgerStatus;
  account_id: string | null;
  settled_transaction_id: string | null;
  settled_at: string | null;
  notes: string | null;
} & Timestamps;

export type Asset = Owned & {
  name: string;
  kind: AssetKind;
  value: number;
  notes: string | null;
  sort_order: number;
} & Timestamps;

export type Liability = Owned & {
  name: string;
  kind: LiabilityKind;
  balance: number;
  notes: string | null;
  sort_order: number;
} & Timestamps;

export type SavingsGoal = Owned & {
  name: string;
  target_amount: number;
  saved_amount: number;
  color: string | null;
  notes: string | null;
  sort_order: number;
  target_date: string | null; // YYYY-MM-DD; set → the goal is a sinking fund
} & Timestamps;

export type Subscription = Owned & {
  plan: string;
  status: SubscriptionStatus;
  interval: string | null;
  xendit_customer_id: string | null;
  xendit_plan_id: string | null;
  current_period_end: string | null;
  access_type: AccessType | null;
  access_expires_at: string | null;
  granted_by: string | null;
  /** "Don't renew" — access continues until current_period_end, then lapses. */
  cancel_at_period_end: boolean;
  canceled_at: string | null;
} & Timestamps;

export type FeedbackCategory = "bug" | "feature" | "recommendation" | "other";
export type FeedbackStatus =
  | "new"
  | "under_review"
  | "planned"
  | "in_progress"
  | "completed"
  | "declined";

export type Feedback = Owned & {
  category: FeedbackCategory;
  title: string;
  message: string;
  screenshot_url: string | null;
  status: FeedbackStatus;
  admin_note: string | null;
  admin_response: string | null;
  is_duplicate: boolean;
  archived: boolean;
} & Timestamps;

/** One recorded payment-provider callback, for webhook idempotency. */
export type BillingEvent = {
  id: string;
  provider: string;
  event_id: string;
  external_id: string | null;
  user_id: string | null;
  status: string;
  amount: number | null;
  processed_at: string;
};

export type PromoStatus = "active" | "expired" | "redeemed";

export type PromotionOffer = {
  id: string;
  user_id: string;
  campaign: string;
  started_at: string;
  expires_at: string;
  status: PromoStatus;
  created_at: string;
};

export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";

export type Invitation = {
  id: string;
  email: string;
  full_name: string | null;
  selected_plan: string;
  access_type: AccessType;
  access_expires_at: string | null;
  token_hash: string;
  invitation_expires_at: string;
  status: InvitationStatus;
  invited_by: string | null;
  accepted_by: string | null;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminAuditLog = {
  id: string;
  admin_id: string;
  target_user_id: string | null;
  action: string;
  detail: Record<string, unknown> | null;
  created_at: string;
};

export type FocusSessionType = "focus" | "short_break" | "long_break";

export type FocusSession = Owned & {
  session_type: FocusSessionType;
  task_id: string | null;
  habit_id: string | null;
  planned_minutes: number;
  actual_seconds: number;
  completed: boolean;
  started_at: string;
  completed_at: string | null;
  created_at: string;
};

// ---- Insert / Update helpers --------------------------------------------

// user_id is required on insert; every other column is optional because the
// database supplies defaults (or the column is nullable). App code always
// provides the columns it needs.
type InsertOf<T extends Owned> = { user_id: string } & Partial<
  Omit<T, "user_id">
>;

type UpdateOf<T> = Partial<T>;

// ---- Database ------------------------------------------------------------

export type Database = {
  public: {
    Tables: {
      profiles: TableShape<
        Profile,
        { user_id: string } & Partial<Omit<Profile, "user_id">>,
        Partial<Profile>
      >;
      accounts: TableShape<Account, InsertOf<Account>, UpdateOf<Account>>;
      categories: TableShape<Category, InsertOf<Category>, UpdateOf<Category>>;
      transactions: TableShape<
        Transaction,
        InsertOf<Transaction>,
        UpdateOf<Transaction>
      >;
      budgets: TableShape<Budget, InsertOf<Budget>, UpdateOf<Budget>>;
      monthly_budgets: TableShape<
        MonthlyBudget,
        { user_id: string; period_start: string } & Partial<
          Omit<MonthlyBudget, "user_id" | "period_start">
        >,
        UpdateOf<MonthlyBudget>
      >;
      import_batches: TableShape<
        ImportBatch,
        { user_id: string } & Partial<Omit<ImportBatch, "user_id">>,
        UpdateOf<ImportBatch>
      >;
      merchant_categories: TableShape<
        MerchantCategory,
        { user_id: string; merchant_key: string; category_id: string } & Partial<
          Omit<MerchantCategory, "user_id" | "merchant_key" | "category_id">
        >,
        UpdateOf<MerchantCategory>
      >;
      transaction_favorites: TableShape<
        TransactionFavorite,
        { user_id: string; label: string } & Partial<
          Omit<TransactionFavorite, "user_id" | "label">
        >,
        UpdateOf<TransactionFavorite>
      >;
      bills: TableShape<Bill, InsertOf<Bill>, UpdateOf<Bill>>;
      bill_payments: TableShape<
        BillPayment,
        InsertOf<BillPayment>,
        UpdateOf<BillPayment>
      >;
      habits: TableShape<Habit, InsertOf<Habit>, UpdateOf<Habit>>;
      habit_logs: TableShape<HabitLog, InsertOf<HabitLog>, UpdateOf<HabitLog>>;
      mood_entries: TableShape<
        MoodEntry,
        InsertOf<MoodEntry>,
        UpdateOf<MoodEntry>
      >;
      tasks: TableShape<Task, InsertOf<Task>, UpdateOf<Task>>;
      calendar_events: TableShape<
        CalendarEvent,
        InsertOf<CalendarEvent>,
        UpdateOf<CalendarEvent>
      >;
      ledger_entries: TableShape<
        LedgerEntry,
        InsertOf<LedgerEntry>,
        UpdateOf<LedgerEntry>
      >;
      assets: TableShape<Asset, InsertOf<Asset>, UpdateOf<Asset>>;
      liabilities: TableShape<
        Liability,
        InsertOf<Liability>,
        UpdateOf<Liability>
      >;
      savings_goals: TableShape<
        SavingsGoal,
        InsertOf<SavingsGoal>,
        UpdateOf<SavingsGoal>
      >;
      subscriptions: TableShape<
        Subscription,
        InsertOf<Subscription>,
        UpdateOf<Subscription>
      >;
      focus_sessions: TableShape<
        FocusSession,
        InsertOf<FocusSession>,
        UpdateOf<FocusSession>
      >;
      feedback: TableShape<Feedback, InsertOf<Feedback>, UpdateOf<Feedback>>;
      admin_audit_log: TableShape<
        AdminAuditLog,
        Omit<AdminAuditLog, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        },
        Partial<AdminAuditLog>
      >;
      user_invitations: TableShape<
        Invitation,
        { email: string; token_hash: string; invitation_expires_at: string } & Partial<
          Omit<Invitation, "email" | "token_hash" | "invitation_expires_at">
        >,
        Partial<Invitation>
      >;
      billing_events: TableShape<
        BillingEvent,
        { event_id: string; status: string } & Partial<
          Omit<BillingEvent, "event_id" | "status">
        >,
        Partial<BillingEvent>
      >;
      promotion_offers: TableShape<
        PromotionOffer,
        { user_id: string; expires_at: string } & Partial<
          Omit<PromotionOffer, "user_id" | "expires_at">
        >,
        Partial<PromotionOffer>
      >;
    };
    Views: {
      account_balances: {
        Row: AccountBalance;
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: {
      account_type: AccountType;
      category_kind: CategoryKind;
      transaction_type: TransactionType;
      adjustment_direction: AdjustmentDirection;
      budget_period: BudgetPeriod;
      bill_frequency: BillFrequency;
      life_area: LifeArea;
      habit_status: HabitStatus;
      task_status: TaskStatus;
      calendar_event_kind: CalendarEventKind;
      ledger_direction: LedgerDirection;
      ledger_status: LedgerStatus;
      asset_kind: AssetKind;
      liability_kind: LiabilityKind;
      subscription_status: SubscriptionStatus;
      focus_session_type: FocusSessionType;
      user_role: UserRole;
      access_type: AccessType;
      account_status: AccountStatus;
      feedback_category: FeedbackCategory;
      feedback_status: FeedbackStatus;
      invitation_status: InvitationStatus;
      promo_status: PromoStatus;
    };
  };
};
