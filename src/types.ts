export interface Contact {
  mode: "email" | "sms";
  address: string;
}

export interface Reminder {
  id?: number;
  title: string;
  date: string;
  location?: any;
  description: string;
  reminders: Contact[];
  alerts: number[];
  is_recurring: boolean;
  recurrence?: string;
  start_date?: string;
  end_date?: string;
  last_alert_time?: Date | null;
  is_active?: boolean;
}

export interface IUnprotectedRoute {
  method: string;
  pathname: string;
}
