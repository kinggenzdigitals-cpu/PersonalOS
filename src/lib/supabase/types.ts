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
} & Timestamps;

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
} & Timestamps;

export type Budget = Owned & {
  category_id: string;
  amount: number;
  period: BudgetPeriod;
  active: boolean;
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
    };
  };
};
